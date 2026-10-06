import { formatBuyerAddress } from '@/lib/buyer';
import { serverSecret } from '@/lib/env.server';
import { formatPrice } from '@/lib/format';
import { formatOrderLines, type OrderRecord, type OrderStatus } from '@/lib/order';

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1';

const ADDRESS_PROPERTIES = {
  'Calle y número': { rich_text: {} },
  'Piso / depto': { rich_text: {} },
  Localidad: { rich_text: {} },
  'Código postal': { rich_text: {} },
} as const;

function config() {
  const token = serverSecret('NOTION_TOKEN');
  const databaseId = serverSecret('NOTION_DATABASE_ID');
  if (!token || !databaseId) return null;
  return { token, databaseId };
}

function text(value: string) {
  return { rich_text: value ? [{ type: 'text' as const, text: { content: value.slice(0, 1900) } }] : [] };
}

function title(value: string) {
  return { title: [{ type: 'text' as const, text: { content: value.slice(0, 200) } }] };
}

export function orderProperties(order: OrderRecord) {
  return {
    Pedido: title(order.orderId),
    Nombre: text(order.buyer.name),
    Email: { email: order.buyer.email || null },
    Teléfono: { phone_number: order.buyer.phone || null },
    Dirección: text(formatBuyerAddress(order.buyer)),
    'Calle y número': text(order.buyer.street),
    'Piso / depto': text(order.buyer.unit),
    Localidad: text(order.buyer.locality),
    'Código postal': text(order.buyer.postalCode),
    Notas: text(order.buyer.notes),
    Productos: text(`${formatOrderLines(order.lines)}\nProductos: ${formatPrice(order.subtotal)}\nEnvío: ${order.shipping.amount === null ? 'A cotizar; total final pendiente' : formatPrice(order.shipping.amount)}\n${order.shipping.amount === null ? 'Subtotal productos' : 'Total con envío'}: ${formatPrice(order.total)}`),
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

let schemaReady: Promise<void> | null = null;

async function ensureAddressProperties() {
  const cfg = config();
  if (!cfg) return;
  const database = (await notion(`/databases/${cfg.databaseId}`, { method: 'GET' })) as {
    properties?: Record<string, { name?: string }>;
  } | null;
  const existing = new Set(Object.keys(database?.properties ?? {}));
  const missing = Object.fromEntries(
    Object.entries(ADDRESS_PROPERTIES).filter(([name]) => !existing.has(name)),
  );
  if (Object.keys(missing).length === 0) return;
  await notion(`/databases/${cfg.databaseId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: missing }),
  });
}

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = ensureAddressProperties().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function withoutSplitAddress(properties: ReturnType<typeof orderProperties>) {
  const {
    'Calle y número': _street,
    'Piso / depto': _unit,
    Localidad: _locality,
    'Código postal': _postal,
    ...rest
  } = properties;
  return rest;
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
    try {
      await ensureSchema();
    } catch (err) {
      console.warn('[notion] No se pudieron crear las columnas de dirección', err);
    }
    const payload = { parent: { database_id: cfg.databaseId }, properties: orderProperties(order) };
    try {
      const page = await notion('/pages', { method: 'POST', body: JSON.stringify(payload) });
      return typeof page?.id === 'string' ? page.id : null;
    } catch (err) {
      const page = await notion('/pages', {
        method: 'POST',
        body: JSON.stringify({ ...payload, properties: withoutSplitAddress(payload.properties) }),
      });
      console.warn('[notion] Pedido guardado sin columnas de dirección separadas', order.orderId, err);
      return typeof page?.id === 'string' ? page.id : null;
    }
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
