import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AuthError, currentRole, helperAvailable, loadCatalog } from '../api';
import type { Catalog } from '../types';

type State = {
  data: Catalog | null;
  refresh: () => Promise<void>;
  authed: boolean | null;
  setAuthed: (v: boolean) => void;
  /** Local AI helper reachable (only on the laptop running `npm run helper`). */
  ai: boolean;
};
const Ctx = createContext<State>(null!);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Catalog | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [ai, setAi] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await loadCatalog());
    } catch (e) {
      if (e instanceof AuthError) setAuthed(false);
      else alert((e as Error).message);
    }
  }, []);

  useEffect(() => {
    currentRole().then((r) => setAuthed(r === 'admin'));
    helperAvailable().then(setAi);
  }, []);

  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);

  return <Ctx.Provider value={{ data, refresh, authed, setAuthed, ai }}>{children}</Ctx.Provider>;
}

export const useAdmin = () => useContext(Ctx);
