import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CATEGORIES, CATEGORY_LABEL, type Role } from '@califnco/shared';
import { useAuth } from '../context/Auth';
import { useCart } from '../context/Cart';
import { AccessStateCard, Loading } from './ui';

export function Layout() {
  const { user, role, logout } = useAuth();
  const { count } = useCart();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp] = useSearchParams();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(sp.get('q') ?? '');
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('califnco.theme') === 'dark';
    } catch {
      return false;
    }
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try {
      localStorage.setItem('califnco.theme', dark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [dark]);

  useEffect(() => {
    setSearchQuery(sp.get('q') ?? '');
  }, [sp]);

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const activeCategory = loc.pathname === '/catalog' ? sp.get('category') : null;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    nav(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
    setMobileOpen(false);
  }

  return (
    <>
      <a className="sr" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="header-inner">
          <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            </button>

            <Link to="/" className="brand-logo" aria-label="Califnco home">
              <span className="brand-wordmark">Califnco</span>
              <span className="brand-sub">Water Systems</span>
            </Link>
          </div>

          <nav className="primary-nav" aria-label="Primary">
            <NavLink end to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
              Home
            </NavLink>
            <Link
              to="/catalog?category=purifiers"
              className={activeCategory === 'purifiers' ? 'active' : ''}
            >
              Water Purifiers
            </Link>
            <Link
              to="/catalog?category=filters"
              className={activeCategory === 'filters' || activeCategory === 'cartridges' ? 'active' : ''}
            >
              Filters &amp; Accessories
            </Link>
            <Link
              to="/catalog?category=dispensers"
              className={activeCategory === 'dispensers' ? 'active' : ''}
            >
              Dispensers
            </Link>
            <Link
              to="/catalog?category=pumps"
              className={activeCategory === 'pumps' ? 'active' : ''}
            >
              Pumps
            </Link>
            <NavLink to="/service" className={({ isActive }) => (isActive ? 'active' : '')}>
              Installation/Service
            </NavLink>
            <NavLink to="/dealer" className={({ isActive }) => (isActive ? 'active' : '')}>
              Dealers
            </NavLink>
          </nav>

          <div className="header-right">
            <form className="header-search" role="search" onSubmit={submitSearch}>
              <span className="header-search-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                name="q"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                aria-label="Search products"
              />
            </form>

            {user ? (
              <div className="account-menu-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="account-trigger"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <span className="account-label">{user.displayName?.split(' ')[0] || 'Account'}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="account-dropdown" role="menu" aria-label="Account options">
                    <div className="account-dropdown-header">
                      <strong>{user.displayName || 'Account'}</strong>
                      <span>{user.email}</span>
                    </div>

                    {role === 'admin' && (
                      <>
                        <Link to="/admin" role="menuitem">
                          <span>Admin Console</span>
                        </Link>
                        <div className="account-dropdown-divider" />
                      </>
                    )}

                    {role === 'dealer' && (
                      <>
                        <Link to="/dealer" role="menuitem">
                          <span>Dealer Portal</span>
                        </Link>
                        <div className="account-dropdown-divider" />
                      </>
                    )}

                    <Link to="/profile" role="menuitem">
                      <span>Profile &amp; Addresses</span>
                    </Link>
                    <Link to="/orders" role="menuitem">
                      <span>Orders</span>
                    </Link>
                    <Link to="/service" role="menuitem">
                      <span>Service Requests</span>
                    </Link>
                    <Link to="/notifications" role="menuitem">
                      <span>Notifications</span>
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setDark((d) => !d)}
                    >
                      <span>Appearance: {dark ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>

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
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link className="account-trigger" to="/login">
                <span className="account-label">Sign in</span>
              </Link>
            )}

            <Link className="cart-btn" to="/cart" aria-label={`Cart, ${count} items`}>
              <span className="cart-label">Cart</span>
              <b className="cart-badge">{count}</b>
            </Link>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileOpen(false)}>
          <aside
            className="mobile-drawer"
            aria-label="Mobile navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-drawer-top">
              <Link to="/" className="brand-logo" onClick={() => setMobileOpen(false)}>
                <span className="brand-wordmark">Califnco</span>
                <span className="brand-sub">Water Systems</span>
              </Link>
              <button
                type="button"
                className="btn ghost sm"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mobile-drawer-body">
              <form role="search" onSubmit={submitSearch}>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products"
                />
              </form>

              <nav className="mobile-nav-list" aria-label="Mobile primary">
                <NavLink end to="/">Home</NavLink>
                <Link to="/catalog?category=purifiers">Water Purifiers</Link>
                <Link to="/catalog?category=filters">Filters &amp; Accessories</Link>
                <Link to="/catalog?category=cartridges">Cartridges &amp; Membranes</Link>
                <Link to="/catalog?category=dispensers">Dispensers</Link>
                <Link to="/catalog?category=pumps">Pumps</Link>
                <Link to="/catalog?category=spare-parts">Spare Parts</Link>
                <NavLink to="/service">Installation &amp; Service</NavLink>
                <NavLink to="/dealer">Dealers</NavLink>
              </nav>

              <div className="mobile-account-box">
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setDark((d) => !d)}
                >
                  Appearance: {dark ? 'Dark Mode' : 'Light Mode'}
                </button>
                {user ? (
                  <>
                    <div style={{ fontSize: 13 }}>
                      <strong>{user.displayName || 'Account'}</strong>
                      <div className="muted">{user.email}</div>
                    </div>
                    {role === 'admin' && (
                      <Link className="btn accent sm" to="/admin">
                        Admin Console
                      </Link>
                    )}
                    <Link className="btn ghost sm" to="/profile">
                      Profile &amp; Addresses
                    </Link>
                    <Link className="btn ghost sm" to="/orders">
                      Orders
                    </Link>
                    <Link className="btn ghost sm" to="/notifications">
                      Notifications
                    </Link>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => {
                        setMobileOpen(false);
                        void logout();
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="btn sm" to="/login">
                      Sign in
                    </Link>
                    <Link className="btn ghost sm" to="/register">
                      Create account
                    </Link>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      <main id="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="cols">
            <div>
              <h3 style={{ fontSize: '1.05rem', letterSpacing: '0.04em' }}>CALIFNCO</h3>
              <p style={{ color: '#B4C9DA', maxWidth: 300 }}>
                Domestic and commercial water purifiers, dispensers, booster pumps, and replacement filters with technician installation and maintenance across India.
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: '#8FB0C9' }}>
                Support: 1800-425-7873 (Mon–Sat, 9 AM – 7 PM)<br />
                Email: support@califnco.com
              </p>
            </div>

            <div>
              <h3>Products</h3>
              {CATEGORIES.map((c) => (
                <div key={c}>
                  <Link to={`/catalog?category=${c}`}>{CATEGORY_LABEL[c]}</Link>
                </div>
              ))}
            </div>

            <div>
              <h3>Service &amp; Support</h3>
              <div><Link to="/service">Book a Service Visit</Link></div>
              <div><Link to="/service?type=installation">New Purifier Installation</Link></div>
              <div><Link to="/service?type=filter_replacement">Filter Replacement</Link></div>
              <div><Link to="/orders">Track Orders</Link></div>
            </div>

            <div>
              <h3>Account &amp; Trade</h3>
              <div><Link to="/profile">My Account</Link></div>
              <div><Link to="/dealer">Dealer Portal</Link></div>
              <div><Link to="/dealer/login">Dealer Application</Link></div>
              <div><Link to="/admin">Admin Sign In</Link></div>
              <div>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#8FB0C9', padding: 0, cursor: 'pointer', fontSize: 13 }}
                  onClick={() => setDark((d) => !d)}
                >
                  Theme: {dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </button>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>&copy; {new Date().getFullYear()} Califnco Water Systems Pvt. Ltd.</span>
            <span>Prices exclude 18% GST. Free delivery on retail orders ₹5,000 and above.</span>
          </div>
        </div>
      </footer>
    </>
  );
}

/** UI authorization guard with explicit distinction between signed-out and unauthorized role states. */
export function Guard({
  roles,
  children,
  to = '/login',
}: {
  roles?: Role[];
  children: ReactNode;
  to?: string;
}) {
  const { user, role, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="wrap" style={{ paddingTop: 40 }}><Loading /></div>;
  if (!user) return <Navigate to={to} state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(role)) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        <AccessStateCard
          kind="unauthorized"
          loginTo={to}
          message={`Your signed-in account (${user.email}, role: ${role}) does not have ${roles.join(' or ')} access.`}
        />
      </div>
    );
  }
  return <>{children}</>;
}
