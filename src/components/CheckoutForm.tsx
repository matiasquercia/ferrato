import { useStore } from '@nanostores/react';
import { useEffect, useState, type SubmitEvent } from 'react';
import { $cart, $cartTotal, removeFromCart, setQuantity } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp';

interface Props {
  freeShippingFrom: number;
}

export default function CheckoutForm({ freeShippingFrom }: Props) {
  const items = useStore($cart);
  const total = useStore($cartTotal);
  const [mounted, setMounted] = useState(false);
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <p className="py-16 text-center text-steel">Cargando carrito…</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="text-lg">Tu carrito está vacío.</p>
        <a href="/productos" className="btn-dark mt-6">
          Ver productos
        </a>
      </div>
    );
  }

  const update = (field: keyof typeof buyer) => (e: { target: { value: string } }) =>
    setBuyer((b) => ({ ...b, [field]: e.target.value }));

  const payWithMercadoPago = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((i) => ({ id: i.id, quantity: i.quantity })), buyer }),
      });
      const data = await res.json();
      if (!res.ok || !data.initPoint) throw new Error(data.error ?? 'No se pudo iniciar el pago.');
      window.location.href = data.initPoint;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      setLoading(false);
    }
  };

  const whatsappUrl = buildWhatsAppOrderUrl(items, buyer);
  const missingForShipping = Math.max(0, freeShippingFrom - total);
  const input =
    'w-full rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
      <section aria-label="Productos" className="h-fit rounded-2xl border border-stone-200 bg-white">
        <ul className="divide-y divide-stone-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-5">
              <img
                src={item.image}
                alt=""
                width={80}
                height={80}
                className="h-20 w-20 rounded-xl bg-brand-50 object-contain p-1"
              />
              <div className="flex-1">
                <a href={`/productos/${item.slug}`} className="font-semibold hover:text-brand-700">
                  {item.name}
                </a>
                <p className="text-sm text-steel">{formatPrice(item.price)} c/u</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center rounded-md border border-stone-300">
                    <button
                      type="button"
                      className="px-3"
                      onClick={() => setQuantity(item.id, item.quantity - 1)}
                      aria-label="Restar"
                    >
                      −
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      className="px-3"
                      onClick={() => setQuantity(item.id, item.quantity + 1)}
                      aria-label="Sumar"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => removeFromCart(item.id)}
                  >
                    Quitar
                  </button>
                </div>
              </div>
              <span className="text-lg font-bold">{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t border-stone-200 p-5">
          <p className="text-sm text-steel">
            {missingForShipping > 0
              ? `Te faltan ${formatPrice(missingForShipping)} para tener envío gratis.`
              : '¡Tenés envío gratis! 🎉'}
          </p>
          <div className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </section>

      <form
        onSubmit={payWithMercadoPago}
        className="h-fit space-y-4 rounded-2xl border border-stone-200 bg-white p-6"
      >
        <h2 className="font-display text-2xl font-bold uppercase">Tus datos</h2>
        <input
          className={input}
          required
          placeholder="Nombre y apellido *"
          autoComplete="name"
          value={buyer.name}
          onChange={update('name')}
        />
        <input
          className={input}
          required
          type="email"
          placeholder="Email *"
          autoComplete="email"
          value={buyer.email}
          onChange={update('email')}
        />
        <input
          className={input}
          type="tel"
          placeholder="Teléfono"
          autoComplete="tel"
          value={buyer.phone}
          onChange={update('phone')}
        />
        <input
          className={input}
          placeholder="Dirección y localidad"
          autoComplete="street-address"
          value={buyer.address}
          onChange={update('address')}
        />
        <textarea
          className={input}
          rows={2}
          placeholder="Notas del pedido"
          value={buyer.notes}
          onChange={update('notes')}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn w-full bg-[#009ee3] text-white hover:bg-[#0086c3]"
        >
          {loading ? 'Redirigiendo…' : 'Pagar con Mercado Pago'}
        </button>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span className="h-px flex-1 bg-stone-200" /> o <span className="h-px flex-1 bg-stone-200" />
        </div>
        <a href={whatsappUrl} target="_blank" rel="noopener" className="btn-whatsapp w-full">
          Pedir por WhatsApp
        </a>
        <p className="text-center text-xs text-steel">
          Pagá con tarjeta, en cuotas, con dinero en cuenta o efectivo.
        </p>
      </form>
    </div>
  );
}
