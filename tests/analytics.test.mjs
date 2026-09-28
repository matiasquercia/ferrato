import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function setup({ stored, blockedStorage = false, config: override = {} } = {}) {
  const scripts = [],
    handlers = {},
    storage = new Map();
  if (stored) storage.set('ferrato:consent:v1', JSON.stringify(stored));
  const config = {
    ga: 'G-TEST123',
    ads: 'AW-123456',
    whatsappLabel: 'wa_label',
    checkoutLabel: 'checkout_label',
    pixel: '',
    ...override,
  };
  class Element {
    constructor(map = {}) {
      this.map = map;
    }
    closest(selector) {
      return this.map[selector] || null;
    }
  }
  const notice = { hidden: true, querySelector: () => ({ focus() {} }) };
  const document = {
    cookie: '',
    title: 'Ferrato',
    referrer: 'https://example.com/private?email=secret',
    getElementById: (id) =>
      id === 'measurement-config' ? { dataset: { config: JSON.stringify(config) } } : notice,
    querySelector: () => ({
      dataset: { viewItem: JSON.stringify({ item_id: 'SAF-2005', item_name: 'Escalera', price: 100 }) },
    }),
    createElement: () => ({}),
    head: { append: (script) => scripts.push(script) },
    addEventListener: (name, handler) => {
      handlers[name] = handler;
    },
  };
  let reloads = 0;
  const window = { addEventListener() {} };
  const context = {
    exports: {},
    window,
    document,
    Element,
    URL,
    URLSearchParams,
    Date,
    location: {
      origin: 'https://test.example',
      pathname: '/productos/escalera',
      search: '?email=secret&gclid=valid_123',
      hostname: 'test.example',
      reload() {
        reloads++;
      },
    },
    localStorage: {
      getItem(k) {
        if (blockedStorage) throw Error();
        return storage.get(k);
      },
      setItem(k, v) {
        if (blockedStorage) throw Error();
        storage.set(k, v);
      },
    },
  };
  vm.runInNewContext(source, context);
  const api = context.exports;
  api.initializeMeasurement();
  const commands = () => window.dataLayer.map((entry) => Array.from(entry));
  const events = (name) => commands().filter((entry) => entry[0] === 'event' && entry[1] === name);
  const choose = (value) =>
    handlers.click({ target: new Element({ '[data-consent]': { dataset: { consent: value } } }) });
  return {
    api,
    scripts,
    notice,
    commands,
    events,
    choose,
    reloads: () => reloads,
    clickWhatsApp() {
      handlers.click({
        target: new Element({ 'a[href]': { href: 'https://wa.me/123?text=private', closest: () => null } }),
      });
    },
  };
}

test('no tracking or third-party scripts before consent or after rejection', () => {
  const h = setup();
  h.api.track('add_to_cart');
  h.clickWhatsApp();
  assert.equal(h.scripts.length, 0);
  assert.equal(h.events('whatsapp_click').length, 0);
  h.choose('none');
  assert.equal(h.scripts.length, 0);
  assert.equal(h.notice.hidden, true);
});
test('analytics-only choice sends one page/item view and no Ads conversions', () => {
  const h = setup();
  h.choose('analytics');
  h.choose('analytics');
  h.api.initializeMeasurement();
  h.clickWhatsApp();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.events('page_view').length, 1);
  assert.equal(h.events('view_item').length, 1);
  assert.equal(h.events('whatsapp_click').length, 1);
  assert.equal(h.events('conversion').length, 0);
  const serialized = JSON.stringify(h.commands());
  assert.ok(!serialized.includes('secret'));
  assert.ok(!serialized.includes('text=private'));
  assert.ok(serialized.includes('gclid=valid_123'));
});
test('all consent routes each action once and never claims a purchase', () => {
  const h = setup();
  h.choose('all');
  h.clickWhatsApp();
  h.api.track('checkout_submit');
  assert.equal(h.events('conversion').length, 2);
  assert.equal(h.events('whatsapp_click').length, 1);
  assert.equal(h.events('purchase').length, 0);
  assert.ok(
    h.commands().findIndex((e) => e[0] === 'consent' && e[1] === 'update') <
      h.commands().findIndex((e) => e[0] === 'config'),
  );
});
test('stored consent works, expired consent requires a new choice', () => {
  assert.equal(
    setup({ stored: { analytics: true, ads: false, updated: Date.now() } }).events('page_view').length,
    1,
  );
  const h = setup({ stored: { analytics: true, ads: true, updated: 0 } });
  assert.equal(h.scripts.length, 0);
  assert.equal(h.notice.hidden, false);
});
test('blocked storage does not prevent rejection or session consent', () => {
  const h = setup({ blockedStorage: true });
  h.choose('analytics');
  assert.equal(h.events('page_view').length, 1);
});
test('revocation stops events and reloads to unload third-party listeners', () => {
  const h = setup();
  h.choose('all');
  h.choose('none');
  h.clickWhatsApp();
  assert.equal(h.events('whatsapp_click').length, 0);
  assert.equal(h.reloads(), 1);
});
test('invalid or missing account IDs never load vendor scripts', () => {
  const h = setup({ config: { ga: '', ads: 'invalid', pixel: '' } });
  h.choose('all');
  assert.equal(h.scripts.length, 0);
});
