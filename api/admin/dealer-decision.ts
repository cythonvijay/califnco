import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb, HttpError } from '../_lib/firebase';
import { authenticate, requireAdmin, route } from '../_lib/http';
import { notify } from '../_lib/notify';

const schema = z.object({ uid: z.string().min(1), decision: z.enum(['approved', 'rejected']) });

export default route('POST', async (req) => {
  const caller = await authenticate(req);
  requireAdmin(caller);
  const { uid, decision } = schema.parse(req.body);
  const db = adminDb();
  const ref = db.doc(`dealerApplications/${uid}`);
  const app = await ref.get();
  if (!app.exists) throw new HttpError(404, 'Application not found.');
  const user = await adminAuth().getUser(uid);
  const existing = user.customClaims ?? {};
  if (existing.role === 'admin') throw new HttpError(409, 'Cannot change the role of an admin.');
  const nextRole = decision === 'approved' ? 'dealer' : undefined;
  await adminAuth().setCustomUserClaims(uid, { ...existing, role: nextRole });
  await adminAuth().revokeRefreshTokens(uid);
  await db.doc(`users/${uid}`).set({ role: decision === 'approved' ? 'dealer' : 'customer' }, { merge: true });
  await ref.update({ status: decision, decidedBy: caller.uid, decidedAt: FieldValue.serverTimestamp() });
  await notify({
    uid,
    email: user.email,
    type: 'dealer',
    title: decision === 'approved' ? 'Dealer account approved' : 'Dealer application update',
    body:
      decision === 'approved'
        ? 'Your dealer account is approved. Sign in via the Dealer Portal to access wholesale pricing.'
        : 'We could not approve your dealer application at this time.',
    link: '/dealer',
  });
  return { ok: true };
});
