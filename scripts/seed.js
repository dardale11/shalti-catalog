// Seeds data/db.json from the e-cigarette products listed on oldshalti.co.il (scraped.json).
// The site only exposes names, so specs/images/descriptions are filled later with "Add with AI".
// Usage: npm run seed [-- --force]
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB_FILE = 'data/db.json';
if (fs.existsSync(DB_FILE) && !process.argv.includes('--force')) {
  console.error(`${DB_FILE} exists; pass --force to overwrite`);
  process.exit(1);
}

const scraped = JSON.parse(fs.readFileSync(new URL('./scraped.json', import.meta.url), 'utf8'));
const id = () => crypto.randomUUID().slice(0, 8);

const categories = [
  { key: 'disposable', name: { he: 'חד פעמיות', en: 'Disposables' }, template: 'disposable' },
  { key: 'pod', name: { he: 'פודים (MTL)', en: 'Pod kits (MTL)' }, template: 'pod' },
  { key: 'mod', name: { he: 'ערכות DL', en: 'DL kits' }, template: 'mod' },
].map((c, i) => ({ ...c, id: c.key, order: i + 1 }));
const catByScrape = { DISP: 'disposable', MTL: 'pod', DL: 'mod' };

const BRAND_HE = {
  Aspire: 'אספייר', Voopoo: 'וופוו', Vaporesso: 'וופורסו', Oxva: 'אוקסבה',
  Lume: 'לום', 'Eco Puff': 'אקו פאף', Vapanda: 'ויפנדה', Qweet: 'קוויט', HQD: 'HQD', Kubi: 'קובי',
  Typhoon: 'טייפון', Fumot: 'פומוט', 'Air Glow': 'איר גלו', Panda: 'פנדה', Emma: 'אמה', Dubai: 'דובאי', Nevoks: 'נבוקס',
};

// Disposable listings are inconsistent (missing English or brand), so map them explicitly.
const DISPOSABLE_FIX = {
  'לום 12000 | Lume': ['Lume', 'Lume 12000', 'לום 12000'],
  'אקו פאף | Eco puff': ['Eco Puff', 'Eco Puff', 'אקו פאף'],
  'פאנטום ענבים מנטה 28000': ['Qweet', 'Qweet Phantom 28,000 Grape Mint', 'קוויט פאנטום 28,000 ענבים מנטה'],
  'פאנטום בלוראז 28000': ['Qweet', 'Qweet Phantom 28,000 Blue Razz', 'קוויט פאנטום 28,000 בלו ראז'],
  'HQD 15000': ['HQD', 'HQD 15000', 'HQD 15000'],
  'קובי מקס | Kubi Max': ['Kubi', 'Kubi Max', 'קובי מקס'],
  'טייפון | Typhoon': ['Typhoon', 'Typhoon', 'טייפון'],
  'נבוקס 40000': ['Nevoks', 'Nevoks 40000', 'נבוקס 40000'],
};

const brands = new Map();
const brandId = (en) => {
  if (!brands.has(en)) brands.set(en, { id: id(), name: { he: BRAND_HE[en] || en, en }, logo: '', visible: true, order: brands.size + 1 });
  return brands.get(en).id;
};

const products = scraped.map((s, i) => {
  let brand, en, he;
  if (DISPOSABLE_FIX[s.name]) [brand, en, he] = DISPOSABLE_FIX[s.name];
  else {
    [he, en] = s.name.split('|').map((x) => x.trim());
    en ||= he;
    brand = Object.keys(BRAND_HE).find((b) => en.toLowerCase().startsWith(b.toLowerCase())) || (en.startsWith('Flexus') ? 'Aspire' : en.split(' ')[0]);
  }
  return {
    id: id(),
    brandId: brandId(brand),
    categoryId: catByScrape[s.cat],
    name: { he, en },
    description: { he: '', en: '' },
    price: null,
    images: [],
    status: 'active',
    featured: false,
    specs: {},
    flavorFamilies: [],
    variants: [],
    sourceUrl: `https://www.oldshalti.co.il/${s.url}`,
    order: i + 1,
    updatedAt: Date.now(),
  };
});

fs.mkdirSync('data/uploads', { recursive: true });
fs.writeFileSync(DB_FILE, JSON.stringify({
  settings: { showPrices: false, idleSeconds: 60, currency: '₪' },
  categories, brands: [...brands.values()], products,
}, null, 1));
console.log(`seeded ${categories.length} categories, ${brands.size} brands, ${products.length} products`);
