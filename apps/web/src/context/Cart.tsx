import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CartLine } from '@califnco/shared';
import { db } from '../lib/firebase';
import { useAuth } from './Auth';

interface Ctx {
  lines: CartLine[];
  count: number;
  add(sku: string, qty?: number): void;
  buyNow(sku: string, qty?: number): void;
  setQty(sku: string, qty: number): void;
  remove(sku: string): void;
  clear(): void;
}
const CartCtx = createContext<Ctx | null>(null);
export const useCart = () => { const c = useContext(CartCtx); if (!c) throw new Error('CartProvider missing'); return c; };
const KEY = 'califnco.cart.v1';

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((l) => typeof l?.sku === 'string' && Number.isInteger(l?.qty) && l.qty > 0) : [];
  } catch { return []; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lines, setLines] = useState<CartLine[]>(load);
  const hydrated = useRef<string | null>(null);
  // A pending remote-cart read must not overwrite a user's fresh cart action.
  const cartMutationVersion = useRef(0);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage unavailable */ } }, [lines]);

  // Persist the cart per account: on sign-in merge the server cart in; afterwards mirror changes up.
  useEffect(() => {
    if (!user || !db) { hydrated.current = null; return; }
    if (hydrated.current !== user.uid) {
      hydrated.current = user.uid;
      const versionAtRead = cartMutationVersion.current;
      getDoc(doc(db, 'carts', user.uid)).then((s) => {
        if (cartMutationVersion.current !== versionAtRead) return;
        const remote = (s.data()?.lines ?? []) as CartLine[];
        setLines((local) => { const m = new Map(remote.map((l) => [l.sku, l.qty])); local.forEach((l) => m.set(l.sku, Math.max(m.get(l.sku) ?? 0, l.qty))); return [...m].map(([sku, qty]) => ({ sku, qty })); });
      }).catch(() => undefined);
      return;
    }
    const t = setTimeout(() => { setDoc(doc(db!, 'carts', user.uid), { lines, updatedAt: serverTimestamp() }).catch(() => undefined); }, 600);
    return () => clearTimeout(t);
  }, [lines, user]);

  const add = useCallback((sku: string, qty = 1) => {
    cartMutationVersion.current += 1;
    setLines((ls) => ls.some((l) => l.sku === sku) ? ls.map((l) => l.sku === sku ? { ...l, qty: l.qty + qty } : l) : [...ls, { sku, qty }]);
  }, []);

  // Buy Now is different from Add to Cart: it replaces checkout contents with
  // exactly the selected product and quantity instead of incrementing an old line.
  const buyNow = useCallback((sku: string, qty = 1) => {
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    cartMutationVersion.current += 1;
    setLines([{ sku, qty: safeQty }]);
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    cartMutationVersion.current += 1;
    setLines((ls) => qty < 1 ? ls.filter((l) => l.sku !== sku) : ls.map((l) => l.sku === sku ? { ...l, qty } : l));
  }, []);
  const remove = useCallback((sku: string) => {
    cartMutationVersion.current += 1;
    setLines((ls) => ls.filter((l) => l.sku !== sku));
  }, []);
  const clear = useCallback(() => {
    cartMutationVersion.current += 1;
    setLines([]);
  }, []);
  const value = useMemo(() => ({ lines, count: lines.reduce((s, l) => s + l.qty, 0), add, buyNow, setQty, remove, clear }), [lines, add, buyNow, setQty, remove, clear]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
