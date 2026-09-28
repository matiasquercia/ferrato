/**
 * Devuelve la URL de una imagen de producto al tamaño pedido.
 * - Fotos locales usan WebP pre-generado; el zoom conserva el original.
 * - Imágenes del CDN de Wix (static.wixstatic.com) se piden redimensionadas y en formato moderno.
 *   Corré `npm run images:download` para bajarlas al repo y no depender de ese CDN.
 */
export function productImage(src: string, size = 600): string {
  if (src.startsWith('/images/productos/') && src.endsWith('.jpg')) {
    if (size > 1200) return src;
    const width = size <= 320 ? 320 : size <= 640 ? 640 : 960;
    return src.replace('/productos/', '/optimized/').replace('.jpg', `-${width}.webp`);
  }
  if (!src.includes('static.wixstatic.com') || src.includes('/v1/')) return src;
  const file = src.split('/').pop() ?? 'image.jpg';
  return `${src}/v1/fit/w_${size},h_${size},q_85,enc_auto/${file}`;
}
