import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AccessErrorKind } from '../lib/api';

export const Notice = ({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'warn' | 'bad' | 'ok';
  children: ReactNode;
}) => (
  <div className={`notice ${kind === 'info' ? '' : kind}`} role={kind === 'bad' ? 'alert' : 'status'}>
    {children}
  </div>
);

export const Empty = ({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="card pad" style={{ textAlign: 'center', padding: '40px 24px' }}>
    <h3 style={{ fontSize: '1.2rem', marginBottom: 8 }}>{title}</h3>
    {children && <div className="muted" style={{ maxWidth: 460, margin: '0 auto 16px' }}>{children}</div>}
    {action && <div style={{ marginTop: 12 }}>{action}</div>}
  </div>
);

export const Loading = ({ label = 'Loading content...' }: { label?: string }) => (
  <div className="skeleton" aria-busy="true" aria-label={label} style={{ padding: 24, display: 'grid', placeItems: 'center' }}>
    <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
  </div>
);

export const DemoBadge = () => (
  <span className="tag warn" title="Legacy seeded demonstration entry">
    Demo record
  </span>
);

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="f">
      <span>{label}</span>
      {children}
      {hint && !error && <div className="field-hint">{hint}</div>}
      {error && <div className="err">{error}</div>}
    </label>
  );
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open && typeof d.showModal === 'function') d.showModal();
    if (!open && d.open && typeof d.close === 'function') d.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog ref={ref} onCancel={onCancel}>
      <h3 style={{ fontSize: '1.15rem' }}>{title}</h3>
      <p className="muted" style={{ marginBottom: 20 }}>{body}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={`btn sm ${danger ? 'danger' : ''}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage(n: number): void }) {
  if (pages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'center', margin: '24px 0' }}>
      <button type="button" className="btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        &larr; Previous
      </button>
      <span className="muted" style={{ fontSize: 13.5, fontWeight: 600 }}>
        Page {page} of {pages}
      </span>
      <button type="button" className="btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next &rarr;
      </button>
    </div>
  );
}

export const paginate = <T,>(items: T[], page: number, size: number) =>
  items.slice((page - 1) * size, page * size);

/** Product image with local fallback and fixed dimensions to prevent layout shift. */
export function Img({
  src,
  alt,
  className,
  size,
  eager,
}: {
  src: string;
  alt: string;
  className?: string;
  size?: number;
  eager?: boolean;
}) {
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      width={size ?? 400}
      height={size ?? 400}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={(e) => {
        const t = e.currentTarget;
        if (!t.dataset.fb) {
          t.dataset.fb = '1';
          t.src = '/img/purifiers.svg';
        }
      }}
    />
  );
}

/**
 * Distinct diagnostic state component differentiating:
 * - Signed-out state
 * - Authenticated but unauthorized state
 * - Missing configuration
 * - Network/backend failure
 */
export function AccessStateCard({
  kind,
  message,
  onRetry,
  loginTo = '/login',
}: {
  kind: AccessErrorKind;
  message?: string | null;
  onRetry?: () => void;
  loginTo?: string;
}) {
  if (kind === 'signed_out') {
    return (
      <div className="card pad" style={{ maxWidth: 520, margin: '32px auto', textAlign: 'center' }}>
        <span className="tag warn" style={{ marginBottom: 12 }}>Authentication Required</span>
        <h2>Sign in to access this workspace</h2>
        <p className="muted">{message ?? 'Your session is not active. Sign in with an authorized account to continue.'}</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Link className="btn" to={loginTo}>Sign in</Link>
          <Link className="btn ghost" to="/">Return to Storefront</Link>
        </div>
      </div>
    );
  }

  if (kind === 'unauthorized') {
    return (
      <div className="card pad" style={{ maxWidth: 540, margin: '32px auto', textAlign: 'center' }}>
        <span className="tag bad" style={{ marginBottom: 12 }}>Insufficient Permissions</span>
        <h2>Role authorization required</h2>
        <p className="muted">
          {message ?? 'Your current account is authenticated, but does not have the required role permissions for this section.'}
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Link className="btn" to={loginTo}>Switch Account</Link>
          <Link className="btn ghost" to="/">Back to Storefront</Link>
        </div>
      </div>
    );
  }

  if (kind === 'missing_config') {
    return (
      <div className="card pad" style={{ maxWidth: 540, margin: '32px auto' }}>
        <span className="tag warn" style={{ marginBottom: 12 }}>Configuration Required</span>
        <h3>Service integration not configured</h3>
        <p className="muted">
          {message ?? 'This external integration requires environment variables that are not configured in the current environment.'}
        </p>
      </div>
    );
  }

  return (
    <Notice kind="bad">
      <div className="row spread">
        <span><b>Data connection error:</b> {message ?? 'Could not reach the backend service.'}</span>
        {onRetry && (
          <button type="button" className="btn ghost sm" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </Notice>
  );
}
