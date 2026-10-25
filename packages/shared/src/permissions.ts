import type { OrderStatus, Role } from './types';

export function roleFromClaims(claims: Record<string, unknown> | undefined | null): Role {
  const r = claims?.role;
  return r === 'admin' || r === 'dealer' ? r : 'customer';
}

/**
 * Resolves the effective user role from verified token claims and optional Firestore user profile document.
 * Token custom claims take precedence; Firestore profile role is used when set by an admin or backend script.
 */
export function resolveEffectiveRole(
  claims: Record<string, unknown> | undefined | null,
  profileData?: Record<string, unknown> | undefined | null,
): Role {
  const fromToken = roleFromClaims(claims);
  if (fromToken !== 'customer') return fromToken;
  const pr = profileData?.role;
  if (pr === 'admin' || pr === 'dealer') return pr;
  return 'customer';
}

export const canSeeDealerPrices = (role: Role) => role === 'dealer';
export const canAccessAdmin = (role: Role) => role === 'admin';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => ORDER_TRANSITIONS[from]?.includes(to) ?? false;
