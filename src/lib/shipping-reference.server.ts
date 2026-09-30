import { priceShipping, postalDigits, type ShippingEstimate } from './shipping';

/** Reference quote obtained 30/09/2026 for one folded ladder, NOT a verified packed tariff.
 * Customer requested estimated unknown costs: ARS 3,000 reserve and 15% collection-cost scenario.
 * Checkout remains blocked until a whole-order tariff is confirmed. Never extrapolate routes. */
export function shippingReference(
  lines: { sku: string; quantity: number }[], postalCode: string, locality: string, now = Date.now(),
): ShippingEstimate['reference'] | undefined {
  if (now < Date.parse('2026-09-30T00:00:00-03:00') || now >= Date.parse('2026-10-03T00:00:00-03:00')) return;
  if (lines.length !== 1 || lines[0].sku !== 'SAF-2005' || lines[0].quantity !== 1) return;
  const cp = postalDigits(postalCode);
  const place = locality.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const supported = cp === '1043' && ['caba', 'ciudad autonoma de buenos aires'].includes(place) ||
    cp === '1609' && ['boulogne', 'boulogne sur mer'].includes(place);
  if (!supported) return;
  const amount = priceShipping(31000.01 + 3000, {
    contingencyRate: 0.10, netMarginRate: 0.10, minimumProfit: 1000, collectionRate: 0.15, roundTo: 100,
  });
  if (amount === null) return;
  return { amount, message: 'Referencia orientativa puerta a puerta desde CP 1419, basada en una consulta a Vía Cargo del 30/09/2026. El importe final depende del paquete embalado y los cargos de entrega. Confirmamos precio y plazo por WhatsApp antes de pagar.' };
}
