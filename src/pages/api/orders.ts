import type { APIRoute } from 'astro';
import { saveOrderToNotion } from '@/lib/notion.server';
import { buildOrder } from '@/lib/order';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  let body: { items?: unknown; buyer?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  const built = await buildOrder({ items: body.items, buyer: body.buyer, channel: 'whatsapp' });
  if (!built.ok) return json({ error: built.error, errors: 'errors' in built ? built.errors : undefined }, built.status);

  await saveOrderToNotion(built.order);
  return json({ orderId: built.order.orderId });
};
