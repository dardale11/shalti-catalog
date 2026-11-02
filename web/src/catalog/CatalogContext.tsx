import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthError, currentRole, loadCatalog, login, subscribeChanges } from '../api';
import type { Brand, Catalog, Product } from '../types';

const CACHE_KEY = 'shalti.catalog';

type State = {
  catalog: Catalog | null;
  locked: boolean;
  offline: boolean;
  reload: () => void;
  brandById: Map<string, Brand>;
  productsOf: (brandId: string) => Product[];
};

const Ctx = createContext<State>(null!);

// What shop screens show: visible brands, non-hidden products.
function forScreens(c: Catalog): Catalog {
  const brands = c.brands.filter((b) => b.visible !== false);
  const ids = new Set(brands.map((b) => b.id));
  return { ...c, brands, products: c.products.filter((p) => p.status !== 'hidden' && ids.has(p.brandId)) };
}

// A device can be logged in by opening the catalog link with ?key=<shop code> once (e.g. from a QR code).
async function consumeKeyFromUrl() {
  const url = new URL(location.href);
  const key = url.searchParams.get('key');
  if (!key) return;
  url.searchParams.delete('key');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  await login('shop', key).catch(() => undefined);
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(() => {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = forScreens(await loadCatalog());
      setCatalog(data);
      setOffline(false);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      if (e instanceof AuthError) setLocked(true);
      else setOffline(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await consumeKeyFromUrl();
      const role = await currentRole();
      setLocked(!role);
      setReady(true);
      if (role) reload();
    })();
  }, [reload]);

  // Live refresh when the admin saves anything.
  useEffect(() => {
    if (locked || !ready) return;
    const off = subscribeChanges(reload);
    const onOnline = () => reload();
    window.addEventListener('online', onOnline);
    return () => (off(), window.removeEventListener('online', onOnline));
  }, [locked, ready, reload]);

  const unlock = useCallback(() => (setLocked(false), reload()), [reload]);

  const value = useMemo<State>(() => {
    const brandById = new Map((catalog?.brands ?? []).map((b) => [b.id, b]));
    return {
      catalog: ready ? catalog : null,
      locked,
      offline,
      reload: unlock,
      brandById,
      productsOf: (brandId) => (catalog?.products ?? []).filter((p) => p.brandId === brandId),
    };
  }, [catalog, locked, offline, ready, unlock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalog = () => useContext(Ctx);
