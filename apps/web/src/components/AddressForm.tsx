import { useRef, useState } from 'react';
import { addressSchema, type Address } from '@califnco/shared';
import { Field, Notice } from './ui';

const blank = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };
type Errors = Partial<Record<keyof Address, string>>;

/** Free OpenStreetMap geocoding via Nominatim. Usage policy: max 1 request/second, user-initiated only, no autocomplete. */
async function geocode(q: string) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('geocoder');
  return (await r.json()) as { lat: string; lon: string; address?: Record<string, string> }[];
}

export function AddressForm({ initial, submitLabel = 'Save address', withMap, onSubmit, busy }: { initial?: Partial<Address>; submitLabel?: string; withMap?: boolean; busy?: boolean; onSubmit(a: Address): void | Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>({ ...blank, ...(initial as Record<string, string>) });
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [errors, setErrors] = useState<Errors>({});
  const [mapMsg, setMapMsg] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const last = useRef(0);
  const set = (k: string) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function locate() {
    const wait = 1100 - (Date.now() - last.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last.current = Date.now(); setLooking(true); setMapMsg(null);
    try {
      const res = await geocode([v.line1, v.city, v.state, v.pincode].filter(Boolean).join(', '));
      const hit = res[0];
      if (!hit) { setMapMsg('No map match found. You can continue with the address as typed.'); return; }
      setGeo({ lat: Number(hit.lat), lng: Number(hit.lon) });
      setV((s) => ({ ...s, city: s.city || hit.address?.city || hit.address?.town || hit.address?.village || '', state: s.state || hit.address?.state || '', pincode: s.pincode || (hit.address?.postcode ?? '').replace(/\s/g, '') }));
    } catch { setMapMsg('Map lookup is unavailable right now. Please enter the address manually - it will still be saved.'); }
    finally { setLooking(false); }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = addressSchema.safeParse({ ...v, ...(geo ?? {}) });
    if (!parsed.success) { const m: Errors = {}; parsed.error.issues.forEach((i) => { m[i.path[0] as keyof Address] ??= i.message; }); setErrors(m); return; }
    setErrors({}); void onSubmit(parsed.data);
  }
  const f = (k: keyof Address, label: string, extra: Record<string, string> = {}) => <Field label={label} error={errors[k]}><input value={v[k] ?? ''} onChange={set(k)} aria-invalid={!!errors[k]} {...extra} /></Field>;
  return (
    <form onSubmit={submit} noValidate>
      <div className="grid g2">{f('fullName', 'Full name', { autoComplete: 'name' })}{f('phone', 'Mobile number', { inputMode: 'numeric', maxLength: '10', autoComplete: 'tel-national' })}</div>
      {f('line1', 'Address line 1', { autoComplete: 'address-line1' })}{f('line2', 'Address line 2 (optional)')}
      <div className="grid g2">{f('city', 'City')}{f('state', 'State')}</div>
      {f('pincode', 'PIN code', { inputMode: 'numeric', maxLength: '6' })}
      {withMap && <div style={{ marginBottom: 14 }}>
        <button type="button" className="btn ghost sm" onClick={locate} disabled={looking || !v.line1}>{looking ? 'Searching...' : 'Find on map'}</button>
        {mapMsg && <Notice kind="warn">{mapMsg}</Notice>}
        {geo && <iframe title="Selected location on OpenStreetMap" style={{ width: '100%', height: 220, border: '1px solid var(--line)', borderRadius: 6, marginTop: 10 }} loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.lng - 0.01}%2C${geo.lat - 0.007}%2C${geo.lng + 0.01}%2C${geo.lat + 0.007}&layer=mapnik&marker=${geo.lat}%2C${geo.lng}`} />}
        <p className="muted" style={{ fontSize: 12 }}>Map data (c) OpenStreetMap contributors. Geocoding by Nominatim. Map use is optional.</p>
      </div>}
      <button className="btn" disabled={busy}>{busy ? 'Saving...' : submitLabel}</button>
    </form>
  );
}
