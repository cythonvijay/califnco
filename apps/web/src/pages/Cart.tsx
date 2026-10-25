import { Link, useNavigate } from 'react-router-dom';
import {
  DEALER_MIN_UNITS,
  FREE_SHIPPING_ABOVE_PAISE,
  MAX_QTY_CUSTOMER,
  MAX_QTY_DEALER,
  computeTotals,
  formatINR,
  validateLines,
} from '@califnco/shared';
import { Empty, Img, Loading, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCart } from '../context/Cart';
import { useCatalog } from '../hooks/useCatalog';
import { productImage } from '../lib/images';

export function useCartView() {
  const cat = useCatalog();
  const { lines } = useCart();
  const { role } = useAuth();
  const eff = role === 'dealer' ? 'dealer' : 'customer';

  const priced = lines.flatMap((l) => {
    const p = cat.find(l.sku);
    const u = cat.priceOf(l.sku);
    const reg = cat.regularPriceOf(l.sku);
    return p && u !== null
      ? [
          {
            ...l,
            name: p.name,
            category: p.category,
            unitPaise: u,
            regularPaise: reg ?? u,
            stock: p.stock,
            image: productImage(p),
            alt: p.imageAlt || p.name,
          },
        ]
      : [];
  });

  const unavailableSkus = lines
    .filter((l) => !cat.find(l.sku) || cat.priceOf(l.sku) === null)
    .map((l) => l.sku);

  return {
    cat,
    role: eff,
    priced,
    totals: computeTotals(priced, eff),
    errors: validateLines(lines, eff),
    missing: unavailableSkus.length,
    unavailableSkus,
  };
}

export default function Cart() {
  const cart = useCart();
  const nav = useNavigate();
  const { cat, role, priced, totals, errors, missing, unavailableSkus } = useCartView();

  if (cat.loading) return <div className="wrap" style={{ paddingTop: 32 }}><Loading label="Loading cart..." /></div>;

  if (cart.lines.length === 0) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        <Empty
          title="Your cart is empty"
          action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn" to={role === 'dealer' ? '/dealer/catalog' : '/catalog'}>
                Browse Products
              </Link>
              <Link className="btn ghost" to="/service">
                Book Service
              </Link>
            </div>
          }
        >
          Add water purifiers, filters, or accessories from the catalog to place an order.
        </Empty>
      </div>
    );
  }

  const max = role === 'dealer' ? MAX_QTY_DEALER : MAX_QTY_CUSTOMER;
  const totalUnits = priced.reduce((s, l) => s + l.qty, 0);
  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_ABOVE_PAISE - totals.subtotalPaise);

  return (
    <div className={role === 'dealer' ? '' : 'wrap'} style={{ paddingTop: role === 'dealer' ? 0 : 28 }}>
      <div className="row spread" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>
            {role === 'dealer' ? 'Bulk Order Cart' : 'Shopping Cart'} ({totalUnits}{' '}
            {totalUnits === 1 ? 'item' : 'items'})
          </h1>
        </div>
        <div className="row">
          <Link className="btn ghost sm" to={role === 'dealer' ? '/dealer/catalog' : '/catalog'}>
            Continue Shopping
          </Link>
          <button type="button" className="btn ghost sm" onClick={() => cart.clear()}>
            Clear Cart
          </button>
        </div>
      </div>

      {missing > 0 && (
        <Notice kind="warn">
          <div className="row spread">
            <span>
              {missing} item(s) ({unavailableSkus.join(', ')}) are no longer available. Remove them to continue.
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={() => unavailableSkus.forEach((s) => cart.remove(s))}
            >
              Remove Unavailable Items
            </button>
          </div>
        </Notice>
      )}

      {role === 'customer' && freeShippingRemaining > 0 && (
        <Notice>
          Add <b>{formatINR(freeShippingRemaining)}</b> more (excl. GST) for free delivery.
        </Notice>
      )}

      {role === 'dealer' && totalUnits < DEALER_MIN_UNITS && (
        <Notice kind="warn">
          Dealer bulk orders require at least <b>{DEALER_MIN_UNITS} total units</b> (currently {totalUnits} units).
        </Notice>
      )}

      <div className="grid cartgrid">
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {priced.map((l) => (
                <tr key={l.sku}>
                  <td>
                    <div className="prodcell">
                      <Img className="thumb" src={l.image} alt={l.alt} size={52} />
                      <div>
                        <Link to={`/product/${l.sku}`} style={{ fontWeight: 700 }}>
                          {l.name}
                        </Link>
                        <div className="muted" style={{ fontSize: 12 }}>SKU: {l.sku}</div>
                        {l.qty > l.stock && (
                          <div className="err">Only {l.stock} available in stock</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{formatINR(l.unitPaise)}</div>
                    {l.regularPaise > l.unitPaise && (
                      <div className="price-strike" style={{ marginLeft: 0, fontSize: 12 }}>
                        {formatINR(l.regularPaise)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ padding: '4px 10px' }}
                        aria-label={`Decrease quantity for ${l.name}`}
                        onClick={() => cart.setQty(l.sku, l.qty - 1)}
                      >
                        &minus;
                      </button>
                      <input
                        aria-label={`Quantity for ${l.name}`}
                        type="number"
                        min={1}
                        max={max}
                        style={{ width: 68, textAlign: 'center', padding: '6px' }}
                        value={l.qty}
                        onChange={(e) =>
                          cart.setQty(l.sku, Math.min(max, Math.max(1, Math.floor(Number(e.target.value)) || 1)))
                        }
                      />
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ padding: '4px 10px' }}
                        disabled={l.qty >= max || l.qty >= l.stock}
                        aria-label={`Increase quantity for ${l.name}`}
                        onClick={() => cart.setQty(l.sku, Math.min(max, l.qty + 1))}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{formatINR(l.unitPaise * l.qty)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => cart.remove(l.sku)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="card pad" aria-label="Order summary">
          <h3 style={{ fontSize: '1.1rem', marginBottom: 14 }}>Order Summary</h3>
          <div className="row spread" style={{ marginBottom: 10 }}>
            <span className="muted">Subtotal ({totalUnits} units)</span>
            <span style={{ fontWeight: 600 }}>{formatINR(totals.subtotalPaise)}</span>
          </div>
          <div className="row spread" style={{ marginBottom: 10 }}>
            <span className="muted">GST (18%)</span>
            <span style={{ fontWeight: 600 }}>{formatINR(totals.taxPaise)}</span>
          </div>
          <div className="row spread" style={{ marginBottom: 14 }}>
            <span className="muted">Delivery</span>
            <span style={{ fontWeight: 600, color: totals.shippingPaise === 0 ? 'var(--ok)' : undefined }}>
              {totals.shippingPaise ? formatINR(totals.shippingPaise) : 'Free'}
            </span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />
          <div className="row spread price" style={{ fontSize: '1.3rem' }}>
            <span>Total</span>
            <span>{formatINR(totals.totalPaise)}</span>
          </div>

          {errors.map((e, i) => (
            <div className="err" key={i}>
              {e.message}
            </div>
          ))}

          <button
            type="button"
            className="btn lg"
            style={{ width: '100%', marginTop: 14 }}
            disabled={errors.length > 0 || missing > 0 || priced.some((l) => l.qty > l.stock)}
            onClick={() => nav('/checkout')}
          >
            Checkout
          </button>
        </aside>
      </div>
    </div>
  );
}
