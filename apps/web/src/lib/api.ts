import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  INITIAL_ACTIVE_CATALOG,
  ORDER_TRANSITIONS,
  SEED_DEALER_PRICES,
  canTransition,
  computeTotals,
  effectiveRetailPaise,
  isProductPublished,
  productFormSchema,
  validateLines,
  type Address,
  type CartLine,
  type DealerStatus,
  type OrderStatus,
  type PaymentStatus,
  type PricedLine,
  type Product,
  type ProductFormInput,
  type ProductStatus,
  type Role,
  type ServiceStatus,
  type Totals,
} from '@califnco/shared';
import { auth, db, firebaseConfigured } from './firebase';
import { productImage } from './images';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new ApiError(401, 'Please sign in to continue.');
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network error. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed.');
  return data as T;
}

export type AccessErrorKind =
  | 'signed_out'
  | 'unauthorized'
  | 'missing_config'
  | 'network_error'
  | 'validation_error'
  | 'not_found';

export class RepoError extends Error {
  constructor(
    public kind: AccessErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface CallerIdentity {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role: Role;
}

export interface OrderRecord {
  id: string;
  uid: string;
  email?: string | null;
  role: Role;
  lines: PricedLine[];
  totals: Totals;
  address: Address;
  status: OrderStatus;
  payment: {
    provider: 'razorpay_test' | 'razorpay_payment_link_test' | 'demo';
    status: PaymentStatus;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfileRecord {
  id: string;
  uid?: string;
  displayName: string;
  email: string;
  phone: string;
  role?: Role;
  referralCode?: string;
  referredBy?: string;
  prefs: { email: boolean; push: boolean; sms: boolean };
  createdAt?: unknown;
}

export interface DealerApplicationRecord {
  id: string;
  uid: string;
  businessName: string;
  gstin: string;
  phone: string;
  city: string;
  status: DealerStatus;
  decidedBy?: string;
  decidedAt?: unknown;
  createdAt?: unknown;
}

export interface ServiceBookingRecord {
  id: string;
  uid: string;
  productSku: string;
  serviceType: string;
  contactName: string;
  contactPhone: string;
  address: Address;
  preferredDate: string;
  preferredSlot: '09:00-12:00' | '12:00-15:00' | '15:00-18:00';
  notes?: string;
  status: ServiceStatus;
  assignedTo?: string;
  createdAt?: unknown;
}

export interface NotificationRecord {
  id: string;
  uid: string;
  type?: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt?: unknown;
  channels: Record<string, string>;
}

interface LocalDbState {
  products: Record<string, Product>;
  dealerPrices: Record<string, number>;
  users: Record<string, UserProfileRecord & { password?: string }>;
  addresses: Record<string, (Address & { id: string; createdAt: number })[]>;
  orders: Record<string, OrderRecord>;
  dealerApplications: Record<string, DealerApplicationRecord>;
  serviceBookings: Record<string, ServiceBookingRecord>;
  notifications: Record<string, NotificationRecord>;
  carts: Record<string, CartLine[]>;
}

const DB_STORAGE_KEY = 'califnco.db.v2';
const DB_INIT_KEY = 'califnco.db.init.v2';
export const DB_CHANGE_EVENT = 'califnco:db-change';

function emitDbChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DB_CHANGE_EVENT));
  }
}

