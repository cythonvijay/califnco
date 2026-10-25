import { describe, expect, it } from 'vitest';
import {
  addressSchema,
  dealerApplicationSchema,
  orderRequestSchema,
  productFormSchema,
  registerSchema,
  serviceBookingSchema,
} from '../src';

const addr = {
  fullName: 'Asha Rao',
  phone: '9876543210',
  line1: '12 Lake View Road',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600001',
};

describe('validation', () => {
  it('accepts a valid address and rejects bad phone/pincode', () => {
    expect(addressSchema.safeParse(addr).success).toBe(true);
    expect(addressSchema.safeParse({ ...addr, phone: '1234567890' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...addr, pincode: '012345' }).success).toBe(false);
  });
  it('enforces password strength', () => {
    const base = { displayName: 'Asha', email: 'a@b.co', phone: '9876543210' };
    expect(registerSchema.safeParse({ ...base, password: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'longpassword' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'longpass123' }).success).toBe(true);
  });
  it('requires an idempotency key on orders', () => {
    expect(orderRequestSchema.safeParse({ lines: [{ sku: 'a', qty: 1 }], address: addr, idempotencyKey: 'x' }).success).toBe(false);
    expect(
      orderRequestSchema.safeParse({ lines: [{ sku: 'a', qty: 1 }], address: addr, idempotencyKey: 'abcdefghijklmnop' }).success,
    ).toBe(true);
  });
  it('validates service bookings', () => {
    const ok = {
      productSku: 'CF-P-RO7',
      serviceType: 'repair',
      contactName: 'Asha',
      contactPhone: '9876543210',
      address: addr,
      preferredDate: '2026-11-02',
      preferredSlot: '09:00-12:00',
    };
    expect(serviceBookingSchema.safeParse(ok).success).toBe(true);
    expect(serviceBookingSchema.safeParse({ ...ok, preferredSlot: '01:00-02:00' }).success).toBe(false);
  });
  it('validates GSTIN', () => {
    const d = { businessName: 'Blue Drop Traders', phone: '9876543210', city: 'Madurai' };
    expect(dealerApplicationSchema.safeParse({ ...d, gstin: '33ABCDE1234F1Z5' }).success).toBe(true);
    expect(dealerApplicationSchema.safeParse({ ...d, gstin: 'NOTAGSTIN' }).success).toBe(false);
  });
  it('validates admin product creation and sale price rules', () => {
    const validProduct = {
      sku: 'CF-P-NEW1',
      name: 'Califnco HydroPure RO 9 L',
      category: 'purifiers',
      description: 'Advanced 9-litre RO+UV water purifier with mineralizer stage.',
      pricePaise: 1699900,
      salePricePaise: 1549900,
      stock: 25,
      image: 'data:image/webp;base64,UklGR',
      imageAlt: 'Califnco HydroPure RO 9 L studio photo',
      specs: { Technology: 'RO + UV', Storage: '9 L' },
      active: true,
      status: 'published',
      featured: true,
    };
    expect(productFormSchema.safeParse(validProduct).success).toBe(true);
    // Rejects salePricePaise >= pricePaise
    expect(productFormSchema.safeParse({ ...validProduct, salePricePaise: 1799900 }).success).toBe(false);
  });
});
