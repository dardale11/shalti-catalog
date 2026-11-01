import { admin } from '../api';
import type { AiDraft, Brand, Catalog, Product } from '../types';
import { importImage } from './images';

const rid = () => Math.random().toString(36).slice(2, 10);
const same = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase();

export const runAiLookup = (query: string, hint?: string) => admin.post<AiDraft>('/ai-lookup', { query, hint });

// Finds the brand the AI named, creating it if the shop doesn't have it yet.
export async function resolveBrand(data: Catalog, draft: AiDraft): Promise<string> {
  const hit = data.brands.find((b) => same(b.name.en, draft.brand.en) || same(b.name.he, draft.brand.he));
  if (hit) return hit.id;
  const created = await admin.post<Brand>('/brands', { name: draft.brand, logo: '', visible: true });
  data.brands.push(created);
  return created.id;
}

export function resolveCategory(data: Catalog, draft: AiDraft): string | undefined {
  return data.categories.find((c) => c.template === draft.category || c.id === draft.category)?.id;
}

// Copies the first `max` reachable images into local storage; dead links are skipped.
export async function importImages(urls: string[], max = 4): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    if (out.length >= max) break;
    try {
      out.push(await importImage(u));
    } catch {
      /* skip broken image links */
    }
  }
  return out;
}

// Merge rule: AI fills gaps but never overwrites what the shop already typed in.
export function mergeDraft(p: Partial<Product>, draft: AiDraft, opts: { overwrite?: boolean } = {}): Partial<Product> {
  const pick = <T,>(cur: T | undefined, next: T | undefined, empty: (v: T | undefined) => boolean) =>
    opts.overwrite || empty(cur) ? next ?? cur : cur;
  const emptyStr = (v?: string) => !v?.trim();
  return {
    ...p,
    name: {
      he: pick(p.name?.he, draft.name.he, emptyStr)!,
      en: pick(p.name?.en, draft.name.en, emptyStr)!,
    },
    description: {
      he: pick(p.description?.he, draft.description.he, emptyStr) ?? '',
      en: pick(p.description?.en, draft.description.en, emptyStr) ?? '',
    },
    specs: opts.overwrite ? { ...p.specs, ...draft.specs } : { ...draft.specs, ...p.specs },
    flavorFamilies: p.flavorFamilies?.length && !opts.overwrite ? p.flavorFamilies : draft.flavorFamilies ?? [],
    variants: p.variants?.length && !opts.overwrite ? p.variants : draft.variants.map((name) => ({ id: rid(), name, inStock: true })),
  };
}

// Used by "AI fill all": fills one product end-to-end and flags it for human review.
export async function autoFill(data: Catalog, product: Product): Promise<Product> {
  const brand = data.brands.find((b) => b.id === product.brandId);
  const query = `${brand?.name.en ?? ''} ${product.name.en}`.trim();
  const draft = await runAiLookup(query, `Hebrew listing name: ${product.name.he}`);
  const merged = mergeDraft(product, draft);
  const images = product.images.length ? product.images : await importImages(draft.imageUrls, 3);
  return admin.put<Product>(`/products/${product.id}`, { ...merged, images, needsReview: true, aiSources: draft.sourceUrls });
}
