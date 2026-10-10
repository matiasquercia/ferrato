import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/lib/verified-payment.server.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let fetched = 0;
const receipt = { orderId: 'FER-TEST', total: 48261, created: Date.now() - 1000 };
const approved = { id: 12345, status: 'approved', live_mode: true, currency_id: 'ARS',
  transaction_amount: 48261, external_reference: receipt.orderId };
const context = { exports: {}, console, Date, require: (name) => {
  if (name === '@/lib/mercadopago.server') return {
    getMercadoPagoClient: () => ({}), paymentApi: () => ({ get: async () => { fetched++; return approved; } }),
  };
  if (name === '@/lib/mercadopago-return') return { paymentReturnCopy: (tone) => ({ title: tone, message: tone }) };
  throw new Error(name);
} };
vm.runInNewContext(source, context);
const { purchaseForPayment, verifiedPaymentReturn } = context.exports;

test('only an approved live payment matching the server receipt yields its true value and ID', () => {
  assert.equal(purchaseForPayment(approved, receipt).transaction_id, 'MP-12345');
  assert.equal(purchaseForPayment(approved, receipt).value, 48261);
  for (const patch of [{ status: 'pending' }, { status: 'rejected' }, { live_mode: false },
    { external_reference: 'FER-OTHER' }, { transaction_amount: 1 }, { currency_id: 'USD' },
    { id: undefined }, { transaction_amount: NaN }]) {
    assert.equal(purchaseForPayment({ ...approved, ...patch }, receipt), undefined);
  }
  assert.equal(purchaseForPayment(approved, { ...receipt, created: Date.now() - 31 * 86400000 }), undefined);
});

test('a fabricated approved return URL without the checkout session cannot create a sale', async () => {
  fetched = 0;
  const url = new URL('https://example.com/checkout/exito?status=approved&payment_id=12345&external_reference=FER-TEST');
  const result = await verifiedPaymentReturn({ url, session: { get: async () => undefined } }, 'success');
  assert.equal(result.tone, 'pending');
  assert.equal(result.purchase, undefined);
  assert.equal(result.orderId, '');
  assert.equal(fetched, 0);
  const verified = await verifiedPaymentReturn({ url, session: { get: async () => receipt } }, 'success');
  assert.equal(verified.tone, 'success');
  assert.equal(verified.purchase.value, 48261);
  assert.equal(fetched, 1);
});
