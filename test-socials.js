#!/usr/bin/env node
const assert = require('assert');
const {
  normalizeSocials,
  formatSocialsLine,
  splitChatMessages,
  TWITCH_CHAT_MAX_LEN,
} = require('./lib/socials');
const { replacePlaceholders, appendSocialsToUserData } = require('./lib/alert-placeholders');
const { isJarvisMacroToolAllowed } = require('./lib/jarvis-macro-allowlist');
const { scopesIncludeCommercial, TWITCH_OAUTH_SCOPES } = require('./lib/twitch-oauth-scopes');

assert.deepStrictEqual(normalizeSocials([{ name: 'Twitter', url: 'https://x.com/a' }, { name: '', url: 'x' }]), [
  { name: 'Twitter', url: 'https://x.com/a' },
]);

assert.strictEqual(
  formatSocialsLine([{ name: 'Twitter', url: 'https://x.com/a' }, { name: 'YouTube', url: 'https://youtube.com/@a' }]),
  'Twitter: https://x.com/a | YouTube: https://youtube.com/@a',
);

const longLine = formatSocialsLine(
  Array.from({ length: 20 }, (_, i) => ({ name: `Site${i}`, url: `https://example.com/${i}` })),
);
const parts = splitChatMessages(longLine, TWITCH_CHAT_MAX_LEN);
assert.ok(parts.length > 1);
parts.forEach((p) => assert.ok(p.length <= TWITCH_CHAT_MAX_LEN));

assert.strictEqual(
  replacePlaceholders('Follow {socials}', appendSocialsToUserData({}, [{ name: 'X', url: 'https://x.com/u' }])),
  'Follow X: https://x.com/u',
);

assert.strictEqual(isJarvisMacroToolAllowed('post_socials'), true);
assert.strictEqual(isJarvisMacroToolAllowed('twitch_start_commercial'), true);
assert.ok(scopesIncludeCommercial(['channel:edit:commercial', 'chat:read']));
assert.ok(TWITCH_OAUTH_SCOPES.includes('channel:edit:commercial'));

console.log('✅ test-socials.js passed');
