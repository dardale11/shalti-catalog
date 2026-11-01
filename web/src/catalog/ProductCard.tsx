import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Product } from '../types';
import { useCatalog } from './CatalogContext';

export function ProductCard({ product: p, showBrand }: { product: Product; showBrand?: boolean }) {
  const { t, tr } = useI18n();
  const { catalog, brandById } = useCatalog();
  const brand = brandById.get(p.brandId);
  const puffs = p.specs.puffs as number | undefined;

  return (
    <Link to={`/product/${p.id}`} className={`product-card ${p.status === 'out_of_stock' ? 'oos' : ''}`}>
      <div className="product-img">
        {p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <Placeholder text={tr(brand?.name)} />}
        {p.status === 'out_of_stock' && <span className="badge dark">{t('outOfStock')}</span>}
        {p.featured && p.status !== 'out_of_stock' && <span className="badge">★</span>}
      </div>
      <div className="product-meta">
        {showBrand && <div className="product-brand">{tr(brand?.name)}</div>}
        <div className="product-name">{tr(p.name)}</div>
        <div className="product-sub">
          {puffs ? <span>{puffs.toLocaleString()} {t('puffs')}</span> : null}
          {catalog?.settings.showPrices && p.price != null && (
            <span className="price">
              {catalog.settings.currency}
              {p.price}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function Placeholder({ text }: { text: string }) {
  return (
    <div className="placeholder">
      <img src="/logo-round.png" alt="" />
      <span>{text}</span>
    </div>
  );
}
