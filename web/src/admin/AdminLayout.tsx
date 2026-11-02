import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { currentRole, login, logout } from '../api';
import { AdminProvider, useAdmin } from './AdminContext';
import { LOGO } from '../assets';

export function AdminRoot() {
  return (
    <AdminProvider>
      <AdminShell />
    </AdminProvider>
  );
}

function AdminShell() {
  const { authed, setAuthed, data } = useAdmin();
  const navigate = useNavigate();
  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} />;

  return (
    <div className="admin" dir="ltr" lang="en">
      <header className="admin-bar">
        <img src={LOGO} alt="" />
        <strong>Catalog admin</strong>
        <nav>
          <NavLink to="/admin" end>Products</NavLink>
          <NavLink to="/admin/brands">Brands</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
        </nav>
        <div className="spacer" />
        <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer">Open catalog ↗</a>
        <button className="link" onClick={() => logout().then(() => (setAuthed(false), navigate('/admin')))}>Log out</button>
      </header>
      <main className="admin-main">{data ? <Outlet /> : <p>Loading…</p>}</main>
    </div>
  );
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [shopSignedIn, setShopSignedIn] = useState(false);
  useEffect(() => {
    currentRole().then((r) => setShopSignedIn(r === 'shop'));
  }, []);
  const toCatalog = () => window.location.assign(import.meta.env.BASE_URL);
  return (
    <div className="gate" dir="ltr">
      <img src={LOGO} alt="" className="gate-logo" />
      <form
        className="gate-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await login('admin', pw);
            onDone();
          } catch {
            setErr('Wrong password');
          }
        }}
      >
        <label htmlFor="pw">Admin password</label>
        <input id="pw" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <button className="btn primary">Log in</button>
        <button type="button" className="link" onClick={toCatalog}>Back to catalog</button>
        {shopSignedIn && (
          <button type="button" className="link" onClick={() => logout().then(toCatalog)}>
            Sign this device out of the shop login
          </button>
        )}
      </form>
    </div>
  );
}
