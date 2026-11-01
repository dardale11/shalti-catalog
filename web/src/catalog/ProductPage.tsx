import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORY_SPECS, FLAVOR_FAMILIES, SPECS, formatSpec, useI18n } from '../i18n';
import { useCatalog } from './CatalogContext';
import { Placeholder } from './ProductCard';

export function ProductPage() {
  const { id } = useParams();
  const { t, tr, lang } = useI18n();
  const { catalog, brandById } = useCatalog();
  const p = catalog?.products.find((x) => x.id === id);
  const [imgIdx, setImgIdx] = useState(0);
  const [variantImg, setVariantImg] = useState<string>();

  if (!p) return <div className="empty">{t('noResults')}</div>;

  const brand = brandById.get(p.brandId);
  const category = catalog?.categories.find((c) => c.id === p.categoryId);
  const template = category?.template ?? '';
  // Known keys for this category first, then anything else that was filled in.
  const keys = [...new Set([...(CATEGORY_SPECS[template] ?? []), ...Object.keys(p.specs)])].filter(
    (k) => SPECS[k] && formatSpec(k, p.specs[k], lang),
  );
  const mainImg = variantImg ?? p.images[imgIdx];

  return (
    <article className="product-page">
      <div className="gallery">
        <div className="gallery-main">
          {mainImg ? <img src={mainImg} alt={tr(p.name)} /> : <Placeholder text={tr(brand?.name)} />}
        </div>
        {p.images.length > 1 && (
          <div className="thumbs">
            {p.images.map((src, i) => (
              <button key={src} className={`thumb ${!variantImg && i === imgIdx ? 'on' : ''}`} onClick={() => (setImgIdx(i), setVariantImg(undefined))}>
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="product-info">
        <div className="crumbs">
          <Link to={`/brand/${p.brandId}`}>{tr(brand?.name)}</Link>
          {category && <span> · {tr(category.name)}</span>}
        </div>
        <h1>{tr(p.name)}</h1>
        <div className="info-row">
          {catalog?.settings.showPrices && p.price != null && (
            <span className="price big">{catalog.settings.currency}{p.price}</span>
          )}
          {p.status === 'out_of_stock' && <span className="badge dark">{t('outOfStock')}</span>}
        </div>

        {tr(p.description) && <p className="description">{tr(p.description)}</p>}

        {p.variants.length > 0 && (
          <section>
            <h3>{t('variants')}</h3>
            <div className="chips wrap">
              {p.variants.map((v) => (
                <button
                  key={v.id}
                  className={`chip ${!v.inStock ? 'disabled' : ''} ${variantImg && variantImg === v.image ? 'on' : ''}`}
                  onClick={() => v.image && setVariantImg(v.image)}
                >
                  {tr(v.name)}
                </button>
              ))}
            </div>
          </section>
        )}

        {p.flavorFamilies?.length > 0 && (
          <section>
            <h3>{t('flavors')}</h3>
            <div className="chips wrap">
              {p.flavorFamilies.map((f) => <span key={f} className="chip static">{tr(FLAVOR_FAMILIES[f])}</span>)}
            </div>
          </section>
        )}

        {keys.length > 0 && (
          <section>
            <h3>{t('specs')}</h3>
            <dl className="spec-table">
              {keys.map((k) => (
                <div key={k}>
                  <dt>{SPECS[k][lang]}</dt>
                  <dd>{formatSpec(k, p.specs[k], lang)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <p className="muted small">{t('askStaff')}</p>
      </div>
    </article>
  );
}
