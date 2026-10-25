/* Usage: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json FIREBASE_PROJECT_ID=xxx npm run seed
   Seeds initial active catalogue data and wholesale prices into Firestore. */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { INITIAL_ACTIVE_CATALOG, SEED_DEALER_PRICES } from '../packages/shared/src';

initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore();
(async () => {
  for (let i = 0; i < INITIAL_ACTIVE_CATALOG.length; i += 400) {
    const batch = db.batch();
    INITIAL_ACTIVE_CATALOG.slice(i, i + 400).forEach((p) => batch.set(db.doc(`products/${p.sku}`), p));
    SEED_DEALER_PRICES.slice(i, i + 400).forEach((d) => batch.set(db.doc(`dealerPrices/${d.sku}`), d));
    await batch.commit();
  }
  console.log(`Seeded ${INITIAL_ACTIVE_CATALOG.length} active catalog products and wholesale prices.`);
})();
