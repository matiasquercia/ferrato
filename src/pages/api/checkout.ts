import type { APIRoute } from 'astro';
import { formatBuyerAddress } from '@/lib/buyer';
import { productImage } from '@/lib/images';
import { getMercadoPagoClient, preferenceApi } from '@/lib/mercadopago.server';
import { saveOrderToNotion } from '@/lib/notion.server';
import { buildOrder } from '@/lib/order';
import { SITE } from '@/lib/site';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, url }) => {
  const mp = getMercadoPagoClient();
  if (!mp) return json({ error: 'El pago online no está disponible en este momento. Coordiná tu pedido por WhatsApp.' }, 503);

  let body: { items?: unknown; buyer?: unknown; shippingAmount?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  const built = await buildOrder({ items: body.items, buyer: body.buyer, shippingAmount: body.shippingAmount, channel: 'mercadopago' });
  if (!built.ok) return json({ error: built.error, errors: 'errors' in built ? built.errors : undefined }, built.status);

  const { order } = built;
  const baseUrl = (import.meta.env.PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
  const isPublicUrl = baseUrl.startsWith('https://');

  try {
    const preference = await preferenceApi(mp).create({
      body: {
        items: [...order.lines.map((line) => ({
          id: line.id,
          title: line.variant ? `${line.name} - ${line.variant}` : line.name,
          description: line.shortDescription,
          picture_url: new URL(productImage(line.image, 600), SITE.url).href,
          category_id: line.category,
          quantity: line.quantity,
          currency_id: 'ARS',
          unit_price: line.unitPrice,
        })), {
          id: `shipping-${order.shipping.rateId}`, title: 'Envío del pedido',
          quantity: 1, currency_id: 'ARS', unit_price: order.shipping.amount!,
        }],
        external_reference: order.orderId,
        payer: {
          name: order.buyer.name,
          email: order.buyer.email,
        },
        metadata: {
          order_id: order.orderId,
          phone: order.buyer.phone,
          address: formatBuyerAddress(order.buyer),
          notes: order.buyer.notes,
          shipping_amount: order.shipping.amount,
          shipping_rate_id: order.shipping.rateId,
          products_subtotal: order.subtotal,
        },
        back_urls: {
          success: `${baseUrl}/checkout/exito`,
          failure: `${baseUrl}/checkout/error`,
          pending: `${baseUrl}/checkout/pendiente`,
        },
        ...(isPublicUrl && {
          auto_return: 'all' as const,
          notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        }),
        statement_descriptor: 'FERRALTO',
      },
    });

    await saveOrderToNotion(order);

    return json({
      orderId: order.orderId,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (err) {
    console.error('[checkout] Error creando preferencia de Mercado Pago', err);
    return json({ error: 'No pudimos iniciar el pago. Probá de nuevo o pedí por WhatsApp.' }, 502);
  }
};
