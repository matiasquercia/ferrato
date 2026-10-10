import { serverSecret } from './env.server';
import { DEFAULT_SHIPPING_POLICY, type ShippingConfiguration } from './shipping';
import { DELIVERY_PRICES, deliveryTariff, type DeliveryDestination } from './delivery';

/** Private configuration: never included in a browser bundle. No unverified tariffs. */
export function shippingConfig(): ShippingConfiguration {
  const raw = serverSecret('SHIPPING_CONFIG_JSON');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.policy === 'object' && Array.isArray(parsed.rates)) return parsed;
    } catch { /* Invalid configuration must fail closed. */ }
  }
  return { policy: DEFAULT_SHIPPING_POLICY, rates: [] };
}
export function shippingForOrder(lines: { sku: string; quantity: number }[], _postalCode: string, _locality: string, destination: DeliveryDestination) {
  const zone = deliveryTariff(destination);
  if (zone && lines.length && lines.every((line) => line.sku && Number.isSafeInteger(line.quantity) && line.quantity > 0)) {
    return {
      status: 'estimated' as const,
      amount: DELIVERY_PRICES[zone],
      rateId: `fixed-${zone}`,
      message: `Envío a domicilio ${zone === 'caba' ? 'en CABA (Capital Federal)' : zone === 'nearby' ? 'en AMBA dentro del radio de 5 km de Obispo San Alberto 3796' : 'en AMBA fuera del radio de 5 km'}. Tarifa fija para todo tu pedido. Coordinamos el día de entrega por WhatsApp.`,
    };
  }
  return {
    status: 'quote_required' as const, amount: null,
    message: 'No pudimos precisar la ubicación de entrega para confirmar la tarifa. Revisá tu dirección o consultanos por WhatsApp antes de pagar el envío.',
  };
}