function buildInitialLocalDb(): LocalDbState {
  const now = Date.now();
  const products: Record<string, Product> = {};
  const dealerPrices: Record<string, number> = {};

  for (const p of INITIAL_ACTIVE_CATALOG) {
    products[p.sku] = {
      ...p,
      image: productImage(p),
      demo: false,
      active: true,
      status: 'published',
      updatedAt: now - 86400000 * 5,
      createdAt: now - 86400000 * 30,
    };
  }
  for (const d of SEED_DEALER_PRICES) {
    dealerPrices[d.sku] = d.pricePaise;
  }

  const users: LocalDbState['users'] = {
    'usr_admin_01': {
      id: 'usr_admin_01',
      uid: 'usr_admin_01',
      displayName: 'Arjun Mehta',
      email: 'admin@califnco.com',
      phone: '9840011223',
      role: 'admin',
      referralCode: 'CALIFADM',
      prefs: { email: true, push: true, sms: false },
      createdAt: now - 86400000 * 60,
      password: 'Admin1234',
    },
    'usr_dealer_01': {
      id: 'usr_dealer_01',
      uid: 'usr_dealer_01',
      displayName: 'Karthik Sundaram',
      email: 'dealer@bluedroptraders.in',
      phone: '9840122334',
      role: 'dealer',
      referralCode: 'BLUEDROP',
      prefs: { email: true, push: false, sms: false },
      createdAt: now - 86400000 * 45,
      password: 'Dealer1234',
    },
    'usr_cust_01': {
      id: 'usr_cust_01',
      uid: 'usr_cust_01',
      displayName: 'Asha Rao',
      email: 'asha.rao@example.com',
      phone: '9876543210',
      role: 'customer',
      referralCode: 'ASHARAO1',
      prefs: { email: true, push: false, sms: false },
      createdAt: now - 86400000 * 20,
      password: 'Customer1234',
    },
    'usr_cust_02': {
      id: 'usr_cust_02',
      uid: 'usr_cust_02',
      displayName: 'Rohan Nair',
      email: 'rohan.nair@example.com',
      phone: '9845098765',
      role: 'customer',
      referralCode: 'ROHAN882',
      prefs: { email: true, push: true, sms: false },
      createdAt: now - 86400000 * 12,
      password: 'Customer1234',
    },
  };

  const addresses: LocalDbState['addresses'] = {
    'usr_cust_01': [
      {
        id: 'addr_asha_1',
        fullName: 'Asha Rao',
        phone: '9876543210',
        line1: '14 Boat Club Road, R.A. Puram',
        line2: 'Near Adyar Gate',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600028',
        lat: 13.0213,
        lng: 80.2565,
        createdAt: now - 86400000 * 18,
      },
    ],
    'usr_dealer_01': [
      {
        id: 'addr_dealer_1',
        fullName: 'Karthik Sundaram (Blue Drop Traders)',
        phone: '9840122334',
        line1: 'Plot 42, SIDCO Industrial Estate, Guindy',
        line2: 'Warehouse Bay 3',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600032',
        createdAt: now - 86400000 * 40,
      },
    ],
  };

  const pRo7 = products['CF-P-RO7']!;
  const pFlt = products['CF-C-KIT7']!;
  const pAlk = products['CF-P-ALK']!;

  const ord1Lines: PricedLine[] = [
    { sku: 'CF-P-RO7', name: pRo7.name, qty: 1, unitPaise: effectiveRetailPaise(pRo7), image: pRo7.image, imageAlt: pRo7.imageAlt },
    { sku: 'CF-C-KIT7', name: pFlt.name, qty: 1, unitPaise: effectiveRetailPaise(pFlt), image: pFlt.image, imageAlt: pFlt.imageAlt },
  ];
  const ord2Lines: PricedLine[] = [
    { sku: 'CF-P-ALK', name: pAlk.name, qty: 1, unitPaise: effectiveRetailPaise(pAlk), image: pAlk.image, imageAlt: pAlk.imageAlt },
  ];
  const ord3Lines: PricedLine[] = [
    { sku: 'CF-P-RO7', name: pRo7.name, qty: 12, unitPaise: dealerPrices['CF-P-RO7']!, image: pRo7.image, imageAlt: pRo7.imageAlt },
  ];

  const orders: Record<string, OrderRecord> = {
    'ord_8f92a1c4b7e0192837465001': {
      id: 'ord_8f92a1c4b7e0192837465001',
      uid: 'usr_cust_01',
      email: 'asha.rao@example.com',
      role: 'customer',
      lines: ord1Lines,
      totals: computeTotals(ord1Lines, 'customer'),
      address: addresses['usr_cust_01']![0]!,
      status: 'delivered',
      payment: { provider: 'razorpay_test', status: 'paid_verified', razorpayOrderId: 'order_RzpVerified001', razorpayPaymentId: 'pay_RzpVerified001' },
      createdAt: now - 86400000 * 9,
      updatedAt: now - 86400000 * 6,
    },
    'ord_7d41b3e9a2c1094857362002': {
      id: 'ord_7d41b3e9a2c1094857362002',
      uid: 'usr_cust_02',
      email: 'rohan.nair@example.com',
      role: 'customer',
      lines: ord2Lines,
      totals: computeTotals(ord2Lines, 'customer'),
      address: {
        fullName: 'Rohan Nair',
        phone: '9845098765',
        line1: '204 Palm Grove Apartments, Indiranagar',
        line2: '100 Feet Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
      },
      status: 'placed',
      payment: { provider: 'razorpay_test', status: 'paid_verified', razorpayOrderId: 'order_RzpVerified002', razorpayPaymentId: 'pay_RzpVerified002' },
      createdAt: now - 86400000 * 1,
      updatedAt: now - 86400000 * 1,
    },
    'ord_6c19e8f2d4b3019283746003': {
      id: 'ord_6c19e8f2d4b3019283746003',
      uid: 'usr_dealer_01',
      email: 'dealer@bluedroptraders.in',
      role: 'dealer',
      lines: ord3Lines,
      totals: computeTotals(ord3Lines, 'dealer'),
      address: addresses['usr_dealer_01']![0]!,
      status: 'shipped',
      payment: { provider: 'razorpay_test', status: 'paid_verified', razorpayOrderId: 'order_RzpVerified003', razorpayPaymentId: 'pay_RzpVerified003' },
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 2,
    },
  };

  const dealerApplications: Record<string, DealerApplicationRecord> = {
    'usr_dealer_01': {
      id: 'usr_dealer_01',
      uid: 'usr_dealer_01',
      businessName: 'Blue Drop Water Systems Pvt Ltd',
      gstin: '33ABCDE1234F1Z5',
      phone: '9840122334',
      city: 'Chennai',
      status: 'approved',
      decidedBy: 'usr_admin_01',
      decidedAt: now - 86400000 * 40,
      createdAt: now - 86400000 * 42,
    },
    'usr_cust_02': {
      id: 'usr_cust_02',
      uid: 'usr_cust_02',
      businessName: 'Deccan Hydro Solutions',
      gstin: '29AABCU9603R1ZM',
      phone: '9845098765',
      city: 'Bengaluru',
      status: 'pending',
      createdAt: now - 86400000 * 2,
    },
  };

  const serviceBookings: Record<string, ServiceBookingRecord> = {
    'svc_1001': {
      id: 'svc_1001',
      uid: 'usr_cust_01',
      productSku: 'CF-P-RO7',
      serviceType: 'installation',
      contactName: 'Asha Rao',
      contactPhone: '9876543210',
      address: addresses['usr_cust_01']![0]!,
      preferredDate: new Date(now + 86400000 * 2).toISOString().slice(0, 10),
      preferredSlot: '09:00-12:00',
      notes: 'Wall-mount installation next to kitchen sink; raw water TDS is ~680 ppm.',
      status: 'assigned',
      assignedTo: 'S. Murugan (Sr. Field Engineer)',
      createdAt: now - 86400000 * 2,
    },
    'svc_1002': {
      id: 'svc_1002',
      uid: 'usr_cust_02',
      productSku: 'CF-P-ALK',
      serviceType: 'installation',
      contactName: 'Rohan Nair',
      contactPhone: '9845098765',
      address: {
        fullName: 'Rohan Nair',
        phone: '9845098765',
        line1: '204 Palm Grove Apartments, Indiranagar',
        line2: '100 Feet Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
      },
      preferredDate: new Date(now + 86400000 * 3).toISOString().slice(0, 10),
      preferredSlot: '12:00-15:00',
      notes: 'Countertop installation + inlet diverter valve setup.',
      status: 'requested',
      assignedTo: '',
      createdAt: now - 86400000 * 1,
    },
  };

  const notifications: Record<string, NotificationRecord> = {
    'ntf_1001': {
      id: 'ntf_1001',
      uid: 'usr_cust_01',
      type: 'order',
      title: 'Order delivered — Califnco AquaPure RO+UV 7 L',
      body: 'Your order ord_8f92a1c4 has been delivered. A technician visit is scheduled for installation.',
      link: '/orders/ord_8f92a1c4b7e0192837465001',
      read: false,
      createdAt: now - 86400000 * 6,
      channels: { inApp: 'delivered', email: 'sent', push: 'skipped', sms: 'skipped' },
    },
    'ntf_1002': {
      id: 'ntf_1002',
      uid: 'usr_cust_01',
      type: 'service',
      title: 'Technician assigned for your installation visit',
      body: 'Senior Field Engineer S. Murugan is assigned for your upcoming 09:00-12:00 slot.',
      link: '/service',
      read: false,
      createdAt: now - 86400000 * 2,
      channels: { inApp: 'delivered', email: 'sent', push: 'skipped', sms: 'skipped' },
    },
    'ntf_1003': {
      id: 'ntf_1003',
      uid: 'usr_dealer_01',
      type: 'dealer',
      title: 'Bulk order shipped — 12x AquaPure RO+UV 7 L',
      body: 'Your wholesale order ord_6c19e8f2 has been dispatched from our Chennai fulfillment hub.',
      link: '/orders/ord_6c19e8f2d4b3019283746003',
      read: true,
      createdAt: now - 86400000 * 2,
      channels: { inApp: 'delivered', email: 'sent', push: 'skipped', sms: 'skipped' },
    },
  };

  return {
    products,
    dealerPrices,
    users,
    addresses,
    orders,
    dealerApplications,
    serviceBookings,
    notifications,
    carts: {},
  };
}

