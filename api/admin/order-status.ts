import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { canTransition, type OrderStatus } from '../../packages/shared/src';
import { adminDb, HttpError } from '../_lib/firebase';
import { authenticate, requireAdmin, route } from '../_lib/http';
import { notify } from '../_lib/notify';

const schema = z.object({ orderId: z.string(), status: z.enum(['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']) });

export default route('POST', async (req) => {
  const caller = await authenticate(req);
  requireAdmin(caller);
  const { orderId, status } = schema.parse(req.body);
  const db = adminDb();
  const ref = db.doc(`orders/${orderId}`);
  const uid = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const o = s.data();
    if (!o) throw new HttpError(404, 'Order not found.');
    if (!canTransition(o.status as OrderStatus, status)) throw new HttpError(409, `Cannot move an order from ${o.status} to ${status}.`);
    if (status === 'placed' && o.payment?.status !== 'paid_verified' && o.payment?.provider !== 'demo') throw new HttpError(409, 'Payment has not been verified.');
    if (status === 'cancelled') for (const l of o.lines) tx.update(db.doc(`products/${l.sku}`), { stock: FieldValue.increment(l.qty) });
    tx.update(ref, { status, updatedAt: FieldValue.serverTimestamp(), [`history.${Date.now()}`]: { status, by: caller.uid } });
    return { uid: o.uid as string, email: o.email as string | undefined };
  });
  await notify({ uid: uid.uid, email: uid.email, type: 'order', title: `Order ${status}`, body: `Your order ${orderId} is now "${status}".`, link: `/orders/${orderId}` });
  return { ok: true };
});
