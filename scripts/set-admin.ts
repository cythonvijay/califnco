/* Usage: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json FIREBASE_PROJECT_ID=xxx npm run set-admin -- admin@example.com
   The user must already exist (register through the app first). Sets custom claim role=admin and updates users/{uid}. */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const email = process.argv[2];
if (!email) {
  console.error('Provide the email of an existing user.');
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
(async () => {
  const u = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(u.uid, { ...(u.customClaims ?? {}), role: 'admin' });
  await getAuth().revokeRefreshTokens(u.uid);
  await getFirestore().doc(`users/${u.uid}`).set({ email: u.email, role: 'admin' }, { merge: true });
  console.log(`${email} is now an admin (custom claim + Firestore profile synced). Sign in again to refresh token.`);
})();
