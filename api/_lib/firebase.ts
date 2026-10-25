import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function init() {
  if (getApps().length) return getApps()[0]!;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new HttpError(503, 'Backend not configured: FIREBASE_SERVICE_ACCOUNT_B64 is missing.');
  return initializeApp({ credential: cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
}
export const adminDb = () => getFirestore(init());
export const adminAuth = () => getAuth(init());

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
