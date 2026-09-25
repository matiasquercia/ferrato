import type { APIRoute } from 'astro';
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';
import { getMercadoPagoClient, paymentApi } from '@/lib/mercadopago.server';

export const prerender = false;

/**
 * Webhook de Mercado Pago (notificaciones de pagos).
 * Configurar en: Panel de desarrolladores > Tu aplicación > Webhooks, evento "Pagos".
 * URL: https://TU-DOMINIO/api/webhooks/mercadopago
 */
export const POST: APIRoute = async ({ request, url }) => {
  const body = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string } };
  const dataId = url.searchParams.get('data.id') ?? body.data?.id;
  const type = url.searchParams.get('type') ?? body.type;

  const secret = import.meta.env.MP_WEBHOOK_SECRET ?? process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: request.headers.get('x-signature'),
        xRequestId: request.headers.get('x-request-id'),
        dataId: dataId ?? null,
        secret,
        toleranceSeconds: 300,
      });
    } catch (err) {
      if (err instanceof InvalidWebhookSignatureError) {
        console.warn('[webhook] Firma inválida', err.reason, err.requestId);
        return new Response('Invalid signature', { status: 401 });
      }
      throw err;
    }
  } else {
    console.warn('[webhook] MP_WEBHOOK_SECRET no configurado: no se valida la firma.');
  }

  if (type !== 'payment' || !dataId) return new Response('ignored', { status: 200 });

  const mp = getMercadoPagoClient();
  if (!mp) return new Response('MP not configured', { status: 503 });

  try {
    const payment = await paymentApi(mp).get({ id: dataId });
    console.info('[webhook] Pago', {
      id: payment.id,
      status: payment.status,
      orderId: payment.external_reference,
      amount: payment.transaction_amount,
      email: payment.payer?.email,
    });

    // TODO: persistir el pedido (DB / Google Sheets), descontar stock y
    // notificar al equipo (email / WhatsApp) cuando payment.status === 'approved'.
  } catch (err) {
    console.error('[webhook] Error consultando pago', err);
    // 500 => Mercado Pago reintenta la notificación.
    return new Response('error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
};
