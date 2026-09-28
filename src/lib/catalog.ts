import catalog from '@/data/catalog.json';

export interface Category {
  slug: string;
  name: string;
  description: string;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  /** Precio en ARS, sin decimales. `null` = "Consultar precio" (no se puede comprar online). */
  price: number | null;
  compareAtPrice: number | null;
  /** Unidades disponibles. `null` = sin control de stock. */
  stock: number | null;
  featured: boolean;
  /** Colores/variantes disponibles. Si hay más de uno, el cliente elige al agregar al carrito. */
  colors: string[];
  images: string[];
  /** Fotos por color. Si falta un color, se muestran `images`. */
  imagesByColor?: Record<string, string[]>;
  shortDescription: string;
  description: string;
  specs: Record<string, string>;
}

/** Máximo de unidades por línea cuando el producto no tiene control de stock. */
export const MAX_QTY_WITHOUT_STOCK = 50;

export const categories: Category[] = catalog.categories;
export const products: Product[] = catalog.products as unknown as Product[];

export const isPurchasable = (p: Product) => p.price !== null && (p.stock === null || p.stock > 0);
export const maxQuantity = (p: Product) => p.stock ?? MAX_QTY_WITHOUT_STOCK;

export const getProductBySlug = (slug: string) => products.find((p) => p.slug === slug);
export const getProductById = (id: string) => products.find((p) => p.id === id);
export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const getProductsByCategory = (slug: string) => products.filter((p) => p.category === slug);
export const getFeaturedProducts = () => products.filter((p) => p.featured);
export const getRelatedProducts = (product: Product, limit = 4) =>
  products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, limit);