export function loadLocalDb(): LocalDbState {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    const initialized = localStorage.getItem(DB_INIT_KEY);
    if (raw && initialized) {
      const parsed = JSON.parse(raw) as LocalDbState;
      if (parsed && typeof parsed.products === 'object') {
        return parsed;
      }
    }
    const initial = buildInitialLocalDb();
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initial));
    localStorage.setItem(DB_INIT_KEY, '1');
    return initial;
  } catch {
    return buildInitialLocalDb();
  }
}

export function saveLocalDb(state: LocalDbState) {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(DB_INIT_KEY, '1');
  } catch {
    // Storage quota or private mode
  }
  emitDbChange();
}

function requireSignedIn(caller: CallerIdentity | null): CallerIdentity {
  if (!caller) {
    throw new RepoError('signed_out', 'Authentication required. Please sign in to continue.');
  }
  return caller;
}

function requireAdminCaller(caller: CallerIdentity | null): CallerIdentity {
  const c = requireSignedIn(caller);
  if (c.role !== 'admin') {
    throw new RepoError(
      'unauthorized',
      `Access denied. Your account (${c.role}) does not have administrator permissions.`,
    );
  }
  return c;
}

export interface CatalogSnapshot {
  customerProducts: Product[];
  adminProducts: Product[];
  demoProductCount: number;
  dealerPrices: Record<string, number>;
  source: 'firestore' | 'local_db';
}

