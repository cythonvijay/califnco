import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  ORDER_TRANSITIONS,
  effectiveRetailPaise,
  formatINR,
  isProductPublished,
  serviceTypes,
  type Category,
  type OrderStatus,
  type Product,
  type ProductFormInput,
  type ProductStatus,
  type ServiceStatus,
} from '@califnco/shared';
import { AccessStateCard, Confirm, Empty, Field, Img, Loading, Notice, Pager, paginate } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCatalog } from '../hooks/useCatalog';
import { useRepoQuery } from '../hooks/useQuery';
import { fmtDate, label } from '../lib/format';
import { IMAGE_PRESETS, productImage } from '../lib/images';
import {
  decideDealerApplicationAdmin,
  deleteProductRecord,
  listAdminDealerApplications,
  listAdminNotifications,
  listAdminOrders,
  listAdminServiceBookings,
  listAdminUsers,
  removeConfirmedDemoProducts,
  updateOrderStatusAdmin,
  updateProductLifecycle,
  updateServiceBookingAdmin,
  upsertProductRecord,
  type DealerApplicationRecord,
  type NotificationRecord,
  type OrderRecord,
  type ServiceBookingRecord,
  type UserProfileRecord,
} from '../lib/api';
import { channelText } from '../pages/Notifications';
import { PayBadge, StatusBadge } from '../pages/Orders';

const SIZE = 10;

const ADMIN_NAV_ITEMS: { path: string; title: string }[] = [
  { path: '', title: 'Overview' },
  { path: 'products', title: 'Products' },
  { path: 'orders', title: 'Orders' },
  { path: 'dealers', title: 'Dealers' },
  { path: 'customers', title: 'Customers' },
  { path: 'service', title: 'Service Requests' },
  { path: 'notifications', title: 'Notifications' },
];

