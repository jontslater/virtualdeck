#!/usr/bin/env node
const assert = require('assert');
const { TwitchCommercialClient } = require('./lib/twitch-commercial');

function mockFetch(handler) {
  return async (url, opts = {}) => handler(url, opts);
}

(async () => {
  const missingScope = new TwitchCommercialClient({
    getClientId: () => 'cid',
    getAccessToken: () => 'tok',
    getBroadcasterId: async () => '100',
    fetchFn: mockFetch(async (url) => {
      if (url.includes('oauth2/validate')) {
        return { ok: true, json: async () => ({ scopes: ['chat:read'] }) };
      }
      throw new Error('unexpected');
    }),
  });
  const blocked = await missingScope.startCommercial({ length: 60 });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.needsReconnect, true);
  assert.match(blocked.error, /channel:edit:commercial/);

  const notLive = new TwitchCommercialClient({
    getClientId: () => 'cid',
    getAccessToken: () => 'tok',
    getBroadcasterId: async () => '100',
    fetchFn: mockFetch(async (url) => {
      if (url.includes('oauth2/validate')) {
        return { ok: true, json: async () => ({ scopes: ['channel:edit:commercial'] }) };
      }
      if (url.includes('/helix/channels/commercial')) {
        return { ok: false, status: 404, json: async () => ({ message: 'Broadcaster is not streaming live' }) };
      }
      throw new Error('unexpected');
    }),
  });
  const offline = await notLive.startCommercial({ length: 90 });
  assert.strictEqual(offline.ok, false);
  assert.strictEqual(offline.reason, 'not_live');

  const cooldown = new TwitchCommercialClient({
    getClientId: () => 'cid',
    getAccessToken: () => 'tok',
    getBroadcasterId: async () => '100',
    fetchFn: mockFetch(async (url) => {
      if (url.includes('oauth2/validate')) {
        return { ok: true, json: async () => ({ scopes: ['channel:edit:commercial'] }) };
      }
      if (url.includes('/helix/channels/commercial')) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ message: 'Too Many Requests', data: [{ retry_after: 312 }] }),
        };
      }
      throw new Error('unexpected');
    }),
  });
  const cd = await cooldown.startCommercial({ length: 120 });
  assert.strictEqual(cd.ok, false);
  assert.strictEqual(cd.reason, 'cooldown');
  assert.strictEqual(cd.retry_after, 312);

  const okClient = new TwitchCommercialClient({
    getClientId: () => 'cid',
    getAccessToken: () => 'tok',
    getBroadcasterId: async () => '100',
    fetchFn: mockFetch(async (url, opts) => {
      if (url.includes('oauth2/validate')) {
        return { ok: true, json: async () => ({ scopes: ['channel:edit:commercial'] }) };
      }
      if (url.includes('/helix/channels/commercial')) {
        const body = JSON.parse(opts.body);
        assert.strictEqual(body.broadcaster_id, '100');
        assert.strictEqual(body.length, 60);
        return { ok: true, json: async () => ({ data: [{ length: 60, retry_after: 0 }] }) };
      }
      throw new Error('unexpected');
    }),
  });
  const ok = await okClient.startCommercial({ length: 60 });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.length, 60);

  console.log('✅ test-twitch-commercial.js passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
