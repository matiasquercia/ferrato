# Ferrato 🪜

Tienda online de **escaleras Safari, tenders, banquitos** y productos de **ferretería / construcción**.
Construida con [Astro](https://astro.build) + islas de React, Tailwind CSS, carrito persistente y checkout con
**Mercado Pago** o **pedido por WhatsApp**.

## Stack

| Parte          | Tecnología                                                                     |
| -------------- | ------------------------------------------------------------------------------ |
| Framework      | Astro 7 (páginas estáticas + rutas de servidor puntuales)                      |
| Interactividad | Islas React 19 (carrito, botones, checkout)                                    |
| Estilos        | Tailwind CSS 4                                                                 |
| Estado carrito | nanostores, persistido en `localStorage`                                       |
| Pagos          | Mercado Pago Checkout Pro (SDK oficial `mercadopago`) + WhatsApp               |
| Catálogo       | `src/data/catalog.json`                                                        |
| SEO            | Meta/OG por página, JSON-LD (Store, Product, Breadcrumb, FAQ), sitemap, robots |
| Deploy         | Vercel (adapter `@astrojs/vercel`)                                             |

## Empezar

Requisitos: Node 22+.

```bash
npm install
cp .env.example .env     # completá las variables
npm run dev              # http://localhost:4321
```

| Script            | Qué hace                              |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Servidor de desarrollo                |
| `npm run build`   | Build de producción                   |
| `npm run preview` | Sirve el build localmente             |
| `npm run check`   | Chequeo de tipos (TypeScript + Astro) |
| `npm run format`  | Formatea el código con Prettier       |

## Variables de entorno

| Variable                 | Descripción                                                           |
| ------------------------ | --------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`        | URL pública (canonical, sitemap, URLs de retorno de MP)               |
| `PUBLIC_WHATSAPP_NUMBER` | Número de ventas, formato `5491123456789`                             |
| `MP_ACCESS_TOKEN`        | Access token de Mercado Pago (**secreto**, sólo servidor)             |
| `MP_WEBHOOK_SECRET`      | Clave secreta de webhooks para validar la firma de las notificaciones |
| `PUBLIC_GA_ID`           | (opcional) Google Analytics 4                                         |
| `PUBLIC_META_PIXEL_ID`   | (opcional) Meta Pixel para campañas en Instagram/Facebook             |

## Estructura

```
src/
├── data/catalog.json          # Categorías y productos
├── lib/
│   ├── catalog.ts             # Tipos y helpers del catálogo
│   ├── cart.ts                # Store del carrito (nanostores)
│   ├── whatsapp.ts            # Arma el mensaje de pedido para WhatsApp
│   ├── mercadopago.server.ts  # Cliente MP (sólo servidor)
│   ├── format.ts / site.ts    # Formato ARS y datos del negocio
├── components/                # Header, Footer, ProductCard, CartDrawer, CheckoutForm…
├── layouts/BaseLayout.astro   # SEO, Open Graph, JSON-LD, analytics
└── pages/
    ├── index.astro
    ├── productos/[slug].astro # Ficha de producto (JSON-LD Product)
    ├── categoria/[slug].astro
    ├── carrito.astro          # Checkout
    ├── checkout/{exito,pendiente,error}.astro
    ├── api/checkout.ts        # POST → crea preferencia de Mercado Pago
    ├── api/webhooks/mercadopago.ts
    └── robots.txt.ts
```

## Cargar productos

Editá `src/data/catalog.json`. Cada producto:

```jsonc
{
  "id": "FER-0001", // único, no cambiar una vez publicado
  "slug": "escalera-safari-aluminio-5-escalones", // URL: /productos/<slug>
  "sku": "FER-ESC-001",
  "name": "Escalera Safari de aluminio 5 escalones",
  "brand": "Safari",
  "category": "escaleras", // slug de una categoría existente
  "price": 89900, // ARS, entero
  "compareAtPrice": 99900, // precio tachado (o null)
  "stock": 12,
  "featured": true, // aparece en la home
  "images": ["/images/productos/escalera-5.webp"],
  "shortDescription": "…",
  "description": "…",
  "specs": { "Material": "Aluminio", "Escalones": "5" },
}
```

Las imágenes van en `public/images/productos/` (recomendado: WebP cuadrado 800×800). Las que vienen son
placeholders SVG.

> ⚠️ Los precios de ejemplo son ficticios. El servidor **siempre recalcula el total desde el catálogo**, nunca
> confía en el precio enviado por el navegador.

## Pagos

### Mercado Pago (Checkout Pro)

1. Creá una aplicación en el [panel de desarrolladores](https://www.mercadopago.com.ar/developers/panel/app).
2. Usá las **credenciales de prueba** en `.env` para desarrollar y
   [cuentas de prueba](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/accounts) para simular
   compras.
3. En producción cargá el access token de **producción** en las variables de entorno del hosting.
4. Configurá el webhook en _Tu aplicación → Webhooks_, evento **Pagos**, URL
   `https://TU-DOMINIO/api/webhooks/mercadopago`, y copiá la clave secreta a `MP_WEBHOOK_SECRET`.

Flujo: carrito → `POST /api/checkout` (valida stock y precios) → redirección a Mercado Pago → vuelve a
`/checkout/exito|pendiente|error` → Mercado Pago notifica al webhook.

> `auto_return` y `notification_url` sólo se envían cuando `PUBLIC_SITE_URL` es `https://`. En local, usá un túnel
> (ngrok / cloudflared) si querés probar el webhook.

### WhatsApp

El botón _Pedir por WhatsApp_ abre un chat con el detalle del pedido y los datos del comprador. También hay un botón
flotante y uno de consulta en cada producto.

## SEO y redes

- HTML pre-renderizado para todas las páginas de catálogo (rápido e indexable).
- `title`, `description`, canonical, Open Graph y Twitter Card por página. Imagen OG por defecto: `public/og-default.png`.
- Datos estructurados: `Store`, `Product` + `Offer` (precio/stock → rich results), `BreadcrumbList`, `FAQPage`.
- `sitemap-index.xml` automático y `robots.txt` (excluye carrito, checkout y API).
- GA4 y Meta Pixel se activan sólo con completar la variable.

Después del primer deploy: registrá el dominio en [Google Search Console](https://search.google.com/search-console)
y enviá `https://TU-DOMINIO/sitemap-index.xml`.

## Deploy

**Vercel (configurado):** importá el repo en Vercel, cargá las variables de entorno y listo. Las páginas se sirven
estáticas y `/api/*` corre como función serverless.

**Otro hosting:** cambiá el adapter en `astro.config.mjs` (`@astrojs/node`, `@astrojs/netlify`, etc.).

## Subir a GitHub

```bash
git remote add origin git@github.com:TU-USUARIO/ferrato.git
git push -u origin main
```

GitHub Actions corre `check` + `build` en cada push y PR (`.github/workflows/ci.yml`).

## Próximos pasos sugeridos

- [ ] Guardar pedidos (DB o Google Sheets) y descontar stock desde el webhook
- [ ] Email de confirmación al comprador
- [ ] Cálculo de envío por código postal
- [ ] Buscador y filtros por precio
- [ ] Panel / CMS para cargar productos sin tocar código
