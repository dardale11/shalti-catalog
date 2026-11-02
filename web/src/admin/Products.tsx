import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { saveItem } from '../api';
import type { Product, ProductStatus } from '../types';
import { useAdmin } from './AdminContext';
import { autoFill } from './aiApply';
import { moveItem } from './reorder';

const isEmpty = (p: Product) => !p.description.he && !p.description.en && !Object.keys(p.specs).length;
// What the bulk AI fill targets: no info yet, or no photos.
const isMissing = (p: Product) => isEmpty(p) || !p.images.length;

export function Products() {
  const { data, refresh, ai } = useAdmin();
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [cat, setCat] = useState('');
  const [view, setView] = useState<'' | 'empty' | 'review'>('');
  const [bulk, setBulk] = useState<{ done: number; total: number; current: string; errors: string[]; stop: boolean } | null>(null);

  const products = data!.products;
  const brandName = (id: string) => data!.brands.find((b) => b.id === id)?.name.en ?? '?';
  const catName = (id: string) => data!.categories.find((c) => c.id === id)?.name.en ?? '?';

  const list = useMemo(() => {
    const nq = q.toLowerCase();
    return products.filter(
      (p) =>
        (!brand || p.brandId === brand) &&
        (!cat || p.categoryId === cat) &&
        (view !== 'empty' || isMissing(p)) &&
        (view !== 'review' || p.needsReview) &&
        (!nq || `${p.name.he} ${p.name.en} ${brandName(p.brandId)}`.toLowerCase().includes(nq)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, q, brand, cat, view]);

  const filtered = !!(q || brand || cat || view);
  const emptyCount = products.filter(isMissing).length;
  const reviewCount = products.filter((p) => p.needsReview).length;

  async function patch(p: Product, body: Partial<Product>) {
    await saveItem('products', { ...p, ...body });
    refresh();
  }

  async function fillAll() {
    const targets = list.filter(isMissing);
    if (!targets.length) return alert('Nothing to fill in the current list.');
    if (!confirm(`Look up ${targets.length} product(s) with Claude? Takes ~1–2 min each, runs 2 at a time.`)) return;
    const state = { done: 0, total: targets.length, current: '', errors: [] as string[], stop: false };
    setBulk({ ...state });
    const queue = [...targets];
    const worker = async () => {
      while (queue.length && !state.stop) {
        const p = queue.shift()!;
        state.current = p.name.en;
        setBulk({ ...state });
        try {
          await autoFill(data!, p);
        } catch (e) {
          state.errors.push(`${p.name.en}: ${(e as Error).message.split('\n')[0]}`);
        }
        state.done++;
        setBulk({ ...state });
        refresh();
      }
    };
    await Promise.all([worker(), worker()]);
    state.current = '';
    setBulk({ ...state });
  }

  return (
    <div>
      <div className="admin-head">
        <h1>Products <span className="muted">({products.length})</span></h1>
        <div className="spacer" />
        <Link className="btn" to="/admin/product/new">+ New product</Link>
        {ai && <Link className="btn primary" to="/admin/product/new?ai=1">✨ Add with AI</Link>}
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">All brands</option>
          {data!.brands.map((b) => <option key={b.id} value={b.id}>{b.name.en}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {data!.categories.map((c) => <option key={c.id} value={c.id}>{c.name.en}</option>)}
        </select>
        <select value={view} onChange={(e) => setView(e.target.value as typeof view)}>
          <option value="">All</option>
          <option value="empty">Missing info / photos ({emptyCount})</option>
          <option value="review">Needs review ({reviewCount})</option>
        </select>
        <div className="spacer" />
        {!ai ? (
          <span className="muted small" title="Run `npm run helper` on the laptop with Claude Code to enable AI">AI tools: offline</span>
        ) : bulk && bulk.current ? (
          <button className="btn" onClick={() => setBulk((b) => (b && ((b.stop = true), { ...b })))}>Stop after current</button>
        ) : (
          <button className="btn" onClick={fillAll} title="Runs AI lookup for listed products that have no description/specs or no photos">
            ✨ AI fill missing ({list.filter(isMissing).length})
          </button>
        )}
      </div>

      {bulk && (
        <div className="notice">
          AI fill: {bulk.done}/{bulk.total} {bulk.current && <>— working on <b>{bulk.current}</b></>}
          {bulk.errors.length > 0 && (
            <details><summary>{bulk.errors.length} failed</summary><ul>{bulk.errors.map((e) => <li key={e}>{e}</li>)}</ul></details>
          )}
          {!bulk.current && <button className="link" onClick={() => setBulk(null)}>dismiss</button>}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th className="hide-sm">Brand</th>
              <th className="hide-sm">Category</th>
              <th>Price</th>
              <th>Status</th>
              <th title="Featured">★</th>
              <th className="hide-sm">Order</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.images[0] ? <img className="thumb-sm" src={p.images[0]} alt="" /> : <div className="thumb-sm blank" />}</td>
                <td>
                  <Link to={`/admin/product/${p.id}`} className="strong">{p.name.en}</Link>
                  <div className="muted" lang="he">{p.name.he}</div>
                  {p.needsReview && <span className="tag warn">review</span>}
                  {isEmpty(p) && <span className="tag">no info</span>}
                  {!isEmpty(p) && !p.images.length && <span className="tag">no photo</span>}
                </td>
                <td className="hide-sm">{brandName(p.brandId)}</td>
                <td className="hide-sm">{catName(p.categoryId)}</td>
                <td>
                  <input
                    className="price-input"
                    type="number"
                    defaultValue={p.price ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      if (v !== p.price) patch(p, { price: v });
                    }}
                  />
                </td>
                <td>
                  <select value={p.status} onChange={(e) => patch(p, { status: e.target.value as ProductStatus })}>
                    <option value="active">Active</option>
                    <option value="out_of_stock">Out of stock</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </td>
                <td><input type="checkbox" checked={p.featured} onChange={() => patch(p, { featured: !p.featured })} /></td>
                <td className="hide-sm nowrap">
                  <button className="icon-btn sm" disabled={filtered} title={filtered ? 'Clear filters to reorder' : 'Move up'} onClick={() => moveItem('products', products, p.id, -1).then(refresh)}>↑</button>
                  <button className="icon-btn sm" disabled={filtered} title={filtered ? 'Clear filters to reorder' : 'Move down'} onClick={() => moveItem('products', products, p.id, 1).then(refresh)}>↓</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
