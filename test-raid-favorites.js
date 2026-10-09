#!/usr/bin/env node
/**
 * Raid Favorites unit tests (store, Helix batching, JARVIS tools).
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RaidFavoritesStore = require('./lib/raid-favorites-store');
const { RaidHelixClient, chunkArray, HELIX_BATCH_SIZE } = require('./lib/raid-helix');
const { registry } = require('./jarvis-tools');
const { isJarvisMacroToolAllowed, JARVIS_MACRO_ALLOWLIST } = require('./lib/jarvis-macro-allowlist');
const { scopesIncludeRaid, TWITCH_OAUTH_SCOPES } = require('./lib/twitch-oauth-scopes');
const MacroManager = require('./lib/macro-manager');

const tmpDir = path.join(os.tmpdir(), `vd-raid-fav-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

function mockFetch(handler) {
  return async (url, opts = {}) => handler(url, opts);
}

(async () => {

// --- Store persistence ---
const storeDir = path.join(tmpDir, 'store-a');
fs.mkdirSync(storeDir, { recursive: true });
const store = new RaidFavoritesStore(storeDir);
store.addFavorite({ login: 'FriendlyStreamer', note: 'collab buddy' });
store.addFavorite({ login: 'Another_Channel', note: '' });
assert.strictEqual(store.listFavorites().length, 2);
store.reorderFavorites(['another_channel', 'friendlystreamer']);
assert.strictEqual(store.listFavorites()[0].login, 'another_channel');
store.removeFavorite('another_channel');
assert.strictEqual(store.listFavorites().length, 1);

const store2 = new RaidFavoritesStore(storeDir);
assert.strictEqual(store2.listFavorites().length, 1);
assert.strictEqual(store2.listFavorites()[0].login, 'friendlystreamer');

store2.recordRaid({ login: 'RaidTarget', displayName: 'RaidTarget' });
assert.ok(store2.listHistory().length >= 1);
assert.ok(store2.isAllowedRaidTarget('raidtarget'));
assert.ok(!store2.isAllowedRaidTarget('not_in_lists'));

assert.throws(() => store2.addFavorite({ login: 'ab' }), /Invalid/);
assert.throws(() => store2.addFavorite({ login: 'bad-name!' }), /Invalid/);

// --- Helix batching & parsing ---
const logins = [];
for (let i = 0; i < 105; i++) logins.push(`user_${i}`);
const batches = chunkArray(logins, HELIX_BATCH_SIZE);
assert.strictEqual(batches.length, 2);
assert.strictEqual(batches[0].length, 100);
assert.strictEqual(batches[1].length, 5);

let streamCallCount = 0;
const helix = new RaidHelixClient({
  getClientId: () => 'client',
  getAccessToken: () => 'token',
  getBroadcasterId: async () => '100',
  fetchFn: mockFetch(async (url, opts) => {
    if (url.includes('oauth2/validate')) {
      return {
        ok: true,
        json: async () => ({ scopes: ['chat:read'], client_id: 'client', login: 'me' }),
      };
    }
    if (url.includes('/helix/users?')) {
      const body = { data: [{ id: '2', login: 'target', display_name: 'Target', profile_image_url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/x-profile_image-300x300.png' }] };
      return { ok: true, json: async () => body };
    }
    if (url.includes('/helix/streams?')) {
      streamCallCount += 1;
      return {
        ok: true,
        json: async () => ({
          data: [{ user_login: 'target', title: 'Live title', game_name: 'Game', viewer_count: 42 }],
        }),
      };
    }
    if (url.includes('/helix/raids') && opts.method === 'POST') {
      return { ok: false, status: 401, json: async () => ({ message: 'missing scope channel:manage:raids' }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }),
});

const live = await helix.getLiveStatusForLogins(['target'], { forceRefresh: true });
assert.strictEqual(live.channels.length, 1);
assert.strictEqual(live.channels[0].live, true);
assert.strictEqual(live.channels[0].viewerCount, 42);
assert.ok(live.channels[0].profileImageUrl.includes('static-cdn.jtvnw.net'));

const cached = await helix.getLiveStatusForLogins(['target'], { forceRefresh: false });
assert.strictEqual(cached.cached, true);
assert.strictEqual(streamCallCount, 1);

const raidMissingScope = await helix.startRaid({ toLogin: 'target' });
assert.strictEqual(raidMissingScope.ok, false);
assert.strictEqual(raidMissingScope.needsReconnect, true);

// --- JARVIS tools ---
assert.ok(JARVIS_MACRO_ALLOWLIST.has('list_live_raid_favorites'));
assert.ok(JARVIS_MACRO_ALLOWLIST.has('start_raid'));
assert.ok(isJarvisMacroToolAllowed('start_raid'));
assert.ok(!isJarvisMacroToolAllowed('rm_rf_everything'));

const listResult = await registry.invoke('list_live_raid_favorites', {});
assert.strictEqual(listResult.success, true);
assert.ok(listResult.result.error);

const confirmResult = await registry.invoke('start_raid', { login: 'somechannel' });
assert.strictEqual(confirmResult.success, true);
assert.strictEqual(confirmResult.result.needsConfirmation, true);

registry.setContext({
  raidFavoritesListLive: async () => ({ success: true, favorites: [{ login: 'target', live: true }] }),
  raidFavoritesStartRaid: async ({ login }) => {
    if (login !== 'target') return { success: false, error: 'not allowed' };
    return { success: true, login };
  },
});

const listOk = await registry.invoke('list_live_raid_favorites', {});
assert.strictEqual(listOk.result.success, true);
assert.strictEqual(listOk.result.favorites[0].login, 'target');

const raidOk = await registry.invoke('start_raid', { login: 'target', confirmed: true });
assert.strictEqual(raidOk.result.success, true);

// --- Macro allowlist validation ---
const macroManager = new MacroManager(tmpDir);
const badMacro = {
  name: 'Bad',
  steps: [{ tool: 'start_raid', arguments: { login: 'x' } }],
};
const badValidation = macroManager.validate(badMacro);
assert.ok(!badMacro.steps[0].arguments.confirmed);
assert.ok(!badValidation.valid);

const goodMacro = {
  name: 'Raid macro',
  steps: [{ tool: 'start_raid', arguments: { login: 'target', confirmed: true } }],
};
assert.ok(macroManager.validate(goodMacro).valid);

assert.ok(scopesIncludeRaid(['channel:manage:raids', 'chat:read']));
assert.ok(TWITCH_OAUTH_SCOPES.includes('channel:manage:raids'));

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('✅ test-raid-favorites.js passed');

})().catch((err) => {
  console.error(err);
  process.exit(1);
});
