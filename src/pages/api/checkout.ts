import type { APIRoute } from 'astro';
import { getProductById, maxQuantity } from '@/lib/catalog';
import { productImage } from '@/lib/images';
import { getMercadoPagoClient, preferenceApi } from '@/lib/mercadopago.server';
import { SITE } from '@/lib/site';

// Esta ruta corre en el servidor (no se pre-renderiza).
export const prerender = false;

interface CheckoutBody {
  items: { id: string; variant?: string; quantity: number }[];
  buyer: { name: string; email: string; phone?: string; address?: string; notes?: string };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, url }) => {
  const mp = getMercadoPagoClient();
  if (!mp) return json({ error: 'Mercado Pago no está configurado (falta MP_ACCESS_TOKEN).' }, 503);

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: 'El carrito está vacío.' }, 400);
  }
  if (!body.buyer?.name?.trim() || !/^\S+@\S+\.\S+$/.test(body.buyer?.email ?? '')) {
    return json({ error: 'Completá tu nombre y un email válido.' }, 400);
  }

  // IMPORTANTE: los precios SIEMPRE se toman del catálogo del servidor, nunca del cliente.
  const items = [];
  for (const line of body.items) {
    const product = getProductById(line.id);
    const quantity = Math.floor(Number(line.quantity));
    if (!product) return json({ error: `Producto inexistente: ${line.id}` }, 400);
    if (product.price === null) {
      return json({ error: `"${product.name}" no tiene precio publicado. Consultalo por WhatsApp.` }, 400);
    }
    if (!Number.isFinite(quantity) || quantity < 1) return json({ error: 'Cantidad inválida.' }, 400);
    if (quantity > maxQuantity(product)) {
      return json({ error: `No hay stock suficiente de "${product.name}".` }, 409);
    }
    if (product.colors.length > 1 && !product.colors.includes(line.variant ?? '')) {
      return json({ error: `Elegí un color válido para "${product.name}".` }, 400);
    }
    const variant = product.colors.length > 1 ? line.variant : undefined;
    items.push({
      id: variant ? `${product.id}::${variant}` : product.id,
      title: variant ? `${product.name} - ${variant}` : product.name,
      description: product.shortDescription,
      picture_url: new URL(productImage(product.images[0], 600), SITE.url).href,
      category_id: product.category,
      quantity,
      currency_id: 'ARS',
      unit_price: product.price,
    });
  }

  const baseUrl = (import.meta.env.PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
  const orderId = `FER-${Date.now().toString(36).toUpperCase()}`;
  const isPublicUrl = baseUrl.startsWith('https://');

  try {
    const preference = await preferenceApi(mp).create({
      body: {
        items,
        external_reference: orderId,
        payer: { name: body.buyer.name, email: body.buyer.email },
        metadata: {
          order_id: orderId,
          phone: body.buyer.phone ?? '',
          address: body.buyer.address ?? '',
          notes: body.buyer.notes ?? '',
        },
        back_urls: {
          success: `${baseUrl}/checkout/exito`,
          failure: `${baseUrl}/checkout/error`,
          pending: `${baseUrl}/checkout/pendiente`,
        },
        // Mercado Pago sólo acepta auto_return y webhooks con URLs públicas (https).
        ...(isPublicUrl && {
          auto_return: 'approved',
          notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        }),
        statement_descriptor: 'FERRATO',
      },
    });

    return json({
      orderId,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (err) {
    console.error('[checkout] Error creando preferencia de Mercado Pago', err);
    return json({ error: 'No pudimos iniciar el pago. Probá de nuevo o pedí por WhatsApp.' }, 502);
  }
};
