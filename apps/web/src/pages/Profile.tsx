import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { phoneSchema, type Address } from '@califnco/shared';
import { AddressForm } from '../components/AddressForm';
import { Confirm, Empty, Field, Loading, Notice } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useRepoQuery } from '../hooks/useQuery';
import {
  addUserAddress,
  deleteUserAddress,
  getUserProfile,
  listUserAddresses,
  saveUserProfile,
  type UserProfileRecord,
} from '../lib/api';

export function AccountSubnav() {
  const { user, role, logout } = useAuth();
  return (
    <div className="card pad" style={{ marginBottom: 24, padding: '14px 18px' }}>
      <div className="row spread">
        <div className="row" style={{ gap: 8 }}>
          <NavLink end to="/profile" className={({ isActive }) => `btn sm ${isActive ? '' : 'ghost'}`}>
            Profile &amp; Addresses
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => `btn sm ${isActive ? '' : 'ghost'}`}>
            Orders
          </NavLink>
          <NavLink to="/service" className={({ isActive }) => `btn sm ${isActive ? '' : 'ghost'}`}>
            Service Visits
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `btn sm ${isActive ? '' : 'ghost'}`}>
            Notifications
          </NavLink>
          {role === 'admin' && (
            <Link to="/admin" className="btn accent sm">
              Admin Console
            </Link>
          )}
          {role === 'dealer' && (
            <Link to="/dealer" className="btn accent sm">
              Dealer Portal
            </Link>
          )}
        </div>
        {user && (
          <button type="button" className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => void logout()}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, role, caller } = useAuth();
  const [p, setP] = useState<UserProfileRecord | null>(null);
  const [msg, setMsg] = useState<{ k: 'ok' | 'bad'; t: string } | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const addrs = useRepoQuery<Address & { id: string }>(
    () => (caller ? listUserAddresses(caller) : Promise.resolve([])),
    [caller?.uid],
  );

  useEffect(() => {
    if (!caller) return;
    getUserProfile(caller)
      .then((prof) => setP(prof))
      .catch(() => setMsg({ k: 'bad', t: 'Could not load your profile details.' }));
  }, [caller]);

  if (!p || !user || !caller) {
    return <div className="wrap" style={{ paddingTop: 32 }}><Loading label="Loading profile..." /></div>;
  }

  async function save() {
    const ph = phoneSchema.safeParse(p!.phone);
    if (!ph.success) return setMsg({ k: 'bad', t: ph.error.issues[0]!.message });
    if (p!.displayName.trim().length < 2) return setMsg({ k: 'bad', t: 'Full name is required.' });
    try {
      await saveUserProfile(caller, {
        displayName: p!.displayName.trim(),
        phone: p!.phone.trim(),
        prefs: p!.prefs,
      });
      setMsg({ k: 'ok', t: 'Profile saved.' });
    } catch (error) {
      setMsg({
        k: 'bad',
        t: error instanceof Error ? error.message : 'Could not save profile changes. Please try again.',
      });
    }
  }

  const pref = (k: keyof UserProfileRecord['prefs'], t: string, note?: string) => (
    <label className="row" style={{ marginBottom: 10, cursor: 'pointer' }}>
      <input
        type="checkbox"
        style={{ width: 18, height: 18, minHeight: 18 }}
        checked={p.prefs[k]}
        onChange={(e) => setP({ ...p, prefs: { ...p.prefs, [k]: e.target.checked } })}
      />
      <span>
        <b>{t}</b>
        {note && <span className="muted"> — {note}</span>}
      </span>
    </label>
  );

  const link = p.referralCode ? `${location.origin}/register?ref=${p.referralCode}` : '';

  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Account &amp; Addresses</h1>
        </div>
      </div>

      <AccountSubnav />

      {msg && <Notice kind={msg.k}>{msg.t}</Notice>}

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <section className="card pad">
          <div className="row spread" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Personal Details</h2>
            <span className="tag navy">{role}</span>
          </div>

          <Field label="Email">
            <input value={user.email ?? ''} disabled />
          </Field>
          <Field label="Full Name">
            <input
              value={p.displayName}
              onChange={(e) => setP({ ...p, displayName: e.target.value })}
            />
          </Field>
          <Field label="Mobile Number (10 digits)">
            <input
              inputMode="numeric"
              maxLength={10}
              value={p.phone}
              onChange={(e) => setP({ ...p, phone: e.target.value })}
            />
          </Field>

          <h3 style={{ marginTop: 22, marginBottom: 10 }}>Notifications</h3>
          {pref('email', 'Email updates', 'Order confirmations and service updates')}
          {pref('push', 'Mobile app notifications', 'Push alerts on the Android app')}
          {pref('sms', 'SMS updates', 'Order and service alerts sent to your phone number above')}
          <button type="button" className="btn" style={{ marginTop: 12 }} onClick={save}>
            Save Changes
          </button>

          {p.referralCode && (
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line-subtle)' }}>
              <h3>Referral Code: {p.referralCode}</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                Share your referral link:
              </p>
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
            </div>
          )}
        </section>

        <section className="card pad">
          <div className="row spread" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Saved Addresses</h2>
            {!adding && (
              <button type="button" className="btn ghost sm" onClick={() => setAdding(true)}>
                + Add Address
              </button>
            )}
          </div>

          {addrs.loading ? (
            <Loading label="Loading addresses..." />
          ) : addrs.data.length === 0 && !adding ? (
            <Empty title="No saved addresses">
              Add a delivery address for faster checkout and service booking.
            </Empty>
          ) : (
            addrs.data.map((a) => (
              <div key={a.id} className="card pad row spread" style={{ marginBottom: 12, background: 'var(--bg)' }}>
                <span>
                  <b style={{ color: 'var(--navy)' }}>{a.fullName}</b> · <span className="muted">{a.phone}</span>
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} — <b>{a.pincode}</b>
                </span>
                <button type="button" className="btn ghost sm" onClick={() => setDel(a.id)}>
                  Delete
                </button>
              </div>
            ))
          )}

          {adding && (
            <div style={{ marginTop: 14 }}>
              <AddressForm
                onSubmit={async (a) => {
                  await addUserAddress(caller, a);
                  setAdding(false);
                  addrs.reload();
                }}
              />
              <button
                type="button"
                className="btn ghost sm"
                style={{ marginTop: 8 }}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>

      <Confirm
        open={!!del}
        danger
        title="Delete saved address?"
        body="This address will be removed from your saved addresses."
        confirmLabel="Delete Address"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return;
          try {
            await deleteUserAddress(caller, del);
            setDel(null);
            addrs.reload();
            setMsg({ k: 'ok', t: 'Address deleted.' });
          } catch (error) {
            setMsg({
              k: 'bad',
              t: error instanceof Error ? error.message : 'Could not delete the address. Please retry.',
            });
          }
        }}
      />
    </div>
  );
}
