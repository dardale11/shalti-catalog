// Data access: Supabase (Postgres + Storage + Auth). Row-level security in supabase/schema.sql
// decides what the shop and admin logins can read/write; nothing is public.
import { createClient } from '@supabase/supabase-js';
import type { Brand, Catalog, Category, Product, Settings } from './types';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

// Two shared logins; users only ever type the code/password.
const EMAILS = { shop: 'shop@shalti-catalog.app', admin: 'admin@shalti-catalog.app' } as const;
export type Role = keyof typeof EMAILS;

export class AuthError extends Error {}

export async function login(role: Role, secret: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: EMAILS[role], password: secret.trim() });
  if (error) throw new AuthError(error.message);
}

export const logout = () => supabase.auth.signOut();

export async function currentRole(): Promise<Role | null> {
  const { data } = await supabase.auth.getSession();
  return (data.session?.user.app_metadata?.role as Role) ?? null;
}

// ---------- rows <-> objects ----------
type Kind = 'categories' | 'brands' | 'products';
type Row = { id: string; sort: number; data: Record<string, unknown> };
type Item = { id: string; order: number };

const fromRow = <T,>(r: Row): T => ({ ...r.data, id: r.id, order: r.sort }) as T;
function toRow(item: Item & Record<string, unknown>): Row {
  const { id, order, price: _price, ...data } = item;
  return { id, sort: order ?? 0, data };
}

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === 'PGRST301' || /JWT/i.test(res.error.message)) throw new AuthError(res.error.message);
    throw new Error(res.error.message);
  }
  return res.data;
}

const byOrder = <T extends Item>(a: T, b: T) => a.order - b.order;

// Shop screens and admin both load everything; prices only come back when allowed by RLS.
export async function loadCatalog(): Promise<Catalog> {
  const [settings, categories, brands, products, prices] = await Promise.all([
    supabase.from('settings').select('data').eq('id', 1).maybeSingle(),
    supabase.from('categories').select('id,sort,data'),
    supabase.from('brands').select('id,sort,data'),
    supabase.from('products').select('id,sort,data'),
    supabase.from('product_prices').select('product_id,price'),
  ]).then((all) => all.map((r) => check(r as { data: unknown; error: { message: string; code?: string } | null })));
  const priceOf = new Map((prices as { product_id: string; price: number }[]).map((p) => [p.product_id, Number(p.price)]));
  return {
    settings: { showPrices: false, idleSeconds: 60, currency: '₪', ...((settings as { data: Settings } | null)?.data ?? {}) },
    categories: (categories as Row[]).map((r) => fromRow<Category>(r)).sort(byOrder),
    brands: (brands as Row[]).map((r) => fromRow<Brand>(r)).sort(byOrder),
    products: (products as Row[])
      .map((r) => ({ ...fromRow<Product>(r), price: priceOf.get(r.id) ?? null }))
      .sort(byOrder),
  };
}

// Fires on any catalog change (admin saves) so screens refresh live.
export function subscribeChanges(onChange: () => void) {
  const ch = supabase.channel('catalog-changes');
  for (const table of ['settings', 'categories', 'brands', 'products', 'product_prices']) {
    ch.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  }
  ch.subscribe();
  return () => void supabase.removeChannel(ch);
}

// ---------- admin writes ----------
const rid = () => crypto.randomUUID().slice(0, 8);

export async function createItem<T extends Item>(kind: Kind, list: Item[], item: Partial<T>): Promise<T> {
  const full = { ...item, id: rid(), order: list.reduce((m, x) => Math.max(m, x.order), 0) + 1 } as T & Record<string, unknown>;
  check(await supabase.from(kind).insert(toRow(full)));
  if (kind === 'products') await savePrice(full.id, (full as unknown as Product).price);
  return full;
}

export async function saveItem<T extends Item>(kind: Kind, item: T): Promise<T> {
  const full = { ...item, updatedAt: Date.now() } as T & Record<string, unknown>;
  check(await supabase.from(kind).update({ ...toRow(full), updated_at: new Date().toISOString() }).eq('id', item.id));
  if (kind === 'products' && 'price' in full) await savePrice(full.id, (full as unknown as Product).price);
  return full;
}

async function savePrice(productId: string, price: number | null | undefined) {
  if (price == null || Number.isNaN(price)) check(await supabase.from('product_prices').delete().eq('product_id', productId));
  else check(await supabase.from('product_prices').upsert({ product_id: productId, price }));
}

export async function deleteItem(kind: Kind, id: string) {
  check(await supabase.from(kind).delete().eq('id', id));
}

export async function setOrder(kind: Kind, items: Item[]) {
  await Promise.all(items.map((x) => supabase.from(kind).update({ sort: x.order }).eq('id', x.id).then(check)));
}

export async function saveSettings(settings: Settings) {
  check(await supabase.from('settings').update({ data: settings }).eq('id', 1));
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

export async function uploadBlob(blob: Blob): Promise<string> {
  const name = `${Date.now().toString(36)}-${rid()}.${EXT[blob.type] ?? 'jpg'}`;
  check(await supabase.storage.from('images').upload(name, blob, { contentType: blob.type, cacheControl: '31536000' }));
  return supabase.storage.from('images').getPublicUrl(name).data.publicUrl;
}

// ---------- AI helper (only on the laptop running `npm run helper`) ----------
// The hosted site has no server; AI lookups and fetching images from other sites go through a small
// local helper that drives the Claude Code CLI. The admin UI shows the AI buttons only when it answers.
export const HELPER_URL = (import.meta.env.VITE_HELPER_URL as string) || 'http://localhost:8840';

export async function helperAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${HELPER_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function helperPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${HELPER_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data as T;
}

export async function helperFetchImage(url: string): Promise<Blob> {
  const r = await fetch(`${HELPER_URL}/fetch-image?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'image fetch failed');
  return r.blob();
}
