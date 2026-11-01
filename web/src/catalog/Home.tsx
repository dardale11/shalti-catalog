import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useCatalog } from './CatalogContext';
import { ProductCard } from './ProductCard';

export function Home() {
  const { t, tr } = useI18n();
  const { catalog, productsOf } = useCatalog();
  const navigate = useNavigate();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');

  const brands = useMemo(
    () =>
      (catalog?.brands ?? [])
        .map((b) => ({ brand: b, count: productsOf(b.id).filter((p) => !cat || p.categoryId === cat).length }))
        .filter((x) => x.count > 0),
    [catalog, productsOf, cat],
  );
  const featured = (catalog?.products ?? []).filter((p) => p.featured && (!cat || p.categoryId === cat));
  const categories = (catalog?.categories ?? []).filter((c) => catalog?.products.some((p) => p.categoryId === c.id));

  return (
    <div className="home">
      <form className="searchbar" onSubmit={(e) => (e.preventDefault(), navigate(`/browse?q=${encodeURIComponent(q)}`))}>
        <input type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" aria-label={t('search')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
      </form>

      <nav className="chips">
        <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>{t('all')}</button>
        {categories.map((c) => (
          <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
            {tr(c.name)}
          </button>
        ))}
        <Link className="chip ghost" to={`/browse${cat ? `?cat=${cat}` : ''}`}>{t('filters')} ⚙</Link>
      </nav>

      {featured.length > 0 && (
        <section>
          <h2 className="section-title">{t('featured')}</h2>
          <div className="row-scroll">
            {featured.map((p) => <ProductCard key={p.id} product={p} showBrand />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">{t('brands')}</h2>
        <div className="brand-grid">
          {brands.map(({ brand, count }) => (
            <Link key={brand.id} to={`/brand/${brand.id}${cat ? `?cat=${cat}` : ''}`} className="brand-tile">
              {brand.logo ? <img src={brand.logo} alt="" /> : <span className="brand-name">{tr(brand.name)}</span>}
              {brand.logo && <span className="brand-caption">{tr(brand.name)}</span>}
              <span className="brand-count">{count} {t('products')}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
