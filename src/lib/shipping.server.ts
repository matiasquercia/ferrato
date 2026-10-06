import { serverSecret } from './env.server';
import { DEFAULT_SHIPPING_POLICY, estimateShipping, type ShippingConfiguration } from './shipping';
import { shippingReference } from './shipping-reference.server';

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
export function shippingForOrder(lines: { sku: string; quantity: number }[], postalCode: string, locality: string) {
  let result;
  try { result = estimateShipping(lines, postalCode, locality, shippingConfig()); }
  catch { result = estimateShipping(lines, postalCode, locality, { policy: DEFAULT_SHIPPING_POLICY, rates: [] }); }
  if (result.status === 'quote_required') {
    const reference = shippingReference(lines, postalCode, locality);
    if (reference) return { ...result, reference };
  }
  return result;
}
