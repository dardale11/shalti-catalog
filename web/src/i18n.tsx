import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import specsDef from '../../shared/specs.json';
import type { Bi, Lang } from './types';

const STRINGS = {
  brands: { he: 'מותגים', en: 'Brands' },
  all: { he: 'הכל', en: 'All' },
  search: { he: 'חיפוש מוצר…', en: 'Search products…' },
  back: { he: 'חזרה', en: 'Back' },
  home: { he: 'ראשי', en: 'Home' },
  products: { he: 'מוצרים', en: 'products' },
  noResults: { he: 'לא נמצאו מוצרים', en: 'No products found' },
  filters: { he: 'סינון', en: 'Filters' },
  clear: { he: 'ניקוי', en: 'Clear' },
  outOfStock: { he: 'אזל במלאי', en: 'Out of stock' },
  featured: { he: 'מומלצים', en: 'Featured' },
  specs: { he: 'מפרט', en: 'Specifications' },
  variants: { he: 'צבעים / טעמים', en: 'Colours / flavours' },
  flavors: { he: 'משפחת טעמים', en: 'Flavour family' },
  category: { he: 'קטגוריה', en: 'Category' },
  brand: { he: 'מותג', en: 'Brand' },
  nicotineType: { he: 'סוג ניקוטין', en: 'Nicotine type' },
  puffs: { he: 'שאיפות', en: 'Puffs' },
  drawStyle: { he: 'סגנון שאיפה', en: 'Draw style' },
  price: { he: 'מחיר', en: 'Price' },
  inStockOnly: { he: 'רק במלאי', en: 'In stock only' },
  yes: { he: 'כן', en: 'Yes' },
  no: { he: 'לא', en: 'No' },
  askStaff: { he: 'לפרטים נוספים פנו לצוות החנות', en: 'Ask our staff for more details' },
  enterCode: { he: 'הזינו קוד חנות', en: 'Enter shop code' },
  unlock: { he: 'כניסה', en: 'Unlock' },
  wrongCode: { he: 'קוד שגוי', en: 'Wrong code' },
  tapToStart: { he: 'געו במסך לצפייה בקטלוג', en: 'Touch the screen to browse' },
  offline: { he: 'מצב לא מקוון – מוצג הקטלוג השמור', en: 'Offline – showing saved catalog' },
  ageNotice: { he: 'מוצרים אלו מיועדים לבני 18 ומעלה בלבד', en: 'For adults 18+ only' },
} satisfies Record<string, Bi>;

export type StringKey = keyof typeof STRINGS;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StringKey) => string; tr: (b?: Bi) => string };
const I18n = createContext<Ctx>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('shalti.lang') as Lang) || 'he');
  useEffect(() => {
    localStorage.setItem('shalti.lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);
  // Fall back to the other language when a field was only filled in one.
  const tr = (b?: Bi) => (b ? b[lang] || b[lang === 'he' ? 'en' : 'he'] || '' : '');
  const t = (k: StringKey) => STRINGS[k][lang];
  return <I18n.Provider value={{ lang, setLang, t, tr }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);

export type SpecDef = { he: string; en: string; type: 'number' | 'text' | 'boolean' | 'enum'; unit?: string; options?: string[] };
export const SPECS = specsDef.specs as Record<string, SpecDef>;
export const ENUM_LABELS = specsDef.enumLabels as Record<string, Bi>;
export const FLAVOR_FAMILIES = specsDef.flavorFamilies as Record<string, Bi>;
export const CATEGORY_SPECS = specsDef.categorySpecs as Record<string, string[]>;
export const TEMPLATES = Object.keys(CATEGORY_SPECS);

export function formatSpec(key: string, value: unknown, lang: Lang): string {
  const def = SPECS[key];
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'boolean') return STRINGS[value ? 'yes' : 'no'][lang];
  if (def?.type === 'enum') return ENUM_LABELS[String(value)]?.[lang] ?? String(value);
  const v = typeof value === 'number' ? value.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US') : String(value);
  return def?.unit ? `${v} ${def.unit}` : v;
}
