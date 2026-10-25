import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatINR } from '@califnco/shared';
import { AccessStateCard, Empty, Img, Loading, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCart } from '../context/Cart';
import { useCatalog } from '../hooks/useCatalog';
import { useRepoQuery } from '../hooks/useQuery';
import { fmtDate, label } from '../lib/format';
import { productImage } from '../lib/images';
import { getOrderById, listCustomerOrders, type OrderRecord } from '../lib/api';
import { AccountSubnav } from './Profile';

export type Order = OrderRecord;

export const PayBadge = ({ s }: { s: string }) =>
  s === 'paid_verified' ? (
    <span className="tag ok">Paid</span>
  ) : s === 'demo_unverified' ? (
    <span className="tag warn">Test Order</span>
  ) : s === 'failed' ? (
    <span className="tag bad">Payment Failed</span>
  ) : (
    <span className="tag warn">Pending</span>
  );

export const StatusBadge = ({ s }: { s: string }) => (
  <span className={`tag ${s === 'cancelled' ? 'bad' : s === 'delivered' ? 'ok' : 'navy'}`}>{label(s)}</span>
);

function resolveLineThumb(cat: ReturnType<typeof useCatalog>, l: OrderRecord['lines'][number]): { src: string; alt: string } {
  const p = cat.find(l.sku) ?? cat.findAny(l.sku);
  if (p) return { src: productImage(p), alt: p.imageAlt || p.name };
  if (l.image) return { src: l.image, alt: l.imageAlt || l.name };
  return { src: productImage({ sku: l.sku, image: '' }), alt: l.name };
}

