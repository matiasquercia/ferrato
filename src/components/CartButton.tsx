import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { $cartCount, $cartOpen } from '@/lib/cart';

export default function CartButton() {
  const count = useStore($cartCount);
  // Evita diferencias de hidratación: el carrito vive en localStorage.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={() => $cartOpen.set(true)}
      className="relative grid min-h-11 min-w-11 place-items-center rounded-lg p-2 hover:bg-stone-100"
      aria-label={`Abrir carrito${mounted ? `, ${count} productos` : ''}`}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 8H6" />
        <circle cx="10" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
      </svg>
      {mounted && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-xs font-bold text-ink">
          {count}
        </span>
      )}
    </button>
  );
}
