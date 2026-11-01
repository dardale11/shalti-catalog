// Two shared secrets, no user accounts:
//  - SHOP_CODE unlocks the catalog on a shop device (once, stored on the device)
//  - ADMIN_PASSWORD unlocks the admin interface
// Tokens are HMACs of the role, so they survive server restarts but change when the secret changes.
import crypto from 'node:crypto';

const SHOP_CODE = process.env.SHOP_CODE || '1234';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shalti';
const SECRET = process.env.TOKEN_SECRET || 'local-dev-secret';

const tokenFor = (role, secret) =>
  crypto.createHmac('sha256', SECRET).update(`${role}:${secret}`).digest('hex');

const SHOP_TOKEN = tokenFor('shop', SHOP_CODE);
const ADMIN_TOKEN = tokenFor('admin', ADMIN_PASSWORD);

const safeEq = (a = '', b = '') =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function login(role, secret) {
  if (role === 'shop' && safeEq(secret, SHOP_CODE)) return SHOP_TOKEN;
  if (role === 'admin' && safeEq(secret, ADMIN_PASSWORD)) return ADMIN_TOKEN;
  return null;
}

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '') || req.query.t || '';

export function requireShop(req, res, next) {
  const t = String(bearer(req));
  if (safeEq(t, SHOP_TOKEN) || safeEq(t, ADMIN_TOKEN)) return next();
  res.status(401).json({ error: 'locked' });
}

export function requireAdmin(req, res, next) {
  if (safeEq(String(bearer(req)), ADMIN_TOKEN)) return next();
  res.status(401).json({ error: 'unauthorized' });
}
