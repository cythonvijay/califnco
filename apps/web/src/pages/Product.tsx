import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORY_LABEL, MAX_QTY_CUSTOMER, MAX_QTY_DEALER, formatINR, isProductPublished } from '@califnco/shared';
import { ProductCard } from '../components/ProductCard';
import { Empty, Img, Loading, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCart } from '../context/Cart';
import { useCatalog } from '../hooks/useCatalog';
import { productImages } from '../lib/images';

export default function Product() {
  const { sku } = useParams();
  const nav = useNavigate();
  const cat = useCatalog();
  const cart = useCart();
  const { role } = useAuth();

  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [added, setAdded] = useState(false);
  const [gi, setGi] = useState(0);

  if (cat.loading) return <div className="wrap" style={{ paddingTop: 32 }}><Loading label="Loading product..." /></div>;

  const p = role === 'admin' ? cat.find(sku ?? '') ?? cat.findAny(sku ?? '') : cat.find(sku ?? '');

  if (!p) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        <Empty
          title="Product not found"
          action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn" to="/catalog">
                Browse Catalog
              </Link>
              {role === 'admin' && (
                <Link className="btn ghost" to="/admin/products">
                  Manage Products
                </Link>
              )}
            </div>
          }
        >
          Product {sku} is not available in the catalog.
        </Empty>
      </div>
    );
  }

  const published = isProductPublished(p);
  const price = cat.priceOf(p.sku);
  const hasSale = role !== 'dealer' && p.salePricePaise && p.salePricePaise > 0 && p.salePricePaise < p.pricePaise;
  const gallery = productImages(p);
  const mainImg = gallery[Math.min(gi, gallery.length - 1)]!;
  const max = Math.min(p.stock, role === 'dealer' ? MAX_QTY_DEALER : MAX_QTY_CUSTOMER);

  const compat = cat.products.filter((x) => p.compatibleWith.includes(x.sku));
  const fits = cat.products.filter((x) => x.compatibleWith.includes(p.sku));
  const related = cat.products.filter((x) => x.category === p.category && x.sku !== p.sku).slice(0, 4);

  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <div className="row spread" style={{ marginBottom: 20 }}>
        <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: 13.5 }}>
          <Link to="/">Home</Link> &rsaquo; <Link to="/catalog">Catalog</Link> &rsaquo;{' '}
          <Link to={`/catalog?category=${p.category}`}>{CATEGORY_LABEL[p.category]}</Link> &rsaquo;{' '}
          <strong style={{ color: 'var(--ink)' }}>{p.name}</strong>
        </nav>
        {role === 'admin' && (
          <Link className="btn ghost sm" to={`/admin/products?edit=${encodeURIComponent(p.sku)}`}>
            Edit Product
          </Link>
        )}
      </div>

      {!published && (
        <Notice kind="warn">
          <b>Admin Preview:</b> This product is currently <b>{p.status ?? 'unpublished'}</b> and hidden from customers.
        </Notice>
      )}

      <div className="grid g2" style={{ alignItems: 'start', gap: 36 }}>
        <div>
          <button
            type="button"
            className="card zoom"
            style={{ padding: 0, width: '100%', background: 'var(--surface)' }}
            onClick={() => setZoom(true)}
            aria-label="Enlarge product photograph"
          >
            <Img src={mainImg} alt={p.imageAlt || p.name} size={640} eager />
          </button>

          {gallery.length > 1 && (
            <div className="row" style={{ marginTop: 12, gap: 10 }}>
              {gallery.map((g, i) => (
                <button
                  key={`${g}_${i}`}
                  type="button"
                  className={`gthumb ${i === gi ? 'on' : ''}`}
                  onClick={() => setGi(i)}
                  aria-label={`View angle ${i + 1}`}
                >
                  <Img src={g} alt={`${p.name} view ${i + 1}`} size={72} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>SKU: {p.sku}</span>
            {p.stock === 0 ? (
              <span className="tag bad">Out of Stock</span>
            ) : p.stock <= 10 ? (
              <span className="tag warn">Low Stock ({p.stock} left)</span>
            ) : (
              <span className="tag ok">In Stock ({p.stock} available)</span>
            )}
          </div>

          <h1 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', marginBottom: 12 }}>{p.name}</h1>

          <div className="card pad" style={{ background: 'var(--bg)', marginBottom: 20 }}>
            <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
              <span className="price" style={{ fontSize: '1.75rem' }}>
                {price === null ? 'Price unavailable' : formatINR(price)}
              </span>
              {hasSale && (
                <span className="price-strike" style={{ fontSize: '1.05rem' }}>
                  {formatINR(p.pricePaise)}
                </span>
              )}
            </div>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {role === 'dealer' ? 'Dealer wholesale price' : 'Price'} excludes 18% GST. Free delivery on orders ₹5,000 and above.
            </p>
          </div>

          <p style={{ fontSize: 15, lineHeight: 1.6 }}>{p.description}</p>

          {p.features && p.features.length > 0 && (
            <ul style={{ paddingLeft: 18, margin: '16px 0', fontSize: 14 }}>
              {p.features.map((feat, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>{feat}</li>
              ))}
            </ul>
          )}

          <div className="card pad" style={{ margin: '20px 0' }}>
            <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
              <label className="f" style={{ margin: 0, width: 96 }}>
                <span>Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={max || 1}
                  value={qty}
                  disabled={p.stock === 0 || !published}
                  onChange={(e) =>
                    setQty(Math.max(1, Math.min(max || 1, Math.floor(Number(e.target.value)) || 1)))
                  }
                />
              </label>

              <button
                type="button"
                className="btn lg"
                style={{ flex: 1 }}
                disabled={p.stock === 0 || price === null || !published}
                onClick={() => {
                  cart.add(p.sku, qty);
                  nav('/checkout');
                }}
              >
                {p.stock === 0 ? 'Out of Stock' : 'Buy Now'}
              </button>

              {p.stock > 0 && (
                <button
                  type="button"
                  className={`btn ghost sm ${added ? 'accent' : ''}`}
                  disabled={price === null || !published}
                  onClick={() => {
                    cart.add(p.sku, qty);
                    setAdded(true);
                  }}
                >
                  {added ? 'Added' : '+ Add to Cart'}
                </button>
              )}
            </div>

            {added && (
              <Notice kind="ok">
                Added <b>{qty} &times; {p.name}</b> to cart. <Link to="/cart" style={{ fontWeight: 700, textDecoration: 'underline' }}>View Cart &rarr;</Link>
              </Notice>
            )}
          </div>

          <div className="grid g2" style={{ gap: 12, marginTop: 16 }}>
            {p.warranty && (
              <div className="card" style={{ padding: '12px 14px' }}>
                <strong style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>
                  Warranty
                </strong>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.warranty}</span>
              </div>
            )}
            {p.dimensions && (
              <div className="card" style={{ padding: '12px 14px' }}>
                <strong style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>
                  Dimensions
                </strong>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{p.dimensions}</span>
              </div>
            )}
          </div>

          {p.installationInfo && (
            <div className="card" style={{ padding: '12px 16px', marginTop: 12, background: 'var(--bg)' }}>
              <div className="row spread">
                <div>
                  <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                    Installation &amp; Service
                  </strong>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{p.installationInfo}</span>
                </div>
                <Link className="btn ghost sm" to={`/service?sku=${encodeURIComponent(p.sku)}`}>
                  Book Service
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 36, alignItems: 'start' }}>
        <section className="card pad">
          <h2 style={{ marginBottom: 14, fontSize: '1.25rem' }}>Specifications</h2>
          <table>
            <tbody>
              <tr>
                <th scope="row" style={{ width: '38%' }}>SKU</th>
                <td>{p.sku}</td>
              </tr>
              <tr>
                <th scope="row">Category</th>
                <td>{CATEGORY_LABEL[p.category]}</td>
              </tr>
              {Object.entries(p.specs).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
              {p.dimensions && (
                <tr>
                  <th scope="row">Dimensions</th>
                  <td>{p.dimensions}</td>
                </tr>
              )}
              {p.warranty && (
                <tr>
                  <th scope="row">Warranty</th>
                  <td>{p.warranty}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {p.filtrationStages && p.filtrationStages.length > 0 && (
          <section className="card pad">
            <h2 style={{ marginBottom: 14, fontSize: '1.25rem' }}>Filtration Stages</h2>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.filtrationStages.map((stage, idx) => (
                <li key={idx} style={{ fontSize: 14, lineHeight: 1.5 }}>
                  {stage}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {compat.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div>
              <h2>Compatible Purifiers</h2>
            </div>
          </div>
          <div className="grid g4">
            {compat.map((x) => (
              <ProductCard key={x.sku} p={x} price={cat.priceOf(x.sku)} wholesale={role === 'dealer'} />
            ))}
          </div>
        </section>
      )}

      {fits.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div>
              <h2>Compatible Replacement Filters &amp; Spares</h2>
            </div>
          </div>
          <div className="grid g4">
            {fits.slice(0, 4).map((x) => (
              <ProductCard key={x.sku} p={x} price={cat.priceOf(x.sku)} wholesale={role === 'dealer'} />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section">
          <div className="section-header">
            <div>
              <h2>Related in {CATEGORY_LABEL[p.category]}</h2>
            </div>
            <Link className="btn ghost sm" to={`/catalog?category=${p.category}`}>
              View All &rarr;
            </Link>
          </div>
          <div className="grid g4">
            {related.map((x) => (
              <ProductCard key={x.sku} p={x} price={cat.priceOf(x.sku)} wholesale={role === 'dealer'} />
            ))}
          </div>
        </section>
      )}

      {zoom && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Product photograph"
          onClick={() => setZoom(false)}
          onKeyDown={(e) => e.key === 'Escape' && setZoom(false)}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <img src={mainImg} alt={p.imageAlt || p.name} />
        </div>
      )}
    </div>
  );
}
