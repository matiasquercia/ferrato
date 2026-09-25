export const SITE = {
  name: 'Ferrato',
  tagline: 'Escaleras Safari, banquetas, tenders y más',
  description:
    'Comprá online escaleras tipo Safari de 2 a 7 peldaños, banquetas plegables, tenders, tablas de planchar y agarraderas. Envíos a todo el país y pago con Mercado Pago.',
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://www.ferrato.com.ar',
  locale: 'es_AR',
  whatsapp: import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? '',
  email: 'ventas@ferrato.com.ar',
  city: 'Buenos Aires',
  social: {
    instagram: 'https://www.instagram.com/ferrato',
    facebook: 'https://www.facebook.com/ferrato',
    tiktok: 'https://www.tiktok.com/@ferrato',
  },
  freeShippingFrom: 150000,
} as const;
