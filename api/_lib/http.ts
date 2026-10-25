import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { resolveEffectiveRole, roleFromClaims, type Role } from '../../packages/shared/src';
import { adminAuth, adminDb, HttpError } from './firebase';

export interface Caller { uid: string; email?: string; role: Role }

export async function authenticate(req: VercelRequest): Promise<Caller> {
  const h = req.headers.authorization ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in required.');
  try {
    const d = await adminAuth().verifyIdToken(token, true);
    let role = roleFromClaims(d);
    if (role === 'customer') {
      try {
        const userSnap = await adminDb().doc(`users/${d.uid}`).get();
        role = resolveEffectiveRole(d, userSnap.data());
      } catch {
        // Fallback to token claim if Firestore profile lookup fails
      }
    }
    return { uid: d.uid, email: d.email, role };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new HttpError(401, 'AUTH_DEBUG: ' + msg);
  }
}
export function requireAdmin(c: Caller) { if (c.role !== 'admin') throw new HttpError(403, 'Admin access required.'); }

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;
export const route = (method: 'POST', fn: Handler) => async (req: VercelRequest, res: VercelResponse) => {
  try {
    if (req.method !== method) { res.setHeader('Allow', method); return res.status(405).json({ error: 'Method not allowed' }); }
    const out = await fn(req, res);
    if (!res.writableEnded) res.status(200).json(out);
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    if (e instanceof ZodError) return res.status(400).json({ error: e.issues[0]?.message ?? 'Invalid request', issues: e.issues });
    console.error('UNHANDLED_ERROR:', e instanceof Error ? e.message : e);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
};