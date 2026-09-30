import { formatPrice } from './format';
import type { CartItem } from './cart';
import { SITE } from './site';

export interface BuyerInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export function buildWhatsAppOrderUrl(items: CartItem[], buyer?: BuyerInfo) {
  const lines = items.map(
    (i) =>
      `• ${i.quantity} x ${i.name}${i.variant ? ` (${i.variant})` : ''} — ${formatPrice(i.price * i.quantity)}`,
  );
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const text = [
    `¡Hola ${SITE.name}! Quiero hacer este pedido:`,
    '',
    ...lines,
    '',
    `*Total: ${formatPrice(total)}*`,
    buyer?.name ? `\nNombre: ${buyer.name}` : '',
    buyer?.email ? `Email: ${buyer.email}` : '',
    buyer?.phone ? `Teléfono: ${buyer.phone}` : '',
    buyer?.address ? `Dirección / localidad: ${buyer.address}` : '',
    buyer?.notes ? `Notas: ${buyer.notes}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n');
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const whatsappContactUrl = (message = `¡Hola ${SITE.name}! Tengo una consulta.`) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
