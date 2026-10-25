import { useCallback, useEffect, useMemo, useState } from 'react';
import { effectiveRetailPaise, type Product } from '@califnco/shared';
import { useAuth } from '../context/Auth';
import { DB_CHANGE_EVENT, fetchCatalogSnapshot } from '../lib/api';

export interface Catalog {
  /** Active, published, non-demo products visible on customer and dealer storefront pages. */
  products: Product[];
  /** All admin-managed products (published, draft, archived), excluding legacy demo placeholders. */
  adminProducts: Product[];
  /** Count of legacy demo:true products in the database so admin can remove them safely. */
  demoProductCount: number;
  loading: boolean;
  error: string | null;
  source: 'firestore' | 'local_db';
  /** Effective unit price the current viewer pays, in paise (wholesale for verified dealers, sale/retail for customers). */
  priceOf(sku: string): number | null;
  /** Regular retail price before any promotional discount, in paise. */
  regularPriceOf(sku: string): number | null;
  /** Wholesale unit price in paise (available to dealers and admins). */
  wholesalePriceOf(sku: string): number | null;
  /** Find a published customer product by SKU. */
  find(sku: string): Product | undefined;
  /** Find any product (including draft/archived) by SKU for admin preview or historical order lookup. */
  findAny(sku: string): Product | undefined;
  /** Reload catalog from the active data source. */
  reload(): void;
}

export function useCatalog(): Catalog {
  const { role, loading: authLoading } = useAuth();
  const [customerProducts, setCustomerProducts] = useState<Product[]>([]);
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [demoProductCount, setDemoProductCount] = useState<number>(0);
  const [dealerPrices, setDealerPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'firestore' | 'local_db'>('local_db');
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (authLoading) return;
    let off = false;
    setLoading(true);
    setError(null);

    fetchCatalogSnapshot(role)
      .then((snap) => {
        if (off) return;
        setCustomerProducts(snap.customerProducts);
        setAdminProducts(snap.adminProducts);
        setDemoProductCount(snap.demoProductCount);
        setDealerPrices(snap.dealerPrices);
        setSource(snap.source);
      })
      .catch((e) => {
        if (off) return;
        setError((e as Error)?.message ?? 'Unable to load product catalog from the database.');
        setCustomerProducts([]);
        setAdminProducts([]);
      })
      .finally(() => {
        if (!off) setLoading(false);
      });

    return () => {
      off = true;
    };
  }, [role, authLoading, tick]);

  useEffect(() => {
    const onUpdate = () => reload();
    window.addEventListener(DB_CHANGE_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener(DB_CHANGE_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [reload]);

  const find = useCallback(
    (sku: string) => customerProducts.find((p) => p.sku.toUpperCase() === sku.toUpperCase()),
    [customerProducts],
  );

  const findAny = useCallback(
    (sku: string) => adminProducts.find((p) => p.sku.toUpperCase() === sku.toUpperCase()),
    [adminProducts],
  );

  const priceOf = useCallback(
    (sku: string): number | null => {
      const p = find(sku) ?? findAny(sku);
      if (!p) return null;
      if (role === 'dealer') {
        return dealerPrices[p.sku] ?? p.wholesalePricePaise ?? effectiveRetailPaise(p);
      }
      return effectiveRetailPaise(p);
    },
    [find, findAny, role, dealerPrices],
  );

  const regularPriceOf = useCallback(
    (sku: string): number | null => {
      const p = find(sku) ?? findAny(sku);
      return p ? p.pricePaise : null;
    },
    [find, findAny],
  );

  const wholesalePriceOf = useCallback(
    (sku: string): number | null => {
      const p = find(sku) ?? findAny(sku);
      if (!p) return null;
      return dealerPrices[p.sku] ?? p.wholesalePricePaise ?? null;
    },
    [find, findAny, dealerPrices],
  );

  const isLoading = loading || authLoading;

  return useMemo(
    () => ({
      products: customerProducts,
      adminProducts,
      demoProductCount,
      loading: isLoading,
      error,
      source,
      priceOf,
      regularPriceOf,
      wholesalePriceOf,
      find,
      findAny,
      reload,
    }),
    [
      customerProducts,
      adminProducts,
      demoProductCount,
      isLoading,
      error,
      source,
      priceOf,
      regularPriceOf,
      wholesalePriceOf,
      find,
      findAny,
      reload,
    ],
  );
}
