import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase';
import { sendSms } from './sms';

export type ChannelStatus = 'delivered' | 'sent' | 'failed' | 'skipped';
interface Input { uid: string; type: string; title: string; body: string; email?: string; link?: string }

const PHONE_RE = /^[6-9]\d{9}$/;

export async function notify(n: Input) {
  const db = adminDb();
  const user = (await db.doc(`users/${n.uid}`).get()).data() as { phone?: string; prefs?: { email?: boolean; sms?: boolean } } | undefined;
  const prefs = user?.prefs;

  let email: ChannelStatus = 'skipped';
  let emailDetail = 'EmailJS not configured';
  const { EMAILJS_SERVICE_ID: s, EMAILJS_TEMPLATE_ID: t, EMAILJS_PUBLIC_KEY: u, EMAILJS_PRIVATE_KEY: p } = process.env;
  if (prefs?.email === false) emailDetail = 'User opted out of email';
  else if (n.email && s && t && u && p) {
    try {
      const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: s, template_id: t, user_id: u, accessToken: p, template_params: { to_email: n.email, subject: n.title, message: n.body } }),
      });
      email = r.ok ? 'sent' : 'failed';
      emailDetail = r.ok ? 'Accepted by EmailJS' : `EmailJS HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;
    } catch (e) { email = 'failed'; emailDetail = String(e).slice(0, 200); }
  }

  let sms: ChannelStatus = 'skipped';
  let smsDetail = 'User has not opted in to SMS';
  if (prefs?.sms !== true) { /* default and explicit opt-out both land here */ }
  else if (!user?.phone || !PHONE_RE.test(user.phone)) smsDetail = 'No valid phone on file';
  else {
    const r = await sendSms(user.phone, `CALIFNCO: ${n.title} - ${n.body}`.slice(0, 300));
    sms = r.status; smsDetail = r.detail;
  }

  await db.collection('notifications').add({
    uid: n.uid, type: n.type, title: n.title, body: n.body, link: n.link ?? null, read: false, createdAt: FieldValue.serverTimestamp(),
    channels: { inApp: 'delivered', email, push: 'skipped', sms }, detail: { email: emailDetail, sms: smsDetail },
  });
}