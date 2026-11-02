import { setOrder } from '../api';

// Swaps an item with its neighbour (only the two changed rows are written).
export function moveItem(kind: 'products' | 'brands' | 'categories', list: { id: string; order: number }[], id: string, delta: -1 | 1) {
  const i = list.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return Promise.resolve();
  const a = list[i], b = list[j];
  const [oa, ob] = a.order === b.order ? [b.order + delta, a.order] : [b.order, a.order];
  return setOrder(kind, [{ id: a.id, order: oa }, { id: b.id, order: ob }]);
}
