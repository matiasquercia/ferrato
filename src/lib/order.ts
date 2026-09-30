import { verifyAddress } from '@/lib/address';
import { getProductById, maxQuantity } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { validateBuyer, type Buyer } from '@/lib/buyer';

export type OrderChannel = 'mercadopago' | 'whatsapp';
export type OrderStatus = 'Pendiente' | 'Pagado' | 'Rechazado' | 'WhatsApp';

export interface OrderLineInput {
  id: string;
  variant?: string;
  quantity: number;
}

export interface ResolvedOrderLine {
  id: string;
  sku: string;
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  image: string;
  category: string;
  shortDescription: string;
}

export interface OrderRecord {
  orderId: string;
  buyer: Buyer;
  channel: OrderChannel;
  status: OrderStatus;
  lines: ResolvedOrderLine[];
  total: number;
}

export function newOrderId() {
  return `FER-${Date.now().toString(36).toUpperCase()}`;
}

export function resolveOrderLines(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false as const, error: 'El carrito está vacío.', status: 400 };
  }

  const lines: ResolvedOrderLine[] = [];
  for (const line of items as OrderLineInput[]) {
    const product = getProductById(line?.id);
    const quantity = Math.floor(Number(line?.quantity));
    if (!product) return { ok: false as const, error: `Producto inexistente: ${line?.id}`, status: 400 };
    if (product.price === null) {
      return {
        ok: false as const,
        error: `"${product.name}" no tiene precio publicado. Consultalo por WhatsApp.`,
        status: 400,
      };
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false as const, error: 'Cantidad inválida.', status: 400 };
    }
    if (quantity > maxQuantity(product)) {
      return { ok: false as const, error: `No hay stock suficiente de "${product.name}".`, status: 409 };
    }
    if (product.colors.length > 1 && !product.colors.includes(line.variant ?? '')) {
      return { ok: false as const, error: `Elegí un color válido para "${product.name}".`, status: 400 };
    }
    const variant = product.colors.length > 1 ? line.variant : undefined;
    lines.push({
      id: variant ? `${product.id}::${variant}` : product.id,
      sku: product.sku,
      name: product.name,
      variant,
      quantity,
      unitPrice: product.price,
      image: product.images[0],
      category: product.category,
      shortDescription: product.shortDescription,
    });
  }

  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return { ok: true as const, lines, total };
}

export function formatOrderLines(lines: ResolvedOrderLine[]) {
  return lines
    .map((line) => {
      const variant = line.variant ? ` (${line.variant})` : '';
      return `• ${line.quantity} × ${line.name}${variant} — ${formatPrice(line.unitPrice * line.quantity)}`;
    })
    .join('\n');
}

export async function buildOrder(input: { items: unknown; buyer: unknown; channel: OrderChannel; orderId?: string }) {
  const buyerResult = validateBuyer(input.buyer);
  if (!buyerResult.ok) {
    return { ok: false as const, error: buyerResult.message ?? 'Datos incompletos.', status: 400, errors: buyerResult.errors };
  }
  const address = await verifyAddress(buyerResult.buyer.address);
  if (!address.ok) {
    return {
      ok: false as const,
      error: address.error,
      status: 400,
      errors: { address: address.error },
    };
  }
  const linesResult = resolveOrderLines(input.items);
  if (!linesResult.ok) return linesResult;

  const order: OrderRecord = {
    orderId: input.orderId ?? newOrderId(),
    buyer: { ...buyerResult.buyer, address: address.match.label },
    channel: input.channel,
    status: input.channel === 'whatsapp' ? 'WhatsApp' : 'Pendiente',
    lines: linesResult.lines,
    total: linesResult.total,
  };
  return { ok: true as const, order };
}
