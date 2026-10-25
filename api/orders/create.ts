import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { computeTotals, effectiveRetailPaise, isProductPublished, orderRequestSchema, validateLines, type PricedLine, type Product } from '../../packages/shared/src';
import { adminDb, HttpError } from '../_lib/firebase';
import { authenticate, route } from '../_lib/http';

const rzp = () => (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && process.env.RAZORPAY_KEY_SECRET ? { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET } : null);

function publicBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const value = (configured || vercel).replace(/\/$/, '');
  if (!value || !value.startsWith('https://')) throw new HttpError(503, 'Payment callback is not configured. Set APP_BASE_URL to the public HTTPS site URL.');
  return value;
}

async function createRazorpayPaymentLink(amount: number, orderId: string, k: { id: string; secret: string }, customer: { name?: string; email?: string; contact?: string }) {
  const baseUrl = publicBaseUrl();
  const r = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${k.id}:${k.secret}`).toString('base64') },
    body: JSON.stringify({
      amount, currency: 'INR', accept_partial: false, reference_id: orderId,
      description: `CALIFNCO order ${orderId}`, customer,
      notify: { sms: false, email: false }, reminder_enable: false,
      callback_url: `${baseUrl}/api/payments/callback`, callback_method: 'get',
    }),
  });
  if (!r.ok) throw new HttpError(502, 'Razorpay could not create the payment link. Your order is saved as pending payment; retry checkout.');
  return (await r.json()) as { id: string; short_url: string; status: string; amount: number };
}

export default route('POST', async (req) => {
  const caller = await authenticate(req);
  const body = orderRequestSchema.parse(req.body);
  // Admins shop as customers; only a verified dealer claim yields wholesale pricing.
  const role = caller.role === 'dealer' ? 'dealer' : 'customer';
  const errs = validateLines(body.lines, role);
  if (errs.length) throw new HttpError(400, errs[0]!.message);

  const db = adminDb();
  // Deterministic ID => a retry or double click with the same key can never create a second order.
  const orderId = 'ord_' + createHash('sha256').update(`${caller.uid}:${body.idempotencyKey}`).digest('hex').slice(0, 24);
  const ref = db.doc(`orders/${orderId}`);

  let created = false;
  const order = await db.runTransaction(async (tx) => {
    const existing = await ref.get();
    if (existing.exists) return existing.data()!;
    const priced: PricedLine[] = [];
    const prodSnaps = await Promise.all(body.lines.map((l) => tx.get(db.doc(`products/${l.sku}`))));
    const dealerSnaps = role === 'dealer' ? await Promise.all(body.lines.map((l) => tx.get(db.doc(`dealerPrices/${l.sku}`)))) : [];
    body.lines.forEach((l, i) => {
      const p = prodSnaps[i]!.data() as Product | undefined;
      if (!p || !isProductPublished(p)) throw new HttpError(400, `Product ${l.sku} is not available for purchase.`);
      if (p.stock < l.qty) throw new HttpError(409, `Only ${p.stock} units of ${p.name} in stock.`);
      const retailUnit = effectiveRetailPaise(p);
      const unit = role === 'dealer' ? ((dealerSnaps[i]!.data()?.pricePaise as number | undefined) ?? p.wholesalePricePaise ?? retailUnit) : retailUnit;
      if (!unit || unit <= 0) throw new HttpError(400, `No valid price available for ${l.sku}.`);
      priced.push({ sku: l.sku, name: p.name, qty: l.qty, unitPaise: unit, image: p.image, imageAlt: p.imageAlt });
    });
    body.lines.forEach((l, i) => tx.update(prodSnaps[i]!.ref, { stock: FieldValue.increment(-l.qty) }));
    const totals = computeTotals(priced, role);
    const key = rzp();
    const doc = {
      uid: caller.uid, email: caller.email ?? null, role, lines: priced, totals, address: body.address,
      status: key ? 'pending_payment' : 'placed',
      payment: key ? { provider: 'razorpay_payment_link_test', status: 'pending' } : { provider: 'demo', status: 'demo_unverified' },
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, doc);
    created = true;
    return doc as Record<string, any>;
  });

  const key = rzp();
  let paymentLink: { id: string; short_url: string } | undefined = order.payment?.razorpayPaymentLinkId && order.payment?.paymentUrl
    ? { id: order.payment.razorpayPaymentLinkId, short_url: order.payment.paymentUrl }
    : undefined;
  if (key && order.status === 'pending_payment' && !paymentLink) {
    const link = await createRazorpayPaymentLink(order.totals.totalPaise, orderId, key, {
      name: body.address.fullName, email: caller.email, contact: body.address.phone,
    });
    paymentLink = { id: link.id, short_url: link.short_url };
    await ref.update({
      'payment.razorpayPaymentLinkId': link.id,
      'payment.paymentUrl': link.short_url,
      'payment.provider': 'razorpay_payment_link_test',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (created && !key) {
    const { notify } = await import('../_lib/notify');
    await notify({ uid: caller.uid, email: caller.email, type: 'order', title: 'Demo order placed', body: `Order ${orderId} was placed using the demo checkout. No payment was taken.`, link: `/orders/${orderId}` });
  }
  return {
    orderId, mode: key ? 'razorpay_payment_link_test' : 'demo', totalPaise: order.totals.totalPaise,
    paymentUrl: key ? paymentLink?.short_url ?? null : null,
  };
});
