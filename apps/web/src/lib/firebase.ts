import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const requiredConfig: Record<string, string | undefined> = {
  VITE_FIREBASE_API_KEY: cfg.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: cfg.authDomain,
  VITE_FIREBASE_PROJECT_ID: cfg.projectId,
  VITE_FIREBASE_APP_ID: cfg.appId,
};

export const missingFirebaseVariables = Object.entries(requiredConfig)
  .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
  .map(([name]) => name);
export const firebaseConfigured = missingFirebaseVariables.length === 0;
export const firebaseConfigError = firebaseConfigured
  ? null
  : `Firebase configuration is incomplete. Missing: ${missingFirebaseVariables.join(', ')}. Configure Vercel Production variables and redeploy.`;

const app = firebaseConfigured ? initializeApp(cfg) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
