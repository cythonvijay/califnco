import { Link } from 'react-router-dom';
import { CATEGORY_LABEL, type Category } from '@califnco/shared';
import { ProductCard } from '../components/ProductCard';
import { Empty, Loading } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCatalog } from '../hooks/useCatalog';
import { categoryImage, familyPhoto, heroPhoto, installPhoto } from '../lib/images';

const CATEGORY_CARDS: { c: Category; sub: string }[] = [
  { c: 'purifiers', sub: 'RO, UV & gravity systems for home and office' },
  { c: 'dispensers', sub: 'Bottom-loading and countertop hot & cold units' },
  { c: 'pumps', sub: '24V DC booster and raw-water transfer pumps' },
  { c: 'filters', sub: '10-inch spun PP sediment and carbon block filters' },
  { c: 'cartridges', sub: 'RO membranes, UV lamps, and mineral cartridges' },
  { c: 'spare-parts', sub: 'Faucets, solenoid valves, SMPS adapters & tubing' },
];

export default function Home() {
  const cat = useCatalog();
  const { role } = useAuth();
  const hero = heroPhoto();
  const family = familyPhoto();
  const install = installPhoto();

  const explicitlyFeatured = cat.products.filter((p) => p.featured);
  const featuredProducts = (
    explicitlyFeatured.length > 0
      ? explicitlyFeatured
      : cat.products.filter((p) => p.category === 'purifiers' && p.stock > 0)
  ).slice(0, 4);

  const replacementProducts = cat.products
    .filter((p) => (p.category === 'filters' || p.category === 'cartridges') && p.stock > 0)
    .slice(0, 4);

  const countByCategory = (c: Category) => cat.products.filter((p) => p.category === c).length;

  return (
    <>
      {/* 1. HERO */}
      <section className="hero-banner">
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>RO &amp; UV Water Purifiers for Home and Commercial Use</h1>
            <p className="hero-lead">
              Multi-stage water purification systems built for Indian municipal, borewell, and tanker water supplies. Includes standard installation and a 1-year onsite warranty.
            </p>
            <div className="row" style={{ gap: 12 }}>
              <Link className="btn accent lg" to="/catalog?category=purifiers">
                Shop Water Purifiers
              </Link>
              <Link
                className="btn ghost lg"
                style={{
                  background: 'transparent',
                  color: '#FFFFFF',
                  borderColor: 'rgba(255,255,255,0.35)',
                }}
                to="/service"
              >
                Book Installation / Service
              </Link>
            </div>

            <div className="hero-kpis">
              <div>
                <strong>Up to 2,000 ppm TDS</strong>
                <span>Suitable for borewell, tanker, and municipal water</span>
              </div>
              <div>
                <strong>48-Hour Installation</strong>
                <span>Technician visit &amp; water TDS check included</span>
              </div>
              <div>
                <strong>1-Year Onsite Warranty</strong>
                <span>Direct service support and genuine spare parts</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-photo-frame">
              <img
                src={hero}
                alt="Califnco countertop RO+UV water purifier dispensing water in a home kitchen"
                width={960}
                height={600}
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. FEATURED PRODUCTS */}
      <section className="section wrap-in">
        <div className="section-header">
          <div>
            <h2>Featured Water Purifiers</h2>
            <p>Popular domestic and commercial purification systems in stock</p>
          </div>
          <div className="row">
            {role === 'admin' && (
              <Link className="btn ghost sm" to="/admin/products">
                Manage Products
              </Link>
            )}
            <Link className="btn ghost sm" to="/catalog?category=purifiers">
              View all purifiers &rarr;
            </Link>
          </div>
        </div>

        {cat.loading ? (
          <Loading label="Loading products..." />
        ) : featuredProducts.length === 0 ? (
          <Empty
            title="No active products in the catalog"
            action={
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link className="btn" to="/admin/products">
                  Manage Products in Admin
                </Link>
                <Link className="btn ghost" to="/service">
                  Book Service Visit
                </Link>
              </div>
            }
          >
            There are currently no published products in the catalog.
          </Empty>
        ) : (
          <div className="grid g4">
            {featuredProducts.map((p) => (
              <ProductCard key={p.sku} p={p} price={cat.priceOf(p.sku)} wholesale={role === 'dealer'} />
            ))}
          </div>
        )}
      </section>

      {/* 3. SHOP BY CATEGORY */}
      <section className="section wrap-in">
        <div className="section-header">
          <div>
            <h2>Shop by Category</h2>
            <p>Purifiers, dispensers, booster pumps, replacement filters, and spare parts</p>
          </div>
          <Link className="btn ghost sm" to="/catalog">
            Browse full catalog ({cat.products.length}) &rarr;
          </Link>
        </div>

        <div className="catgrid">
          {CATEGORY_CARDS.map(({ c, sub }) => {
            const count = countByCategory(c);
            return (
              <Link key={c} to={`/catalog?category=${c}`} className="cattile">
                <div className="cattile-body">
                  <h3>{CATEGORY_LABEL[c]}</h3>
                  <p>{sub}</p>
                  <span className="cattile-link">
                    {count} {count === 1 ? 'product' : 'products'} &rarr;
                  </span>
                </div>
                <div className="cattile-img">
                  <img
                    src={categoryImage(c)}
                    alt={CATEGORY_LABEL[c]}
                    loading="lazy"
                    width={320}
                    height={220}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. FILTRATION STAGES */}
      <section className="section wrap-in">
        <div className="band">
          <div className="row spread" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
            <div>
              <h2>How Multi-Stage RO + UV Filtration Works</h2>
              <p className="muted" style={{ margin: 0, maxWidth: 620 }}>
                Each purifier combines sediment filtration, activated carbon, reverse osmosis, and UV-C disinfection matched to your input water quality.
              </p>
            </div>
            <Link className="btn accent sm" to="/catalog?category=purifiers">
              Compare Models
            </Link>
          </div>

          <ol className="stages">
            <li>
              <h3>5-Micron Pre-Sediment</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Spun polypropylene stage traps rust, silt, and suspended dirt particles.
              </p>
            </li>
            <li>
              <h3>Activated Carbon Block</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Removes free chlorine, organic chemicals, and odor before the RO membrane.
              </p>
            </li>
            <li>
              <h3>RO Membrane</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Reduces dissolved salts, hardness, heavy metals, and high input TDS up to 96%.
              </p>
            </li>
            <li>
              <h3>UV-C Disinfection</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                254 nm UV-C lamp inactivates waterborne bacteria and viruses without chemicals.
              </p>
            </li>
            <li>
              <h3>Post-Carbon &amp; Mineralizer</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Restores calcium and magnesium minerals and balances pH for clean drinking taste.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* 5. REPLACEMENT FILTERS & CARTRIDGES */}
      {replacementProducts.length > 0 && (
        <section className="section wrap-in">
          <div className="section-header">
            <div>
              <h2>Replacement Filters &amp; Service Kits</h2>
              <p>Standard 10-inch filters, 1812 RO membranes, UV lamps, and annual maintenance kits</p>
            </div>
            <Link className="btn ghost sm" to="/catalog?category=cartridges">
              View all filters &amp; cartridges &rarr;
            </Link>
          </div>

          <div className="grid g4">
            {replacementProducts.map((p) => (
              <ProductCard key={p.sku} p={p} price={cat.priceOf(p.sku)} wholesale={role === 'dealer'} />
            ))}
          </div>
        </section>
      )}

      {/* 6. INSTALLATION & SERVICE */}
      <section className="section wrap-in">
        <div className="split-banner">
          <div className="split-banner-copy">
            <h2>Doorstep Installation &amp; Periodic Maintenance</h2>
            <p className="muted">
              Schedule a technician visit online for new purifier installation, filter replacement, repair, or annual maintenance. Our technicians check raw and output water TDS at every visit.
            </p>
            <ul style={{ paddingLeft: 18, color: 'var(--ink)', fontSize: 14, marginBottom: 22 }}>
              <li style={{ marginBottom: 6 }}>Wall-mount or countertop installation within 24–48 hours of delivery</li>
              <li style={{ marginBottom: 6 }}>TDS and feed-pressure check included with every service visit</li>
              <li style={{ marginBottom: 6 }}>Morning, afternoon, and evening appointment slots available</li>
            </ul>
            <div className="row">
              <Link className="btn" to="/service">
                Book a Service Visit
              </Link>
              <Link className="btn ghost" to="/catalog?category=filters">
                Shop Replacement Filters
              </Link>
            </div>
          </div>
          <div className="split-banner-media">
            <img
              src={install}
              alt="Technician testing water TDS next to a wall-mounted RO water purifier"
              loading="lazy"
              width={720}
              height={540}
            />
          </div>
        </div>
      </section>

      {/* 7. WATER GUIDE & DEALER SUPPLY */}
      <section className="section wrap-in">
        <div className="grid g2">
          <div className="card">
            <img
              src={family}
              alt="Family pouring drinking water in a kitchen"
              style={{ width: '100%', height: 220, objectFit: 'cover' }}
              loading="lazy"
            />
            <div className="pad">
              <h3>Choosing the Right Purifier for Your Water Supply</h3>
              <p className="muted" style={{ marginBottom: 14 }}>
                For municipal tap water with low TDS (under 200 ppm), a UV+UF or gravity purifier is sufficient. For borewell or tanker water with high TDS (200–2,000 ppm), choose an RO+UV+Mineralizer system.
              </p>
              <Link className="btn ghost sm" to="/catalog?category=purifiers">
                Compare Purifiers &rarr;
              </Link>
            </div>
          </div>

          <div className="card pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--surface)' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--navy)' }}>
                Wholesale Supply for Dealers &amp; Contractors
              </h3>
              <p className="muted" style={{ marginTop: 8 }}>
                We supply water treatment dealers, service technicians, and commercial contractors with wholesale pricing on purifiers, pumps, membranes, and spare parts.
              </p>
              <div className="card pad" style={{ background: 'var(--bg)', marginTop: 14, marginBottom: 18 }}>
                <div className="row spread" style={{ fontSize: 13.5, marginBottom: 6 }}>
                  <strong>Minimum Order Quantity</strong>
                  <span>10 units total</span>
                </div>
                <div className="row spread" style={{ fontSize: 13.5, marginBottom: 6 }}>
                  <strong>Bulk Shipping</strong>
                  <span>Free on all dealer orders</span>
                </div>
                <div className="row spread" style={{ fontSize: 13.5 }}>
                  <strong>Eligibility</strong>
                  <span>Valid GSTIN &amp; account approval</span>
                </div>
              </div>
            </div>
            <div className="row">
              <Link className="btn" to="/dealer">
                Dealer Portal
              </Link>
              <Link className="btn ghost" to="/dealer/login">
                Apply for Dealer Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. SERVICE & WARRANTY ASSURANCES */}
      <section className="section wrap-in">
        <div className="trust-grid">
          <div className="trust-card">
            <strong>Free Standard Installation</strong>
            <p>Included with every domestic water purifier. Book your preferred date and time slot online.</p>
          </div>
          <div className="trust-card">
            <strong>1-Year Onsite Warranty</strong>
            <p>Covers electrical parts, booster pumps, and manufacturing defects on all purifiers and dispensers.</p>
          </div>
          <div className="trust-card">
            <strong>Compatible Spare Parts</strong>
            <p>Every filter, membrane, and spare component lists exact compatible purifier models by SKU.</p>
          </div>
          <div className="trust-card">
            <strong>GST Invoice on Every Order</strong>
            <p>Transparent pricing with 18% GST breakdown and free delivery on retail orders ₹5,000 and above.</p>
          </div>
        </div>
      </section>
    </>
  );
}
