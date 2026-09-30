import { formatBuyerAddress, type Buyer } from './buyer';
import { formatPrice } from './format';
import type { CartItem } from './cart';
import { SITE } from './site';

export function buildWhatsAppOrderUrl(items: CartItem[], buyer?: Buyer) {
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
    buyer?.street ? `Dirección: ${formatBuyerAddress(buyer)}` : '',
    buyer?.notes ? `Notas: ${buyer.notes}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n');
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const whatsappContactUrl = (message = `¡Hola ${SITE.name}! Tengo una consulta.`) =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
