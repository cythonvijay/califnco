import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { computeTotals, effectiveRetailPaise, isProductPublished, orderRequestSchema, validateLines, type PricedLine, type Product } from '../../packages/shared/src';
import { adminDb, HttpError } from '../_lib/firebase';
import { authenticate, route } from '../_lib/http';

type RazorpayCredentials = { id: string; secret: string; mode: 'test' | 'live' };

const rzp = (): RazorpayCredentials | null => {
  const id = process.env.RAZORPAY_KEY_ID?.trim() ?? '';
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? '';
  const mode = id.startsWith('rzp_test_') ? 'test' : id.startsWith('rzp_live_') ? 'live' : null;
  return mode && secret ? { id, secret, mode } : null;
};

function isProductionDeployment() {
  return process.env.VERCEL_ENV === 'production';
}

function publicBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const value = (configured || vercel).replace(/\/$/, '');
  if (!value || !value.startsWith('https://')) throw new HttpError(503, 'Payment callback is not configured. Set APP_BASE_URL to the public HTTPS site URL.');
  return value;
}

async function createRazorpayPaymentLink(baseUrl: string, amount: number, orderId: string, k: RazorpayCredentials, customer: { name?: string; email?: string; contact?: string }) {
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
  const responseBody = await r.json().catch(() => null) as
    | { error?: { code?: unknown; description?: unknown; field?: unknown } }
    | null;
  if (!r.ok) {
    const code = typeof responseBody?.error?.code === 'string'
      ? responseBody.error.code
      : 'RAZORPAY_API_ERROR';
    const description = typeof responseBody?.error?.description === 'string'
      ? responseBody.error.description.replace(/[\\r\\n]+/g, ' ').slice(0, 280)
      : 'Razorpay returned an error without a description.';
    // Never log or return credentials. These fields are Razorpay's non-secret diagnostic response.
    console.error('Razorpay payment-link creation failed', {
      httpStatus: r.status,
      code,
      description,
      field: typeof responseBody?.error?.field === 'string' ? responseBody.error.field : undefined,
      mode: k.mode,
    });
    throw new HttpError(
      502,
      `Razorpay rejected payment-link creation (HTTP ${r.status}, ${code}): ${description}. Check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are the matching active keys from the same Razorpay mode/account.`,
    );
  }

  const data = responseBody as unknown as { id?: string; short_url?: string; status?: string; amount?: number };
  if (!data?.id || !data.short_url) {
    console.error('Razorpay payment-link response was missing id/short_url', { httpStatus: r.status });
    throw new HttpError(502, 'Razorpay returned a successful response without a payment-link URL. Check the Razorpay dashboard and server logs before retrying.');
  }
  return data as { id: string; short_url: string; status: string; amount: number };
}

export default route('POST', async (req) => {
  const caller = await authenticate(req);
  const body = orderRequestSchema.parse(req.body);
  // Admins shop as customers; only a verified dealer claim yields wholesale pricing.
  const role = caller.role === 'dealer' ? 'dealer' : 'customer';
  const errs = validateLines(body.lines, role);
  if (errs.length) throw new HttpError(400, errs[0]!.message);

  const key = rzp();
  if (isProductionDeployment() && !key) {
    throw new HttpError(
      503,
      'Razorpay is not configured for this production deployment. Set RAZORPAY_KEY_ID to a valid rzp_test_ or rzp_live_ key and set the matching RAZORPAY_KEY_SECRET. No demo order was created.',
    );
  }
  // Validate callback configuration before changing stock or creating an order.
  const callbackBase = key ? publicBaseUrl() : null;

  const db = adminDb();
  // Deterministic ID => a retry or double click with the same key can never create a second order.
  const orderId = 'ord_' + createHash('sha256').update(`${caller.uid}:${body.idempotencyKey}`).digest('hex').slice(0, 24);
  const ref = db.doc(`orders/${orderId}`);

  const transactionResult = await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return { order: existing.data() as Record<string, any>, created: false };
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
    const document = {
      uid: caller.uid, email: caller.email ?? null, role, lines: priced, totals, address: body.address,
      status: key ? 'pending_payment' : 'placed',
      payment: key
        ? { provider: `razorpay_payment_link_${key.mode}`, status: 'pending' }
        : { provider: 'demo', status: 'demo_unverified' },
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, document);
    return { order: document as Record<string, any>, created: true };
  });

  const order = transactionResult.order;
  const created = transactionResult.created;
  let paymentLink: { id: string; short_url: string } | undefined = order.payment?.razorpayPaymentLinkId && order.payment?.paymentUrl
    ? { id: order.payment.razorpayPaymentLinkId, short_url: order.payment.paymentUrl }
    : undefined;
  if (key && order.status === 'pending_payment' && !paymentLink) {
    let link: { id: string; short_url: string };
    try {
      link = await createRazorpayPaymentLink(callbackBase!, order.totals.totalPaise, orderId, key, {
        name: body.address.fullName, email: caller.email, contact: body.address.phone,
      });
    } catch (gatewayError) {
      // A failed payment-link request must not leave a pending order consuming stock.
      // Existing pending orders without a stored link are also cleaned up on retry.
      try {
        await db.runTransaction(async (tx) => {
          const currentSnap = await tx.get(ref);
          const current = currentSnap.data();
          if (!currentSnap.exists || !current) return;

          // Another concurrent request may already have attached a valid payment link.
          if (current.payment?.paymentUrl || current.payment?.status === 'paid_verified') return;

          const productSnaps = await Promise.all(
            body.lines.map((line) => tx.get(db.doc(`products/${line.sku}`))),
          );

          body.lines.forEach((line, index) => {
            const productSnap = productSnaps[index]!;
            if (productSnap.exists) {
              tx.update(productSnap.ref, { stock: FieldValue.increment(line.qty) });
            }
          });
          tx.delete(ref);
        });
      } catch (rollbackError) {
        console.error('Failed to release stock after Razorpay link creation failed', {
          orderId,
          error: rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error',
        });
      }
      throw gatewayError;
    }

    paymentLink = { id: link.id, short_url: link.short_url };
    await ref.update({
      'payment.razorpayPaymentLinkId': link.id,
      'payment.paymentUrl': link.short_url,
      'payment.provider': `razorpay_payment_link_${key.mode}`,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (created && !key) {
    const { notify } = await import('../_lib/notify');
    await notify({ uid: caller.uid, email: caller.email, type: 'order', title: 'Demo order placed', body: `Order ${orderId} was placed using the demo checkout. No payment was taken.`, link: `/orders/${orderId}` });
  }
  return {
    orderId, mode: key ? `razorpay_payment_link_${key.mode}` : 'demo', totalPaise: order.totals.totalPaise,
    paymentUrl: key ? paymentLink?.short_url ?? null : null,
  };
});
