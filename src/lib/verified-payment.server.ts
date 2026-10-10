import type { APIContext } from 'astro';
import { getMercadoPagoClient, paymentApi } from '@/lib/mercadopago.server';
import { paymentReturnCopy, type PaymentReturnTone } from '@/lib/mercadopago-return';

export type CheckoutReceipt = { orderId: string; total: number; created: number };
type Payment = {
  id?: number; status?: string; live_mode?: boolean; external_reference?: string;
  currency_id?: string; transaction_amount?: number;
};
export type Purchase = { transaction_id: string; value: number; currency: 'ARS' };
export const receiptKey = (orderId: string) => `checkout-receipt:${orderId}`;

/** The provider response and server-side checkout receipt are the only payment authority. */
export function purchaseForPayment(payment: Payment, receipt: CheckoutReceipt, now = Date.now()): Purchase | undefined {
  if (payment.status !== 'approved' || payment.live_mode !== true || payment.currency_id !== 'ARS' ||
      payment.external_reference !== receipt.orderId || !Number.isSafeInteger(payment.id) || payment.id! <= 0 ||
      !Number.isFinite(payment.transaction_amount) || payment.transaction_amount! <= 0 ||
      !Number.isFinite(receipt.total) || receipt.total <= 0 ||
      Math.round(payment.transaction_amount! * 100) !== Math.round(receipt.total * 100) ||
      !Number.isFinite(receipt.created) || now < receipt.created || now - receipt.created > 30 * 86400000) return;
  return { transaction_id: `MP-${payment.id}`, value: payment.transaction_amount!, currency: 'ARS' };
}

export async function verifiedPaymentReturn(context: Pick<APIContext, 'url' | 'session'>, fallback: PaymentReturnTone) {
  let tone: PaymentReturnTone = fallback === 'error' ? 'error' : 'pending';
  let orderId = '';
  let purchase: Purchase | undefined;
  let verifiedPending = false;
  const requestedOrder = context.url.searchParams.get('external_reference') ?? '';
  const paymentId = context.url.searchParams.get('payment_id') ?? context.url.searchParams.get('collection_id') ?? '';
  // A return URL alone must never expose a receipt or manufacture a purchase.
  if (/^FER-[A-Z0-9-]{1,64}$/.test(requestedOrder) && /^\d{1,20}$/.test(paymentId)) {
    try {
      const receipt = await context.session?.get<CheckoutReceipt>(receiptKey(requestedOrder));
      const mp = receipt && getMercadoPagoClient();
      if (receipt?.orderId === requestedOrder && mp) {
        orderId = receipt.orderId;
        const payment = await paymentApi(mp).get({ id: paymentId });
        if (payment.external_reference === receipt.orderId) {
          purchase = purchaseForPayment(payment, receipt);
          verifiedPending = ['pending', 'in_process', 'in_mediation', 'authorized'].includes(payment.status ?? '');
          if (purchase) tone = 'success';
          else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status ?? '')) tone = 'error';
        }
      }
    } catch {
      // Unavailable verification must not block the page or emit an unverified conversion.
      console.warn('[checkout-return] No se pudo verificar el pago.');
    }
  }
  const copy = paymentReturnCopy(tone);
  if (tone === 'pending' && !verifiedPending) {
    copy.title = 'Verificá el estado de tu pago';
    copy.message = 'No pudimos confirmar el resultado del pago. Revisalo en Mercado Pago o consultanos antes de volver a pagar. Tu carrito sigue guardado.';
  }
  return { tone, orderId, purchase, ...copy };
}
