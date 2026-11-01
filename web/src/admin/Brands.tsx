import { useRef, useState } from 'react';
import { admin } from '../api';
import type { Brand } from '../types';
import { useAdmin } from './AdminContext';
import { uploadImage } from './images';
import { moveItem } from './reorder';

export function Brands() {
  const { data, refresh } = useAdmin();
  const [name, setName] = useState({ he: '', en: '' });
  const count = (id: string) => data!.products.filter((p) => p.brandId === id).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.he && !name.en) return;
    await admin.post('/brands', { name, logo: '', visible: true });
    setName({ he: '', en: '' });
    refresh();
  }

  const patch = async (b: Brand, body: Partial<Brand>) => (await admin.put(`/brands/${b.id}`, body), refresh());

  async function remove(b: Brand) {
    if (count(b.id)) return alert('Move or delete this brand’s products first.');
    if (!confirm(`Delete brand "${b.name.en}"?`)) return;
    await admin.del(`/brands/${b.id}`);
    refresh();
  }

  return (
    <div>
      <div className="admin-head"><h1>Brands</h1></div>
      <form className="toolbar" onSubmit={add}>
        <input dir="rtl" placeholder="Name (Hebrew)" value={name.he} onChange={(e) => setName({ ...name, he: e.target.value })} />
        <input placeholder="Name (English)" value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} />
        <button className="btn primary">+ Add brand</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Logo</th><th>Hebrew</th><th>English</th><th>Products</th><th>Visible</th><th>Order</th><th /></tr></thead>
          <tbody>
            {data!.brands.map((b) => (
              <tr key={b.id}>
                <td><LogoCell brand={b} onChange={(logo) => patch(b, { logo })} /></td>
                <td><input dir="rtl" defaultValue={b.name.he} onBlur={(e) => e.target.value !== b.name.he && patch(b, { name: { ...b.name, he: e.target.value } })} /></td>
                <td><input defaultValue={b.name.en} onBlur={(e) => e.target.value !== b.name.en && patch(b, { name: { ...b.name, en: e.target.value } })} /></td>
                <td>{count(b.id)}</td>
                <td><input type="checkbox" checked={b.visible !== false} onChange={() => patch(b, { visible: b.visible === false })} /></td>
                <td className="nowrap">
                  <button className="icon-btn sm" onClick={() => moveItem('brands', data!.brands, b.id, -1).then(refresh)}>↑</button>
                  <button className="icon-btn sm" onClick={() => moveItem('brands', data!.brands, b.id, 1).then(refresh)}>↓</button>
                </td>
                <td><button className="link danger" onClick={() => remove(b)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogoCell({ brand, onChange }: { brand: Brand; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="logo-cell" onClick={() => input.current?.click()} title="Upload logo">
        {brand.logo ? <img src={brand.logo} alt="" /> : <span>+ logo</span>}
      </button>
      {brand.logo && <button className="link small" onClick={() => onChange('')}>remove</button>}
      <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => e.target.files?.[0] && onChange(await uploadImage(e.target.files[0]))} />
    </>
  );
}
