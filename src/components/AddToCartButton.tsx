import { useState } from 'react';
import { addToCart, type CartItem } from '@/lib/cart';

interface Props {
  item: Omit<CartItem, 'quantity'>;
  compact?: boolean;
  withQuantity?: boolean;
}

export default function AddToCartButton({ item, compact = false, withQuantity = false }: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = item.maxStock <= 0;

  const onAdd = () => {
    addToCart(item, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className={`flex gap-3 ${compact ? 'mt-2' : 'mt-6'}`}>
      {withQuantity && !outOfStock && (
        <div className="flex items-center rounded-lg border border-stone-300 bg-white">
          <button
            type="button"
            className="px-3 py-2 text-lg"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Restar"
          >
            −
          </button>
          <span className="w-8 text-center font-semibold" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className="px-3 py-2 text-lg"
            onClick={() => setQty((q) => Math.min(item.maxStock, q + 1))}
            aria-label="Sumar"
          >
            +
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        disabled={outOfStock}
        className={`btn-primary flex-1 ${compact ? 'py-2 text-sm' : ''}`}
      >
        {outOfStock ? 'Sin stock' : added ? '¡Agregado! ✓' : 'Agregar al carrito'}
      </button>
    </div>
  );
}
