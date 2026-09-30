export type PaymentReturnTone = 'success' | 'pending' | 'error';

const SUCCESS = new Set(['approved']);
const PENDING = new Set(['pending', 'in_process', 'in_mediation', 'authorized']);
const FAILURE = new Set(['rejected', 'cancelled', 'canceled', 'refunded', 'charged_back', 'null']);

/** Mercado Pago sends `collection_status` and/or `status` on the back_url. */
export function paymentReturnTone(params: URLSearchParams, fallback: PaymentReturnTone): PaymentReturnTone {
  const status = (params.get('collection_status') ?? params.get('status') ?? '').trim().toLowerCase();
  if (SUCCESS.has(status)) return 'success';
  if (PENDING.has(status)) return 'pending';
  if (FAILURE.has(status)) return 'error';
  return fallback;
}

export function paymentReturnCopy(tone: PaymentReturnTone) {
  if (tone === 'success') {
    return {
      title: 'Pedido realizado con éxito',
      message:
        'Recibimos tu pago. Te contactamos para coordinar la entrega. Guardá el número de pedido si aparece abajo.',
    };
  }
  if (tone === 'pending') {
    return {
      title: 'Pago pendiente',
      message: 'Tu pago está en proceso. Apenas se acredite te avisamos y coordinamos la entrega.',
    };
  }
  return {
    title: 'No pudimos procesar el pago',
    message:
      'Tu carrito sigue guardado. Podés intentar de nuevo con otro medio de pago o hacer el pedido por WhatsApp.',
  };
}
