export type Lang = 'he' | 'en';
export type Bi = { he: string; en: string };

export type Settings = { showPrices: boolean; idleSeconds: number; currency: string };

export type Category = { id: string; name: Bi; template: string; order: number };

export type Brand = { id: string; name: Bi; logo: string; visible: boolean; order: number };

export type Variant = { id: string; name: Bi; image?: string; inStock: boolean };

export type ProductStatus = 'active' | 'out_of_stock' | 'hidden';

export type Product = {
  id: string;
  brandId: string;
  categoryId: string;
  name: Bi;
  description: Bi;
  price: number | null;
  images: string[];
  status: ProductStatus;
  featured: boolean;
  specs: Record<string, string | number | boolean>;
  flavorFamilies: string[];
  variants: Variant[];
  sourceUrl?: string;
  needsReview?: boolean;
  aiSources?: string[];
  order: number;
  updatedAt: number;
};

export type Catalog = { settings: Settings; categories: Category[]; brands: Brand[]; products: Product[] };

export type AiDraft = {
  found: boolean;
  brand: Bi;
  category: string;
  name: Bi;
  description: Bi;
  specs: Product['specs'];
  flavorFamilies?: string[];
  variants: Bi[];
  imageUrls: string[];
  sourceUrls: string[];
  costUsd?: number;
};
