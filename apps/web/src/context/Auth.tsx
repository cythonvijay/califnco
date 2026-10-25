import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveEffectiveRole, roleFromClaims, type Role } from '@califnco/shared';
import { auth, db, firebaseConfigured, firebaseConfigError } from '../lib/firebase';
import { DB_CHANGE_EVENT, loadLocalDb, saveLocalDb, type CallerIdentity } from '../lib/api';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface Ctx {
  user: AppUser | null;
  role: Role;
  caller: CallerIdentity | null;
  loading: boolean;
  register(i: { displayName: string; email: string; phone: string; password: string; referredBy?: string; dealerApplication?: boolean; gstin?: string }): Promise<void>;
  login(email: string, password: string): Promise<Role>;
  logout(): Promise<void>;
  reset(email: string): Promise<void>;
  refreshRole(): Promise<Role>;
}

const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
};

const LOCAL_SESSION_KEY = 'califnco.auth.session.v2';

function assertFirebaseAvailableForProduction(): void {
  if (import.meta.env.PROD && (!firebaseConfigured || !auth || !db)) {
    throw new Error(
      firebaseConfigError ??
        'Firebase is unavailable in this production build. Verify VITE_FIREBASE_* variables in Vercel and redeploy.',
    );
  }
}

function loadLocalSession(): { uid: string } | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? (JSON.parse(raw) as { uid: string }) : null;
  } catch {
    return null;
  }
}

