import { describe, expect, it } from 'vitest';
import {
  DEALER_MIN_UNITS,
  computeTotals,
  effectiveRetailPaise,
  isProductPublished,
  validateLines,
} from '../src';

describe('computeTotals', () => {
  it('adds 18% GST and flat shipping under the threshold', () => {
    expect(computeTotals([{ unitPaise: 100000, qty: 2 }], 'customer')).toEqual({
      subtotalPaise: 200000,
      taxPaise: 36000,
      shippingPaise: 9900,
      totalPaise: 245900,
    });
  });
  it('gives free shipping at or above the threshold', () => {
    expect(computeTotals([{ unitPaise: 500000, qty: 1 }], 'customer').shippingPaise).toBe(0);
  });
  it('never charges dealers shipping', () => {
    expect(computeTotals([{ unitPaise: 1000, qty: 1 }], 'dealer').shippingPaise).toBe(0);
  });
  it('returns zeros for an empty cart', () => {
    expect(computeTotals([], 'customer').totalPaise).toBe(0);
  });
  it('rounds tax to whole paise', () => {
    expect(Number.isInteger(computeTotals([{ unitPaise: 12345, qty: 3 }], 'customer').taxPaise)).toBe(true);
  });
});

describe('effectiveRetailPaise & isProductPublished', () => {
  it('uses salePricePaise when lower than regular pricePaise', () => {
    expect(effectiveRetailPaise({ pricePaise: 1499900, salePricePaise: 1349900 })).toBe(1349900);
    expect(effectiveRetailPaise({ pricePaise: 1499900, salePricePaise: null })).toBe(1499900);
    expect(effectiveRetailPaise({ pricePaise: 1499900, salePricePaise: 1599900 })).toBe(1499900);
  });
  it('hides draft, archived, inactive, and demo products from customer listings', () => {
    expect(isProductPublished({ active: true, status: 'published', demo: false })).toBe(true);
    expect(isProductPublished({ active: true, status: 'draft', demo: false })).toBe(false);
    expect(isProductPublished({ active: true, status: 'archived', demo: false })).toBe(false);
    expect(isProductPublished({ active: false, status: 'published', demo: false })).toBe(false);
    expect(isProductPublished({ active: true, status: 'published', demo: true })).toBe(false);
  });
});

describe('validateLines', () => {
  it('rejects empty carts, bad and duplicate lines', () => {
    expect(validateLines([], 'customer')).toHaveLength(1);
    expect(validateLines([{ sku: 'a', qty: 0 }], 'customer')).toHaveLength(1);
    expect(validateLines([{ sku: 'a', qty: 1.5 }], 'customer')).toHaveLength(1);
    expect(validateLines([{ sku: 'a', qty: 1 }, { sku: 'a', qty: 1 }], 'customer').length).toBeGreaterThan(0);
  });
  it('caps customer quantity at 10', () => {
    expect(validateLines([{ sku: 'a', qty: 11 }], 'customer')).toHaveLength(1);
    expect(validateLines([{ sku: 'a', qty: 10 }], 'customer')).toHaveLength(0);
  });
  it('requires a minimum bulk size for dealers', () => {
    expect(validateLines([{ sku: 'a', qty: DEALER_MIN_UNITS - 1 }], 'dealer')).toHaveLength(1);
    expect(validateLines([{ sku: 'a', qty: DEALER_MIN_UNITS }], 'dealer')).toHaveLength(0);
  });
});
