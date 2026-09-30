import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const transpile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const core = { exports: {} };
vm.runInNewContext(transpile('../src/lib/shipping.ts'), core);
const reference = { exports: {}, require: () => core.exports };
vm.runInNewContext(transpile('../src/lib/shipping-reference.server.ts'), reference);
const now = Date.parse('2026-09-30T15:00:00Z');
const lines = [{ sku: 'SAF-2005', quantity: 1 }];
test('reference price is separated from a payable rate and never turns pending into free shipping', () => {
  const estimate = core.exports.estimateShipping(lines, '1043', 'CABA', { policy: core.exports.DEFAULT_SHIPPING_POLICY, rates: [] }, now);
  estimate.reference = reference.exports.shippingReference(lines, '1043', 'CABA', now);
  assert.equal(estimate.reference.amount, 49900);
  assert.equal(estimate.amount, null);
  assert.equal(estimate.status, 'quote_required');
  assert.equal(estimate.rateId, undefined);
});
test('a folded-package reference cannot be reused for more units, other routes or later dates', () => {
  for (const [items, cp, place, date] of [[[{ sku: 'SAF-2005', quantity: 2 }], '1043', 'CABA', now], [[{ sku: 'SAF-2004', quantity: 1 }], '1043', 'CABA', now], [lines, '1900', 'La Plata', now], [lines, '1609', 'CABA', now], [lines, '1043', 'CABA', Date.parse('2026-10-03T12:00:00Z')]]) {
    assert.equal(reference.exports.shippingReference(items, cp, place, date), undefined);
  }
});
