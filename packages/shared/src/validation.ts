import { z } from 'zod';
import { CATEGORIES } from './types';

export const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
export const pincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code');
export const gstinSchema = z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN');

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required').max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(5, 'Address line is required').max(160),
  line2: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().min(2, 'City is required').max(60),
  state: z.string().trim().min(2, 'State is required').max(60),
  pincode: pincodeSchema,
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type Address = z.infer<typeof addressSchema>;

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Name is required').max(80),
  email: z.string().trim().email('Enter a valid email'),
  phone: phoneSchema,
  password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
});

export const orderRequestSchema = z.object({
  lines: z.array(z.object({ sku: z.string().min(1).max(40), qty: z.number().int() })).min(1).max(100),
  address: addressSchema,
  idempotencyKey: z.string().min(16).max(80),
});

export const serviceTypes = ['installation', 'repair', 'filter_replacement', 'annual_maintenance', 'inspection'] as const;
export const serviceBookingSchema = z.object({
  productSku: z.string().min(1, 'Select a product'),
  serviceType: z.enum(serviceTypes),
  contactName: z.string().trim().min(2, 'Contact name is required').max(80),
  contactPhone: phoneSchema,
  address: addressSchema,
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  preferredSlot: z.enum(['09:00-12:00', '12:00-15:00', '15:00-18:00']),
  notes: z.string().trim().max(500).optional().default(''),
});

export const dealerApplicationSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required').max(120),
  gstin: gstinSchema,
  phone: phoneSchema,
  city: z.string().trim().min(2, 'City is required').max(60),
});

export const productFormSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-_]{2,31}$/, 'SKU must be 3–32 characters using letters, numbers, hyphens, or underscores'),
    name: z.string().trim().min(3, 'Product name must be at least 3 characters').max(120),
    category: z.enum(CATEGORIES),
    description: z.string().trim().min(10, 'Provide a clear product description (at least 10 characters)').max(2000),
    pricePaise: z.number().int().positive('Retail price must be greater than zero'),
    salePricePaise: z.number().int().positive().nullable().optional(),
    wholesalePricePaise: z.number().int().positive().nullable().optional(),
    stock: z.number().int().min(0, 'Stock cannot be negative').max(100000),
    image: z.string().trim().min(1, 'Select or upload a product photograph'),
    imageAlt: z.string().trim().min(3, 'Provide descriptive alt text for accessibility').max(220),
    gallery: z.array(z.string().trim().min(1)).optional().default([]),
    specs: z.record(z.string().trim().min(1), z.string().trim().min(1)),
    features: z.array(z.string().trim().min(1)).optional().default([]),
    filtrationStages: z.array(z.string().trim().min(1)).optional().default([]),
    dimensions: z.string().trim().max(120).optional().default(''),
    warranty: z.string().trim().max(200).optional().default(''),
    installationInfo: z.string().trim().max(300).optional().default(''),
    compatibleWith: z.array(z.string().trim().min(1)).optional().default([]),
    active: z.boolean(),
    status: z.enum(['published', 'draft', 'archived']).optional().default('published'),
    featured: z.boolean().optional().default(false),
  })
  .refine((d) => !d.salePricePaise || d.salePricePaise < d.pricePaise, {
    message: 'Sale price must be lower than the regular retail price',
    path: ['salePricePaise'],
  });
export type ProductFormInput = z.infer<typeof productFormSchema>;
