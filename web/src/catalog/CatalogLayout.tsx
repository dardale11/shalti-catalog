import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useCatalog } from './CatalogContext';
import { Gate } from './Gate';
import { Screensaver } from './Screensaver';
import { LOGO } from '../assets';

export function CatalogLayout() {
  const { t, lang, setLang } = useI18n();
  const { catalog, locked, offline } = useCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const idle = useIdle((catalog?.settings.idleSeconds ?? 60) * 1000);
  // Staff-only way out of the kiosk: hold the logo for 2s to open admin (switch login / sign out there).
  const holdLogo = useLongPress(2000, () => navigate('/admin'));

  // Kiosk reset: after inactivity go back to the start so the next customer starts fresh.
  useEffect(() => {
    if (idle && location.pathname !== '/') navigate('/', { replace: true });
  }, [idle, location.pathname, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (locked) return <Gate />;
  if (!catalog) return <div className="center muted">…</div>;

  const atHome = location.pathname === '/';

  return (
    <div className="catalog">
      <header className="topbar">
        <div className="topbar-side">
          {!atHome && (
            <button className="icon-btn" onClick={() => navigate(-1)} aria-label={t('back')}>
              <span className="flip-rtl">←</span> {t('back')}
            </button>
          )}
        </div>
        <Link to="/" className="brandmark" {...holdLogo} onContextMenu={(e) => e.preventDefault()}>
          <img src={LOGO} alt="" />
          <span>{lang === 'he' ? 'שלתי הזקן' : 'Shalti HaZaken'}</span>
        </Link>
        <div className="topbar-side end">
          <button className="icon-btn lang" onClick={() => setLang(lang === 'he' ? 'en' : 'he')}>
            {lang === 'he' ? 'EN' : 'עב'}
          </button>
        </div>
      </header>
      {offline && <div className="banner">{t('offline')}</div>}
      <main className="catalog-main">
        <Outlet />
      </main>
      <footer className="catalog-footer">{t('ageNotice')}</footer>
      {idle && <Screensaver />}
    </div>
  );
}

function useLongPress(ms: number, onHold: () => void) {
  const timer = useRef<number>();
  const held = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: () => {
      held.current = false;
      timer.current = window.setTimeout(() => ((held.current = true), onHold()), ms);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // The click that ends a long press must not also follow the link.
    onClick: (e: React.MouseEvent) => held.current && e.preventDefault(),
  };
}

function useIdle(ms: number) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer: number;
    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [ms]);
  return idle;
}