export async function fetchCatalogSnapshot(role: Role): Promise<CatalogSnapshot> {
  if (firebaseConfigured && db) {
    const prodSnap = await getDocs(collection(db, 'products'));
    const allDocs = prodSnap.docs.map((d) => ({ ...(d.data() as Product), sku: d.data().sku ?? d.id }));
    const demoProductCount = allDocs.filter((p) => p.demo === true).length;
    const adminProducts = allDocs
      .filter((p) => !p.demo)
      .sort((a, b) => a.sku.localeCompare(b.sku));
    const customerProducts = adminProducts.filter((p) => isProductPublished(p));

    let dealerPrices: Record<string, number> = {};
    if (role === 'dealer') {
      try {
        const dpSnap = await getDocs(collection(db, 'dealerPrices'));
        dealerPrices = Object.fromEntries(dpSnap.docs.map((d) => [d.id, d.data().pricePaise as number]));
      } catch {
        for (const p of adminProducts) {
          if (p.wholesalePricePaise) dealerPrices[p.sku] = p.wholesalePricePaise;
        }
      }
    }
    return {
      customerProducts,
      adminProducts,
      demoProductCount,
      dealerPrices,
      source: 'firestore',
    };
  }

  const state = loadLocalDb();
  const allDocs = Object.values(state.products);
  const demoProductCount = allDocs.filter((p) => p.demo === true).length;
  const adminProducts = allDocs
    .filter((p) => !p.demo)
    .sort((a, b) => a.sku.localeCompare(b.sku));
  const customerProducts = adminProducts.filter((p) => isProductPublished(p));
  const dealerPrices = role === 'dealer' ? { ...state.dealerPrices } : {};

  return {
    customerProducts,
    adminProducts,
    demoProductCount,
    dealerPrices,
    source: 'local_db',
  };
}

export async function upsertProductRecord(
  caller: CallerIdentity | null,
  input: ProductFormInput,
  originalSku?: string,
): Promise<Product> {
  requireAdminCaller(caller);
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new RepoError('validation_error', parsed.error.issues[0]?.message ?? 'Invalid product data.');
  }
  const d = parsed.data;
  const status: ProductStatus = d.status ?? (d.active ? 'published' : 'draft');
  const active = status === 'published' ? Boolean(d.active) : false;
  const wholesalePaise =
    d.wholesalePricePaise && d.wholesalePricePaise > 0
      ? d.wholesalePricePaise
      : Math.round((d.pricePaise * (['purifiers', 'dispensers', 'pumps'].includes(d.category) ? 0.82 : 0.78)) / 100) * 100;

  const record: Product = {
    sku: d.sku,
    name: d.name,
    category: d.category,
    description: d.description,
    pricePaise: d.pricePaise,
    salePricePaise: d.salePricePaise ?? null,
    wholesalePricePaise: wholesalePaise,
    stock: d.stock,
    specs: d.specs,
    compatibleWith: d.compatibleWith ?? [],
    image: d.image,
    imageAlt: d.imageAlt,
    gallery: d.gallery ?? [],
    features: d.features ?? [],
    filtrationStages: d.filtrationStages ?? [],
    dimensions: d.dimensions ?? '',
    warranty: d.warranty ?? '',
    installationInfo: d.installationInfo ?? '',
    active,
    status,
    featured: Boolean(d.featured),
    demo: false,
    updatedAt: Date.now(),
  };

  if (firebaseConfigured && db) {
    if (originalSku && originalSku !== record.sku) {
      await deleteDoc(doc(db, 'products', originalSku)).catch(() => undefined);
      await deleteDoc(doc(db, 'dealerPrices', originalSku)).catch(() => undefined);
    }
    await setDoc(doc(db, 'products', record.sku), { ...record, updatedAt: serverTimestamp() }, { merge: true });
    await setDoc(doc(db, 'dealerPrices', record.sku), { sku: record.sku, pricePaise: wholesalePaise });
    emitDbChange();
    return record;
  }

  const state = loadLocalDb();
  if (originalSku && originalSku !== record.sku) {
    delete state.products[originalSku];
    delete state.dealerPrices[originalSku];
  }
  const existing = state.products[record.sku];
  state.products[record.sku] = {
    ...existing,
    ...record,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  state.dealerPrices[record.sku] = wholesalePaise;
  saveLocalDb(state);
  return state.products[record.sku]!;
}

