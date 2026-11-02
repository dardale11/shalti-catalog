// Local AI helper for the admin. The catalog itself is hosted (static site + Supabase); this small server
// runs only on the laptop that has Claude Code logged in, and gives the admin UI two things a browser can't do:
//   POST /ai-lookup   – look a product up on the web with `claude -p`
//   GET  /fetch-image – download an image from another site (no CORS) so the browser can upload it
// It listens on 127.0.0.1 only and answers only pages from ALLOWED_ORIGINS.
import express from 'express';
import { aiLookup } from './ai.js';

const PORT = Number(process.env.PORT || 8840);
const ALLOWED = new Set(
  ['http://localhost:5173', 'http://localhost:4173', ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const app = express();
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED.has(origin)) return res.status(403).json({ error: `origin ${origin} not allowed (set ALLOWED_ORIGINS)` });
  if (origin) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      // Chrome asks before an https site may call a localhost server.
      'Access-Control-Allow-Private-Network': 'true',
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/ai-lookup', wrap(async (req, res) => {
  const query = String(req.body.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query required' });
  res.json(await aiLookup(query, req.body.hint));
}));

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|svg\+xml)$/;

app.get('/fetch-image', wrap(async (req, res) => {
  const url = new URL(String(req.query.url));
  if (!/^https?:$/.test(url.protocol)) return res.status(400).json({ error: 'bad url' });
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  const type = (r.headers.get('content-type') || '').split(';')[0];
  if (!r.ok || !IMAGE_TYPES.test(type)) return res.status(400).json({ error: `not an image (${r.status} ${type})` });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'image too large' });
  res.type(type).send(buf);
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '127.0.0.1', () => console.log(`AI helper on http://localhost:${PORT} (allowed: ${[...ALLOWED].join(', ')})`));
