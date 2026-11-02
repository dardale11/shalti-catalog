import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useCatalog } from './CatalogContext';
import { LOGO } from '../assets';

const SLIDE_MS = 6000;

// Shown after inactivity: cycles featured products (or any with photos). Any touch dismisses it.
export function Screensaver() {
  const { t, tr } = useI18n();
  const { catalog, brandById } = useCatalog();
  const [i, setI] = useState(0);

  const slides = useMemo(() => {
    const withImg = (catalog?.products ?? []).filter((p) => p.images.length && p.status === 'active');
    const featured = withImg.filter((p) => p.featured);
    return featured.length ? featured : withImg;
  }, [catalog]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  const p = slides[i % Math.max(slides.length, 1)];

  return (
    <div className="screensaver">
      {p ? (
        <div className="ss-slide" key={p.id}>
          <img src={p.images[0]} alt="" />
          <div className="ss-caption">
            <div className="ss-brand">{tr(brandById.get(p.brandId)?.name)}</div>
            <div className="ss-name">{tr(p.name)}</div>
          </div>
        </div>
      ) : (
        <img src={LOGO} alt="" className="ss-logo" />
      )}
      <div className="ss-hint">{t('tapToStart')}</div>
    </div>
  );
}
