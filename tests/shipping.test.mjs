import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/shipping.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(source, context);
const { priceShipping, estimateShipping, authorizeCheckoutShipping, DEFAULT_SHIPPING_POLICY } = context.exports;
const policy = { ...DEFAULT_SHIPPING_POLICY, collectionRate: 0.10 };
const now = Date.parse('2026-09-30T15:00:00Z');
const rate = {
  id: 'fixture-not-a-real-rate', carrier: 'Test carrier', originPostalCode: '1000',
  destinationPostalCodes: ['1043'], destinationLocalities: ['CABA'],
  verifiedAt: '2026-09-30T14:00:00Z', validUntil: '2026-10-01T14:00:00Z',
  source: 'TEST FIXTURE', quantities: { 'SAF-2005': 2 }, packagesVerified: true,
  carrierCost: 10000, packagingCost: 1000, insuranceCost: 0, handlingCost: 0,
};
const quote = (rates, lines = [{ sku: 'SAF-2005', quantity: 1 }], cp = '1043', locality = 'CABA') => estimateShipping(lines, cp, locality, { policy, rates }, now);
test('pricing preserves net margin and minimum profit after fees and contingency', () => {
  for (const cost of [100, 1000, 10000, 64600, 999999]) {
    for (const fees of [0, 0.05, 0.20, 0.50]) {
      const p = { ...policy, collectionRate: fees };
      const charge = priceShipping(cost, p);
      const profit = charge * (1 - fees) - cost * (1 + p.contingencyRate);
      assert.ok(profit + 0.000001 >= p.minimumProfit);
      assert.ok(profit / charge + 0.000001 >= p.netMarginRate);
      assert.equal(charge % p.roundTo, 0);
    }
  }
});
test('unknown fees and invalid financial settings never become a zero-price quote', () => {
  assert.equal(priceShipping(10000, DEFAULT_SHIPPING_POLICY), null);
  for (const patch of [{ collectionRate: 0.95 }, { minimumProfit: 0 }, { roundTo: 0 }, { contingencyRate: -1 }, { collectionRate: NaN }]) {
    assert.equal(priceShipping(10000, { ...policy, ...patch }), null);
  }
  for (const cost of [0, -1, NaN, Infinity]) assert.equal(priceShipping(cost, policy), null);
});
test('verified whole-order quote and Argentine CPA are supported without disclosing cost', () => {
  const result = quote([rate], undefined, 'C1043AAE');
  assert.equal(result.status, 'estimated');
  assert.equal(result.amount, 15200);
  assert.equal(result.carrierCost, undefined);
});
test('expired, future-dated, oversized validity window or unverified package needs quotation', () => {
  for (const patch of [{ validUntil: '2026-09-30T14:30:00Z' }, { verifiedAt: '2026-10-01T14:00:00Z' }, { validUntil: '2027-01-01T00:00:00Z' }, { packagesVerified: false }, { insuranceCost: undefined }, { carrierCost: -1 }]) {
    assert.equal(quote([{ ...rate, ...patch }]).amount, null);
  }
});
test('unknown destination, product and excess quantity cannot reuse a smaller tariff', () => {
  assert.equal(quote([rate], undefined, '1900').amount, null);
  assert.equal(quote([rate], undefined, '1043', 'La Plata').amount, null);
  assert.equal(quote([rate], [{ sku: 'UNKNOWN', quantity: 1 }]).amount, null);
  assert.equal(quote([rate], [{ sku: 'SAF-2005', quantity: 3 }]).amount, null);
  assert.equal(quote([rate], [{ sku: 'SAF-2005', quantity: 2 }, { sku: 'SAF-2005', quantity: 1 }]).amount, null);
});
test('empty tariff inventory stays pending even for a high-value order', () => {
  const result = quote([]);
  assert.equal(result.status, 'quote_required');
  assert.equal(result.amount, null);
});
test('Mercado Pago can charge products only when shipping is still a quote', () => {
  const pending = quote([]);
  assert.equal(authorizeCheckoutShipping(pending, 0).ok, true);
  assert.equal(authorizeCheckoutShipping(pending, undefined).ok, false);
  assert.equal(authorizeCheckoutShipping(pending, null).ok, false);
  const estimated = quote([rate]);
  assert.equal(authorizeCheckoutShipping(estimated, estimated.amount).ok, true);
  assert.equal(authorizeCheckoutShipping(estimated, 0).ok, false);
  assert.equal(authorizeCheckoutShipping(estimated, 999).status, 409);
});
