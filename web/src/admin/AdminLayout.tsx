import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, login } from '../api';
import { AdminProvider, useAdmin } from './AdminContext';

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
        <img src="/logo-round.png" alt="" />
        <strong>Catalog admin</strong>
        <nav>
          <NavLink to="/admin" end>Products</NavLink>
          <NavLink to="/admin/brands">Brands</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
        </nav>
        <div className="spacer" />
        <a href="/" target="_blank" rel="noreferrer">Open catalog ↗</a>
        <button className="link" onClick={() => (clearToken('admin'), setAuthed(false), navigate('/admin'))}>Log out</button>
      </header>
      <main className="admin-main">{data ? <Outlet /> : <p>Loading…</p>}</main>
    </div>
  );
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="gate" dir="ltr">
      <img src="/logo-round.png" alt="" className="gate-logo" />
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
      </form>
    </div>
  );
}
