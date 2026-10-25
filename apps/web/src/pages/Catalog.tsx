import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CATEGORIES, CATEGORY_LABEL, type Category } from '@califnco/shared';
import { ProductCard } from '../components/ProductCard';
import { Empty, Loading, Notice, Pager, paginate } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useCatalog } from '../hooks/useCatalog';

const SIZE = 12;

export default function Catalog({ wholesale = false }: { wholesale?: boolean }) {
  const cat = useCatalog();
  const { role } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [page, setPage] = useState(1);

  const q = sp.get('q') ?? '';
  const category = sp.get('category') ?? '';
  const sort = sp.get('sort') ?? 'featured';
  const inStock = sp.get('stock') === '1';

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
    setPage(1);
  };

  const clearFilters = () => {
    setSp(new URLSearchParams(), { replace: true });
    setPage(1);
  };

  const list = useMemo(() => {
    const searchLower = q.trim().toLowerCase();
    let l = cat.products.filter((p) => {
      if (category && p.category !== category) return false;
      if (inStock && p.stock <= 0) return false;
      if (searchLower) {
        const haystack = `${p.name} ${p.sku} ${p.description} ${Object.entries(p.specs)
          .map(([k, v]) => `${k} ${v}`)
          .join(' ')}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });

    const price = (sku: string) => cat.priceOf(sku) ?? Infinity;
    if (sort === 'featured') {
      l = [...l].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.sku.localeCompare(b.sku));
    } else if (sort === 'price_asc') {
      l = [...l].sort((a, b) => price(a.sku) - price(b.sku));
    } else if (sort === 'price_desc') {
      l = [...l].sort((a, b) => price(b.sku) - price(a.sku));
    } else if (sort === 'name') {
      l = [...l].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'stock_desc') {
      l = [...l].sort((a, b) => b.stock - a.stock);
    }
    return l;
  }, [cat, q, category, sort, inStock]);

  const hasActiveFilters = Boolean(q || category || inStock || sort !== 'featured');

  return (
    <div className={wholesale ? '' : 'wrap'} style={{ paddingTop: wholesale ? 0 : 28 }}>
      <div className="row spread" style={{ alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', marginBottom: 4 }}>
            {wholesale
              ? 'Wholesale Catalog'
              : category
                ? CATEGORY_LABEL[category as Category] ?? 'Products'
                : 'All Products'}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {wholesale
              ? 'Dealer pricing (excl. 18% GST). Minimum order: 10 units.'
              : 'Water purifiers, dispensers, booster pumps, replacement filters, and spare parts.'}
          </p>
        </div>
        {role === 'admin' && (
          <Link className="btn sm" to="/admin/products">
            Manage Products
          </Link>
        )}
      </div>

      {wholesale && role !== 'dealer' && role !== 'admin' && (
        <Notice kind="warn">
          Wholesale prices are available to approved dealers. Standard retail prices are shown below.
        </Notice>
      )}
      {cat.error && <Notice kind="bad">{cat.error}</Notice>}

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className={`btn sm ${!category ? '' : 'ghost'}`}
          onClick={() => setParam('category', '')}
        >
          All ({cat.products.length})
        </button>
        {CATEGORIES.map((c) => {
          const cnt = cat.products.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              type="button"
              className={`btn sm ${category === c ? '' : 'ghost'}`}
              onClick={() => setParam('category', category === c ? '' : c)}
            >
              {CATEGORY_LABEL[c]} ({cnt})
            </button>
          );
        })}
      </div>

      <div className="toolbar" role="search">
        <input
          type="search"
          aria-label="Search products"
          placeholder="Search by product name, SKU, or specification..."
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <select aria-label="Category" value={category} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select aria-label="Sort by" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="featured">Featured</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name">Name: A to Z</option>
          <option value="stock_desc">Stock: High to Low</option>
        </select>
        <label className="row" style={{ flex: '0 0 auto', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>
          <input
            type="checkbox"
            style={{ width: 18, height: 18, minHeight: 18 }}
            checked={inStock}
            onChange={(e) => setParam('stock', e.target.checked ? '1' : '')}
          />
          In stock only
        </label>
        {hasActiveFilters && (
          <button type="button" className="btn ghost sm" style={{ flex: '0 0 auto' }} onClick={clearFilters}>
            Reset
          </button>
        )}
      </div>

      {cat.loading ? (
        <Loading label="Loading catalog..." />
      ) : cat.products.length === 0 ? (
        <Empty
          title="No products in catalog"
          action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn" to="/admin/products">
                Manage Products
              </Link>
              <Link className="btn ghost" to="/">
                Back to Home
              </Link>
            </div>
          }
        >
          No products are currently published.
        </Empty>
      ) : list.length === 0 ? (
        <Empty
          title="No matching products"
          action={
            <button type="button" className="btn" onClick={clearFilters}>
              Clear Filters
            </button>
          }
        >
          No products matched {q ? `"${q}"` : 'your selected filters'}.
        </Empty>
      ) : (
        <>
          <div className="row spread" style={{ marginBottom: 14 }}>
            <span className="muted" aria-live="polite" style={{ fontSize: 13 }}>
              Showing {paginate(list, page, SIZE).length} of {list.length} products
            </span>
            {q && (
              <span className="tag">
                Search: &ldquo;{q}&rdquo;
              </span>
            )}
          </div>

          <div className="grid g4">
            {paginate(list, page, SIZE).map((p) => (
              <ProductCard
                key={p.sku}
                p={p}
                price={cat.priceOf(p.sku)}
                wholesale={wholesale && role === 'dealer'}
              />
            ))}
          </div>

          <Pager page={page} pages={Math.ceil(list.length / SIZE)} onPage={setPage} />
        </>
      )}
    </div>
  );
}