export async function updateProductLifecycle(
  caller: CallerIdentity | null,
  sku: string,
  patch: { status?: ProductStatus; active?: boolean; featured?: boolean },
): Promise<Product> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    const ref = doc(db, 'products', sku);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new RepoError('not_found', `Product ${sku} not found.`);
    const cur = snap.data() as Product;
    const nextStatus: ProductStatus =
      patch.status ?? (patch.active !== undefined ? (patch.active ? 'published' : 'draft') : cur.status ?? 'published');
    const nextActive = nextStatus === 'published' ? (patch.active ?? true) : false;
    const nextFeatured = patch.featured !== undefined ? patch.featured : Boolean(cur.featured);
    await updateDoc(ref, {
      status: nextStatus,
      active: nextActive,
      featured: nextFeatured,
      demo: false,
      updatedAt: serverTimestamp(),
    });
    emitDbChange();
    return { ...cur, status: nextStatus, active: nextActive, featured: nextFeatured, demo: false };
  }

  const state = loadLocalDb();
  const cur = state.products[sku];
  if (!cur) throw new RepoError('not_found', `Product ${sku} not found.`);
  const nextStatus: ProductStatus =
    patch.status ?? (patch.active !== undefined ? (patch.active ? 'published' : 'draft') : cur.status ?? 'published');
  const nextActive = nextStatus === 'published' ? (patch.active ?? true) : false;
  const nextFeatured = patch.featured !== undefined ? patch.featured : Boolean(cur.featured);
  state.products[sku] = {
    ...cur,
    status: nextStatus,
    active: nextActive,
    featured: nextFeatured,
    demo: false,
    updatedAt: Date.now(),
  };
  saveLocalDb(state);
  return state.products[sku]!;
}

export async function deleteProductRecord(caller: CallerIdentity | null, sku: string): Promise<void> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    await deleteDoc(doc(db, 'products', sku));
    await deleteDoc(doc(db, 'dealerPrices', sku)).catch(() => undefined);
    emitDbChange();
    return;
  }
  const state = loadLocalDb();
  if (!state.products[sku]) throw new RepoError('not_found', `Product ${sku} not found.`);
  delete state.products[sku];
  delete state.dealerPrices[sku];
  saveLocalDb(state);
}

export async function removeConfirmedDemoProducts(caller: CallerIdentity | null): Promise<number> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    const q = query(collection(db, 'products'), where('demo', '==', true));
    const snaps = await getDocs(q);
    const batch = writeBatch(db);
    snaps.docs.forEach((d) => {
      batch.delete(d.ref);
      batch.delete(doc(db!, 'dealerPrices', d.id));
    });
    await batch.commit();
    emitDbChange();
    return snaps.size;
  }
  const state = loadLocalDb();
  let removed = 0;
  for (const [sku, prod] of Object.entries(state.products)) {
    if (prod.demo) {
      delete state.products[sku];
      delete state.dealerPrices[sku];
      removed++;
    }
  }
  saveLocalDb(state);
  return removed;
}

function hashIdem(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'ord_' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + input.slice(0, 8).replace(/[^a-z0-9]/gi, '');
}

export interface CreateOrderResult {
  orderId: string;
  mode: 'demo' | 'razorpay_payment_link_test';
  totalPaise: number;
  paymentUrl?: string | null;
}

