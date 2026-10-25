import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DEALER_MIN_UNITS, dealerApplicationSchema, formatINR } from '@califnco/shared';
import { Field, Img, Loading, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCart } from '../context/Cart';
import { useCatalog } from '../hooks/useCatalog';
import { useRepoQuery } from '../hooks/useQuery';
import { productImage } from '../lib/images';
import {
  getMyDealerApplication,
  listCustomerOrders,
  submitDealerApplication,
  type DealerApplicationRecord,
  type OrderRecord,
} from '../lib/api';
import { LoginForm } from '../pages/Auth';

export function DealerShell() {
  const { user, role, logout } = useAuth();
  const { count } = useCart();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const initials = (user?.displayName || user?.email || 'D')
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header className="site-header" style={{ background: 'var(--navy)', borderColor: 'rgba(255,255,255,0.12)' }}>
        <div className="header-inner">
          <div className="row" style={{ gap: 14 }}>
            <Link to="/dealer" className="brand-logo">
              <span className="brand-wordmark" style={{ color: '#FFFFFF' }}>CALIFNCO</span>
              <span className="brand-sub" style={{ color: '#72C9E8', borderLeftColor: 'rgba(255,255,255,0.2)' }}>
                Dealer Portal
              </span>
            </Link>
          </div>

          <nav className="primary-nav" aria-label="Dealer navigation">
            <NavLink
              end
              to="/dealer"
              style={({ isActive }) => ({
                color: isActive ? 'var(--navy)' : '#DCEAF2',
                background: isActive ? 'var(--ice)' : 'transparent',
              })}
            >
              Overview
            </NavLink>
            <NavLink
              to="/dealer/catalog"
              style={({ isActive }) => ({
                color: isActive ? 'var(--navy)' : '#DCEAF2',
                background: isActive ? 'var(--ice)' : 'transparent',
              })}
            >
              Wholesale Catalog
            </NavLink>
            <NavLink
              to="/dealer/cart"
              style={({ isActive }) => ({
                color: isActive ? 'var(--navy)' : '#DCEAF2',
                background: isActive ? 'var(--ice)' : 'transparent',
              })}
            >
              Cart ({count})
            </NavLink>
            <NavLink
              to="/dealer/orders"
              style={({ isActive }) => ({
                color: isActive ? 'var(--navy)' : '#DCEAF2',
                background: isActive ? 'var(--ice)' : 'transparent',
              })}
            >
              Orders
            </NavLink>
            <NavLink
              to="/dealer/account"
              style={({ isActive }) => ({
                color: isActive ? 'var(--navy)' : '#DCEAF2',
                background: isActive ? 'var(--ice)' : 'transparent',
              })}
            >
              Account
            </NavLink>
          </nav>

          <div className="header-right">
            <Link className="btn ghost sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)' }} to="/">
              Storefront
            </Link>

            {user ? (
              <div className="account-menu-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="account-trigger"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <span className="account-avatar" aria-hidden="true">
                    {initials}
                  </span>
                  <span className="account-label">{user.displayName?.split(' ')[0] || 'Dealer'}</span>
                </button>
                {menuOpen && (
                  <div className="account-dropdown" role="menu">
                    <div className="account-dropdown-header">
                      <strong>{user.displayName || 'Dealer Account'}</strong>
                      <span>{user.email}</span>
                    </div>
                    <Link to="/dealer/account" role="menuitem">Trade Account &amp; GSTIN</Link>
                    <Link to="/dealer/orders" role="menuitem">Bulk Orders</Link>
                                        <div className="account-dropdown-divider" />
                    <button
                      type="button"
                      role="menuitem"
                      className="signout-item"
                      onClick={() => {
                        setMenuOpen(false);
                        void logout();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link className="btn accent sm" to="/dealer/login">
                Dealer Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="wrap" style={{ flex: 1, paddingTop: 28, paddingBottom: 48, width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}

function Application() {
  const { caller, refreshRole } = useAuth();
  const [app, setApp] = useState<DealerApplicationRecord | null | undefined>(undefined);
  const [v, setV] = useState({ businessName: '', gstin: '', phone: '', city: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!caller) return;
    getMyDealerApplication(caller)
      .then((res) => setApp(res))
      .catch(() => setApp(null));
  }, [caller]);

  if (app === undefined) return <Loading label="Checking application status..." />;

  if (app) {
    return (
      <div className="card pad" style={{ background: 'var(--bg)' }}>
        <div className="row spread" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{app.businessName}</h3>
          <span className={`tag ${app.status === 'approved' ? 'ok' : app.status === 'rejected' ? 'bad' : 'warn'}`}>
            {app.status}
          </span>
        </div>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
          GSTIN: <b>{app.gstin}</b> · City: <b>{app.city}</b> · Phone: <b>{app.phone}</b>
        </p>
        {app.status === 'approved' && (
          <Notice kind="ok">
            Your dealer account is approved. Wholesale pricing and bulk ordering (minimum {DEALER_MIN_UNITS} units) are enabled.{' '}
            <button type="button" className="btn sm" style={{ marginLeft: 8 }} onClick={() => void refreshRole()}>
              Refresh Session
            </button>
          </Notice>
        )}
        {app.status === 'pending' && (
          <Notice kind="warn">
            Your dealer application is pending administrator review.
          </Notice>
        )}
        {app.status === 'rejected' && (
          <Notice kind="bad">
            Your dealer application was not approved. Contact trade@califnco.com for assistance.
          </Notice>
        )}
      </div>
    );
  }

  const s = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  return (
    <form
      noValidate
      className="card pad"
      onSubmit={async (e) => {
        e.preventDefault();
        const p = dealerApplicationSchema.safeParse(v);
        if (!p.success) {
          const m: Record<string, string> = {};
          p.error.issues.forEach((i) => {
            m[String(i.path[0])] ??= i.message;
          });
          setErrs(m);
          return;
        }
        setErrs({});
        setErr(null);
        try {
          const created = await submitDealerApplication(caller, p.data);
          setApp(created);
        } catch (ex) {
          setErr((ex as Error).message || 'Could not submit application.');
        }
      }}
    >
      <h2 style={{ fontSize: '1.25rem', marginBottom: 6 }}>Apply for a Dealer Account</h2>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
        Submit your GSTIN and business details for wholesale account approval.
      </p>
      <Field label="Business Name *" error={errs.businessName}>
        <input value={v.businessName} onChange={s('businessName')} placeholder="Blue Drop Water Systems Pvt Ltd" />
      </Field>
      <Field label="15-Character GSTIN *" hint="Format: 33ABCDE1234F1Z5" error={errs.gstin}>
        <input
          value={v.gstin}
          onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })}
          maxLength={15}
          placeholder="33ABCDE1234F1Z5"
        />
      </Field>
      <div className="grid g2">
        <Field label="Business Phone (10 digits) *" error={errs.phone}>
          <input inputMode="numeric" value={v.phone} onChange={s('phone')} maxLength={10} placeholder="9840122334" />
        </Field>
        <Field label="City *" error={errs.city}>
          <input value={v.city} onChange={s('city')} placeholder="Chennai" />
        </Field>
      </div>
      {err && <Notice kind="bad">{err}</Notice>}
      <button type="submit" className="btn">
        Submit Application
      </button>
    </form>
  );
}

export function DealerLogin() {
  const { user, role } = useAuth();
  const nav = useNavigate();

  return (
    <div style={{ maxWidth: 520, margin: '24px auto' }}>
      <div className="card pad">
        <h1 style={{ fontSize: '1.65rem', marginBottom: 8 }}>Dealer Portal</h1>
        {role === 'dealer' ? (
          <>
            <Notice kind="ok">
              Signed in with wholesale access ({user?.email}).
            </Notice>
            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => nav('/dealer')}>
                Open Dashboard
              </button>
              <Link className="btn ghost" to="/dealer/catalog">
                Wholesale Catalog
              </Link>
            </div>
          </>
        ) : user ? (
          <>
            <Notice kind="info">
              Signed in as <b>{user.email}</b>. Submit your GSTIN below to apply for wholesale pricing.
            </Notice>
            <Application />
          </>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 14 }}>
              Sign in below to access wholesale pricing and bulk ordering, or{' '}
              <Link to="/register" style={{ color: 'var(--navy)', fontWeight: 700 }}>
                create an account
              </Link>{' '}
              to apply as a dealer.
            </p>
            <LoginForm expect="dealer" onDone={() => nav('/dealer', { replace: true })} />
          </>
        )}
      </div>
    </div>
  );
}

export function DealerDashboard() {
  const { caller } = useAuth();
  const nav = useNavigate();
  const cat = useCatalog();
  const cart = useCart();
  const { data, loading } = useRepoQuery<OrderRecord>(
    () => listCustomerOrders(caller),
    [caller?.uid],
  );

  if (loading || cat.loading) return <Loading label="Loading dealer portal..." />;

  const open = data.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const spend = data.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.totals.totalPaise, 0);
  const topWholesaleItems = cat.products.slice(0, 6);

  return (
    <>
      <div className="row spread" style={{ marginBottom: 24, alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Dealer Overview</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Wholesale pricing · Minimum order {DEALER_MIN_UNITS} units · Free bulk shipping
          </p>
        </div>
        <div className="row">
          <Link className="btn" to="/dealer/catalog">
            Wholesale Catalog
          </Link>
          <Link className="btn ghost" to="/dealer/cart">
            View Cart
          </Link>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 28 }}>
        <div className="card stat">
          <span className="muted">Orders Placed</span>
          <b>{data.length}</b>
        </div>
        <div className="card stat">
          <span className="muted">Active Orders</span>
          <b>{open}</b>
        </div>
        <div className="card stat">
          <span className="muted">Total Order Volume</span>
          <b>{formatINR(spend)}</b>
        </div>
        <div className="card stat">
          <span className="muted">Available SKUs</span>
          <b>{cat.products.length}</b>
        </div>
      </div>

      <section className="card pad">
        <div className="row spread" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Quick Bulk Order</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Order 10-unit packs at wholesale pricing
            </p>
          </div>
          <Link className="btn ghost sm" to="/dealer/catalog">
            Full Catalog &rarr;
          </Link>
        </div>

        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Retail Price</th>
                <th>Wholesale Price</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {topWholesaleItems.map((p) => {
                const ws = cat.wholesalePriceOf(p.sku) ?? cat.priceOf(p.sku) ?? p.pricePaise;
                return (
                  <tr key={p.sku}>
                    <td>
                      <div className="prodcell">
                        <Img className="thumb" src={productImage(p)} alt={p.imageAlt || p.name} size={48} />
                        <div>
                          <Link to={`/product/${p.sku}`} style={{ fontWeight: 700 }}>
                            {p.name}
                          </Link>
                          <div className="muted" style={{ fontSize: 12 }}>SKU: {p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted" style={{ textDecoration: 'line-through' }}>
                      {formatINR(p.pricePaise)}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--navy)' }}>{formatINR(ws)}</td>
                    <td>
                      <span className={`tag ${p.stock >= 10 ? 'ok' : 'warn'}`}>{p.stock} units</span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn sm"
                          disabled={p.stock < 10}
                          onClick={() => {
                            cart.add(p.sku, 10);
                            nav('/checkout');
                          }}
                        >
                          Buy 10 Now
                        </button>
                        <button
                          type="button"
                          className="btn ghost xs"
                          disabled={p.stock < 10}
                          onClick={() => cart.add(p.sku, 10)}
                        >
                          + Cart
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function DealerAccount() {
  const { user, role } = useAuth();
  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: '1.85rem', marginBottom: 8 }}>Trade Account &amp; GSTIN</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Signed in as <b>{user?.email}</b> ({role})
      </p>
      <Application />
    </div>
  );
}
