import { track, ecommerceItem } from './analytics';
import { getProductById, maxQuantity } from './catalog';
import { persistentAtom, setPersistentEngine, windowPersistentEvents } from '@nanostores/persistent';
import { atom, computed } from 'nanostores';
import { safeStorageEngine } from './storage';

export interface CartItem {
  /** id del producto en el catálogo */
  id: string;
  /** color/variante elegida (opcional) */
  variant?: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  maxStock: number;
}

/** Clave única de una línea del carrito (producto + variante). */
export const lineKey = (i: Pick<CartItem, 'id' | 'variant'>) => (i.variant ? `${i.id}::${i.variant}` : i.id);

/** Carrito persistido en localStorage (se comparte entre pestañas). */
if (typeof window !== 'undefined') {
  setPersistentEngine(safeStorageEngine(() => window.localStorage), windowPersistentEvents);
}
export const $cart = persistentAtom<CartItem[]>('ferrato:cart', [], {
  encode: JSON.stringify,
  decode(raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value)) return [];
      return value.flatMap((item): CartItem[] => {
        if (!item || typeof item.id !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1) return [];
        const product = getProductById(item.id);
        if (!product || product.price === null || maxQuantity(product) < 1) return [];
        const variant = product.colors.includes(item.variant) ? item.variant : product.colors[0];
        return [{
          id: product.id, slug: product.slug, name: product.name, price: product.price,
          image: product.imagesByColor?.[variant]?.[0] ?? product.images[0], variant,
          quantity: Math.min(item.quantity, maxQuantity(product)), maxStock: maxQuantity(product),
        }];
      });
    } catch { return []; }
  },
});
export const $cartOpen = atom(false);

export const $cartCount = computed($cart, (items) => items.reduce((n, i) => n + i.quantity, 0));
export const $cartTotal = computed($cart, (items) => items.reduce((sum, i) => sum + i.price * i.quantity, 0));

/** A stored cart can outlive a catalogue price update. The server always charges catalogue prices. */
export function syncCartPrices() {
  const items = $cart.get();
  const updated = items.map((item) => {
    const price = getProductById(item.id)?.price;
    return price != null && price !== item.price ? { ...item, price } : item;
  });
  if (updated.some((item, index) => item !== items[index])) $cart.set(updated);
}

if (typeof window !== 'undefined') syncCartPrices();

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1) {
  const items = $cart.get();
  const key = lineKey(item);
  const existing = items.find((i) => lineKey(i) === key);
  if (existing) {
    setQuantity(key, existing.quantity + quantity);
  } else {
    $cart.set([...items, { ...item, quantity: Math.min(quantity, item.maxStock) }]);
  }
  const added = ($cart.get().find((i) => lineKey(i) === key)?.quantity ?? 0) - (existing?.quantity ?? 0);
  if (added > 0)
    track('add_to_cart', {
      currency: 'ARS',
      value: item.price * added,
      items: [ecommerceItem({ ...item, quantity: added })],
    });
  $cartOpen.set(true);
}

export function setQuantity(key: string, quantity: number) {
  $cart.set(
    $cart
      .get()
      .map((i) => (lineKey(i) === key ? { ...i, quantity: Math.max(0, Math.min(quantity, i.maxStock)) } : i))
      .filter((i) => i.quantity > 0),
  );
}

export const removeFromCart = (key: string) => $cart.set($cart.get().filter((i) => lineKey(i) !== key));
export const clearCart = () => $cart.set([]);
