#!/usr/bin/env node
const assert = require('assert');
const {
  scopeString,
  parseImplicitCallbackUrl,
  pollDeviceCodeToken,
} = require('./lib/twitch-oauth-client');
const { getTwitchOAuthClientId, DEFAULT_TWITCH_CLIENT_ID } = require('./lib/twitch-oauth');
const { classifyDroppedFileName, labelFromFileName } = require('./lib/dropped-deck-file');

assert.strictEqual(scopeString(['chat:read', 'chat:edit']), 'chat:read chat:edit');

const implicit = parseImplicitCallbackUrl('http://localhost:17563/oauth/callback?access_token=abc123&scope=chat%3Aread&token_type=bearer');
assert.strictEqual(implicit.ok, true);
assert.strictEqual(implicit.accessToken, 'abc123');

const implicitHash = parseImplicitCallbackUrl('http://localhost:17563/oauth/callback#access_token=xyz&token_type=bearer');
assert.strictEqual(implicitHash.ok, true);
assert.strictEqual(implicitHash.accessToken, 'xyz');

let calls = 0;
const fetchMock = async () => {
  calls += 1;
  if (calls === 1) {
    return {
      ok: false,
      json: async () => ({ error: 'authorization_pending' }),
    };
  }
  return {
    ok: true,
    json: async () => ({
      access_token: 'tok',
      refresh_token: 'ref',
      expires_in: 3600,
    }),
  };
};

(async () => {
  const polled = await pollDeviceCodeToken(fetchMock, 'client', 'device', {
    intervalSec: 0.01,
    expiresInSec: 5,
  });
  assert.strictEqual(polled.ok, true);
  assert.strictEqual(polled.data.access_token, 'tok');
})().then(() => {
  assert.strictEqual(classifyDroppedFileName('game.exe'), 'app');
  assert.strictEqual(classifyDroppedFileName('sound.mp3'), 'audio');
  assert.strictEqual(labelFromFileName('My Sound.wav'), 'My Sound');

  assert.strictEqual(DEFAULT_TWITCH_CLIENT_ID, '6xnmuyhhtmfpqugw2cn9j5njh770ct');
  assert.strictEqual(getTwitchOAuthClientId(), DEFAULT_TWITCH_CLIENT_ID);

  console.log('✅ test-twitch-oauth.js passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
