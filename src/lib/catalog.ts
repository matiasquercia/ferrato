import catalog from '@/data/catalog.json';

export interface Category {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  /** Precio en ARS, sin decimales */
  price: number;
  compareAtPrice: number | null;
  stock: number;
  featured: boolean;
  images: string[];
  shortDescription: string;
  description: string;
  specs: Record<string, string>;
}

export const categories: Category[] = catalog.categories;
export const products: Product[] = catalog.products as unknown as Product[];

export const getProductBySlug = (slug: string) => products.find((p) => p.slug === slug);
export const getProductById = (id: string) => products.find((p) => p.id === id);
export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const getProductsByCategory = (slug: string) => products.filter((p) => p.category === slug);
export const getFeaturedProducts = () => products.filter((p) => p.featured);
export const getRelatedProducts = (product: Product, limit = 4) =>
  products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, limit);
