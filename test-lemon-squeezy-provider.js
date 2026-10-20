#!/usr/bin/env node
/**
 * Lemon Squeezy license provider tests (mocked HTTP).
 */
const assert = require('assert');
const { createLemonSqueezyProvider, API_BASE } = require('./lib/license/providers/lemon-squeezy');

console.log('🧪 Lemon Squeezy provider tests\n');

function mockFetch(handler) {
  return async (url, options) => {
    const parsed = new URL(url);
    const bodyText = options.body ? options.body.toString() : '';
    const fields = {};
    for (const [k, v] of new URLSearchParams(bodyText)) {
      fields[k] = v;
    }
    const response = handler({ url, path: parsed.pathname, fields, options });
    if (response instanceof Error) {
      throw response;
    }
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.json,
    };
  };
}

const goodMeta = { store_id: 501850, product_id: 1453199, variant_id: 2268234 };

assert.strictEqual(API_BASE, 'https://api.lemonsqueezy.com/v1');

(async () => {
  const provider = createLemonSqueezyProvider({
    storeId: '501850',
    productId: '1453199',
    fetchImpl: mockFetch(({ path, fields }) => {
      assert.strictEqual(path, '/v1/licenses/activate');
      assert.strictEqual(fields.license_key, 'TEST-KEY');
      assert.strictEqual(fields.instance_name, 'my-pc');
      return {
        status: 200,
        json: {
          activated: true,
          error: null,
          instance: { id: 'inst-1', name: 'my-pc' },
          meta: goodMeta,
          license_key: { status: 'active' },
        },
      };
    }),
  });
  const r = await provider.activate('TEST-KEY', 'my-pc');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.instance.id, 'inst-1');
  console.log('✅ activate sends form body and returns instance');

  const wrongStore = createLemonSqueezyProvider({
    storeId: '999',
    productId: '1453199',
    fetchImpl: mockFetch(() => ({
      status: 200,
      json: {
        activated: true,
        instance: { id: 'x' },
        meta: goodMeta,
        license_key: { status: 'active' },
      },
    })),
  });
  const ws = await wrongStore.activate('TEST-KEY', 'pc');
  assert.strictEqual(ws.ok, false);
  assert.match(ws.error, /wrong store/i);
  console.log('✅ rejects license from another store');

  const limitProvider = createLemonSqueezyProvider({
    fetchImpl: mockFetch(() => ({
      status: 200,
      json: { activated: false, error: 'This license key has reached the activation limit.' },
    })),
  });
  const lim = await limitProvider.activate('TEST-KEY', 'pc');
  assert.strictEqual(lim.ok, false);
  assert.match(lim.error, /activation limit/i);
  console.log('✅ surfaces activation limit errors');

  const validateProvider = createLemonSqueezyProvider({
    storeId: '501850',
    productId: '1453199',
    fetchImpl: mockFetch(({ path, fields }) => {
      assert.strictEqual(path, '/v1/licenses/validate');
      assert.strictEqual(fields.instance_id, 'inst-1');
      return {
        status: 200,
        json: { valid: true, error: null, meta: goodMeta, license_key: { status: 'active' } },
      };
    }),
  });
  const vr = await validateProvider.validate('TEST-KEY', 'inst-1');
  assert.strictEqual(vr.ok, true);
  console.log('✅ validate uses instance_id');

  const invalidProvider = createLemonSqueezyProvider({
    fetchImpl: mockFetch(() => ({
      status: 200,
      json: { valid: false, error: 'Invalid license key' },
    })),
  });
  const inv = await invalidProvider.validate('BAD', 'inst-1');
  assert.strictEqual(inv.ok, false);
  console.log('✅ invalid validate returns error');

  const netProvider = createLemonSqueezyProvider({
    fetchImpl: mockFetch(() => {
      throw new Error('ENOTFOUND');
    }),
  });
  const net = await netProvider.validate('TEST-KEY', 'inst-1');
  assert.strictEqual(net.ok, false);
  assert.strictEqual(net.transient, true);
  console.log('✅ network failures marked transient');

  const deactProvider = createLemonSqueezyProvider({
    fetchImpl: mockFetch(({ path, fields }) => {
      assert.strictEqual(path, '/v1/licenses/deactivate');
      assert.strictEqual(fields.instance_id, 'inst-1');
      return { status: 200, json: { deactivated: true, error: null } };
    }),
  });
  const dr = await deactProvider.deactivate('TEST-KEY', 'inst-1');
  assert.strictEqual(dr.ok, true);
  console.log('✅ deactivate calls API');

  console.log('\n✅ All Lemon Squeezy provider tests passed');
})().catch((err) => {
  console.error('❌ Lemon Squeezy provider tests failed:', err);
  process.exit(1);
});