export async function createValidatedOrder(
  caller: CallerIdentity | null,
  payload: { lines: CartLine[]; address: Address; idempotencyKey: string },
): Promise<CreateOrderResult> {
  const user = requireSignedIn(caller);
  const effRole: Role = user.role === 'dealer' ? 'dealer' : 'customer';
  const lineErrors = validateLines(payload.lines, effRole);
  if (lineErrors.length > 0) {
    throw new RepoError('validation_error', lineErrors[0]!.message);
  }

  if (firebaseConfigured && db) {
    return apiPost<CreateOrderResult>('/orders/create', payload);
  }

  const state = loadLocalDb();
  const orderId = hashIdem(`${user.uid}:${payload.idempotencyKey}`);
  const existing = state.orders[orderId];
  if (existing) {
    return {
      orderId: existing.id,
      mode: 'demo',
      totalPaise: existing.totals.totalPaise,
      paymentUrl: null,
    };
  }

  const priced: PricedLine[] = [];
  for (const line of payload.lines) {
    const prod = state.products[line.sku];
    if (!prod || !isProductPublished(prod)) {
      throw new RepoError('validation_error', `Product ${line.sku} is no longer available in the active catalog.`);
    }
    if (prod.stock < line.qty) {
      throw new RepoError('validation_error', `Only ${prod.stock} units of ${prod.name} remain in stock.`);
    }
    const retailUnit = effectiveRetailPaise(prod);
    const unitPaise =
      effRole === 'dealer' ? (state.dealerPrices[line.sku] ?? prod.wholesalePricePaise ?? retailUnit) : retailUnit;
    if (!unitPaise || unitPaise <= 0) {
      throw new RepoError('validation_error', `Price unavailable for ${line.sku}.`);
    }
    priced.push({
      sku: prod.sku,
      name: prod.name,
      qty: line.qty,
      unitPaise,
      image: productImage(prod),
      imageAlt: prod.imageAlt,
    });
  }

  for (const line of payload.lines) {
    state.products[line.sku]!.stock -= line.qty;
  }

  const totals = computeTotals(priced, effRole);
  const now = Date.now();
  const order: OrderRecord = {
    id: orderId,
    uid: user.uid,
    email: user.email,
    role: effRole,
    lines: priced,
    totals,
    address: payload.address,
    status: 'placed',
    payment: { provider: 'demo', status: 'demo_unverified' },
    createdAt: now,
    updatedAt: now,
  };
  state.orders[orderId] = order;

  const notifId = `ntf_${now}`;
  state.notifications[notifId] = {
    id: notifId,
    uid: user.uid,
    type: 'order',
    title: `Order ${orderId.slice(4, 12)} placed`,
    body: `Your order for ${priced.reduce((s, l) => s + l.qty, 0)} item(s) has been recorded.`,
    link: `/orders/${orderId}`,
    read: false,
    createdAt: now,
    channels: { inApp: 'delivered', email: 'skipped', push: 'skipped', sms: 'skipped' },
  };

  saveLocalDb(state);
  return { orderId, mode: 'demo', totalPaise: totals.totalPaise, paymentUrl: null };
}

export async function listCustomerOrders(caller: CallerIdentity | null): Promise<OrderRecord[]> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const q = query(collection(db, 'orders'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
    const s = await getDocs(q);
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.orders)
    .filter((o) => o.uid === user.uid)
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function getOrderById(caller: CallerIdentity | null, orderId: string): Promise<OrderRecord | null> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const s = await getDoc(doc(db, 'orders', orderId));
    if (!s.exists()) return null;
    const data = s.data() as Omit<OrderRecord, 'id'>;
    if (data.uid !== user.uid && user.role !== 'admin') {
      throw new RepoError('unauthorized', 'You do not have permission to view this order.');
    }
    return { id: s.id, ...data };
  }
  const state = loadLocalDb();
  const o = state.orders[orderId] ?? null;
  if (!o) return null;
  if (o.uid !== user.uid && user.role !== 'admin') {
    throw new RepoError('unauthorized', 'You do not have permission to view this order.');
  }
  return o;
}

export async function listAdminOrders(caller: CallerIdentity | null): Promise<OrderRecord[]> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500));
    const s = await getDocs(q);
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.orders).sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function updateOrderStatusAdmin(
  caller: CallerIdentity | null,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    await apiPost('/admin/order-status', { orderId, status });
    emitDbChange();
    return;
  }
  const state = loadLocalDb();
  const order = state.orders[orderId];
  if (!order) throw new RepoError('not_found', 'Order not found.');
  if (!canTransition(order.status, status)) {
    throw new RepoError('validation_error', `Cannot transition order from ${order.status} to ${status}.`);
  }
  if (status === 'cancelled') {
    for (const l of order.lines) {
      if (state.products[l.sku]) {
        state.products[l.sku]!.stock += l.qty;
      }
    }
  }
  order.status = status;
  order.updatedAt = Date.now();
  const notifId = `ntf_${Date.now()}`;
  state.notifications[notifId] = {
    id: notifId,
    uid: order.uid,
    type: 'order',
    title: `Order ${orderId.slice(4, 12)} ${status.replace('_', ' ')}`,
    body: `Your order status has been updated to "${status.replace('_', ' ')}".`,
    link: `/orders/${orderId}`,
    read: false,
    createdAt: Date.now(),
    channels: { inApp: 'delivered', email: 'sent', push: 'skipped', sms: 'skipped' },
  };
  saveLocalDb(state);
}

