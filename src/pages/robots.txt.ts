import type { APIRoute } from 'astro';

// The wildcard group also allows search crawlers such as OAI-SearchBot.
// Keep checkout/API exclusions for all crawlers; preview hosting overrides with Disallow: /.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site).href;
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /carrito\nDisallow: /checkout/\nDisallow: /api/\n\nSitemap: ${sitemap}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
