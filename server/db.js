// Tiny JSON-file store. Fine for ~100s of products on a single local server;
// swap for Postgres/Supabase when this moves to hosting.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = {
  settings: { showPrices: false, idleSeconds: 60, currency: '₪' },
  categories: [],
  brands: [],
  products: [],
};

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : structuredClone(EMPTY);
db = { ...structuredClone(EMPTY), ...db, settings: { ...EMPTY.settings, ...db.settings } };

const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export const getDb = () => db;

export function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
  for (const fn of listeners) fn();
}

export const newId = () => crypto.randomUUID().slice(0, 8);

export function nextOrder(list) {
  return list.reduce((m, x) => Math.max(m, x.order ?? 0), 0) + 1;
}
