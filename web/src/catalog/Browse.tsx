import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ENUM_LABELS, FLAVOR_FAMILIES, useI18n, type StringKey } from '../i18n';
import type { Bi, Product } from '../types';
import { useCatalog } from './CatalogContext';
import { ProductCard } from './ProductCard';

const PUFF_BUCKETS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'p1', label: '< 10K', min: 0, max: 9_999 },
  { id: 'p2', label: '10K–20K', min: 10_000, max: 20_000 },
  { id: 'p3', label: '20K–40K', min: 20_001, max: 40_000 },
  { id: 'p4', label: '40K+', min: 40_001, max: Infinity },
];

// Each filter is a multi-select group stored in the URL (?cat=a,b&nic=salt...), so Back keeps state.
type Group = { key: string; title: StringKey; options: { id: string; label: string }[]; match: (p: Product, v: string) => boolean };

const norm = (s: string) => s.toLowerCase().replace(/[\s\-,.]/g, '');

export function Browse() {
  const { t, tr, lang } = useI18n();
  const { catalog, brandById } = useCatalog();
  const { brandId } = useParams();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const q = params.get('q') ?? '';
  const brand = brandId ? brandById.get(brandId) : undefined;

  const base = useMemo(() => {
    let list = catalog?.products ?? [];
    if (brandId) list = list.filter((p) => p.brandId === brandId);
    if (q) {
      const nq = norm(q);
      list = list.filter((p) =>
        [p.name.he, p.name.en, brandById.get(p.brandId)?.name.he, brandById.get(p.brandId)?.name.en, p.description.he, p.description.en]
          .some((s) => s && norm(s).includes(nq)),
      );
    }
    return list;
  }, [catalog, brandId, q, brandById]);

  const groups = useMemo<Group[]>(() => {
    const present = (get: (p: Product) => unknown[]) => new Set(base.flatMap(get).filter((x) => x !== undefined && x !== ''));
    const label = (b?: Bi, fallback = '') => (b ? tr(b) : fallback);
    const g: Group[] = [];
    const cats = present((p) => [p.categoryId]);
    g.push({
      key: 'cat', title: 'category',
      options: (catalog?.categories ?? []).filter((c) => cats.has(c.id)).map((c) => ({ id: c.id, label: tr(c.name) })),
      match: (p, v) => p.categoryId === v,
    });
    if (!brandId) {
      const bs = present((p) => [p.brandId]);
      g.push({
        key: 'brand', title: 'brand',
        options: (catalog?.brands ?? []).filter((b) => bs.has(b.id)).map((b) => ({ id: b.id, label: tr(b.name) })),
        match: (p, v) => p.brandId === v,
      });
    }
    for (const [key, spec, title] of [['nic', 'nicotineType', 'nicotineType'], ['style', 'style', 'drawStyle']] as const) {
      const vals = present((p) => [p.specs[spec]]);
      g.push({
        key, title,
        options: [...vals].map((v) => ({ id: String(v), label: label(ENUM_LABELS[String(v)], String(v)) })),
        match: (p, v) => String(p.specs[spec]) === v,
      });
    }
    const puffs = base.map((p) => p.specs.puffs as number).filter(Boolean);
    g.push({
      key: 'puffs', title: 'puffs',
      options: PUFF_BUCKETS.filter((b) => puffs.some((n) => n >= b.min && n <= b.max)).map((b) => ({ id: b.id, label: b.label })),
      match: (p, v) => {
        const b = PUFF_BUCKETS.find((x) => x.id === v)!;
        const n = p.specs.puffs as number;
        return n >= b.min && n <= b.max;
      },
    });
    const flav = present((p) => p.flavorFamilies ?? []);
    g.push({
      key: 'flavor', title: 'flavors',
      options: Object.keys(FLAVOR_FAMILIES).filter((f) => flav.has(f)).map((f) => ({ id: f, label: tr(FLAVOR_FAMILIES[f]) })),
      match: (p, v) => (p.flavorFamilies ?? []).includes(v),
    });
    return g.filter((x) => x.options.length > 1 || params.get(x.key));
  }, [base, catalog, brandId, tr, params]);

  const selected = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);
  const inStockOnly = params.get('stock') === '1';

  const results = useMemo(
    () =>
      base.filter(
        (p) =>
          (!inStockOnly || p.status !== 'out_of_stock') &&
          groups.every((g) => {
            const sel = selected(g.key);
            return !sel.length || sel.some((v) => g.match(p, v));
          }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, groups, params],
  );

  function toggle(key: string, id: string) {
    const cur = selected(key);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    const p = new URLSearchParams(params);
    next.length ? p.set(key, next.join(',')) : p.delete(key);
    setParams(p, { replace: true });
  }

  function clearAll() {
    setParams(q ? { q } : {}, { replace: true });
  }

  const activeCount = groups.reduce((n, g) => n + selected(g.key).length, 0) + (inStockOnly ? 1 : 0);

  return (
    <div className="browse">
      <div className="browse-head">
        <h1>{brand ? tr(brand.name) : q ? `“${q}”` : t('all')}</h1>
        <span className="muted">{results.length} {t('products')}</span>
        <button className="btn filter-toggle" onClick={() => setOpen((o) => !o)}>
          {t('filters')} {activeCount > 0 && <span className="count">{activeCount}</span>}
        </button>
      </div>

      <div className="browse-body">
        <aside className={`filters ${open ? 'open' : ''}`} lang={lang}>
          <div className="filters-head">
            <strong>{t('filters')}</strong>
            {activeCount > 0 && <button className="link" onClick={clearAll}>{t('clear')}</button>}
          </div>
          {groups.map((g) => (
            <div key={g.key} className="filter-group">
              <div className="filter-title">{t(g.title)}</div>
              <div className="chips wrap">
                {g.options.map((o) => (
                  <button key={o.id} className={`chip sm ${selected(g.key).includes(o.id) ? 'on' : ''}`} onClick={() => toggle(g.key, o.id)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="check">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={() => {
                const p = new URLSearchParams(params);
                inStockOnly ? p.delete('stock') : p.set('stock', '1');
                setParams(p, { replace: true });
              }}
            />
            {t('inStockOnly')}
          </label>
          <button className="btn primary close-filters" onClick={() => setOpen(false)}>
            {results.length} {t('products')}
          </button>
        </aside>

        {results.length ? (
          <div className="product-grid">
            {results.map((p) => <ProductCard key={p.id} product={p} showBrand={!brandId} />)}
          </div>
        ) : (
          <div className="empty">{t('noResults')}</div>
        )}
      </div>
    </div>
  );
}
