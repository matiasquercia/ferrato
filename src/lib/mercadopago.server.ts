/**
 * Sólo para uso en el servidor (rutas /api). Nunca importar desde componentes del cliente:
 * el access token de Mercado Pago es secreto.
 */
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { serverSecret } from '@/lib/env.server';

let client: MercadoPagoConfig | null = null;
let cachedToken: string | undefined;

export function getMercadoPagoClient() {
  const accessToken = serverSecret('MP_ACCESS_TOKEN');
  if (!accessToken) return null;
  if (!client || cachedToken !== accessToken) {
    cachedToken = accessToken;
    client = new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
  }
  return client;
}

export const preferenceApi = (c: MercadoPagoConfig) => new Preference(c);
export const paymentApi = (c: MercadoPagoConfig) => new Payment(c);
