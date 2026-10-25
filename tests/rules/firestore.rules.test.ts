import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'califnco-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'dealerPrices/CF-P-RO7'), { sku: 'CF-P-RO7', pricePaise: 1 });
    await setDoc(doc(db, 'users/alice'), {
      displayName: 'Alice',
      email: 'a@x.com',
      phone: '9876543210',
      createdAt: 1,
      prefs: { email: true, push: false, sms: false },
      referralCode: 'ALICE001',
    });
    await setDoc(doc(db, 'carts/alice'), { lines: [{ sku: 'CF-P-RO7', qty: 1 }], updatedAt: 1 });
    await setDoc(doc(db, 'orders/o1'), { uid: 'alice', status: 'placed', totals: { totalPaise: 100 } });
    await setDoc(doc(db, 'products/CF-P-RO7'), { pricePaise: 100, stock: 1, name: 'x' });
    await setDoc(doc(db, 'serviceBookings/s1'), { uid: 'alice', status: 'requested', createdAt: 1, address: {} });
  });
});
afterAll(() => env.cleanup());

const customer = () => env.authenticatedContext('alice', { role: undefined, email: 'a@x.com' }).firestore();
const dealer = () => env.authenticatedContext('dan', { role: 'dealer' }).firestore();
const admin = () => env.authenticatedContext('root', { role: 'admin' }).firestore();

describe('firestore rules', () => {
  it('hides wholesale prices from anonymous users and customers', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'dealerPrices/CF-P-RO7')));
    await assertFails(getDoc(doc(customer(), 'dealerPrices/CF-P-RO7')));
  });
  it('shows wholesale prices to dealers and admins', async () => {
    await assertSucceeds(getDoc(doc(dealer(), 'dealerPrices/CF-P-RO7')));
    await assertSucceeds(getDoc(doc(admin(), 'dealerPrices/CF-P-RO7')));
  });
  it('allows owners to read and update their persisted cart, but not another user\'s cart', async () => {
    await assertSucceeds(getDoc(doc(customer(), 'carts/alice')));
    await assertSucceeds(updateDoc(doc(customer(), 'carts/alice'), {
      lines: [{ sku: 'CF-P-RO7', qty: 2 }],
      updatedAt: 2,
    }));
    await assertFails(getDoc(doc(env.authenticatedContext('mallory').firestore(), 'carts/alice')));
  });

  it('allows profile edits without rewriting immutable metadata', async () => {
    await assertSucceeds(updateDoc(doc(customer(), 'users/alice'), {
      displayName: 'Alice Updated',
      phone: '9876543210',
      prefs: { email: false, push: false, sms: false },
    }));
    await assertFails(updateDoc(doc(customer(), 'users/alice'), { createdAt: 2 }));
  });

  it('prevents clients from creating or editing orders', async () => {
    await assertFails(setDoc(doc(customer(), 'orders/o2'), { uid: 'alice', status: 'placed' }));
    await assertFails(updateDoc(doc(customer(), 'orders/o1'), { 'totals.totalPaise': 1 }));
    await assertFails(updateDoc(doc(admin(), 'orders/o1'), { status: 'delivered' }));
  });
  it('lets owners and admins read orders, but not other customers', async () => {
    await assertSucceeds(getDoc(doc(customer(), 'orders/o1')));
    await assertSucceeds(getDoc(doc(admin(), 'orders/o1')));
    await assertFails(getDoc(doc(env.authenticatedContext('mallory').firestore(), 'orders/o1')));
  });
  it('blocks customers from changing products', async () => {
    await assertFails(updateDoc(doc(customer(), 'products/CF-P-RO7'), { pricePaise: 1 }));
    await assertSucceeds(updateDoc(doc(admin(), 'products/CF-P-RO7'), { pricePaise: 200 }));
  });
  it('lets a user file only a pending dealer application for themselves', async () => {
    const base = { uid: 'alice', businessName: 'A', gstin: 'x', phone: '9', city: 'c', createdAt: 1 };
    await assertSucceeds(setDoc(doc(customer(), 'dealerApplications/alice'), { ...base, status: 'pending' }));
    await assertFails(setDoc(doc(customer(), 'dealerApplications/alice'), { ...base, status: 'approved' }));
    await assertFails(updateDoc(doc(customer(), 'dealerApplications/alice'), { status: 'approved' }));
  });
  it('lets only admins change a service booking', async () => {
    await assertFails(updateDoc(doc(customer(), 'serviceBookings/s1'), { status: 'completed' }));
    await assertSucceeds(updateDoc(doc(admin(), 'serviceBookings/s1'), { status: 'assigned', assignedTo: 'Ravi' }));
  });
  it('does not let users write a role into their profile', async () => {
    await assertFails(setDoc(doc(customer(), 'users/alice'), { displayName: 'A', email: 'a@x.com', role: 'admin', createdAt: 1 }));
  });
});
