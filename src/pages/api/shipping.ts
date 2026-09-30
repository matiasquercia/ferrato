import type { APIRoute } from 'astro';
import { resolveOrderLines } from '@/lib/order';
import { shippingForOrder } from '@/lib/shipping.server';
export const prerender = false;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
export const POST: APIRoute = async ({ request }) => {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Pedido inválido.' }, 400); }
  if (!body || typeof body.postalCode !== 'string' || typeof body.locality !== 'string' ||
      body.postalCode.length > 12 || body.locality.length > 200) return json({ error: 'Indicá código postal y localidad.' }, 400);
  const built = resolveOrderLines(body.items);
  if (!built.ok) return json({ error: built.error }, built.status);
  const shipping = shippingForOrder(built.lines, body.postalCode, body.locality);
  return json({ shipping, subtotal: built.total, total: shipping.amount === null ? null : built.total + shipping.amount });
};
