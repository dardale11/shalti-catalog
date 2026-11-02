// One-time move to Supabase: creates the shop/admin logins and uploads data/db.json + data/uploads.
// Needs .env.local with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (run supabase/schema.sql in the SQL editor first).
// Usage: node scripts/setup-supabase.js [--skip-data]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
);
const URL_ = env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY || !env.SUPABASE_ANON_KEY) throw new Error('.env.local needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
async function call(method, p, body, extra = {}) {
  const r = await fetch(URL_ + p, {
    method,
    headers: { ...headers, ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// ---------- logins ----------
const EMAILS = { shop: 'shop@shalti-catalog.app', admin: 'admin@shalti-catalog.app' };
const CRED_FILE = 'credentials.local.txt';
const creds = fs.existsSync(CRED_FILE)
  ? Object.fromEntries(fs.readFileSync(CRED_FILE, 'utf8').split('\n').map((l) => l.split(': ')).filter((x) => x.length === 2))
  : {};
// Shop code: digits, easy to type on a tablet. Admin: longer random password.
creds.shop ||= String(crypto.randomInt(10_000_000, 99_999_999));
creds.admin ||= crypto.randomBytes(9).toString('base64url');

const { users } = await call('GET', '/auth/v1/admin/users?per_page=100');
for (const role of ['shop', 'admin']) {
  const body = { email: EMAILS[role], password: creds[role], email_confirm: true, app_metadata: { role } };
  const existing = users.find((u) => u.email === EMAILS[role]);
  if (existing) await call('PUT', `/auth/v1/admin/users/${existing.id}`, body);
  else await call('POST', '/auth/v1/admin/users', body);
  console.log(`login ready: ${role}`);
}
fs.writeFileSync(CRED_FILE, `shop: ${creds.shop}\nadmin: ${creds.admin}\n`);

fs.writeFileSync('web/.env.local', `VITE_SUPABASE_URL=${URL_}\nVITE_SUPABASE_ANON_KEY=${env.SUPABASE_ANON_KEY}\n`);
console.log('wrote web/.env.local and credentials.local.txt');

if (process.argv.includes('--skip-data')) process.exit(0);

// ---------- data ----------
const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const publicUrl = (name) => `${URL_}/storage/v1/object/public/images/${name}`;

const uploaded = new Map();
async function moveImage(url) {
  if (!url?.startsWith('/uploads/')) return url;
  if (uploaded.has(url)) return uploaded.get(url);
  const name = path.basename(url);
  const buf = fs.readFileSync(path.join('data/uploads', name));
  await call('POST', `/storage/v1/object/images/${name}`, buf, {
    'Content-Type': MIME[path.extname(name)] || 'application/octet-stream', 'x-upsert': 'true', 'Cache-Control': '31536000',
  });
  uploaded.set(url, publicUrl(name));
  return publicUrl(name);
}

const toRow = ({ id, order, price, ...data }) => ({ id, sort: order ?? 0, data });
const upsert = (table, rows) =>
  rows.length && call('POST', `/rest/v1/${table}`, rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });

await upsert('settings', [{ id: 1, data: db.settings }]);
await upsert('categories', db.categories.map(toRow));

for (const b of db.brands) b.logo = await moveImage(b.logo);
await upsert('brands', db.brands.map(toRow));

for (const p of db.products) {
  p.images = await Promise.all(p.images.map(moveImage));
  for (const v of p.variants) if (v.image) v.image = await moveImage(v.image);
}
await upsert('products', db.products.map(toRow));
await upsert('product_prices', db.products.filter((p) => p.price != null).map((p) => ({ product_id: p.id, price: p.price })));

console.log(`migrated ${db.categories.length} categories, ${db.brands.length} brands, ${db.products.length} products, ${uploaded.size} images`);
