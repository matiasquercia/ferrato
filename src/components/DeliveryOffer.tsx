import { DELIVERY_PRICES } from '@/lib/delivery';
import { formatPrice } from '@/lib/format';

export default function DeliveryOffer() {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
      <p className="flex items-start gap-3 font-semibold">
        <svg className="shrink-0 text-brand-700" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M14 18V6H2v12h3m4 0h6m-1-10h4l4 5v5h-3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
        <span>Envío a domicilio en CABA por {formatPrice(DELIVERY_PRICES.caba)}</span>
      </p>
      <p className="mt-2 text-steel">También {formatPrice(DELIVERY_PRICES.nearby)} en AMBA hasta 5 km a la redonda de Obispo San Alberto 3796. Resto de AMBA: {formatPrice(DELIVERY_PRICES.amba)}.</p>
      <p className="mt-2 text-steel">Un solo envío para todo tu pedido. Confirmá la tarifa con tu dirección en el carrito.</p>
      <a href="/como-comprar#envios" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-700 underline underline-offset-4">Ver cobertura y condiciones →</a>
    </div>
  );
}
