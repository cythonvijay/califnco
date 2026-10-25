import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORY_LABEL, formatINR, type Product } from '@califnco/shared';
import { useCart } from '../context/Cart';
import { productImage } from '../lib/images';
import { Img } from './ui';

export function ProductCard({
  p,
  price,
  wholesale,
}: {
  p: Product;
  price: number | null;
  wholesale?: boolean;
}) {
  const cart = useCart();
  const nav = useNavigate();
  const [justAdded, setJustAdded] = useState(false);
  const out = p.stock === 0;
  const hasSale = !wholesale && p.salePricePaise && p.salePricePaise > 0 && p.salePricePaise < p.pricePaise;
  const defaultQty = wholesale ? 10 : 1;

  function handleBuyNow() {
    cart.add(p.sku, defaultQty);
    nav('/checkout');
  }

  function handleAdd() {
    cart.add(p.sku, defaultQty);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <article className="card pcard">
      <Link to={`/product/${p.sku}`} className="pimg" aria-label={p.name}>
        <Img src={productImage(p)} alt={p.imageAlt || p.name} />
        <div className="pbadges">
          <div>{p.featured && <span className="tag navy">Featured</span>}</div>
          <span className={`tag ${out ? 'bad' : p.stock <= 10 ? 'warn' : 'ok'}`}>
            {out ? 'Out of stock' : p.stock <= 10 ? `${p.stock} left` : 'In stock'}
          </span>
        </div>
      </Link>

      <div className="b">
        <div className="row spread" style={{ gap: 6 }}>
          <span className="pcard-cat">{CATEGORY_LABEL[p.category] ?? p.category}</span>
          <span className="muted" style={{ fontSize: 11.5 }}>{p.sku}</span>
        </div>

        <h3 className="pcard-title">
          <Link to={`/product/${p.sku}`}>{p.name}</Link>
        </h3>

        <div className="pcard-specs-line">
          {Object.entries(p.specs)
            .slice(0, 2)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ')}
        </div>

        {p.rating && p.rating.count > 0 && (
          <div style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 700 }}>
            &#9733; {p.rating.average.toFixed(1)} <span className="muted">({p.rating.count})</span>
          </div>
        )}

        <div className="pcard-price-row">
          <div>
            <span className="price">{price === null ? 'Price unavailable' : formatINR(price)}</span>
            {hasSale && <span className="price-strike">{formatINR(p.pricePaise)}</span>}
            <div className="muted" style={{ fontSize: 11.5 }}>
              {wholesale ? 'Wholesale · excl. GST' : 'Excl. 18% GST'}
            </div>
          </div>
        </div>

        <div className="pcard-actions">
          <button
            type="button"
            className="btn sm"
            style={{ flex: 1 }}
            disabled={out || price === null}
            onClick={handleBuyNow}
          >
            {out ? 'Out of stock' : 'Buy Now'}
          </button>
          {!out && (
            <button
              type="button"
              className={`btn ghost xs ${justAdded ? 'accent' : ''}`}
              disabled={price === null}
              onClick={handleAdd}
              aria-label={`Add ${p.name} to cart`}
              title="Add to cart"
            >
              {justAdded ? 'Added' : '+ Cart'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
