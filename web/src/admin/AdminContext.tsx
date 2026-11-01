import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { admin, AuthError, getToken } from '../api';
import type { Catalog } from '../types';

type State = { data: Catalog | null; refresh: () => Promise<void>; authed: boolean; setAuthed: (v: boolean) => void };
const Ctx = createContext<State>(null!);

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Catalog | null>(null);
  const [authed, setAuthed] = useState(!!getToken('admin'));

  const refresh = useCallback(async () => {
    try {
      const d = await admin.get<Catalog>('/data');
      d.brands.sort(byOrder);
      d.categories.sort(byOrder);
      d.products.sort(byOrder);
      setData(d);
    } catch (e) {
      if (e instanceof AuthError) setAuthed(false);
      else throw e;
    }
  }, []);

  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);

  return <Ctx.Provider value={{ data, refresh, authed, setAuthed }}>{children}</Ctx.Provider>;
}

export const useAdmin = () => useContext(Ctx);
