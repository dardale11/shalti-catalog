import { useState } from 'react';
import { createItem, deleteItem, saveItem } from '../api';
import { TEMPLATES } from '../i18n';
import type { Category } from '../types';
import { useAdmin } from './AdminContext';
import { moveItem } from './reorder';

// Categories are how the catalog grows beyond e-cigarettes later: each picks a spec template.
export function Categories() {
  const { data, refresh } = useAdmin();
  const [draft, setDraft] = useState({ he: '', en: '', template: TEMPLATES[0] });
  const count = (id: string) => data!.products.filter((p) => p.categoryId === id).length;
  const patch = async (c: Category, body: Partial<Category>) => (await saveItem('categories', { ...c, ...body }), refresh());

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.he && !draft.en) return;
    await createItem<Category>('categories', data!.categories, { name: { he: draft.he, en: draft.en }, template: draft.template });
    setDraft({ he: '', en: '', template: TEMPLATES[0] });
    refresh();
  }

  async function remove(c: Category) {
    if (count(c.id)) return alert('Move this category’s products first.');
    if (!confirm(`Delete category "${c.name.en}"?`)) return;
    await deleteItem('categories', c.id);
    refresh();
  }

  return (
    <div>
      <div className="admin-head"><h1>Categories</h1></div>
      <form className="toolbar" onSubmit={add}>
        <input dir="rtl" placeholder="Name (Hebrew)" value={draft.he} onChange={(e) => setDraft({ ...draft, he: e.target.value })} />
        <input placeholder="Name (English)" value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
        <select value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value })}>
          {TEMPLATES.map((t) => <option key={t} value={t}>Specs: {t}</option>)}
        </select>
        <button className="btn primary">+ Add category</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Hebrew</th><th>English</th><th>Spec template</th><th>Products</th><th>Order</th><th /></tr></thead>
          <tbody>
            {data!.categories.map((c) => (
              <tr key={c.id}>
                <td><input dir="rtl" defaultValue={c.name.he} onBlur={(e) => e.target.value !== c.name.he && patch(c, { name: { ...c.name, he: e.target.value } })} /></td>
                <td><input defaultValue={c.name.en} onBlur={(e) => e.target.value !== c.name.en && patch(c, { name: { ...c.name, en: e.target.value } })} /></td>
                <td>
                  <select value={c.template} onChange={(e) => patch(c, { template: e.target.value })}>
                    {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td>{count(c.id)}</td>
                <td className="nowrap">
                  <button className="icon-btn sm" onClick={() => moveItem('categories', data!.categories, c.id, -1).then(refresh)}>↑</button>
                  <button className="icon-btn sm" onClick={() => moveItem('categories', data!.categories, c.id, 1).then(refresh)}>↓</button>
                </td>
                <td><button className="link danger" onClick={() => remove(c)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
