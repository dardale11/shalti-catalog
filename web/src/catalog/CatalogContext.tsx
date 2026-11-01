import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthError, eventsUrl, getToken, shopGet } from '../api';
import type { Brand, Catalog, Product } from '../types';

const CACHE_KEY = 'shalti.catalog';

type State = {
  catalog: Catalog | null;
  locked: boolean;
  offline: boolean;
  error: string;
  reload: () => void;
  brandById: Map<string, Brand>;
  productsOf: (brandId: string) => Product[];
};

const Ctx = createContext<State>(null!);

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(() => {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [locked, setLocked] = useState(!getToken('shop') && !getToken('admin'));
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!getToken('shop') && !getToken('admin')) return setLocked(true);
    try {
      const data = await shopGet<Catalog>('/api/catalog');
      data.brands.sort(byOrder);
      data.products.sort(byOrder);
      data.categories.sort(byOrder);
      setCatalog(data);
      setLocked(false);
      setOffline(false);
      setError('');
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      if (e instanceof AuthError) setLocked(true);
      else {
        setOffline(true);
        setError((e as Error).message);
      }
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Live refresh when the admin saves; EventSource reconnects on its own after Wi-Fi drops.
  useEffect(() => {
    if (locked) return;
    const es = new EventSource(eventsUrl());
    es.onmessage = () => reload();
    es.onopen = () => reload();
    return () => es.close();
  }, [locked, reload]);

  const value = useMemo<State>(() => {
    const brandById = new Map((catalog?.brands ?? []).map((b) => [b.id, b]));
    return {
      catalog,
      locked,
      offline,
      error,
      reload,
      brandById,
      productsOf: (brandId) => (catalog?.products ?? []).filter((p) => p.brandId === brandId),
    };
  }, [catalog, locked, offline, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalog = () => useContext(Ctx);
