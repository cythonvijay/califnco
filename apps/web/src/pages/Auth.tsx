import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { registerSchema } from '@califnco/shared';
import { Field, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';

const friendly = (e: unknown) => {
  const c = (e as { code?: string })?.code ?? '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) {
    return 'Incorrect email or password.';
  }
  if (c.includes('email-already-in-use')) return 'An account with this email already exists.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
  if (c.includes('network')) return 'Network error. Check your connection.';
  return (e as Error)?.message ?? 'Sign in failed. Please try again.';
};

function PasswordInput({ value, onChange, autoComplete, placeholder, required = true }: { value: string; onChange: (value: string) => void; autoComplete: string; placeholder?: string; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        style={{ width: '100%', paddingRight: 48 }}
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((v) => !v)}
        style={{ position: 'absolute', zIndex: 2, right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: '#ffffff', color: 'var(--navy)', cursor: 'pointer', padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 6 }}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9 4.5 10 7-.4 1-1.3 2.2-2.5 3.3"/><path d="M6.2 6.2C3.8 7.7 2.4 10 2 12c1 2.5 4.8 7 10 7 1.2 0 2.3-.2 3.3-.6"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  );
}

export function LoginForm({ expect, onDone }: { expect?: 'dealer' | 'admin'; onDone?: () => void }) {
  const { login, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const role = await login(email.trim(), pw);
      if (expect === 'admin' && role !== 'admin') {
        await logout();
        setErr('Access denied: This account does not have administrator permissions.');
        return;
      }
      if (onDone) {
        onDone();
      } else {
        const dest = (loc.state as { from?: string } | null)?.from ?? (role === 'admin' ? '/admin' : role === 'dealer' ? '/dealer' : '/');
        nav(dest, { replace: true });
      }
    } catch (x) {
      setErr(friendly(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Email address">
        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field label="Password">
        <PasswordInput value={pw} onChange={setPw} autoComplete="current-password" placeholder="Enter your password" />
      </Field>
      {err && <Notice kind="bad">{err}</Notice>}
      <button type="submit" className="btn lg" style={{ width: '100%' }} disabled={busy || !email || !pw}>
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}

const Shell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="wrap" style={{ maxWidth: 440, margin: '48px auto' }}>
    <div className="card pad">
      <div style={{ marginBottom: 20 }}>
        <Link to="/" className="brand-logo" style={{ marginBottom: 16 }}>
          <span className="brand-wordmark">CALIFNCO</span>
          <span className="brand-sub">Water Systems</span>
        </Link>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
);

export const Login = () => (
  <Shell
    title="Sign in"
    subtitle="View your orders, scheduled service visits, and saved addresses."
  >
    <LoginForm />
    <div className="row spread" style={{ marginTop: 18, fontSize: 13.5 }}>
      <Link to="/reset" style={{ color: 'var(--navy)', fontWeight: 600 }}>
        Forgot password?
      </Link>
      <span>
        New customer?{' '}
        <Link to="/register" style={{ color: 'var(--navy)', fontWeight: 700 }}>
          Create account
        </Link>
      </span>
    </div>
  </Shell>
);

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [v, setV] = useState({ displayName: '', email: '', phone: '', password: '' });
  const [dealerApplication, setDealerApplication] = useState(false);
  const [gstin, setGstin] = useState('');
  const [submittedDealer, setSubmittedDealer] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = registerSchema.safeParse(v);
    if (!p.success) {
      const m: Record<string, string> = {};
      p.error.issues.forEach((i) => {
        m[String(i.path[0])] ??= i.message;
      });
      setErrs(m);
      return;
    }
    setErrs({});
    setErr(null);
    setBusy(true);
    try {
      if (dealerApplication && !/^[0-9A-Z]{15}$/.test(gstin.trim().toUpperCase())) {
        setErrs({ gstin: 'Enter a valid 15-character GSTIN.' });
        return;
      }
      await register({ ...p.data, referredBy: sp.get('ref') ?? undefined, dealerApplication, gstin: gstin.trim().toUpperCase() });
      if (dealerApplication) {
        setSubmittedDealer(true);
      } else {
        nav('/', { replace: true });
      }
    } catch (x) {
      setErr(friendly(x));
    } finally {
      setBusy(false);
    }
  }

  const s = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  return (
    <Shell
      title={submittedDealer ? 'Dealer application submitted' : 'Create account'}
      subtitle={submittedDealer ? 'Your application is waiting for admin review.' : 'Track orders, book installation, and manage filter replacements.'}
    >
      {submittedDealer ? (
        <>
          <Notice kind="ok">Your account has been created and your dealer application has been sent to the admin for approval. You cannot sign in until it is approved.</Notice>
          <Link className="btn lg" style={{ width: '100%', textAlign: 'center', marginTop: 16 }} to="/login">Go to Sign in</Link>
        </>
      ) : <form onSubmit={submit} noValidate>
        <Field label="Full name" error={errs.displayName}>
          <input value={v.displayName} onChange={s('displayName')} autoComplete="name" placeholder="Asha Rao" />
        </Field>
        <Field label="Email address" error={errs.email}>
          <input type="email" value={v.email} onChange={s('email')} autoComplete="email" placeholder="asha@example.com" />
        </Field>
        <Field label="Mobile number (10 digits)" error={errs.phone}>
          <input inputMode="numeric" maxLength={10} value={v.phone} onChange={s('phone')} placeholder="9876543210" />
        </Field>
        <Field label="Password" hint="At least 8 characters with a letter and a number" error={errs.password}>
          <PasswordInput value={v.password} onChange={(value) => setV({ ...v, password: value })} autoComplete="new-password" placeholder="Create a password" />
        </Field>
        <label className="row" style={{ alignItems: 'flex-start', gap: 10, margin: '8px 0 16px', cursor: 'pointer' }}>
          <input type="checkbox" checked={dealerApplication} onChange={(e) => setDealerApplication(e.target.checked)} style={{ marginTop: 4 }} />
          <span>
            <b>I want to register as a dealer</b>
            <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 3 }}>Dealer access requires admin approval. Leave unchecked for a regular customer account.</span>
          </span>
        </label>
        {dealerApplication && (
          <Field label="GST Number (GSTIN)" hint="Enter your 15-character GSTIN as printed on your GST registration certificate." error={errs.gstin}>
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
              autoComplete="off"
              maxLength={15}
              placeholder="e.g. 22AAAAA0000A1Z5"
              required
              aria-invalid={Boolean(errs.gstin)}
            />
          </Field>
        )}
        {sp.get('ref') && <Notice kind="info">Referral code applied: <b>{sp.get('ref')}</b></Notice>}
        {err && <Notice kind="bad">{err}</Notice>}
        <button type="submit" className="btn lg" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Creating account...' : 'Create Account'}
        </button>
        <p className="muted" style={{ marginTop: 16, marginBottom: 0, textAlign: 'center', fontSize: 13.5 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--navy)', fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
      </form>}
    </Shell>
  );
}

export function Reset() {
  const { reset } = useAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Shell title="Reset password" subtitle="Enter your email address to receive a password reset link.">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await reset(email.trim());
            setDone(true);
          } catch (x) {
            setErr(friendly(x));
          }
        }}
      >
        <Field label="Email address">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        {done && <Notice kind="ok">If an account exists for {email}, a reset link has been sent.</Notice>}
        {err && <Notice kind="bad">{err}</Notice>}
        <button type="submit" className="btn" style={{ width: '100%' }} disabled={!email}>
          Send Reset Link
        </button>
        <p className="muted" style={{ marginTop: 14, marginBottom: 0, textAlign: 'center', fontSize: 13.5 }}>
          <Link to="/login" style={{ color: 'var(--navy)', fontWeight: 600 }}>
            &larr; Back to sign in
          </Link>
        </p>
      </form>
    </Shell>
  );
}
