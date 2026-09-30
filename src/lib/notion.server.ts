import { formatBuyerAddress } from '@/lib/buyer';
import { formatPrice } from '@/lib/format';
import { formatOrderLines, type OrderRecord, type OrderStatus } from '@/lib/order';

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1';

function config() {
  const token = import.meta.env.NOTION_TOKEN ?? process.env.NOTION_TOKEN;
  const databaseId = import.meta.env.NOTION_DATABASE_ID ?? process.env.NOTION_DATABASE_ID;
  if (!token || !databaseId) return null;
  return { token, databaseId };
}

function text(value: string) {
  return { rich_text: value ? [{ type: 'text' as const, text: { content: value.slice(0, 1900) } }] : [] };
}

function title(value: string) {
  return { title: [{ type: 'text' as const, text: { content: value.slice(0, 200) } }] };
}

function properties(order: OrderRecord) {
  return {
    Pedido: title(order.orderId),
    Nombre: text(order.buyer.name),
    Email: { email: order.buyer.email || null },
    Teléfono: { phone_number: order.buyer.phone || null },
    Dirección: text(formatBuyerAddress(order.buyer)),
    Notas: text(order.buyer.notes),
    Productos: text(`${formatOrderLines(order.lines)}\nTotal: ${formatPrice(order.total)}`),
    Total: { number: order.total },
    Estado: { select: { name: order.status } },
    Canal: { select: { name: order.channel === 'whatsapp' ? 'WhatsApp' : 'Mercado Pago' } },
  };
}

async function notion(path: string, init: RequestInit) {
  const cfg = config();
  if (!cfg) return null;
  const response = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Notion ${response.status}: ${detail.slice(0, 400)}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export function isNotionConfigured() {
  return config() !== null;
}

export async function saveOrderToNotion(order: OrderRecord) {
  const cfg = config();
  if (!cfg) {
    console.warn('[notion] Falta NOTION_TOKEN o NOTION_DATABASE_ID: el pedido no se guardó.');
    return null;
  }
  try {
    const page = await notion('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { database_id: cfg.databaseId }, properties: properties(order) }),
    });
    return typeof page?.id === 'string' ? page.id : null;
  } catch (err) {
    console.error('[notion] No se pudo crear el pedido', order.orderId, err);
    return null;
  }
}

export async function updateNotionOrderStatus(orderId: string, status: OrderStatus) {
  const cfg = config();
  if (!cfg || !orderId) return;
  try {
    const result = (await notion(`/databases/${cfg.databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 1,
        filter: { property: 'Pedido', title: { equals: orderId } },
      }),
    })) as { results?: { id: string }[] };
    const pageId = result?.results?.[0]?.id;
    if (!pageId) {
      console.warn('[notion] Pedido no encontrado para actualizar', orderId);
      return;
    }
    await notion(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: { Estado: { select: { name: status } } } }),
    });
  } catch (err) {
    console.error('[notion] No se pudo actualizar el estado', orderId, err);
    throw err;
  }
}
