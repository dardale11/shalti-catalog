import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, save, newId, nextOrder, onChange, UPLOAD_DIR } from './db.js';
import { login, requireShop, requireAdmin } from './auth.js';
import { aiLookup } from './ai.js';

const PORT = Number(process.env.PORT || 8840);
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- auth ----------
app.post('/api/login', (req, res) => {
  const token = login(req.body.role, String(req.body.secret || ''));
  if (!token) return res.status(401).json({ error: 'wrong code' });
  res.json({ token });
});

// ---------- catalog (shop devices) ----------
app.get('/api/catalog', requireShop, (req, res) => {
  const db = getDb();
  const brands = db.brands.filter((b) => b.visible !== false);
  const brandIds = new Set(brands.map((b) => b.id));
  const products = db.products
    .filter((p) => p.status !== 'hidden' && brandIds.has(p.brandId))
    .map((p) => (db.settings.showPrices ? p : { ...p, price: null }));
  res.json({ settings: db.settings, categories: db.categories, brands, products });
});

// Live updates: shop screens refetch when the admin saves anything.
app.get('/api/events', requireShop, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = () => res.write(`data: changed\n\n`);
  const off = onChange(send);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => (off(), clearInterval(ping)));
});

// ---------- admin ----------
const admin = express.Router();
admin.use(requireAdmin);

admin.get('/data', (req, res) => res.json(getDb()));

admin.put('/settings', (req, res) => {
  const db = getDb();
  db.settings = { ...db.settings, ...req.body };
  save();
  res.json(db.settings);
});

for (const kind of ['categories', 'brands', 'products']) {
  admin.post(`/${kind}`, (req, res) => {
    const list = getDb()[kind];
    const item = { ...req.body, id: newId(), order: nextOrder(list), updatedAt: Date.now() };
    list.push(item);
    save();
    res.json(item);
  });

  admin.put(`/${kind}/:id`, (req, res) => {
    const list = getDb()[kind];
    const i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'not found' });
    list[i] = { ...list[i], ...req.body, id: list[i].id, updatedAt: Date.now() };
    save();
    res.json(list[i]);
  });

  admin.delete(`/${kind}/:id`, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const inUse =
      (kind === 'brands' && db.products.some((p) => p.brandId === id)) ||
      (kind === 'categories' && db.products.some((p) => p.categoryId === id));
    if (inUse) return res.status(409).json({ error: 'in use by products' });
    db[kind] = db[kind].filter((x) => x.id !== id);
    save();
    res.json({ ok: true });
  });
}

admin.post('/reorder', (req, res) => {
  const { kind, ids } = req.body;
  const list = getDb()[kind];
  if (!Array.isArray(list) || !Array.isArray(ids)) return res.status(400).json({ error: 'bad request' });
  ids.forEach((id, i) => {
    const item = list.find((x) => x.id === id);
    if (item) item.order = i + 1;
  });
  save();
  res.json({ ok: true });
});

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };
const storeImage = (buf, type) => {
  const name = `${Date.now().toString(36)}-${newId()}${EXT[type] || '.jpg'}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
};

// Browser resizes before uploading; body is the raw image.
admin.post('/upload', express.raw({ type: 'image/*', limit: '10mb' }), (req, res) => {
  const type = req.headers['content-type'];
  if (!EXT[type] || !req.body?.length) return res.status(400).json({ error: 'unsupported image' });
  res.json({ url: storeImage(req.body, type) });
});

// Copy a remote image (e.g. one the AI found) into local storage.
admin.post('/import-image', wrap(async (req, res) => {
  const url = new URL(String(req.body.url));
  if (!/^https?:$/.test(url.protocol)) return res.status(400).json({ error: 'bad url' });
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 shalti-catalog' }, signal: AbortSignal.timeout(20_000) });
  const type = (r.headers.get('content-type') || '').split(';')[0];
  if (!r.ok || !EXT[type]) return res.status(400).json({ error: `not an image (${r.status} ${type})` });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'image too large' });
  res.json({ url: storeImage(buf, type) });
}));

admin.post('/ai-lookup', wrap(async (req, res) => {
  const query = String(req.body.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query required' });
  res.json(await aiLookup(query, req.body.hint));
}));

app.use('/api/admin', admin);

// ---------- production: serve the built PWA ----------
const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => console.log(`API on http://localhost:${PORT}`));
