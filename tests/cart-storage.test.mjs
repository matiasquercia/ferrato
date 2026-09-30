import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as stores from 'nanostores';
import * as persistent from '@nanostores/persistent';

function load(file, imports = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, ...globals, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}
const storage = load('../src/lib/storage.ts');
const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: key => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: key => { delete data[key]; },
  };
};

test('storage stays synchronized with another tab and supports deletion', () => {
  const browser = fakeStorage({ cart: 'one' });
  const engine = storage.safeStorageEngine(() => browser);
  assert.equal(engine.cart, 'one');
  browser.setItem('cart', 'two');
  assert.equal(engine.cart, 'two');
  delete engine.cart;
  assert.equal('cart' in engine, false);
  assert.equal(browser.getItem('cart'), null);
});
test('blocked storage keeps a functional in-memory cart', () => {
  const engine = storage.safeStorageEngine(() => { throw new Error('SecurityError'); });
  assert.equal('cart' in engine, false);
  engine.cart = 'items';
  assert.equal(engine.cart, 'items');
  delete engine.cart;
  assert.equal('cart' in engine, false);
});
test('quota failures preserve new cart values instead of restoring stale ones', () => {
  const browser = fakeStorage({ cart: 'old' });
  browser.setItem = () => { throw new Error('QuotaExceededError'); };
  const engine = storage.safeStorageEngine(() => browser);
  assert.equal(engine.cart, 'old');
  engine.cart = 'new';
  assert.equal(engine.cart, 'new');
});

const product = { id: 'ladder', slug: 'ladder', name: 'Escalera', price: 33261,
  colors: ['Negro'], images: ['/ladder.jpg'], stock: 3 };
function cartFor(raw) {
  return load('../src/lib/cart.ts', {
    './analytics': { track() {}, ecommerceItem: item => item },
    './catalog': { getProductById: id => id === product.id ? product : undefined, maxQuantity: p => p.stock },
    './storage': storage,
    nanostores: stores,
    '@nanostores/persistent': { ...persistent, windowPersistentEvents: { addEventListener() {}, removeEventListener() {} } },
  }, { window: { localStorage: fakeStorage({ 'ferrato:cart': raw }) } });
}
test('invalid saved carts cannot break hydration or totals', () => {
  for (const raw of ['null', '{}', 'true', '{broken', '[null,42,{}]']) {
    const api = cartFor(raw);
    assert.equal(api.$cart.get().length, 0);
    assert.equal(api.$cartTotal.get(), 0);
  }
});
test('restored items use current prices, supported colors and stock limits', () => {
  const api = cartFor(JSON.stringify([{ id: 'ladder', quantity: 8, price: 2, variant: 'Invalid' },
    { id: 'removed', quantity: 1 }, { id: 'ladder', quantity: -1 }]));
  const items = api.$cart.get();
  assert.equal(items.length, 1);
  assert.equal(items[0].price, 33261);
  assert.equal(items[0].variant, 'Negro');
  assert.equal(items[0].quantity, 3);
  assert.equal(api.$cartTotal.get(), 99783);
});
