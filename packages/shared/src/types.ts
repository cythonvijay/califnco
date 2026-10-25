export type Role = 'customer' | 'dealer' | 'admin';
export const CATEGORIES = ['purifiers', 'dispensers', 'pumps', 'filters', 'cartridges', 'spare-parts'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<Category, string> = {
  purifiers: 'Water Purifiers',
  dispensers: 'Dispensers',
  pumps: 'Pumps',
  filters: 'Filters & Accessories',
  cartridges: 'Cartridges & Membranes',
  'spare-parts': 'Spare Parts',
};

export type ProductStatus = 'published' | 'draft' | 'archived';

export interface Product {
  sku: string;
  name: string;
  category: Category;
  description: string;
  /** Regular retail price in paise, GST-exclusive. */
  pricePaise: number;
  /** Optional promotional sale price in paise, GST-exclusive (must be < pricePaise when active). */
  salePricePaise?: number | null;
  /** Optional wholesale price in paise for dealers (also synced to dealerPrices/{sku}). */
  wholesalePricePaise?: number | null;
  stock: number;
  specs: Record<string, string>;
  compatibleWith: string[];
  image: string;
  imageAlt: string;
  /** Additional gallery photographs for the product detail page. */
  gallery?: string[];
  /** Key bullet highlights displayed on the product detail page. */
  features?: string[];
  /** Multi-stage filtration breakdown where applicable. */
  filtrationStages?: string[];
  /** Physical dimensions (e.g. '380 × 270 × 505 mm'). */
  dimensions?: string;
  /** Warranty coverage details. */
  warranty?: string;
  /** Delivery, installation, and service coverage details. */
  installationInfo?: string;
  /** Controls whether the product is active and visible to customers. */
  active: boolean;
  /** Publication status ('published' | 'draft' | 'archived'). */
  status?: ProductStatus;
  /** Whether the product is highlighted in the homepage featured section. */
  featured?: boolean;
  /** Verified customer rating data, present only when genuine ratings exist. */
  rating?: { average: number; count: number } | null;
  /** True only for legacy seeded demo records; false for active admin-owned catalog products. */
  demo: boolean;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export interface DealerPrice {
  sku: string;
  pricePaise: number;
}

export interface CartLine {
  sku: string;
  qty: number;
}

export interface PricedLine {
  sku: string;
  name: string;
  qty: number;
  unitPaise: number;
  image?: string;
  imageAlt?: string;
}

export interface Totals {
  subtotalPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  discountPaise?: number;
}

export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid_verified' | 'demo_unverified' | 'failed';
export type ServiceStatus = 'requested' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type DealerStatus = 'pending' | 'approved' | 'rejected';
