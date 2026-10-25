import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { serviceBookingSchema, serviceTypes, type Address } from '@califnco/shared';
import { AddressForm } from '../components/AddressForm';
import { Empty, Field, Loading, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCatalog } from '../hooks/useCatalog';
import { useRepoQuery } from '../hooks/useQuery';
import { fmtDate, label } from '../lib/format';
import { installPhoto } from '../lib/images';
import { createServiceBooking, listMyServiceBookings, type ServiceBookingRecord } from '../lib/api';

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function Service() {
  const { user, caller } = useAuth();
  const cat = useCatalog();
  const [sp] = useSearchParams();

  const initialSku = sp.get('sku') ?? '';
  const initialType = sp.get('type') ?? 'installation';

  const [f, setF] = useState({
    productSku: initialSku,
    serviceType: serviceTypes.includes(initialType as (typeof serviceTypes)[number]) ? initialType : 'installation',
    contactName: user?.displayName ?? '',
    contactPhone: '',
    preferredDate: tomorrow(),
    preferredSlot: '09:00-12:00' as '09:00-12:00' | '12:00-15:00' | '15:00-18:00',
    notes: '',
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  const list = useRepoQuery<ServiceBookingRecord>(
    () => (caller ? listMyServiceBookings(caller) : Promise.resolve([])),
    [caller?.uid],
  );

  const set = (k: string) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  if (cat.loading) {
    return <div className="wrap" style={{ paddingTop: 32 }}><Loading label="Loading service page..." /></div>;
  }

  const appliances = cat.products.filter((p) => ['purifiers', 'dispensers', 'pumps'].includes(p.category));

  async function submit(address: Address) {
    const parsed = serviceBookingSchema.safeParse({ ...f, address });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        m[String(i.path[0])] ??= i.message;
      });
      setErr(m);
      return;
    }
    if (parsed.data.preferredDate < tomorrow()) {
      setErr({ preferredDate: 'Please select a future date starting tomorrow' });
      return;
    }
    if (!caller) {
      setFail('Please sign in to submit a service booking.');
      return;
    }
    setErr({});
    setBusy(true);
    setFail(null);
    setOk(false);
    try {
      await createServiceBooking(caller, parsed.data);
      setOk(true);
      list.reload();
    } catch (e) {
      setFail((e as Error)?.message ?? 'We could not save your service request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      <div className="split-banner" style={{ marginBottom: 32 }}>
        <div className="split-banner-copy">
          <h1 style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2rem)', marginBottom: 10 }}>
            Installation, Filter Replacement &amp; Service
          </h1>
          <p className="muted" style={{ marginBottom: 16 }}>
            Schedule a technician for new purifier installation, cartridge or RO membrane replacement, or routine maintenance.
          </p>
          <div className="row" style={{ gap: 12, fontSize: 13 }}>
            <span className="tag">New purifier installation: Free</span>
            <span className="tag">Service / filter visit: ₹299</span>
          </div>
        </div>
        <div className="split-banner-media">
          <img
            src={installPhoto()}
            alt="Technician installing and testing a water purifier"
            width={640}
            height={420}
          />
        </div>
      </div>

      {!user && (
        <Notice kind="warn">
          Please{' '}
          <Link to="/login" style={{ fontWeight: 700, textDecoration: 'underline' }}>
            sign in
          </Link>{' '}
          to submit a service booking and track assigned technicians.
        </Notice>
      )}
      {ok && (
        <Notice kind="ok">
          <b>Service request submitted.</b> You can track its status and assigned technician below.
        </Notice>
      )}
      {fail && <Notice kind="bad">{fail}</Notice>}

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <section className="card pad">
          <h2 style={{ fontSize: '1.2rem', marginBottom: 14 }}>1. Equipment &amp; Preferred Slot</h2>

          <Field label="Product" error={err.productSku}>
            <select value={f.productSku} onChange={set('productSku')}>
              <option value="">Choose a water purifier, dispenser, or pump...</option>
              {(appliances.length ? appliances : cat.products).map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Service Type">
            <select value={f.serviceType} onChange={set('serviceType')}>
              {serviceTypes.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid g2">
            <Field label="Contact Name" error={err.contactName}>
              <input value={f.contactName} onChange={set('contactName')} placeholder="Asha Rao" />
            </Field>
            <Field label="Mobile Number (10 digits)" error={err.contactPhone}>
              <input
                inputMode="numeric"
                maxLength={10}
                value={f.contactPhone}
                onChange={set('contactPhone')}
                placeholder="9876543210"
              />
            </Field>
          </div>

          <div className="grid g2">
            <Field label="Preferred Date" error={err.preferredDate}>
              <input type="date" min={tomorrow()} value={f.preferredDate} onChange={set('preferredDate')} />
            </Field>
            <Field label="Time Slot" error={err.preferredSlot}>
              <select value={f.preferredSlot} onChange={set('preferredSlot')}>
                <option value="09:00-12:00">Morning (09:00 – 12:00)</option>
                <option value="12:00-15:00">Afternoon (12:00 – 15:00)</option>
                <option value="15:00-18:00">Evening (15:00 – 18:00)</option>
              </select>
            </Field>
          </div>

          <Field
            label="Notes (optional)"
            hint="Water source (borewell/municipal) or mounting details"
          >
            <textarea
              rows={3}
              maxLength={500}
              value={f.notes}
              onChange={set('notes')}
              placeholder="e.g. Wall-mount installation near kitchen sink"
            />
          </Field>
        </section>

        <section className="card pad">
          <h2 style={{ fontSize: '1.2rem', marginBottom: 14 }}>2. Service Address</h2>
          {err.address && <div className="err">{err.address}</div>}
          <AddressForm
            withMap
            submitLabel={user ? 'Book Service Visit' : 'Sign In Required to Book'}
            busy={busy || !user}
            onSubmit={submit}
          />
        </section>
      </div>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Scheduled Service Visits</h2>
          </div>
        </div>

        {!user ? (
          <Empty title="Sign in to view your service bookings" action={<Link className="btn sm" to="/login">Sign In</Link>} />
        ) : list.loading ? (
          <Loading label="Loading service visits..." />
        ) : list.data.length === 0 ? (
          <Empty title="No service visits booked yet">
            Use the form above to book installation, filter replacement, or maintenance.
          </Empty>
        ) : (
          <div className="card scroll">
            <table>
              <thead>
                <tr>
                  <th>Booked On</th>
                  <th>Service Type</th>
                  <th>Product SKU</th>
                  <th>Preferred Slot</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Technician</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((b) => (
                  <tr key={b.id}>
                    <td>{fmtDate(b.createdAt as number)}</td>
                    <td style={{ fontWeight: 700 }}>{label(b.serviceType)}</td>
                    <td>
                      <Link to={`/product/${b.productSku}`} style={{ color: 'var(--navy)', fontWeight: 600 }}>
                        {b.productSku}
                      </Link>
                    </td>
                    <td>
                      <b>{b.preferredDate}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{b.preferredSlot}</div>
                    </td>
                    <td>
                      {b.address.line1}, {b.address.city} {b.address.pincode}
                    </td>
                    <td>
                      <span
                        className={`tag ${
                          b.status === 'completed'
                            ? 'ok'
                            : b.status === 'cancelled'
                              ? 'bad'
                              : b.status === 'assigned' || b.status === 'in_progress'
                                ? 'navy'
                                : 'warn'
                        }`}
                      >
                        {label(b.status)}
                      </span>
                    </td>
                    <td>{b.assignedTo || <span className="muted">Unassigned</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