export async function getUserProfile(caller: CallerIdentity | null): Promise<UserProfileRecord> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const s = await getDoc(doc(db, 'users', user.uid));
    const d = s.data() as Partial<UserProfileRecord> | undefined;
    return {
      id: user.uid,
      uid: user.uid,
      displayName: d?.displayName ?? user.displayName ?? '',
      email: d?.email ?? user.email ?? '',
      phone: d?.phone ?? '',
      role: user.role,
      referralCode: d?.referralCode ?? user.uid.slice(0, 8).toUpperCase(),
      prefs: d?.prefs ?? { email: true, push: false, sms: false },
      createdAt: d?.createdAt,
    };
  }
  const state = loadLocalDb();
  const u = state.users[user.uid];
  return (
    u ?? {
      id: user.uid,
      uid: user.uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      phone: '',
      role: user.role,
      referralCode: user.uid.slice(0, 8).toUpperCase(),
      prefs: { email: true, push: false, sms: false },
    }
  );
}

export async function saveUserProfile(
  caller: CallerIdentity | null,
  patch: { displayName: string; phone: string; prefs: { email: boolean; push: boolean; sms: boolean } },
): Promise<void> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        displayName: patch.displayName.trim(),
        phone: patch.phone.trim(),
        prefs: patch.prefs,
        email: user.email,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    emitDbChange();
    return;
  }
  const state = loadLocalDb();
  const cur = state.users[user.uid];
  state.users[user.uid] = {
    ...(cur ?? {
      id: user.uid,
      uid: user.uid,
      email: user.email ?? '',
      role: user.role,
      createdAt: Date.now(),
    }),
    displayName: patch.displayName.trim(),
    phone: patch.phone.trim(),
    prefs: patch.prefs,
  };
  saveLocalDb(state);
}

export async function listUserAddresses(caller: CallerIdentity | null): Promise<(Address & { id: string })[]> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const s = await getDocs(query(collection(db, 'users', user.uid, 'addresses'), orderBy('createdAt', 'desc')));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Address) }));
  }
  const state = loadLocalDb();
  return [...(state.addresses[user.uid] ?? [])].sort((a, b) => b.createdAt - a.createdAt);
}

export async function addUserAddress(caller: CallerIdentity | null, address: Address): Promise<string> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const ref = await addDoc(collection(db, 'users', user.uid, 'addresses'), {
      ...address,
      createdAt: serverTimestamp(),
    });
    emitDbChange();
    return ref.id;
  }
  const state = loadLocalDb();
  const id = `addr_${Date.now()}`;
  const list = state.addresses[user.uid] ?? [];
  list.unshift({ ...address, id, createdAt: Date.now() });
  state.addresses[user.uid] = list;
  saveLocalDb(state);
  return id;
}

export async function deleteUserAddress(caller: CallerIdentity | null, addressId: string): Promise<void> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    await deleteDoc(doc(db, 'users', user.uid, 'addresses', addressId));
    emitDbChange();
    return;
  }
  const state = loadLocalDb();
  state.addresses[user.uid] = (state.addresses[user.uid] ?? []).filter((a) => a.id !== addressId);
  saveLocalDb(state);
}

export async function listAdminUsers(caller: CallerIdentity | null): Promise<UserProfileRecord[]> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    const s = await getDocs(query(collection(db, 'users'), limit(500)));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserProfileRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.users).sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function getMyDealerApplication(
  caller: CallerIdentity | null,
): Promise<DealerApplicationRecord | null> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const s = await getDoc(doc(db, 'dealerApplications', user.uid));
    return s.exists() ? { id: s.id, ...(s.data() as Omit<DealerApplicationRecord, 'id'>) } : null;
  }
  const state = loadLocalDb();
  return state.dealerApplications[user.uid] ?? null;
}

export async function submitDealerApplication(
  caller: CallerIdentity | null,
  input: { businessName: string; gstin: string; phone: string; city: string },
): Promise<DealerApplicationRecord> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    await setDoc(doc(db, 'dealerApplications', user.uid), {
      ...input,
      uid: user.uid,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    emitDbChange();
    return { id: user.uid, uid: user.uid, ...input, status: 'pending', createdAt: Date.now() };
  }
  const state = loadLocalDb();
  const record: DealerApplicationRecord = {
    id: user.uid,
    uid: user.uid,
    ...input,
    status: 'pending',
    createdAt: Date.now(),
  };
  state.dealerApplications[user.uid] = record;
  saveLocalDb(state);
  return record;
}

