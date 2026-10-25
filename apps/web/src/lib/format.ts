import type { Timestamp } from 'firebase/firestore';
export { formatINR, effectiveRetailPaise, isProductPublished } from '@califnco/shared';

export function fmtDate(t?: Timestamp | number | string | { toDate?: () => Date; seconds?: number } | null): string {
  if (!t) return '—';
  try {
    if (typeof t === 'number') {
      return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (typeof t === 'string') {
      const d = new Date(t);
      return Number.isNaN(d.getTime()) ? t : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (typeof t === 'object' && typeof t.toDate === 'function') {
      return t.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (typeof t === 'object' && typeof t.seconds === 'number') {
      return new Date(t.seconds * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
  } catch {
    return '—';
  }
  return '—';
}

export const label = (s: string): string =>
  s
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
