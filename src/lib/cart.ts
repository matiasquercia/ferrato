import { persistentJSON } from '@nanostores/persistent';
import { atom, computed } from 'nanostores';

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  maxStock: number;
}

/** Carrito persistido en localStorage (se comparte entre pestañas). */
export const $cart = persistentJSON<CartItem[]>('ferrato:cart', []);
export const $cartOpen = atom(false);

export const $cartCount = computed($cart, (items) => items.reduce((n, i) => n + i.quantity, 0));
export const $cartTotal = computed($cart, (items) => items.reduce((sum, i) => sum + i.price * i.quantity, 0));

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1) {
  const items = $cart.get();
  const existing = items.find((i) => i.id === item.id);
  if (existing) {
    setQuantity(item.id, existing.quantity + quantity);
  } else {
    $cart.set([...items, { ...item, quantity: Math.min(quantity, item.maxStock) }]);
  }
  $cartOpen.set(true);
}

export function setQuantity(id: string, quantity: number) {
  $cart.set(
    $cart
      .get()
      .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, Math.min(quantity, i.maxStock)) } : i))
      .filter((i) => i.quantity > 0),
  );
}

export const removeFromCart = (id: string) => $cart.set($cart.get().filter((i) => i.id !== id));
export const clearCart = () => $cart.set([]);