export async function listAdminDealerApplications(
  caller: CallerIdentity | null,
): Promise<DealerApplicationRecord[]> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    const s = await getDocs(query(collection(db, 'dealerApplications'), limit(500)));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DealerApplicationRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.dealerApplications).sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function decideDealerApplicationAdmin(
  caller: CallerIdentity | null,
  uid: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  const admin = requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    try {
      await apiPost('/admin/dealer-decision', { uid, decision });
    } catch {
      await updateDoc(doc(db, 'dealerApplications', uid), {
        status: decision,
        decidedBy: admin.uid,
        decidedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', uid), { role: decision === 'approved' ? 'dealer' : 'customer' }, { merge: true });
    }
    emitDbChange();
    return;
  }
  const state = loadLocalDb();
  const app = state.dealerApplications[uid];
  if (!app) throw new RepoError('not_found', 'Dealer application not found.');
  app.status = decision;
  app.decidedBy = admin.uid;
  app.decidedAt = Date.now();
  if (state.users[uid]) {
    state.users[uid]!.role = decision === 'approved' ? 'dealer' : 'customer';
  }
  const notifId = `ntf_${Date.now()}`;
  state.notifications[notifId] = {
    id: notifId,
    uid,
    type: 'dealer',
    title: decision === 'approved' ? 'Dealer account approved' : 'Dealer application update',
    body:
      decision === 'approved'
        ? 'Your dealer account is approved. You now have access to wholesale pricing in the Dealer Portal.'
        : 'Your dealer application could not be approved at this time.',
    link: '/dealer',
    read: false,
    createdAt: Date.now(),
    channels: { inApp: 'delivered', email: 'sent', push: 'skipped', sms: 'skipped' },
  };
  saveLocalDb(state);
}

export async function listMyServiceBookings(caller: CallerIdentity | null): Promise<ServiceBookingRecord[]> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const s = await getDocs(
      query(collection(db, 'serviceBookings'), where('uid', '==', user.uid), orderBy('createdAt', 'desc')),
    );
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceBookingRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.serviceBookings)
    .filter((b) => b.uid === user.uid)
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function createServiceBooking(
  caller: CallerIdentity | null,
  input: Omit<ServiceBookingRecord, 'id' | 'uid' | 'status' | 'assignedTo' | 'createdAt'>,
): Promise<ServiceBookingRecord> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const ref = await addDoc(collection(db, 'serviceBookings'), {
      ...input,
      uid: user.uid,
      status: 'requested',
      assignedTo: '',
      createdAt: serverTimestamp(),
    });
    emitDbChange();
    return { id: ref.id, uid: user.uid, ...input, status: 'requested', assignedTo: '', createdAt: Date.now() };
  }
  const state = loadLocalDb();
  const id = `svc_${Date.now()}`;
  const record: ServiceBookingRecord = {
    id,
    uid: user.uid,
    ...input,
    status: 'requested',
    assignedTo: '',
    createdAt: Date.now(),
  };
  state.serviceBookings[id] = record;
  const notifId = `ntf_${Date.now() + 1}`;
  state.notifications[notifId] = {
    id: notifId,
    uid: user.uid,
    type: 'service',
    title: `Service request received (${input.serviceType.replace('_', ' ')})`,
    body: `Your request for ${input.productSku} on ${input.preferredDate} (${input.preferredSlot}) has been logged.`,
    link: '/service',
    read: false,
    createdAt: Date.now(),
    channels: { inApp: 'delivered', email: 'sent', push: 'skipped', sms: 'skipped' },
  };
  saveLocalDb(state);
  return record;
}

export async function listAdminServiceBookings(caller: CallerIdentity | null): Promise<ServiceBookingRecord[]> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    const s = await getDocs(query(collection(db, 'serviceBookings'), orderBy('createdAt', 'desc'), limit(500)));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceBookingRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.serviceBookings).sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function updateServiceBookingAdmin(
  caller: CallerIdentity | null,
  bookingId: string,
  patch: { status?: ServiceStatus; assignedTo?: string },
): Promise<void> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    await updateDoc(doc(db, 'serviceBookings', bookingId), patch as Record<string, string>);
    emitDbChange();
    return;
  }
  const state = loadLocalDb();
  const b = state.serviceBookings[bookingId];
  if (!b) throw new RepoError('not_found', 'Service booking not found.');
  if (patch.assignedTo !== undefined) b.assignedTo = patch.assignedTo;
  if (patch.status !== undefined) b.status = patch.status;
  saveLocalDb(state);
}

export async function listMyNotifications(caller: CallerIdentity | null): Promise<NotificationRecord[]> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    const s = await getDocs(
      query(collection(db, 'notifications'), where('uid', '==', user.uid), orderBy('createdAt', 'desc')),
    );
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.notifications)
    .filter((n) => n.uid === user.uid)
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export async function markNotificationRead(caller: CallerIdentity | null, notifId: string): Promise<void> {
  const user = requireSignedIn(caller);
  if (firebaseConfigured && db) {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
    emitDbChange();
    return;
  }
  const state = loadLocalDb();
  const n = state.notifications[notifId];
  if (n && (n.uid === user.uid || user.role === 'admin')) {
    n.read = true;
    saveLocalDb(state);
  }
}

export async function listAdminNotifications(caller: CallerIdentity | null): Promise<NotificationRecord[]> {
  requireAdminCaller(caller);
  if (firebaseConfigured && db) {
    const s = await getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(200)));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationRecord, 'id'>) }));
  }
  const state = loadLocalDb();
  return Object.values(state.notifications).sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

export { ORDER_TRANSITIONS };
