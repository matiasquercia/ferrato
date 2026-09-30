import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(fileUrl) {
  const source = ts.transpileModule(readFileSync(fileUrl, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {},
    module: { exports: {} },
    console,
    fetch,
    URLSearchParams,
    require(spec) {
      if (spec === '@/lib/address') return load(new URL('../src/lib/address.ts', import.meta.url));
      throw new Error(`Unexpected import: ${spec}`);
    },
  };
  context.module.exports = context.exports;
  vm.runInNewContext(source, context);
  return context.exports;
}

const api = load(new URL('../src/lib/buyer.ts', import.meta.url));
const address = load(new URL('../src/lib/address.ts', import.meta.url));

const valid = {
  name: 'Matías Quercia',
  email: 'ventas@ferrato.com.ar',
  phone: '11 3100 8720',
  address: 'Av. Corrientes 1234, CABA',
  notes: '',
};

test('acepta un comprador completo', () => {
  const result = api.validateBuyer(valid);
  assert.equal(result.ok, true);
  assert.equal(result.buyer.email, 'ventas@ferrato.com.ar');
});

test('pide nombre y apellido', () => {
  const result = api.validateBuyer({ ...valid, name: 'Matías' });
  assert.equal(result.ok, false);
  assert.match(result.errors.name, /apellido/i);
});

test('rechaza un email inválido', () => {
  const result = api.validateBuyer({ ...valid, email: 'hola@' });
  assert.equal(result.ok, false);
  assert.match(result.errors.email, /email válido/i);
});

test('exige teléfono con código de área', () => {
  const result = api.validateBuyer({ ...valid, phone: '1234' });
  assert.equal(result.ok, false);
  assert.match(result.errors.phone, /código de área/i);
});

test('acepta teléfono internacional argentino', () => {
  const result = api.validateBuyer({ ...valid, phone: '+54 9 11 3100-8720' });
  assert.equal(result.ok, true);
});

test('exige calle, número y localidad', () => {
  const result = api.validateBuyer({ ...valid, address: 'CABA' });
  assert.equal(result.ok, false);
  assert.match(result.errors.address, /calle|número|localidad/i);
});

test('exige el número de la calle', () => {
  const result = api.validateBuyer({ ...valid, address: 'Avenida Corrientes, CABA' });
  assert.equal(result.ok, false);
  assert.match(result.errors.address, /número/i);
});

test('separa calle y localidad', () => {
  const parsed = address.parseAddressQuery('Av. Corrientes 1234, CABA');
  assert.equal(parsed.direccion, 'Av. Corrientes 1234');
  assert.equal(parsed.lugar, 'CABA');
});

test('resuelve una coincidencia única', () => {
  const match = {
    label: 'AV CORRIENTES 1234, Comuna 1, Ciudad Autónoma de Buenos Aires',
    street: 'AV CORRIENTES',
    number: 1234,
    locality: 'Ciudad Autónoma de Buenos Aires',
    province: 'Ciudad Autónoma de Buenos Aires',
  };
  const resolved = address.resolveAddress('Av. Corrientes 1234, CABA', [match]);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.match.label, match.label);
});

test('pide elegir cuando hay varias coincidencias', () => {
  const matches = [
    { label: 'AV CORRIENTES 1234, Rosario, Santa Fe', street: 'AV CORRIENTES', number: 1234, locality: 'Rosario', province: 'Santa Fe' },
    { label: 'AV CORRIENTES 1234, Comuna 1, Ciudad Autónoma de Buenos Aires', street: 'AV CORRIENTES', number: 1234, locality: 'CABA', province: 'CABA' },
  ];
  const resolved = address.resolveAddress('Av. Corrientes 1234', matches);
  assert.equal(resolved.ok, false);
  assert.match(resolved.error, /varias coincidencias/i);
});

test('separa el número al final de la calle', () => {
  const parsed = address.splitStreetAndNumber('Av. Corrientes 1234');
  assert.equal(parsed.street, 'Av. Corrientes');
  assert.equal(parsed.number, '1234');
});

test('resume CABA como localidad', () => {
  assert.equal(address.prettyLocality('Ciudad Autónoma de Buenos Aires'), 'CABA');
  assert.equal(address.prettyLocality('Comuna 5', 'Ciudad Autónoma de Buenos Aires'), 'CABA');
  assert.equal(address.prettyLocality('Rosario', 'Santa Fe'), 'Rosario');
});

test('sugiere CABA al escribir el alias', () => {
  const aliases = address.aliasLocalities('caba');
  assert.equal(aliases[0].locality, 'CABA');
});

test('al elegir una calle deja lugar para el número', () => {
  const next = address.applySuggestion('', {
    kind: 'street',
    id: 'street:av-corrientes:caba',
    title: 'AV CORRIENTES',
    subtitle: 'CABA',
    value: 'AV CORRIENTES ',
    street: 'AV CORRIENTES',
    locality: 'CABA',
  });
  assert.equal(next, 'AV CORRIENTES ');
});

test('al elegir una calle con número completa la localidad', () => {
  const next = address.applySuggestion('corrientes 1234', {
    kind: 'street',
    id: 'street:av-corrientes:caba',
    title: 'AV CORRIENTES',
    subtitle: 'CABA',
    value: 'AV CORRIENTES ',
    street: 'AV CORRIENTES',
    locality: 'CABA',
  });
  assert.equal(next, 'AV CORRIENTES 1234, CABA');
});

test('al elegir una localidad la agrega después de la coma', () => {
  const next = address.applySuggestion('AV CORRIENTES 1234, pal', {
    kind: 'locality',
    id: 'locality:rosario',
    title: 'Rosario',
    subtitle: 'Santa Fe',
    value: 'Rosario',
    locality: 'Rosario',
  });
  assert.equal(next, 'AV CORRIENTES 1234, Rosario');
});

test('prioriza CABA y evita duplicar la misma calle', () => {
  const ranked = address.rankAndDedupeStreets([
    { nombre: 'CORRIENTES', localidad_censal: { nombre: 'Ayacucho' }, provincia: { nombre: 'Buenos Aires' } },
    { nombre: 'AV CORRIENTES', categoria: 'AV', localidad_censal: { nombre: 'Ciudad Autónoma de Buenos Aires' }, provincia: { nombre: 'Ciudad Autónoma de Buenos Aires' } },
    { nombre: 'AV CORRIENTES', categoria: 'AV', localidad_censal: { nombre: 'Ciudad Autónoma de Buenos Aires' }, provincia: { nombre: 'Ciudad Autónoma de Buenos Aires' } },
  ]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].nombre, 'AV CORRIENTES');
});
