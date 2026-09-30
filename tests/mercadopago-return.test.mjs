import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(fileUrl) {
  const source = ts.transpileModule(readFileSync(fileUrl, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, module: { exports: {} } };
  context.module.exports = context.exports;
  vm.runInNewContext(source, context, { filename: fileUrl.pathname });
  return context.module.exports;
}

const { paymentReturnTone } = load(new URL('../src/lib/mercadopago-return.ts', import.meta.url));

test('approved collection_status is success even on the error fallback', () => {
  const params = new URLSearchParams('collection_status=approved&status=approved');
  assert.equal(paymentReturnTone(params, 'error'), 'success');
});

test('pending payment stays pending', () => {
  assert.equal(paymentReturnTone(new URLSearchParams('status=pending'), 'success'), 'pending');
  assert.equal(paymentReturnTone(new URLSearchParams('collection_status=in_process'), 'error'), 'pending');
});

test('rejected payment is an error', () => {
  assert.equal(paymentReturnTone(new URLSearchParams('status=rejected'), 'success'), 'error');
});

test('missing status keeps the page fallback', () => {
  assert.equal(paymentReturnTone(new URLSearchParams(), 'success'), 'success');
  assert.equal(paymentReturnTone(new URLSearchParams(), 'error'), 'error');
});
