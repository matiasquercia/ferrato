export const SITE = {
  name: 'Ferralto',
  tagline: 'Escaleras, hogar y ferretería',
  description:
    'Comprá online escaleras, banquetas, tenders, tablas de planchar, agarraderas y ferretería. Envíos a todo el país y pago con Mercado Pago.',
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://ferralto.com',
  locale: 'es_AR',
  whatsapp: import.meta.env.PUBLIC_WHATSAPP_NUMBER || '5491131008720',
  email: '',
  city: 'Buenos Aires',
  social: {},

} as const;
