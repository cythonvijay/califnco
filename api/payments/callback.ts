import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, HttpError } from '../_lib/firebase';
import { notify } from '../_lib/notify';

function baseUrl(req: VercelRequest) {
  const configured = process.env.APP_BASE_URL?.trim();
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const value = (configured || vercel || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || ''}`).replace(/\/$/, '');
  if (!value.startsWith('https://')) throw new HttpError(503, 'Secure callback URL is not configured.');
  return value;
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export default async function callback(req: VercelRequest, res: VercelResponse) {
  let redirect = '/checkout?payment=verification_failed';
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).send('Method not allowed');
    }
    const q = req.query;
    const paymentId = typeof q.razorpay_payment_id === 'string' ? q.razorpay_payment_id : '';
    const linkId = typeof q.razorpay_payment_link_id === 'string' ? q.razorpay_payment_link_id : '';
    const referenceId = typeof q.razorpay_payment_link_reference_id === 'string' ? q.razorpay_payment_link_reference_id : '';
    const status = typeof q.razorpay_payment_link_status === 'string' ? q.razorpay_payment_link_status : '';
    const signature = typeof q.razorpay_signature === 'string' ? q.razorpay_signature : '';
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!paymentId || !linkId || !referenceId || !status || !signature || !secret) throw new HttpError(400, 'Missing payment callback details.');

    const expected = createHmac('sha256', secret).update(`${linkId}|${referenceId}|${status}|${paymentId}`).digest('hex');
    if (!safeEqualHex(expected, signature)) throw new HttpError(400, 'Payment signature verification failed.');

    const db = adminDb();
    const ref = db.doc(`orders/${referenceId}`);
    const snap = await ref.get();
    const order = snap.data();
    if (!order || order.payment?.razorpayPaymentLinkId !== linkId) throw new HttpError(404, 'Order/payment link does not match.');
    redirect = `/order-confirmation/${referenceId}`;

    // Do not trust only the browser redirect parameters. Fetch the link from
    // Razorpay and verify status + exact amount before marking the order paid.
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) throw new HttpError(503, 'Payment gateway is not configured.');
    const gatewayRes = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(linkId)}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${secret}`).toString('base64') },
    });
    if (!gatewayRes.ok) throw new HttpError(502, 'Could not verify payment with Razorpay.');
    const gateway = await gatewayRes.json() as { id: string; status: string; amount: number; amount_paid: number };
    if (gateway.id !== linkId || gateway.status !== 'paid' || gateway.amount !== order.totals?.totalPaise || gateway.amount_paid !== order.totals?.totalPaise || status !== 'paid') {
      throw new HttpError(400, 'Payment is not fully paid. The order remains unconfirmed.');
    }

    let shouldNotify = false;
    await db.runTransaction(async (tx) => {
      const currentSnap = await tx.get(ref);
      const current = currentSnap.data();
      if (!current || current.payment?.razorpayPaymentLinkId !== linkId) throw new HttpError(404, 'Order/payment link does not match.');
      if (current.payment?.status === 'paid_verified') return;
      tx.update(ref, {
        status: 'placed',
        'payment.status': 'paid_verified',
        'payment.razorpayPaymentId': paymentId,
        'payment.razorpayPaymentLinkStatus': gateway.status,
        updatedAt: FieldValue.serverTimestamp(),
      });
      shouldNotify = true;
    });
    if (shouldNotify) await notify({ uid: order.uid, email: order.email ?? undefined, type: 'order', title: 'Payment verified', body: `Order ${referenceId} is confirmed.`, link: `/orders/${referenceId}` });
  } catch (e) {
    console.error('Razorpay callback verification failed:', e instanceof Error ? e.message : 'Unknown error');
  }
  try {
    return res.redirect(303, `${baseUrl(req)}${redirect}`);
  } catch {
    return res.status(500).send('Payment callback could not complete. Please return to CALIFNCO and check your order status.');
  }
}