async function resolveFirebaseRole(u: User, forceRefresh = false): Promise<Role> {
  const tokenRes = await u.getIdTokenResult(forceRefresh);
  let resolved = roleFromClaims(tokenRes.claims);
  if (resolved === 'customer' && db) {
    try {
      const snap = await getDoc(doc(db, 'users', u.uid));
      resolved = resolveEffectiveRole(tokenRes.claims, snap.data() as Record<string, unknown> | undefined);
    } catch {
      // Keep claim-resolved role
    }
  }
  return resolved;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<Role>('customer');
  const [loading, setLoading] = useState<boolean>(true);

  const syncLocalUser = useCallback(() => {
    if (firebaseConfigured && auth && db) return;
    if (import.meta.env.PROD) {
      setUser(null);
      setRole('customer');
      setLoading(false);
      return;
    }
    const sess = loadLocalSession();
    if (!sess) {
      setUser(null);
      setRole('customer');
      setLoading(false);
      return;
    }
    const state = loadLocalDb();
    const u = state.users[sess.uid];
    if (!u) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setUser(null);
      setRole('customer');
      setLoading(false);
      return;
    }
    setUser({ uid: u.id, email: u.email, displayName: u.displayName });
    setRole(u.role ?? 'customer');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (firebaseConfigured && auth) {
      return onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setUser(null);
          setRole('customer');
          setLoading(false);
          return;
        }
        try {
          const r = await resolveFirebaseRole(u, false);
          setUser({ uid: u.uid, email: u.email, displayName: u.displayName });
          setRole(r);
        } catch (error) {
          // Keep a valid Firebase session usable as a customer if role metadata cannot be refreshed.
          // Never leave the entire app stuck in its initial loading state.
          console.error('Could not resolve account role:', error);
          setUser({ uid: u.uid, email: u.email, displayName: u.displayName });
          setRole('customer');
        } finally {
          setLoading(false);
        }
      });
    }

    syncLocalUser();
    const onStorage = () => syncLocalUser();
    window.addEventListener('storage', onStorage);
    window.addEventListener(DB_CHANGE_EVENT, onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(DB_CHANGE_EVENT, onStorage);
    };
  }, [syncLocalUser]);

  const refreshRole = useCallback(async (): Promise<Role> => {
    if (firebaseConfigured && auth?.currentUser) {
      const r = await resolveFirebaseRole(auth.currentUser, true);
      setRole(r);
      return r;
    }
    if (import.meta.env.PROD) {
      assertFirebaseAvailableForProduction();
      setRole('customer');
      return 'customer';
    }
    const sess = loadLocalSession();
    if (!sess) return 'customer';
    const state = loadLocalDb();
    const r = state.users[sess.uid]?.role ?? 'customer';
    setRole(r);
    return r;
  }, []);

  const caller = useMemo<CallerIdentity | null>(
    () => (user ? { uid: user.uid, email: user.email, displayName: user.displayName, role } : null),
    [user, role],
  );

  const value = useMemo<Ctx>(
    () => ({
      user,
      role,
      caller,
      loading,
      refreshRole,
      async register({ displayName, email, phone, password, referredBy, dealerApplication = false, gstin = '' }) {
        const cleanEmail = email.trim().toLowerCase();
        if (firebaseConfigured && auth && db) {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          await updateProfile(cred.user, { displayName: displayName.trim() });
          await setDoc(doc(db, 'users', cred.user.uid), {
            displayName: displayName.trim(),
            email: cleanEmail,
            phone: phone.trim(),
            createdAt: serverTimestamp(),
            prefs: { email: true, push: false, sms: false },
            referralCode: cred.user.uid.slice(0, 8).toUpperCase(),
            ...(referredBy ? { referredBy } : {}),
          });
          if (dealerApplication) {
            await setDoc(doc(db, 'dealerApplications', cred.user.uid), {
              uid: cred.user.uid,
              businessName: displayName.trim(),
              gstin: gstin.trim().toUpperCase(),
              phone: phone.trim(),
              city: '',
              status: 'pending',
              createdAt: serverTimestamp(),
            });
            await signOut(auth);
            setUser(null);
            setRole('customer');
            return;
          }
          return;
        }

        assertFirebaseAvailableForProduction();
        // Local Persistence Mode registration is allowed only in development.
        const state = loadLocalDb();
        const exists = Object.values(state.users).some((u) => u.email.toLowerCase() === cleanEmail);
        if (exists) {
          const err = new Error('An account with this email already exists.') as Error & { code?: string };
          err.code = 'auth/email-already-in-use';
          throw err;
        }
        const uid = `usr_${Date.now().toString(36)}`;
        state.users[uid] = {
          id: uid,
          uid,
          displayName: displayName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          role: 'customer',
          referralCode: uid.slice(-8).toUpperCase(),
          ...(referredBy ? { referredBy } : {}),
          prefs: { email: true, push: false, sms: false },
          createdAt: Date.now(),
          password,
        };
        if (dealerApplication) {
          state.dealerApplications[uid] = {
            id: uid, uid, businessName: displayName.trim(), gstin: gstin.trim().toUpperCase(), phone: phone.trim(), city: '',
            status: 'pending', createdAt: Date.now(),
          };
        }
        saveLocalDb(state);
        if (!dealerApplication) {
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ uid }));
          setUser({ uid, email: cleanEmail, displayName: displayName.trim() });
          setRole('customer');
        }
      },
      async login(email, password) {
        const cleanEmail = email.trim().toLowerCase();
        if (firebaseConfigured && auth) {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
          // Resolve trusted role first. Dealer approval must never block an administrator,
          // even if a stale dealerApplications document exists for the same UID.
          const r = await resolveFirebaseRole(cred.user, true);
          if (db && r !== 'admin') {
            const application = await getDoc(doc(db, 'dealerApplications', cred.user.uid));
            if (application.exists()) {
              const status = String(application.data().status ?? 'pending');
              if (status !== 'approved') {
                await signOut(auth);
                const message = status === 'rejected'
                  ? 'Your dealer application was not approved by the admin. Please contact CALIFNCO support.'
                  : 'Your dealer account is awaiting admin approval. You can sign in after it is approved.';
                throw new Error(message);
              }
            }
          }
          setUser({ uid: cred.user.uid, email: cred.user.email, displayName: cred.user.displayName });
          setRole(r);
          return r;
        }

        assertFirebaseAvailableForProduction();
        // Local Persistence Mode login is allowed only in development.
        const state = loadLocalDb();
        const match = Object.values(state.users).find((u) => u.email.toLowerCase() === cleanEmail);
        if (!match || (match.password && match.password !== password)) {
          const err = new Error('Incorrect email or password.') as Error & { code?: string };
          err.code = 'auth/invalid-credential';
          throw err;
        }
        const application = state.dealerApplications[match.id];
        if (match.role !== 'admin' && application && application.status !== 'approved') {
          const err = new Error(application.status === 'rejected'
            ? 'Your dealer application was not approved by the admin. Please contact CALIFNCO support.'
            : 'Your dealer account is awaiting admin approval. You can sign in after it is approved.');
          (err as Error & { code?: string }).code = 'auth/dealer-pending';
          throw err;
        }
        const r: Role = match.role ?? 'customer';
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ uid: match.id }));
        setUser({ uid: match.id, email: match.email, displayName: match.displayName });
        setRole(r);
        return r;
      },
      async logout() {
        if (firebaseConfigured && auth) {
          await signOut(auth);
        }
        try {
          localStorage.removeItem(LOCAL_SESSION_KEY);
        } catch {
          // ignore
        }
        setUser(null);
        setRole('customer');
      },
      async reset(email) {
        if (firebaseConfigured && auth) {
          await sendPasswordResetEmail(auth, email.trim());
          return;
        }
        assertFirebaseAvailableForProduction();
        const state = loadLocalDb();
        const match = Object.values(state.users).find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!match && !email.includes('@')) {
          throw new Error('Enter a valid email address.');
        }
      },
    }),
    [user, role, caller, loading, refreshRole],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
