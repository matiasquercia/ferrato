export const SITE = {
  name: 'Ferrato',
  tagline: 'Escaleras, hogar y ferretería',
  description:
    'Comprá online escaleras, banquetas, tenders, tablas de planchar, agarraderas y ferretería. Envíos a todo el país y pago con Mercado Pago.',
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://www.ferrato.com.ar',
  locale: 'es_AR',
  whatsapp: import.meta.env.PUBLIC_WHATSAPP_NUMBER || '5491131008720',
  email: 'ventas@ferrato.com.ar',
  city: 'Buenos Aires',
  social: {
    instagram: 'https://www.instagram.com/ferrato',
    facebook: 'https://www.facebook.com/ferrato',
    tiktok: 'https://www.tiktok.com/@ferrato',
  },
  freeShippingFrom: 150000,
} as const;
