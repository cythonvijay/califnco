import type { CartLine, PricedLine, Product, Role, Totals } from './types';

export const GST_RATE = 0.18;
export const SHIPPING_FLAT_PAISE = 9900;
export const FREE_SHIPPING_ABOVE_PAISE = 500000;
export const MAX_QTY_CUSTOMER = 10;
export const MAX_QTY_DEALER = 500;
export const DEALER_MIN_UNITS = 10;

/** Returns the effective customer unit price in paise (uses salePricePaise when valid and lower than pricePaise). */
export function effectiveRetailPaise(p: Pick<Product, 'pricePaise' | 'salePricePaise'>): number {
  if (typeof p.salePricePaise === 'number' && p.salePricePaise > 0 && p.salePricePaise < p.pricePaise) {
    return p.salePricePaise;
  }
  return p.pricePaise;
}

/** Returns true if a product is active, published, and not a legacy demo placeholder. */
export function isProductPublished(p: Pick<Product, 'active' | 'status' | 'demo'>): boolean {
  if (p.demo) return false;
  if (p.status === 'draft' || p.status === 'archived') return false;
  return Boolean(p.active);
}

/** All money is integer paise. Tax is GST-exclusive pricing: tax = round(subtotal * 18%). */
export function computeTotals(lines: Pick<PricedLine, 'unitPaise' | 'qty'>[], role: Role): Totals {
  const subtotalPaise = lines.reduce((s, l) => s + l.unitPaise * l.qty, 0);
  const taxPaise = Math.round(subtotalPaise * GST_RATE);
  const shippingPaise =
    subtotalPaise === 0 || role === 'dealer' || subtotalPaise >= FREE_SHIPPING_ABOVE_PAISE ? 0 : SHIPPING_FLAT_PAISE;
  return { subtotalPaise, taxPaise, shippingPaise, totalPaise: subtotalPaise + taxPaise + shippingPaise };
}

export type LineError = { sku?: string; message: string };

export function validateLines(lines: CartLine[], role: Role): LineError[] {
  const errors: LineError[] = [];
  if (lines.length === 0) return [{ message: 'Cart is empty.' }];
  const max = role === 'dealer' ? MAX_QTY_DEALER : MAX_QTY_CUSTOMER;
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.sku)) errors.push({ sku: l.sku, message: 'Duplicate line.' });
    seen.add(l.sku);
    if (!Number.isInteger(l.qty) || l.qty < 1) errors.push({ sku: l.sku, message: 'Quantity must be a whole number of at least 1.' });
    else if (l.qty > max) errors.push({ sku: l.sku, message: `Maximum ${max} units per product.` });
  }
  if (role === 'dealer') {
    const units = lines.reduce((s, l) => s + (Number.isInteger(l.qty) ? l.qty : 0), 0);
    if (units < DEALER_MIN_UNITS) errors.push({ message: `Bulk orders require at least ${DEALER_MIN_UNITS} units in total.` });
  }
  return errors;
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}