export function AdminShell() {
  const { user, role, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const segment = loc.pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? '';
  const currentTitle = ADMIN_NAV_ITEMS.find((i) => i.path === segment)?.title ?? 'Overview';

  const initials = (user?.displayName || user?.email || 'A')
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Administrator navigation">
        <div className="admin-sidebar-brand">
          <Link to="/admin">
            <span className="brand-wordmark" style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>CALIFNCO</span>
          </Link>
          <span className="role-pill">Admin</span>
        </div>

        <nav className="admin-nav">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              end={item.path === ''}
              to={item.path ? `/admin/${item.path}` : '/admin'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/" style={{ color: '#72C9E8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            &larr; Storefront
          </Link>
        </div>
      </aside>

      <div className="admin-main-col">
        <header className="admin-topbar">
          <div className="row" style={{ gap: 12 }}>
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Toggle admin sidebar"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            </button>
            <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
              <Link to="/admin">Admin</Link>
              <span>/</span>
              <strong>{currentTitle}</strong>
            </nav>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <Link className="btn ghost sm" to="/admin/products">
              Products
            </Link>
            <Link className="btn ghost sm" to="/admin/notifications" aria-label="Notifications">
              Notifications
            </Link>

            <div className="account-menu-wrap" ref={profileRef}>
              <button
                type="button"
                className="account-trigger"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((o) => !o)}
              >
                <span className="account-avatar" aria-hidden="true">
                  {initials}
                </span>
                <span className="account-label">{user?.displayName || user?.email || 'Admin'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {profileOpen && (
                <div className="account-dropdown" role="menu" aria-label="Administrator account options">
                  <div className="account-dropdown-header">
                    <strong>{user?.displayName || 'Administrator'}</strong>
                    <span>{user?.email}</span>
                    <span className="tag navy" style={{ marginTop: 6 }}>
                      {role}
                    </span>
                  </div>
                  <Link to="/" role="menuitem">
                    <span>Storefront</span>
                  </Link>
                  <Link to="/profile" role="menuitem">
                    <span>Account Profile</span>
                  </Link>
                  <div className="account-dropdown-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    className="signout-item"
                    onClick={async () => {
                      setProfileOpen(false);
                      await logout();
                      nav('/', { replace: true });
                    }}
                  >
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const Head = ({ t, subtitle, children }: { t: string; subtitle?: string; children?: React.ReactNode }) => (
  <div className="row spread" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: subtitle ? 4 : 0 }}>{t}</h1>
      {subtitle && <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{subtitle}</p>}
    </div>
    {children && <div className="row">{children}</div>}
  </div>
);

export function Overview() {
  const { caller } = useAuth();
  const cat = useCatalog();
  const [daysFilter, setDaysFilter] = useState<'all' | '7' | '30'>('all');

  const orders = useRepoQuery<OrderRecord>(() => listAdminOrders(caller), [caller?.uid]);
  const users = useRepoQuery<UserProfileRecord>(() => listAdminUsers(caller), [caller?.uid]);
  const apps = useRepoQuery<DealerApplicationRecord>(() => listAdminDealerApplications(caller), [caller?.uid]);
  const svc = useRepoQuery<ServiceBookingRecord>(() => listAdminServiceBookings(caller), [caller?.uid]);

  if (orders.loading || users.loading || cat.loading) {
    return <Loading label="Loading overview..." />;
  }

  const anyErrorKind = orders.errorKind || users.errorKind || apps.errorKind || svc.errorKind;
  const anyErrorMsg = orders.error || users.error || apps.error || svc.error;

  if (anyErrorKind) {
    return (
      <>
        <Head t="Overview" />
        <AccessStateCard
          kind={anyErrorKind}
          message={anyErrorMsg}
          loginTo="/login"
          onRetry={() => {
            orders.reload();
            users.reload();
            apps.reload();
            svc.reload();
          }}
        />
      </>
    );
  }

  const cutoff =
    daysFilter === 'all'
      ? 0
      : Date.now() - Number(daysFilter) * 86400000;

  const filteredOrders = orders.data.filter((o) => {
    if (!cutoff) return true;
    const ts = typeof o.createdAt === 'number' ? o.createdAt : (o.createdAt as { toMillis?: () => number })?.toMillis?.() ?? Date.now();
    return ts >= cutoff;
  });

  const activeOrders = filteredOrders.filter((o) =>
    ['placed', 'confirmed', 'packed', 'shipped', 'delivered'].includes(o.status),
  );
  const verifiedOrders = activeOrders.filter((o) => o.payment.status === 'paid_verified');
  const demoOrders = activeOrders.filter((o) => o.payment.status === 'demo_unverified');

  const lowStockProducts = cat.adminProducts.filter((p) => p.active && p.stock <= 10);
  const pendingDealers = apps.data.filter((a) => a.status === 'pending');
  const openService = svc.data.filter((s) => !['completed', 'cancelled'].includes(s.status));

  const stat = (title: string, value: string | number, sub?: string, to?: string) => (
    <div className="card stat">
      <div className="row spread">
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
          {title}
        </span>
        {to && (
          <Link to={to} style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
            View &rarr;
          </Link>
        )}
      </div>
      <b>{value}</b>
      {sub && <span className="muted" style={{ fontSize: 12 }}>{sub}</span>}
    </div>
  );

  return (
    <>
      <Head
        t="Overview"
        subtitle="Storefront catalog, orders, dealer applications, and service requests"
      >
        <select
          aria-label="Date range filter"
          value={daysFilter}
          onChange={(e) => setDaysFilter(e.target.value as 'all' | '7' | '30')}
          style={{ width: 170 }}
        >
          <option value="all">All Time</option>
          <option value="30">Last 30 Days</option>
          <option value="7">Last 7 Days</option>
        </select>
        <Link className="btn sm" to="/admin/products">
          Manage Products
        </Link>
      </Head>

      <div className="grid g4">
        {stat(
          'Active Products',
          cat.products.length,
          `${cat.products.filter((p) => p.featured).length} featured · ${cat.adminProducts.length - cat.products.length} draft/archived`,
          '/admin/products',
        )}
        {stat(
          'Paid Revenue',
          formatINR(verifiedOrders.reduce((s, o) => s + o.totals.totalPaise, 0)),
          `${verifiedOrders.length} paid orders`,
          '/admin/orders',
        )}
        {stat(
          'Orders',
          filteredOrders.length,
          `${filteredOrders.filter((o) => o.status === 'placed').length} placed`,
          '/admin/orders',
        )}
        {stat(
          'Test Orders',
          formatINR(demoOrders.reduce((s, o) => s + o.totals.totalPaise, 0)),
          `${demoOrders.length} test orders`,
          '/admin/orders',
        )}
        {stat(
          'Customers',
          users.data.length,
          `${apps.data.filter((a) => a.status === 'approved').length} dealers`,
          '/admin/customers',
        )}
        {stat(
          'Pending Dealers',
          pendingDealers.length,
          pendingDealers.length > 0 ? 'Awaiting review' : 'Up to date',
          '/admin/dealers',
        )}
        {stat(
          'Open Service Visits',
          openService.length,
          `${svc.data.filter((s) => s.status === 'requested').length} unassigned`,
          '/admin/service',
        )}
        {stat(
          'Low Stock',
          lowStockProducts.length,
          `${lowStockProducts.filter((p) => p.stock === 0).length} out of stock`,
          '/admin/products',
        )}
      </div>

      <div className="grid g2" style={{ marginTop: 24, alignItems: 'start' }}>
        <StatusChart orders={filteredOrders} />

        <div className="card pad">
          <div className="row spread" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Low Stock Products (&le; 10 units)</h3>
            <Link to="/admin/products" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>
              All Products &rarr;
            </Link>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>All active products have more than 10 units in stock.</p>
          ) : (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.slice(0, 6).map((p) => (
                    <tr key={p.sku}>
                      <td style={{ fontWeight: 700 }}>{p.sku}</td>
                      <td>{p.name}</td>
                      <td>
                        <span className={`tag ${p.stock === 0 ? 'bad' : 'warn'}`}>
                          {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                        </span>
                      </td>
                      <td>
                        <Link className="btn ghost sm" to={`/admin/products?edit=${encodeURIComponent(p.sku)}`}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatusChart({ orders }: { orders: OrderRecord[] }) {
  const counts = Object.keys(ORDER_TRANSITIONS).map((st) => ({
    st,
    n: orders.filter((o) => o.status === st).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.n));

  return (
    <div className="card pad">
      <div className="row spread" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Orders by Status</h3>
        <span className="muted" style={{ fontSize: 12 }}>{orders.length} total</span>
      </div>
      {orders.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No orders in the selected period.</p>
      ) : (
        <div
          className="bars"
          role="img"
          aria-label={`Orders by status: ${counts.map((c) => `${label(c.st)} ${c.n}`).join(', ')}`}
        >
          {counts.map((c) => (
            <div key={c.st}>
              <strong style={{ color: 'var(--navy)' }}>{c.n}</strong>
              <i style={{ height: `${Math.max(6, (c.n / max) * 100)}%` }} />
              <span>{label(c.st)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DraftProductState {
  sku: string;
  name: string;
  category: Category;
  description: string;
  priceRupees: string;
  salePriceRupees: string;
  wholesalePriceRupees: string;
  stock: string;
  image: string;
  imageAlt: string;
  specsList: { key: string; value: string }[];
  featuresText: string;
  stagesText: string;
  dimensions: string;
  warranty: string;
  installationInfo: string;
  compatibleSkusText: string;
  status: ProductStatus;
  active: boolean;
  featured: boolean;
}

function productToDraft(p?: Product | null): DraftProductState {
  if (!p) {
    return {
      sku: '',
      name: '',
      category: 'purifiers',
      description: '',
      priceRupees: '',
      salePriceRupees: '',
      wholesalePriceRupees: '',
      stock: '25',
      image: IMAGE_PRESETS[0]!.url,
      imageAlt: '',
      specsList: [
        { key: 'Technology', value: 'RO + UV + Mineralizer' },
        { key: 'Storage', value: '8 L' },
        { key: 'Flow rate', value: '18 L/h' },
      ],
      featuresText: 'Multi-stage RO+UV+Mineralizer purification\nFood-grade storage tank with LED status indicator',
      stagesText:
        'Stage 1: 5-Micron Pre-Sediment Filter\nStage 2: Activated Carbon Block\nStage 3: RO Membrane\nStage 4: UV-C Chamber\nStage 5: Post-Carbon & Mineralizer',
      dimensions: '380 × 270 × 505 mm',
      warranty: '1 Year Onsite Warranty',
      installationInfo: 'Standard technician installation included within 48 hours of delivery.',
      compatibleSkusText: '',
      status: 'published',
      active: true,
      featured: false,
    };
  }

  const specsEntries = Object.entries(p.specs);
  return {
    sku: p.sku,
    name: p.name,
    category: p.category,
    description: p.description,
    priceRupees: String(p.pricePaise / 100),
    salePriceRupees: p.salePricePaise ? String(p.salePricePaise / 100) : '',
    wholesalePriceRupees: p.wholesalePricePaise ? String(p.wholesalePricePaise / 100) : '',
    stock: String(p.stock),
    image: productImage(p),
    imageAlt: p.imageAlt || `${p.name} (${p.sku})`,
    specsList: specsEntries.length ? specsEntries.map(([key, value]) => ({ key, value })) : [{ key: 'Specification', value: 'Standard' }],
    featuresText: (p.features ?? []).join('\n'),
    stagesText: (p.filtrationStages ?? []).join('\n'),
    dimensions: p.dimensions ?? '',
    warranty: p.warranty ?? '',
    installationInfo: p.installationInfo ?? '',
    compatibleSkusText: (p.compatibleWith ?? []).join(', '),
    status: p.status ?? (p.active ? 'published' : 'draft'),
    active: Boolean(p.active && p.status !== 'draft' && p.status !== 'archived'),
    featured: Boolean(p.featured),
  };
}

function compressUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format.'));
      img.onload = () => {
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(String(reader.result));
        ctx.fillStyle = '#F4F8FB';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', 0.84));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AdminProducts() {
  const { caller } = useAuth();
  const cat = useCatalog();
  const [sp, setSp] = useSearchParams();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived' | 'featured' | 'low_stock'>('all');
  const [page, setPage] = useState(1);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOriginalSku, setEditingOriginalSku] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<DraftProductState>(() => productToDraft(null));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'bad' | 'warn'; t: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Product | null>(null);

  useEffect(() => {
    const editSku = sp.get('edit');
    if (editSku && !cat.loading) {
      const target = cat.findAny(editSku);
      if (target) {
        setEditingOriginalSku(target.sku);
        setDraft(productToDraft(target));
        setFormErrors({});
        setEditorOpen(true);
      }
    }
  }, [sp, cat.loading]);

  const rows = useMemo(() => {
    const qLower = search.trim().toLowerCase();
    return cat.adminProducts.filter((p) => {
      if (catFilter && p.category !== catFilter) return false;
      const pub = isProductPublished(p);
      const st = p.status ?? (p.active ? 'published' : 'draft');
      if (statusFilter === 'published' && !pub) return false;
      if (statusFilter === 'draft' && st !== 'draft') return false;
      if (statusFilter === 'archived' && st !== 'archived') return false;
      if (statusFilter === 'featured' && !p.featured) return false;
      if (statusFilter === 'low_stock' && p.stock > 10) return false;
      if (qLower) {
        const hay = `${p.sku} ${p.name} ${p.category} ${p.description} ${Object.values(p.specs).join(' ')}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [cat.adminProducts, search, catFilter, statusFilter]);

  if (cat.loading) return <Loading label="Loading products..." />;

  function openCreate() {
    setEditingOriginalSku(undefined);
    setDraft(productToDraft(null));
    setFormErrors({});
    setMsg(null);
    setEditorOpen(true);
    if (sp.has('edit')) {
      const next = new URLSearchParams(sp);
      next.delete('edit');
      setSp(next, { replace: true });
    }
  }

  function openEdit(p: Product) {
    setEditingOriginalSku(p.sku);
    setDraft({
      ...productToDraft(p),
      wholesalePriceRupees: String((cat.wholesalePriceOf(p.sku) ?? p.wholesalePricePaise ?? Math.round(p.pricePaise * 0.8)) / 100),
    });
    setFormErrors({});
    setMsg(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingOriginalSku(undefined);
    if (sp.has('edit')) {
      const next = new URLSearchParams(sp);
      next.delete('edit');
      setSp(next, { replace: true });
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors({});
    setMsg(null);

    const pricePaise = Math.round(Number(draft.priceRupees) * 100);
    const salePricePaise = draft.salePriceRupees.trim() ? Math.round(Number(draft.salePriceRupees) * 100) : null;
    const wholesalePricePaise = draft.wholesalePriceRupees.trim()
      ? Math.round(Number(draft.wholesalePriceRupees) * 100)
      : null;
    const stock = Math.floor(Number(draft.stock));

    const specs: Record<string, string> = {};
    for (const row of draft.specsList) {
      if (row.key.trim() && row.value.trim()) {
        specs[row.key.trim()] = row.value.trim();
      }
    }
    if (Object.keys(specs).length === 0) {
      setFormErrors({ specs: 'Add at least one specification (e.g. Technology: RO+UV).' });
      return;
    }

    const input: ProductFormInput = {
      sku: draft.sku.trim().toUpperCase(),
      name: draft.name.trim(),
      category: draft.category,
      description: draft.description.trim(),
      pricePaise,
      salePricePaise,
      wholesalePricePaise,
      stock,
      image: draft.image.trim(),
      imageAlt: (draft.imageAlt.trim() || `${draft.name.trim()} product photograph`),
      gallery: [],
      specs,
      features: draft.featuresText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      filtrationStages: draft.stagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      dimensions: draft.dimensions.trim(),
      warranty: draft.warranty.trim(),
      installationInfo: draft.installationInfo.trim(),
      compatibleWith: draft.compatibleSkusText
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      status: draft.status,
      active: draft.status === 'published' ? draft.active : false,
      featured: draft.featured,
    };

    setSaving(true);
    try {
      const saved = await upsertProductRecord(caller, input, editingOriginalSku);
      cat.reload();
      setMsg({
        k: 'ok',
        t: editingOriginalSku
          ? `Updated ${saved.name} (${saved.sku}).`
          : `Created ${saved.name} (${saved.sku}).`,
      });
      closeEditor();
    } catch (err) {
      setMsg({ k: 'bad', t: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head
        t="Products"
        subtitle={`${cat.products.length} published · ${cat.adminProducts.length} total`}
      >
        <button type="button" className="btn" onClick={openCreate}>
          + Add Product
        </button>
      </Head>

      {cat.demoProductCount > 0 && (
        <Notice kind="warn">
          <div className="row spread">
            <span>
              {cat.demoProductCount} demo product record(s) are hidden from customer listings.
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                const count = await removeConfirmedDemoProducts(caller);
                cat.reload();
                setMsg({ k: 'ok', t: `Removed ${count} demo product(s).` });
              }}
            >
              Remove Demo Records
            </button>
          </div>
        </Notice>
      )}

      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}

      {editorOpen && (
        <section className="card pad" style={{ marginBottom: 28, border: '2px solid var(--navy)' }} aria-label="Product Editor">
          <div className="row spread" style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {editingOriginalSku ? `Edit ${draft.name || editingOriginalSku}` : 'Add Product'}
              </h2>
            </div>
            <div className="row">
              {editingOriginalSku && (
                <Link className="btn ghost sm" to={`/product/${editingOriginalSku}`} target="_blank">
                  View on Storefront &nearr;
                </Link>
              )}
              <button type="button" className="btn ghost sm" onClick={closeEditor}>
                Close
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveProduct} noValidate>
            <div className="grid g2" style={{ gap: 28, alignItems: 'start' }}>
              <div>
                <h3 style={{ marginBottom: 12, color: 'var(--navy)' }}>Product Details</h3>
                <div className="grid g2">
                  <Field label="SKU *" hint="e.g. CF-P-RO9" error={formErrors.sku}>
                    <input
                      value={draft.sku}
                      onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })}
                      placeholder="CF-P-RO9"
                      required
                    />
                  </Field>
                  <Field label="Category *">
                    <select
                      value={draft.category}
                      onChange={(e) => {
                        const nextCat = e.target.value as Category;
                        const preset = IMAGE_PRESETS.find((pr) => pr.category === nextCat);
                        setDraft({
                          ...draft,
                          category: nextCat,
                          image: !editingOriginalSku && preset ? preset.url : draft.image,
                        });
                      }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Product Name *" error={formErrors.name}>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Califnco AquaPure RO+UV 9 L"
                    required
                  />
                </Field>

                <Field label="Description *" error={formErrors.description}>
                  <textarea
                    rows={3}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Product description and application details..."
                    required
                  />
                </Field>

                <h3 style={{ marginTop: 20, marginBottom: 12, color: 'var(--navy)' }}>Pricing (INR, excl. GST) &amp; Stock</h3>
                <div className="grid g3">
                  <Field label="Retail Price (₹) *" error={formErrors.pricePaise}>
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={draft.priceRupees}
                      onChange={(e) => setDraft({ ...draft, priceRupees: e.target.value })}
                      placeholder="15999"
                      required
                    />
                  </Field>
                  <Field label="Sale Price (₹)" hint="Optional">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={draft.salePriceRupees}
                      onChange={(e) => setDraft({ ...draft, salePriceRupees: e.target.value })}
                      placeholder="14499"
                    />
                  </Field>
                  <Field label="Wholesale Price (₹)" hint="Optional">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={draft.wholesalePriceRupees}
                      onChange={(e) => setDraft({ ...draft, wholesalePriceRupees: e.target.value })}
                      placeholder="12799"
                    />
                  </Field>
                </div>

                <div className="grid g2">
                  <Field label="Stock Quantity *" error={formErrors.stock}>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={draft.stock}
                      onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={draft.status}
                      onChange={(e) => {
                        const st = e.target.value as ProductStatus;
                        setDraft({ ...draft, status: st, active: st === 'published' });
                      }}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft (Hidden)</option>
                      <option value="archived">Archived</option>
                    </select>
                  </Field>
                </div>

                <div className="card pad" style={{ background: 'var(--bg)', marginTop: 8 }}>
                  <label className="row" style={{ cursor: 'pointer', marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, minHeight: 18 }}
                      checked={draft.status === 'published' && draft.active}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          active: e.target.checked,
                          status: e.target.checked ? 'published' : 'draft',
                        })
                      }
                    />
                    <span>
                      <b>Visible in customer catalog</b>
                    </span>
                  </label>

                  <label className="row" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, minHeight: 18 }}
                      checked={draft.featured}
                      onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                    />
                    <span>
                      <b>Featured on homepage</b>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: 12, color: 'var(--navy)' }}>Product Image</h3>
                <div className="card pad" style={{ background: 'var(--bg)', marginBottom: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
                    <Img
                      src={draft.image || IMAGE_PRESETS[0]!.url}
                      alt={draft.imageAlt || draft.name || 'Product preview'}
                      className="thumb"
                      size={110}
                    />
                    <div style={{ flex: 1 }}>
                      <Field label="Upload Image (JPG, PNG, WebP)">
                        <input
                          type="file"
                          accept="image/*"
                          style={{ padding: 6 }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const dataUri = await compressUploadedImage(file);
                              setDraft((d) => ({ ...d, image: dataUri }));
                            } catch (err) {
                              setMsg({ k: 'bad', t: (err as Error).message });
                            }
                          }}
                        />
                      </Field>
                      <Field label="Or Choose Catalog Photo">
                        <select
                          aria-label="Select studio photograph preset"
                          value={IMAGE_PRESETS.find((pr) => pr.url === draft.image)?.key ?? ''}
                          onChange={(e) => {
                            const found = IMAGE_PRESETS.find((pr) => pr.key === e.target.value);
                            if (found) setDraft({ ...draft, image: found.url });
                          }}
                        >
                          <option value="">Custom uploaded image</option>
                          {IMAGE_PRESETS.map((pr) => (
                            <option key={pr.key} value={pr.key}>
                              {pr.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                  <Field label="Alt Text">
                    <input
                      value={draft.imageAlt}
                      onChange={(e) => setDraft({ ...draft, imageAlt: e.target.value })}
                      placeholder="Product photo description"
                    />
                  </Field>
                </div>

                <h3 style={{ marginBottom: 12, color: 'var(--navy)' }}>Specifications &amp; Warranty</h3>
                <div style={{ marginBottom: 14 }}>
                  <div className="row spread" style={{ marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>Specifications *</strong>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() =>
                        setDraft({ ...draft, specsList: [...draft.specsList, { key: '', value: '' }] })
                      }
                    >
                      + Add Row
                    </button>
                  </div>
                  {formErrors.specs && <div className="err">{formErrors.specs}</div>}
                  {draft.specsList.map((row, idx) => (
                    <div key={idx} className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'nowrap' }}>
                      <input
                        placeholder="Label (e.g. Storage)"
                        value={row.key}
                        onChange={(e) => {
                          const next = [...draft.specsList];
                          next[idx] = { ...row, key: e.target.value };
                          setDraft({ ...draft, specsList: next });
                        }}
                      />
                      <input
                        placeholder="Value (e.g. 8 L)"
                        value={row.value}
                        onChange={(e) => {
                          const next = [...draft.specsList];
                          next[idx] = { ...row, value: e.target.value };
                          setDraft({ ...draft, specsList: next });
                        }}
                      />
                      {draft.specsList.length > 1 && (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              specsList: draft.specsList.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid g2">
                  <Field label="Dimensions">
                    <input
                      value={draft.dimensions}
                      onChange={(e) => setDraft({ ...draft, dimensions: e.target.value })}
                      placeholder="380 × 270 × 505 mm"
                    />
                  </Field>
                  <Field label="Warranty">
                    <input
                      value={draft.warranty}
                      onChange={(e) => setDraft({ ...draft, warranty: e.target.value })}
                      placeholder="1 Year Onsite Warranty"
                    />
                  </Field>
                </div>

                <Field label="Filtration Stages (one per line)">
                  <textarea
                    rows={3}
                    value={draft.stagesText}
                    onChange={(e) => setDraft({ ...draft, stagesText: e.target.value })}
                  />
                </Field>

                <Field label="Compatible SKUs (comma-separated)">
                  <input
                    value={draft.compatibleSkusText}
                    onChange={(e) => setDraft({ ...draft, compatibleSkusText: e.target.value })}
                    placeholder="CF-P-RO7, CF-P-RO8M"
                  />
                </Field>
              </div>
            </div>

            <div className="row spread" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Changes apply immediately to the storefront and dealer catalog.
              </span>
              <div className="row">
                <button type="button" className="btn ghost" onClick={closeEditor}>
                  Cancel
                </button>
                <button type="submit" className="btn lg" disabled={saving}>
                  {saving ? 'Saving...' : editingOriginalSku ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by SKU, name, or specification..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search products"
        />
        <select
          aria-label="Category filter"
          value={catFilter}
          onChange={(e) => {
            setCatFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Categories ({cat.adminProducts.length})</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
          <option value="featured">Featured</option>
          <option value="low_stock">Low Stock (&le;10)</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty
          title="No matching products"
          action={
            <button type="button" className="btn" onClick={openCreate}>
              + Add Product
            </button>
          }
        >
          No products matched your current search or filter.
        </Empty>
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Retail Price</th>
                <th>Wholesale</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Featured</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginate(rows, page, SIZE).map((p) => {
                const pub = isProductPublished(p);
                const st = p.status ?? (p.active ? 'published' : 'draft');
                const ws = cat.wholesalePriceOf(p.sku);
                return (
                  <tr key={p.sku}>
                    <td>
                      <div className="prodcell">
                        <Img className="thumb" src={productImage(p)} alt={p.imageAlt || p.name} size={48} />
                        <div>
                          <strong style={{ display: 'block' }}>{p.name}</strong>
                          <span className="muted" style={{ fontSize: 12 }}>SKU: {p.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td>{CATEGORY_LABEL[p.category] ?? p.category}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{formatINR(effectiveRetailPaise(p))}</div>
                      {p.salePricePaise && p.salePricePaise < p.pricePaise && (
                        <div className="price-strike" style={{ marginLeft: 0, fontSize: 11.5 }}>
                          {formatINR(p.pricePaise)}
                        </div>
                      )}
                    </td>
                    <td className="muted">{ws ? formatINR(ws) : '—'}</td>
                    <td>
                      <span className={`tag ${p.stock === 0 ? 'bad' : p.stock <= 10 ? 'warn' : 'ok'}`}>
                        {p.stock} units
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${pub ? 'ok' : st === 'archived' ? 'bad' : 'warn'}`}>
                        {pub ? 'Published' : label(st)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn sm ${p.featured ? 'accent' : 'ghost'}`}
                        onClick={async () => {
                          await updateProductLifecycle(caller, p.sku, { featured: !p.featured });
                          cat.reload();
                          setMsg({
                            k: 'ok',
                            t: `${p.name} ${!p.featured ? 'marked as featured' : 'removed from featured'}.`,
                          });
                        }}
                      >
                        {p.featured ? 'Featured' : 'Feature'}
                      </button>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <button type="button" className="btn ghost sm" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={async () => {
                            const nextPub = !pub;
                            await updateProductLifecycle(caller, p.sku, {
                              status: nextPub ? 'published' : 'draft',
                              active: nextPub,
                            });
                            cat.reload();
                            setMsg({
                              k: 'ok',
                              t: `${p.name} (${p.sku}) is now ${nextPub ? 'published' : 'unpublished'}.`,
                            });
                          }}
                        >
                          {pub ? 'Unpublish' : 'Publish'}
                        </button>
                        <Link className="btn ghost sm" to={`/product/${p.sku}`}>
                          View
                        </Link>
                        {st !== 'archived' && (
                          <button
                            type="button"
                            className="btn ghost sm"
                            onClick={() => setConfirmArchive(p)}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn ghost sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setConfirmDelete(p)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} pages={Math.ceil(rows.length / SIZE)} onPage={setPage} />

      <Confirm
        open={!!confirmArchive}
        title={`Archive ${confirmArchive?.name}?`}
        body="Archiving hides this product from the customer storefront while keeping its record in the admin catalog and preserving past orders."
        confirmLabel="Archive Product"
        onCancel={() => setConfirmArchive(null)}
        onConfirm={async () => {
          if (!confirmArchive) return;
          const target = confirmArchive;
          setConfirmArchive(null);
          await updateProductLifecycle(caller, target.sku, { status: 'archived', active: false });
          cat.reload();
          setMsg({ k: 'ok', t: `Archived ${target.name} (${target.sku}).` });
        }}
      />

      <Confirm
        open={!!confirmDelete}
        danger
        title={`Delete ${confirmDelete?.name} (${confirmDelete?.sku})?`}
        body="This removes the product from the active catalog. Historical customer orders keep their saved line items."
        confirmLabel="Delete Product"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const target = confirmDelete;
          setConfirmDelete(null);
          try {
            await deleteProductRecord(caller, target.sku);
            cat.reload();
            setMsg({ k: 'ok', t: `Deleted ${target.name} (${target.sku}).` });
          } catch (e) {
            setMsg({ k: 'bad', t: (e as Error).message });
          }
        }}
      />
    </>
  );
}

export function AdminOrders() {
  const { caller } = useAuth();
  const cat = useCatalog();
  const { data, loading, error, errorKind, reload } = useRepoQuery<OrderRecord>(
    () => listAdminOrders(caller),
    [caller?.uid],
  );
  // New orders are written by the server (order create / Razorpay callback), not by this
  // admin session, so a one-shot fetch will not reflect them until something re-queries.
  // Poll in the background so a confirmed order surfaces here without a manual reload.
  useEffect(() => {
    if (!caller) return;
    const id = window.setInterval(() => reload(), 20000);
    return () => window.clearInterval(id);
  }, [caller?.uid, reload]);
  const [s, setS] = useState('');
  const [f, setF] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [pend, setPend] = useState<{ id: string; status: OrderStatus } | null>(null);
  const [msg, setMsg] = useState<{ k: 'ok' | 'bad'; t: string } | null>(null);

  const rows = useMemo(
    () =>
      data.filter(
        (o) =>
          (!f || o.status === f) &&
          (!payFilter || o.payment.status === payFilter) &&
          (!s ||
            `${o.id} ${o.address.fullName} ${o.address.phone} ${o.email ?? ''}`
              .toLowerCase()
              .includes(s.toLowerCase())),
      ),
    [data, s, f, payFilter],
  );

  if (loading) return <Loading label="Loading orders..." />;
  if (errorKind) return <AccessStateCard kind={errorKind} message={error} onRetry={reload} loginTo="/login" />;

  return (
    <>
      <Head
        t="Orders"
        subtitle={`${data.length} total orders`}
      />
      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}

      <div className="toolbar">
        <input
          placeholder="Search order ID, customer name, email, or phone..."
          value={s}
          onChange={(e) => {
            setS(e.target.value);
            setPage(1);
          }}
          aria-label="Search orders"
        />
        <select
          value={f}
          onChange={(e) => {
            setF(e.target.value);
            setPage(1);
          }}
          aria-label="Fulfillment status filter"
        >
          <option value="">All Statuses</option>
          {Object.keys(ORDER_TRANSITIONS).map((x) => (
            <option key={x} value={x}>
              {label(x)}
            </option>
          ))}
        </select>
        <select
          value={payFilter}
          onChange={(e) => {
            setPayFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Payment status filter"
        >
          <option value="">All Payments</option>
          <option value="paid_verified">Paid</option>
          <option value="demo_unverified">Test Order</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {selectedOrder && (
        <div className="card pad" style={{ marginBottom: 20, border: '2px solid var(--navy)' }}>
          <div className="row spread" style={{ marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>
                Order #{selectedOrder.id.slice(4, 12).toUpperCase()} ({selectedOrder.role})
              </h3>
            </div>
            <button type="button" className="btn ghost sm" onClick={() => setSelectedOrder(null)}>
              Close
            </button>
          </div>
          <div className="grid g2">
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 13.5 }}>
                <b>Customer:</b> {selectedOrder.address.fullName} ({selectedOrder.address.phone})
                <br />
                <b>Address:</b> {selectedOrder.address.line1}, {selectedOrder.address.city},{' '}
                {selectedOrder.address.state} — {selectedOrder.address.pincode}
              </p>
              <div className="row" style={{ gap: 8 }}>
                <StatusBadge s={selectedOrder.status} />
                <PayBadge s={selectedOrder.payment.status} />
              </div>
            </div>
            <div>
              {selectedOrder.lines.map((l) => (
                <div key={l.sku} className="row spread" style={{ fontSize: 13.5, marginBottom: 6 }}>
                  <span>
                    {l.qty} &times; <b>{l.name}</b> ({l.sku})
                  </span>
                  <span>{formatINR(l.qty * l.unitPaise)}</span>
                </div>
              ))}
              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '8px 0' }} />
              <div className="row spread" style={{ fontWeight: 700 }}>
                <span>Total (incl. GST)</span>
                <span>{formatINR(selectedOrder.totals.totalPaise)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="No matching orders" />
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Items</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {paginate(rows, page, SIZE).map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ fontWeight: 700 }}
                      onClick={() => setSelectedOrder(o)}
                    >
                      #{o.id.slice(4, 12).toUpperCase()}
                    </button>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{o.role}</div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      {o.lines.slice(0, 2).map((l) => {
                        const p = cat.findAny(l.sku);
                        const src = p ? productImage(p) : l.image || productImage({ sku: l.sku, image: '' });
                        return <Img key={l.sku} className="thumb" src={src} alt={l.name} size={42} />;
                      })}
                      <span style={{ fontSize: 13 }}>
                        {o.lines.reduce((acc, l) => acc + l.qty, 0)} units
                      </span>
                    </div>
                  </td>
                  <td>{fmtDate(o.createdAt as number)}</td>
                  <td>
                    <b>{o.address.fullName}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{o.address.phone} · {o.address.city}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{formatINR(o.totals.totalPaise)}</td>
                  <td>
                    <PayBadge s={o.payment.status} />
                  </td>
                  <td>
                    <StatusBadge s={o.status} />
                  </td>
                  <td>
                    {ORDER_TRANSITIONS[o.status].length === 0 ? (
                      <span className="muted" style={{ fontSize: 12 }}>Closed</span>
                    ) : (
                      <select
                        aria-label={`Update status for ${o.id}`}
                        value=""
                        onChange={(e) =>
                          e.target.value && setPend({ id: o.id, status: e.target.value as OrderStatus })
                        }
                      >
                        <option value="">Update status...</option>
                        {ORDER_TRANSITIONS[o.status]
                          .filter((x) => x !== 'placed')
                          .map((x) => (
                            <option key={x} value={x}>
                              {label(x)}
                            </option>
                          ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} pages={Math.ceil(rows.length / SIZE)} onPage={setPage} />

      <Confirm
        open={!!pend}
        danger={pend?.status === 'cancelled'}
        title={`Update order status to ${pend ? label(pend.status) : ''}?`}
        body={
          pend?.status === 'cancelled'
            ? 'Cancelling this order restores reserved stock and notifies the customer.'
            : 'This updates the order status and notifies the customer.'
        }
        confirmLabel="Update Status"
        onCancel={() => setPend(null)}
        onConfirm={async () => {
          const p = pend!;
          setPend(null);
          try {
            await updateOrderStatusAdmin(caller, p.id, p.status);
            setMsg({ k: 'ok', t: `Order #${p.id.slice(4, 12).toUpperCase()} updated to ${label(p.status)}.` });
            reload();
            cat.reload();
          } catch (e) {
            setMsg({ k: 'bad', t: (e as Error).message });
          }
        }}
      />
    </>
  );
}

export function AdminDealers() {
  const { caller } = useAuth();
  const { data, loading, error, errorKind, reload } = useRepoQuery<DealerApplicationRecord>(
    () => listAdminDealerApplications(caller),
    [caller?.uid],
  );
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pend, setPend] = useState<{ uid: string; businessName: string; d: 'approved' | 'rejected' } | null>(null);
  const [msg, setMsg] = useState<{ k: 'ok' | 'bad'; t: string } | null>(null);

  if (loading) return <Loading label="Loading dealer applications..." />;
  if (errorKind) return <AccessStateCard kind={errorKind} message={error} onRetry={reload} loginTo="/login" />;

  const rows = data.filter(
    (a) =>
      (!statusFilter || a.status === statusFilter) &&
      (!search || `${a.businessName} ${a.gstin} ${a.city} ${a.phone}`.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <>
      <Head
        t="Dealer Applications"
        subtitle="Review trade applications and manage wholesale pricing access"
      />
      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}

      <div className="toolbar">
        <input
          placeholder="Search business name, GSTIN, city, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search dealer applications"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter application status"
        >
          <option value="">All ({data.length})</option>
          <option value="pending">Pending ({data.filter((a) => a.status === 'pending').length})</option>
          <option value="approved">Approved ({data.filter((a) => a.status === 'approved').length})</option>
          <option value="rejected">Rejected ({data.filter((a) => a.status === 'rejected').length})</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty title="No matching dealer applications" />
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>GSTIN</th>
                <th>Phone</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.businessName}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{a.city}</div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{a.gstin}</td>
                  <td>{a.phone}</td>
                  <td>{fmtDate(a.createdAt as number)}</td>
                  <td>
                    <span
                      className={`tag ${
                        a.status === 'approved' ? 'ok' : a.status === 'rejected' ? 'bad' : 'warn'
                      }`}
                    >
                      {label(a.status)}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {a.status !== 'approved' && (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => setPend({ uid: a.id, businessName: a.businessName, d: 'approved' })}
                        >
                          Approve
                        </button>
                      )}
                      {a.status !== 'rejected' && (
                        <button
                          type="button"
                          className="btn danger sm"
                          onClick={() => setPend({ uid: a.id, businessName: a.businessName, d: 'rejected' })}
                        >
                          {a.status === 'approved' ? 'Revoke' : 'Reject'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Confirm
        open={!!pend}
        danger={pend?.d === 'rejected'}
        title={
          pend?.d === 'approved'
            ? `Approve ${pend.businessName}?`
            : `Reject ${pend?.businessName}?`
        }
        body={
          pend?.d === 'approved'
            ? 'Approving grants dealer access and wholesale pricing for this account.'
            : 'Wholesale pricing access will be removed for this account.'
        }
        confirmLabel={pend?.d === 'approved' ? 'Approve' : 'Reject'}
        onCancel={() => setPend(null)}
        onConfirm={async () => {
          const p = pend!;
          setPend(null);
          try {
            await decideDealerApplicationAdmin(caller, p.uid, p.d);
            setMsg({ k: 'ok', t: `${p.businessName} marked as ${p.d}.` });
            reload();
          } catch (e) {
            setMsg({ k: 'bad', t: (e as Error).message });
          }
        }}
      />
    </>
  );
}

export function AdminCustomers() {
  const { caller } = useAuth();
  const { data, loading, error, errorKind, reload } = useRepoQuery<UserProfileRecord>(
    () => listAdminUsers(caller),
    [caller?.uid],
  );
  const apps = useRepoQuery<DealerApplicationRecord>(
    () => listAdminDealerApplications(caller),
    [caller?.uid],
  );
  const orders = useRepoQuery<OrderRecord>(() => listAdminOrders(caller), [caller?.uid]);

  const [s, setS] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  if (loading) return <Loading label="Loading customers..." />;
  if (errorKind) return <AccessStateCard kind={errorKind} message={error} onRetry={reload} loginTo="/login" />;

  const dealerMap = new Map(apps.data.map((a) => [a.id, a]));
  const rows = data.filter((u) => {
    const effRole = u.role ?? (dealerMap.get(u.id)?.status === 'approved' ? 'dealer' : 'customer');
    if (roleFilter && effRole !== roleFilter) return false;
    if (s && !`${u.displayName} ${u.email} ${u.phone}`.toLowerCase().includes(s.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <Head
        t="Customers"
        subtitle={`${data.length} registered accounts`}
      />

      <div className="toolbar">
        <input
          placeholder="Search by name, email, or phone..."
          value={s}
          onChange={(e) => {
            setS(e.target.value);
            setPage(1);
          }}
          aria-label="Search customers"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
        >
          <option value="">All Roles</option>
          <option value="customer">Customers</option>
          <option value="dealer">Dealers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty title="No matching accounts" />
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Orders</th>
                <th>Total Spend</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {paginate(rows, page, SIZE).map((u) => {
                const userOrders = orders.data.filter((o) => o.uid === u.id && o.status !== 'cancelled');
                const totalSpend = userOrders.reduce((acc, o) => acc + o.totals.totalPaise, 0);
                const effRole = u.role ?? (dealerMap.get(u.id)?.status === 'approved' ? 'dealer' : 'customer');
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.displayName || '—'}</b>
                      {dealerMap.get(u.id) && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {dealerMap.get(u.id)!.businessName}
                        </div>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <span className={`tag ${effRole === 'admin' ? 'navy' : effRole === 'dealer' ? 'ok' : ''}`}>
                        {effRole}
                      </span>
                    </td>
                    <td>{userOrders.length}</td>
                    <td style={{ fontWeight: 700 }}>{formatINR(totalSpend)}</td>
                    <td>{fmtDate(u.createdAt as number)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} pages={Math.ceil(rows.length / SIZE)} onPage={setPage} />
    </>
  );
}

export function AdminService() {
  const { caller } = useAuth();
  const { data, loading, error, errorKind, reload } = useRepoQuery<ServiceBookingRecord>(
    () => listAdminServiceBookings(caller),
    [caller?.uid],
  );
  const [f, setF] = useState('');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ k: 'ok' | 'bad'; t: string } | null>(null);

  if (loading) return <Loading label="Loading service requests..." />;
  if (errorKind) return <AccessStateCard kind={errorKind} message={error} onRetry={reload} loginTo="/login" />;

  const rows = data.filter(
    (b) =>
      (!f || b.status === f) &&
      (!search ||
        `${b.contactName} ${b.contactPhone} ${b.productSku} ${b.address.city} ${b.assignedTo ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  const upd = async (id: string, patch: { status?: ServiceStatus; assignedTo?: string }) => {
    try {
      await updateServiceBookingAdmin(caller, id, patch);
      setMsg({ k: 'ok', t: 'Service booking updated.' });
      reload();
    } catch (e) {
      setMsg({ k: 'bad', t: (e as Error).message });
    }
  };

  return (
    <>
      <Head
        t="Service Requests"
        subtitle="Assign technicians and update installation or maintenance visits"
      />
      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}

      <div className="toolbar">
        <input
          placeholder="Search customer, phone, SKU, city, or technician..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search service requests"
        />
        <select value={f} onChange={(e) => setF(e.target.value)} aria-label="Status filter">
          <option value="">All Statuses ({data.length})</option>
          {(['requested', 'assigned', 'in_progress', 'completed', 'cancelled'] as const).map((x) => (
            <option key={x} value={x}>
              {label(x)}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty title="No matching service requests" />
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Service &amp; SKU</th>
                <th>Customer</th>
                <th>Address</th>
                <th>Preferred Slot</th>
                <th>Technician</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b>{label(b.serviceType)}</b>
                    <div className="muted" style={{ fontSize: 12 }}>SKU: {b.productSku}</div>
                    {b.notes && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>&ldquo;{b.notes}&rdquo;</div>}
                  </td>
                  <td>
                    <b>{b.contactName}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{b.contactPhone}</div>
                  </td>
                  <td>
                    {b.address.line1}, {b.address.city} {b.address.pincode}
                    {b.address.lat != null && (
                      <div>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${b.address.lat}&mlon=${b.address.lng}#map=16/${b.address.lat}/${b.address.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--navy)', fontWeight: 700, fontSize: 12 }}
                        >
                          Map &nearr;
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    <b>{b.preferredDate}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{b.preferredSlot}</div>
                  </td>
                  <td>
                    <input
                      aria-label={`Assign technician for ${b.contactName}`}
                      defaultValue={b.assignedTo}
                      placeholder="Assign technician..."
                      onBlur={(e) =>
                        e.target.value.trim() !== (b.assignedTo ?? '') &&
                        upd(b.id, {
                          assignedTo: e.target.value.trim(),
                          ...(b.status === 'requested' && e.target.value.trim() ? { status: 'assigned' } : {}),
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Status for ${b.contactName}`}
                      value={b.status}
                      onChange={(e) => upd(b.id, { status: e.target.value as ServiceStatus })}
                    >
                      {(['requested', 'assigned', 'in_progress', 'completed', 'cancelled'] as const).map((x) => (
                        <option key={x} value={x}>
                          {label(x)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Service types: {serviceTypes.map(label).join(', ')}.
      </p>
    </>
  );
}

export function AdminNotifications() {
  const { caller } = useAuth();
  const { data, loading, error, errorKind, reload } = useRepoQuery<NotificationRecord>(
    () => listAdminNotifications(caller),
    [caller?.uid],
  );

  if (loading) return <Loading label="Loading notifications..." />;
  if (errorKind) return <AccessStateCard kind={errorKind} message={error} onRetry={reload} loginTo="/login" />;

  return (
    <>
      <Head
        t="Notifications"
        subtitle="System notifications and delivery status"
      />

      <div className="grid g3" style={{ marginBottom: 20 }}>
        <div className="card pad">
          <div className="row spread" style={{ marginBottom: 6 }}>
            <strong>In-App Notifications</strong>
            <span className="tag ok">Active</span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Order, dealer approval, and service updates are delivered to user accounts automatically.
          </p>
        </div>

        <div className="card pad">
          <div className="row spread" style={{ marginBottom: 6 }}>
            <strong>Email Relay (EmailJS)</strong>
            <span className="tag warn">Server Config</span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Configure <code>EMAILJS_SERVICE_ID</code>, <code>EMAILJS_TEMPLATE_ID</code>, and <code>EMAILJS_PRIVATE_KEY</code> to send transactional emails.
          </p>
        </div>

        <div className="card pad">
          <div className="row spread" style={{ marginBottom: 6 }}>
            <strong>Mobile Push &amp; SMS</strong>
            <span className="tag">Optional</span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Android push uses <code>google-services.json</code>. Unconfigured channels are skipped without blocking orders.
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <Empty title="No notifications logged yet" />
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Message</th>
                <th>Channel</th>
              </tr>
            </thead>
            <tbody>
              {data.map((n) => (
                <tr key={n.id}>
                  <td>{fmtDate(n.createdAt as number)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{n.uid}</td>
                  <td>
                    <b>{n.title}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{n.body}</div>
                  </td>
                  <td>
                    <span className="tag">{channelText(n.channels) || 'In-app'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
