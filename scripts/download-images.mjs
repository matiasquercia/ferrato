/**
 * Descarga las imágenes de productos que están en CDNs externos (ej. static.wixstatic.com)
 * a public/images/productos/ y actualiza src/data/catalog.json para usar las copias locales.
 *
 * Uso:  npm run images:download
 * Requiere Node 22+ (usa fetch nativo). Es idempotente: si la imagen ya existe, no la vuelve a bajar.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATALOG = path.join(ROOT, 'src/data/catalog.json');
const OUT_DIR = path.join(ROOT, 'public/images/productos');
const SIZE = 1200;

const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
await mkdir(OUT_DIR, { recursive: true });

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );
let downloaded = 0;

for (const product of catalog.products) {
  const local = [];
  for (const [i, src] of product.images.entries()) {
    if (!/^https?:\/\//.test(src)) {
      local.push(src);
      continue;
    }
    const file = `${product.slug}-${i + 1}.jpg`;
    const dest = path.join(OUT_DIR, file);
    if (!(await exists(dest))) {
      // Wix permite pedir la imagen redimensionada y en JPG.
      const url =
        src.includes('static.wixstatic.com') && !src.includes('/v1/')
          ? `${src}/v1/fit/w_${SIZE},h_${SIZE},q_85,enc_jpg/${file}`
          : src;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`✗ ${product.slug} #${i + 1}: HTTP ${res.status} (${url})`);
        local.push(src);
        continue;
      }
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      downloaded++;
      console.log(`✓ ${file}`);
    }
    local.push(`/images/productos/${file}`);
  }
  product.images = local;
}

await writeFile(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
console.log(`\nListo: ${downloaded} imágenes descargadas. catalog.json actualizado.`);
