/**
 * Sólo para uso en el servidor (rutas /api). Nunca importar desde componentes del cliente:
 * el access token de Mercado Pago es secreto.
 */
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

let client: MercadoPagoConfig | null = null;

export function getMercadoPagoClient() {
  const accessToken = import.meta.env.MP_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return null;
  client ??= new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
  return client;
}

export const preferenceApi = (c: MercadoPagoConfig) => new Preference(c);
export const paymentApi = (c: MercadoPagoConfig) => new Payment(c);