export function MyOrders({ dealer }: { dealer?: boolean }) {
  const { caller } = useAuth();
  const { clear: clearCart } = useCart();
  const cat = useCatalog();
  const { data, loading, error, errorKind, reload } = useRepoQuery<OrderRecord>(
    () => listCustomerOrders(caller),
    [caller?.uid],
  );

  if (loading) {
    return <div className={dealer ? '' : 'wrap'} style={{ paddingTop: dealer ? 0 : 28 }}><Loading label="Loading orders..." /></div>;
  }

  return (
    <div className={dealer ? '' : 'wrap'} style={{ paddingTop: dealer ? 0 : 28 }}>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>{dealer ? 'Bulk Orders' : 'Orders'}</h1>
        </div>
        <Link className="btn ghost sm" to={dealer ? '/dealer/catalog' : '/catalog'}>
          Browse Catalog
        </Link>
      </div>

      {!dealer && <AccountSubnav />}

      {errorKind && <AccessStateCard kind={errorKind} message={error} onRetry={reload} />}

      {data.length === 0 ? (
        <Empty
          title="No orders yet"
          action={
            <Link className="btn" to={dealer ? '/dealer/catalog' : '/catalog'}>
              Browse Products
            </Link>
          }
        >
          Your orders and delivery updates will appear here.
        </Empty>
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => {
                const totalUnits = o.lines.reduce((s, l) => s + l.qty, 0);
                return (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`} style={{ fontWeight: 700, color: 'var(--navy)' }}>
                        #{o.id.slice(4, 12).toUpperCase()}
                      </Link>
                    </td>
                    <td>{fmtDate(o.createdAt as number)}</td>
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        {o.lines.slice(0, 3).map((l) => {
                          const thumb = resolveLineThumb(cat, l);
                          return <Img key={l.sku} className="thumb" src={thumb.src} alt={thumb.alt} size={44} />;
                        })}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                            {o.lines[0]?.name}
                            {o.lines.length > 1 ? ` +${o.lines.length - 1} more` : ''}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatINR(o.totals.totalPaise)}</td>
                    <td>
                      <StatusBadge s={o.status} />
                    </td>
                    <td>
                      <PayBadge s={o.payment.status} />
                    </td>
                    <td>
                      <Link className="btn ghost sm" to={`/orders/${o.id}`}>
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ORDER_STEPS = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'] as const;

export function OrderDetail({ confirmation }: { confirmation?: boolean }) {
  const { id } = useParams();
  const { caller } = useAuth();
  const { clear: clearCart } = useCart();
  const cat = useCatalog();
  const [o, setO] = useState<OrderRecord | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !caller) return;
    getOrderById(caller, id)
      .then((res) => {
        setO(res);
       if (confirmation && res?.payment.status === 'paid_verified') {
          clearCart();
          sessionStorage.removeItem('califnco.idem');
        }
      })
      .catch((e) => {
        setErr((e as Error).message);
        setO(null);
      });
  }, [id, caller, confirmation, clearCart]);

  if (o === undefined) {
    return <div className="wrap" style={{ paddingTop: 32 }}><Loading label="Loading order..." /></div>;
  }

  if (o === null) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        {err && <Notice kind="bad">{err}</Notice>}
        <Empty
          title="Order not found"
          action={<Link className="btn" to="/orders">Back to Orders</Link>}
        >
          We could not find order {id} on your account.
        </Empty>
      </div>
    );
  }

  const currentStepIdx = ORDER_STEPS.indexOf(o.status as (typeof ORDER_STEPS)[number]);

  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      {confirmation &&
        (o.payment.status === 'paid_verified' ? (
          <Notice kind="ok">
            <b>Order confirmed.</b> Your payment has been received and your order is being prepared.
          </Notice>
        ) : o.payment.status === 'demo_unverified' ? (
          <Notice kind="warn">
            <b>Test order recorded (#{o.id.slice(4, 12).toUpperCase()}):</b> Your order was saved in test mode with no payment charged.
          </Notice>
        ) : (
          <Notice kind="warn">Your order is recorded and awaiting payment confirmation.</Notice>
        ))}

      <div className="row spread" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Order #{o.id.slice(4, 12).toUpperCase()}</h1>
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <StatusBadge s={o.status} />
            <PayBadge s={o.payment.status} />
            <span className="muted" style={{ fontSize: 13 }}>Placed {fmtDate(o.createdAt as number)}</span>
          </div>
        </div>
        <div className="row">
          <Link className="btn ghost sm" to="/service">
            Book Installation
          </Link>
          <Link className="btn ghost sm" to="/orders">
            All Orders
          </Link>
        </div>
      </div>

      {o.status !== 'cancelled' && (
        <div className="card pad" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: 12 }}>
            Order Status
          </h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
            {ORDER_STEPS.map((st, idx) => {
              const done = currentStepIdx >= idx;
              return (
                <div
                  key={st}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    background: done ? 'var(--ice-soft)' : 'var(--bg)',
                    border: `1px solid ${done ? 'var(--ice)' : 'var(--line-subtle)'}`,
                    fontSize: 12.5,
                    fontWeight: done ? 700 : 500,
                    color: done ? 'var(--navy)' : 'var(--muted)',
                  }}
                >
                  {idx + 1}. {label(st)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid cartgrid">
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l) => {
                const thumb = resolveLineThumb(cat, l);
                const existsInCatalog = Boolean(cat.find(l.sku));
                return (
                  <tr key={l.sku}>
                    <td>
                      <div className="prodcell">
                        <Img className="thumb" src={thumb.src} alt={thumb.alt} size={48} />
                        <div>
                          {existsInCatalog ? (
                            <Link to={`/product/${l.sku}`} style={{ fontWeight: 700 }}>
                              {l.name}
                            </Link>
                          ) : (
                            <strong style={{ display: 'block' }}>{l.name}</strong>
                          )}
                          <div className="muted" style={{ fontSize: 12 }}>SKU: {l.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatINR(l.unitPaise)}</td>
                    <td>{l.qty}</td>
                    <td style={{ fontWeight: 700 }}>{formatINR(l.qty * l.unitPaise)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card pad">
          <h3 style={{ marginBottom: 10 }}>Delivery Address</h3>
          <p style={{ fontSize: 14, lineHeight: 1.55 }}>
            <b>{o.address.fullName}</b> · {o.address.phone}
            <br />
            {o.address.line1}
            {o.address.line2 ? `, ${o.address.line2}` : ''}
            <br />
            {o.address.city}, {o.address.state} — <b>{o.address.pincode}</b>
          </p>

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />
          <h3 style={{ marginBottom: 10 }}>Summary</h3>
          <div className="row spread" style={{ marginBottom: 6 }}>
            <span className="muted">Subtotal</span>
            <span>{formatINR(o.totals.subtotalPaise)}</span>
          </div>
          <div className="row spread" style={{ marginBottom: 6 }}>
            <span className="muted">GST (18%)</span>
            <span>{formatINR(o.totals.taxPaise)}</span>
          </div>
          <div className="row spread" style={{ marginBottom: 10 }}>
            <span className="muted">Delivery</span>
            <span>{o.totals.shippingPaise ? formatINR(o.totals.shippingPaise) : 'Free'}</span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '10px 0' }} />
          <div className="row spread price">
            <span>Total</span>
            <span>{formatINR(o.totals.totalPaise)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
