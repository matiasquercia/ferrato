import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, dependencies = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, Date, console, ...globals, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(source, context);
  return context.exports;
}
const delivery = load('lib/delivery.ts');
const shipping = load('lib/shipping.ts');
const server = load('lib/shipping.server.ts', {
  './delivery': delivery, './shipping': shipping,
  './env.server': { serverSecret: () => { throw new Error('Fixed customer tariffs must not depend on carrier configuration'); } },
  './shipping-reference.server': { shippingReference: () => undefined },
});
const caba = { province: 'Ciudad Autónoma de Buenos Aires', locality: 'CABA' };
const martelli = { province: 'Buenos Aires', department: 'Vicente López', locality: 'Villa Martelli', coordinates: { lat: -34.56, lon: -58.5 } };
const quilmes = { province: 'Buenos Aires', department: 'Quilmes', locality: 'Quilmes', coordinates: { lat: -34.72, lon: -58.26 } };

test('CABA has its own tariff, distinct from all other AMBA destinations', () => {
  assert.equal(delivery.deliveryZone(caba), 'caba');
  assert.equal(delivery.deliveryZone({ province: 'Capital Federal' }), 'caba');
  assert.equal(delivery.deliveryZone({ province: 'CABA' }), 'caba');
  assert.equal(delivery.deliveryZone(martelli), 'amba');
  assert.equal(delivery.deliveryZone({ province: 'Buenos Aires', department: 'General San Martín' }), 'amba');
  assert.equal(delivery.deliveryZone({ province: 'Buenos Aires', department: 'José C. Paz' }), 'amba');
});

test('outside AMBA, missing municipality and same-name municipalities in other provinces are excluded', () => {
  for (const destination of [
    { province: 'Buenos Aires', department: 'Bahía Blanca' },
    { province: 'Buenos Aires' },
    { province: 'Santa Fe', department: 'San Martín' },
    { province: 'Santa Fe', department: 'Rosario' },
  ]) assert.equal(delivery.deliveryZone(destination), null);
});

test('fixed rates cover the whole order, including multiple products and quantities', () => {
  const lines = [{ sku: 'SAF-2005', quantity: 3 }, { sku: 'SAF-2001', quantity: 2 }];
  assert.equal(server.shippingForOrder(lines, '1043', 'CABA', caba).amount, 15000);
  assert.equal(server.shippingForOrder(lines, '1603', 'Villa Martelli', martelli).amount, 15000);
  assert.equal(server.shippingForOrder(lines, '1878', 'Quilmes', quilmes).amount, 35000);
});

test('the 5 km circle includes its boundary and never rounds an outside destination into the cheap zone', () => {
  const atDistance = (km) => ({ ...martelli, coordinates: {
    lat: delivery.DISPATCH_ORIGIN.lat + km / 6371.0088 * 180 / Math.PI,
    lon: delivery.DISPATCH_ORIGIN.lon,
  } });
  assert.equal(delivery.distanceFromDispatchKm(delivery.DISPATCH_ORIGIN), 0);
  for (const km of [0, 2, 4.999, 5]) assert.equal(delivery.deliveryTariff(atDistance(km)), 'nearby');
  for (const km of [5.001, 5.01, 10]) assert.equal(delivery.deliveryTariff(atDistance(km)), 'amba');
  assert.equal(delivery.deliveryTariff({ ...caba, coordinates: atDistance(20).coordinates }), 'caba');
  assert.equal(delivery.deliveryTariff({ ...atDistance(1), province: 'Santa Fe' }), null);
});

test('missing or invalid coordinates cannot overcharge a potentially nearby address', () => {
  for (const coordinates of [undefined, { lat: NaN, lon: -58.5 }, { lat: -34.5, lon: Infinity }, { lat: 91, lon: -58.5 }]) {
    const destination = { ...martelli, coordinates };
    assert.equal(delivery.deliveryTariff(destination), null);
    assert.equal(server.shippingForOrder([{ sku: 'SAF-2012', quantity: 1 }], '1603', 'Villa Martelli', destination).amount, null);
  }
});

