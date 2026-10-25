import { describe, expect, it } from 'vitest';
import {
  INITIAL_ACTIVE_CATALOG,
  SEED_DEALER_PRICES,
  SEED_PRODUCTS,
  canAccessAdmin,
  canSeeDealerPrices,
  canTransition,
  isProductPublished,
  resolveEffectiveRole,
  roleFromClaims,
} from '../src';

describe('roles', () => {
  it('defaults unknown or missing claims to customer', () => {
    expect(roleFromClaims(undefined)).toBe('customer');
    expect(roleFromClaims({ role: 'superuser' })).toBe('customer');
    expect(roleFromClaims({ admin: true })).toBe('customer');
  });
  it('maps only exact roles', () => {
    expect(roleFromClaims({ role: 'dealer' })).toBe('dealer');
    expect(roleFromClaims({ role: 'admin' })).toBe('admin');
  });
  it('resolves role from user profile when token claim is not set', () => {
    expect(resolveEffectiveRole({}, { role: 'admin' })).toBe('admin');
    expect(resolveEffectiveRole({}, { role: 'dealer' })).toBe('dealer');
    expect(resolveEffectiveRole({ role: 'admin' }, { role: 'customer' })).toBe('admin');
    expect(resolveEffectiveRole({}, { role: 'invalid' })).toBe('customer');
  });
  it('limits privileged capabilities', () => {
    expect(canSeeDealerPrices('customer')).toBe(false);
    expect(canSeeDealerPrices('dealer')).toBe(true);
    expect(canAccessAdmin('dealer')).toBe(false);
    expect(canAccessAdmin('admin')).toBe(true);
  });
});

describe('order state machine', () => {
  it('allows the forward path and blocks skipping or reviving', () => {
    expect(canTransition('placed', 'confirmed')).toBe(true);
    expect(canTransition('placed', 'delivered')).toBe(false);
    expect(canTransition('delivered', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'placed')).toBe(false);
  });
});

describe('seed and initial active catalog data', () => {
  it('has at least 50 unique products', () => {
    expect(SEED_PRODUCTS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(SEED_PRODUCTS.map((p) => p.sku)).size).toBe(SEED_PRODUCTS.length);
  });
  it('marks INITIAL_ACTIVE_CATALOG as published non-demo records', () => {
    expect(INITIAL_ACTIVE_CATALOG.length).toBe(SEED_PRODUCTS.length);
    for (const p of INITIAL_ACTIVE_CATALOG) {
      expect(p.demo).toBe(false);
      expect(isProductPublished(p)).toBe(true);
    }
  });
  it('prices dealers strictly below retail', () => {
    for (const d of SEED_DEALER_PRICES) {
      const p = SEED_PRODUCTS.find((x) => x.sku === d.sku)!;
      expect(d.pricePaise).toBeLessThan(p.pricePaise);
    }
  });
  it('only references compatible SKUs that exist', () => {
    const skus = new Set(SEED_PRODUCTS.map((p) => p.sku));
    for (const p of SEED_PRODUCTS) for (const c of p.compatibleWith) expect(skus.has(c)).toBe(true);
  });
});
