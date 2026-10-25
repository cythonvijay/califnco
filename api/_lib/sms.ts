import type { ChannelStatus } from './notify';

// textbee.dev — free SMS gateway that sends through an Android phone you
// register to your account. Account-level endpoint, no device id needed in
// the request (the account's registered device handles it). Free tier: 1
// device, up to 50 messages/day, 300/month — no payment method required,
// unlike Fast2SMS which needs a minimum ₹100 top-up before its API route
// unlocks even on a "free credit" signup.
const API = 'https://api.textbee.dev/api/v1/gateway/send-sms';

export async function sendSms(phone: string, message: string): Promise<{ status: ChannelStatus; detail: string }> {
  const key = process.env.TEXTBEE_API_KEY?.trim();
  if (!key) return { status: 'skipped', detail: 'TextBee not configured' };
  // notify.ts validates phone as a bare 10-digit Indian mobile (^[6-9]\d{9}$);
  // textbee expects E.164 (with country code), so add +91 here.
  const recipient = phone.startsWith('+') ? phone : `+91${phone}`;
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: [recipient], message }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await r.json().catch(() => ({}))) as { message?: string; smsBatchId?: string };
    if (r.ok) return { status: 'sent', detail: data.smsBatchId ? `Accepted by TextBee (batch ${data.smsBatchId})` : 'Accepted by TextBee' };
    return { status: 'failed', detail: `TextBee HTTP ${r.status}: ${String(data.message ?? r.statusText).slice(0, 200)}` };
  } catch (e) {
    return { status: 'failed', detail: String(e).slice(0, 200) };
  }
}