import { admin } from '../api';

export function moveItem(kind: 'products' | 'brands' | 'categories', list: { id: string }[], id: string, delta: -1 | 1) {
  const ids = list.map((x) => x.id);
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return Promise.resolve();
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return admin.post('/reorder', { kind, ids });
}
