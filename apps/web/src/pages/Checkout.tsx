import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatINR, type Address } from '@califnco/shared';
import { AddressForm } from '../components/AddressForm';
import { Empty, Img, Loading, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCart } from '../context/Cart';
import { addUserAddress, createValidatedOrder, listUserAddresses } from '../lib/api';
import { useCartView } from './Cart';

type Saved = Address & { id: string };
function idemKey(sig: string) {
  try {
    const cur = JSON.parse(sessionStorage.getItem('califnco.idem') ?? 'null');
    if (cur?.sig === sig) return cur.key as string;
    const key = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`).replace(/-/g, '') + '0000000000000000';
    const trimmed = key.slice(0, 32);
    sessionStorage.setItem('califnco.idem', JSON.stringify({ sig, key: trimmed }));
    return trimmed;
  } catch {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}0000000000`.slice(0, 32);
  }
}

export default function Checkout() {
  const { user, caller } = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const { cat, role, priced, totals, errors, missing } = useCartView();

  const [addrs, setAddrs] = useState<Saved[] | null>(null);
  const [sel, setSel] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadAddrs = async () => {
    if (!caller) return;
    const list = await listUserAddresses(caller);
    setAddrs(list);
    if (!sel && list[0]) setSel(list[0].id);
  };

  useEffect(() => {
    loadAddrs().catch(() => {
      setAddrs([]);
      setErr('Could not load saved addresses.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caller?.uid]);

  if (cat.loading || addrs === null) {
    return <div className="wrap" style={{ paddingTop: 32 }}><Loading label="Loading checkout..." /></div>;
  }

  if (priced.length === 0) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        <Empty
          title="No items in your cart"
          action={<Link className="btn" to="/catalog">Browse Products</Link>}
        >
          Your cart is empty. Add products before proceeding to checkout.
        </Empty>
      </div>
    );
  }

  const address = addrs.find((a) => a.id === sel);

  async function place() {
    if (!address || busy || !caller) return;
    setBusy(true);
    setErr(null);
    try {
      const { id: _id, ...addr } = address;
      const lines = cart.lines;
      const res = await createValidatedOrder(caller, {
        lines,
        address: addr,
        idempotencyKey: idemKey(JSON.stringify([lines, address.id])),
      });

      if (res.mode === 'razorpay_payment_link_test' && res.paymentUrl) {
        // Payment is completed on Razorpay's hosted page. The signed callback
        // verifies the payment server-side before the confirmation page can say paid.
        window.location.assign(res.paymentUrl);
        return;
      }

      cart.clear();
      sessionStorage.removeItem('califnco.idem');
      nav(`/order-confirmation/${res.orderId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      <div className="row spread" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Checkout</h1>
        </div>
        <Link className="btn ghost sm" to="/cart">
          Back to Cart
        </Link>
      </div>

      <div className="grid cartgrid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="card pad">
            <div className="row spread" style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Delivery Address</h2>
              {addrs.length > 0 && !adding && (
                <button type="button" className="btn ghost sm" onClick={() => setAdding(true)}>
                  + Add New Address
                </button>
              )}
            </div>

            {addrs.length === 0 && !adding && (
              <p className="muted">Enter your delivery address below to continue.</p>
            )}

            {addrs.map((a) => (
              <label
                key={a.id}
                className="card pad row"
                style={{
                  marginBottom: 10,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  borderColor: sel === a.id ? 'var(--navy)' : 'var(--line)',
                  background: sel === a.id ? 'var(--ice-soft)' : 'var(--surface)',
                }}
              >
                <input
                  type="radio"
                  style={{ width: 18, height: 18, minHeight: 18, marginTop: 3 }}
                  name="addr"
                  checked={sel === a.id}
                  onChange={() => setSel(a.id)}
                />
                <span style={{ flex: 1 }}>
                  <b style={{ color: 'var(--navy)' }}>{a.fullName}</b> · <span className="muted">{a.phone}</span>
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} — <b>{a.pincode}</b>
                </span>
              </label>
            ))}

            {(adding || addrs.length === 0) && (
              <div style={{ marginTop: 12, paddingTop: addrs.length > 0 ? 16 : 0, borderTop: addrs.length > 0 ? '1px solid var(--line)' : '0' }}>
                <AddressForm
                  submitLabel="Save & Use This Address"
                  onSubmit={async (a) => {
                    if (!caller) return;
                    const id = await addUserAddress(caller, a);
                    await loadAddrs();
                    setSel(id);
                    setAdding(false);
                  }}
                />
                {addrs.length > 0 && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ marginTop: 8 }}
                    onClick={() => setAdding(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="card pad">
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Payment</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Secure hosted payment via Razorpay (UPI, cards, and netbanking). Payment is confirmed by the server before the order is marked paid. Without Razorpay test keys, checkout remains in clearly labelled demo mode.
            </p>
          </section>
        </div>

        <aside className="card pad">
          <h3 style={{ fontSize: '1.1rem', marginBottom: 14 }}>Order Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {priced.map((l) => (
              <div key={l.sku} className="row spread" style={{ fontSize: 13.5, flexWrap: 'nowrap' }}>
                <span className="prodcell" style={{ minWidth: 0 }}>
                  <Img className="thumb" src={l.image} alt={l.alt} size={44} />
                  <span>
                    <strong style={{ display: 'block', lineHeight: 1.25 }}>{l.name}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {l.qty} &times; {formatINR(l.unitPaise)}
                    </span>
                  </span>
                </span>
                <span style={{ fontWeight: 700 }}>{formatINR(l.unitPaise * l.qty)}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />
          <div className="row spread" style={{ marginBottom: 8 }}>
            <span className="muted">Subtotal</span>
            <span>{formatINR(totals.subtotalPaise)}</span>
          </div>
          <div className="row spread" style={{ marginBottom: 8 }}>
            <span className="muted">GST (18%)</span>
            <span>{formatINR(totals.taxPaise)}</span>
          </div>
          <div className="row spread" style={{ marginBottom: 12 }}>
            <span className="muted">Delivery</span>
            <span style={{ color: totals.shippingPaise === 0 ? 'var(--ok)' : undefined, fontWeight: 600 }}>
              {totals.shippingPaise ? formatINR(totals.shippingPaise) : 'Free'}
            </span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '12px 0' }} />
          <div className="row spread price" style={{ fontSize: '1.3rem', marginBottom: 12 }}>
            <span>Total</span>
            <span>{formatINR(totals.totalPaise)}</span>
          </div>

          {role === 'dealer' && (
            <p className="muted" style={{ fontSize: 12 }}>
              Dealer wholesale pricing applied.
            </p>
          )}

          {errors.map((e, i) => (
            <div key={i} className="err">
              {e.message}
            </div>
          ))}
          {err && <Notice kind="bad">{err}</Notice>}

          <button
            type="button"
            className="btn lg"
            style={{ width: '100%', marginTop: 12 }}
            disabled={!address || busy || errors.length > 0 || missing > 0 || priced.some((l) => l.qty > l.stock)}
            onClick={place}
          >
            {busy ? 'Placing Order...' : `Place Order (${formatINR(totals.totalPaise)})`}
          </button>
        </aside>
      </div>
    </div>
  );
}