function orderFor(destination) {
  const product = { id: 'SAF-2012', sku: 'SAF-2012', name: 'Escalera de prueba', price: 33261, colors: [], images: ['/test.jpg'], category: 'escaleras', shortDescription: 'Fixture' };
  return load('lib/order.ts', {
    '@/lib/address': {
      prettyLocality: () => destination.locality,
      verifyLocality: async () => ({ ok: true, locality: destination.locality }),
      verifyAddress: async () => ({ ok: true, match: { street: 'Fixture', number: 100, ...destination } }),
      verifyPostalCode: async () => ({ ok: true }),
    },
    '@/lib/buyer': { validateBuyer: (buyer) => ({ ok: true, buyer }) },
    '@/lib/catalog': { getProductById: () => product, maxQuantity: () => 100 },
    '@/lib/format': { formatPrice: String },
    '@/lib/shipping.server': server, '@/lib/shipping': shipping, '@/lib/delivery': delivery,
  });
}
const input = { items: [{ id: 'SAF-2012', quantity: 2 }], buyer: { street: 'Fixture 100', locality: 'CABA', postalCode: '1043' }, channel: 'mercadopago' };

test('checkout recalculates shipping on the server and totals products plus the zone tariff', async () => {
  for (const [destination, amount] of [[caba, 15000], [martelli, 15000], [quilmes, 35000]]) {
    const api = orderFor(destination);
    const result = await api.buildOrder({ ...input, shippingAmount: amount });
    assert.equal(result.ok, true);
    assert.equal(result.order.subtotal, 66522);
    assert.equal(result.order.total, 66522 + amount);
    for (const tampered of [0, 10000, 1, undefined, amount === 15000 ? 35000 : 15000]) {
      const rejected = await api.buildOrder({ ...input, shippingAmount: tampered });
      assert.equal(rejected.ok, false);
      assert.equal(rejected.status, 409);
    }
  }
});

test('Georef sublocalities such as Villa Martelli are recognized and address coordinates are retained', async () => {
  const api = load('lib/address.ts', {}, { URLSearchParams, fetch: async (url) => ({ ok: true, json: async () => {
    if (url.includes('/localidades?')) return { localidades: [{ id: '0686101009', nombre: 'Villa Martelli', provincia: { nombre: 'Buenos Aires' } }] };
    if (url.includes('/localidades-censales?')) return { localidades_censales: [{ id: '46077010', nombre: 'Villa Castelli', provincia: { nombre: 'La Rioja' } }] };
    assert.match(url, /departamento.nombre/);
    assert.match(url, /ubicacion.lat/);
    return { direcciones: [{ nomenclatura: 'Fixture 100, Vicente López, Buenos Aires', calle: { nombre: 'Fixture' }, altura: { valor: 100 }, localidad_censal: { nombre: 'Vicente López' }, provincia: { nombre: 'Buenos Aires' }, departamento: { nombre: 'Vicente López' }, ubicacion: martelli.coordinates }] };
  } }) });
  const locality = await api.verifyLocality('Villa Martelli');
  assert.equal(locality.ok, true);
  assert.equal(locality.province, 'Buenos Aires');
  const address = await api.verifyAddress('Fixture 100', 'Villa Martelli');
  assert.equal(address.ok, true);
  assert.equal(address.match.department, 'Vicente López');
  assert.equal(address.match.coordinates.lat, martelli.coordinates.lat);
  assert.equal(delivery.deliveryTariff(address.match), 'nearby');
});

test('checkout refuses destinations outside AMBA for both payment and WhatsApp orders', async () => {
  const api = orderFor({ province: 'Santa Fe', department: 'Rosario', locality: 'Rosario' });
  for (const channel of ['mercadopago', 'whatsapp']) {
    const result = await api.buildOrder({ ...input, channel, shippingAmount: 35000 });
    assert.equal(result.ok, false);
    assert.equal(result.status, 422);
  }
});
