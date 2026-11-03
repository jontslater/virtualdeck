#!/usr/bin/env node
const assert = require('assert');
const {
  normalizeChatCommandConfig,
  parseTriggerKeywords,
  messageMatchesChatCommand,
  messageContainsWholeWord,
  findChatCommandTriggers,
  createChatCommandCooldownStore,
  buildChatCommandFromFields,
} = require('./lib/twitch-chat-command');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}:`, err.message || err);
    process.exitCode = 1;
  }
}

console.log('🧪 Twitch chat command trigger tests\n');

test('normalizeChatCommandConfig applies backward-compatible defaults', () => {
  const cfg = normalizeChatCommandConfig({
    enabled: true,
    keyword: 'Hype',
    triggerMethod: 'both',
  });
  assert.strictEqual(cfg.requirePrefix, true);
  assert.strictEqual(cfg.matchAnywhere, false);
  assert.strictEqual(cfg.allowOverlappingRuns, false);
  assert.strictEqual(cfg.perUserCooldownSeconds, 0);
  assert.strictEqual(cfg.keyword, 'hype');
});

test('parseTriggerKeywords splits comma-separated words', () => {
  assert.deepStrictEqual(parseTriggerKeywords('turnup, hype ,COOL'), ['turnup', 'hype', 'cool']);
});

test('classic !command exact first-token match', () => {
  const cfg = { enabled: true, keyword: 'turnup', requirePrefix: true, matchAnywhere: false };
  assert.strictEqual(messageMatchesChatCommand('!turnup', cfg), true);
  assert.strictEqual(messageMatchesChatCommand('!turnup extra', cfg), true);
  assert.strictEqual(messageMatchesChatCommand('turnup', cfg), false);
  assert.strictEqual(messageMatchesChatCommand('!TurnUp', cfg), true);
});

test('secret word match anywhere without prefix', () => {
  const cfg = {
    enabled: true,
    keyword: 'poggers',
    requirePrefix: false,
    matchAnywhere: true,
  };
  assert.strictEqual(messageMatchesChatCommand('that was poggers honestly', cfg), true);
  assert.strictEqual(messageMatchesChatCommand('poggersville', cfg), false);
  assert.strictEqual(messageMatchesChatCommand('POGGERS', cfg), true);
});

test('match anywhere with require prefix still needs leading !', () => {
  const cfg = {
    enabled: true,
    keyword: 'hype',
    requirePrefix: true,
    matchAnywhere: true,
  };
  assert.strictEqual(messageMatchesChatCommand('!lets go hype train', cfg), true);
  assert.strictEqual(messageMatchesChatCommand('lets go hype train', cfg), false);
});

test('multiple keywords on one command', () => {
  const cfg = {
    enabled: true,
    keyword: 'turnup,hype',
    requirePrefix: true,
    matchAnywhere: false,
  };
  assert.strictEqual(messageMatchesChatCommand('!hype', cfg), true);
  assert.strictEqual(messageMatchesChatCommand('!turnup', cfg), true);
});

test('findChatCommandTriggers respects triggerMethod', () => {
  const buttons = [
    {
      id: 'a',
      label: 'Sound A',
      chatCommand: { enabled: true, keyword: 'a', triggerMethod: 'redeem' },
    },
    {
      id: 'b',
      label: 'Sound B',
      chatCommand: { enabled: true, keyword: 'a', triggerMethod: 'command' },
    },
  ];
  const hits = findChatCommandTriggers('!a', buttons);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].btn.id, 'b');
});

test('legacy command buttons still require ! prefix', () => {
  const buttons = [{ type: 'command', label: 'legacy' }];
  assert.strictEqual(findChatCommandTriggers('legacy', buttons).length, 0);
  assert.strictEqual(findChatCommandTriggers('!legacy', buttons).length, 1);
});

test('per-user cooldown store blocks repeat within window', () => {
  const store = createChatCommandCooldownStore();
  const now = Date.now();
  const original = Date.now;
  Date.now = () => now;
  try {
    assert.strictEqual(store.isOnCooldown('btn1', 'viewer1', 30), false);
    store.record('btn1', 'viewer1');
    assert.strictEqual(store.isOnCooldown('btn1', 'viewer1', 30), true);
    assert.strictEqual(store.isOnCooldown('btn1', 'viewer2', 30), false);
  } finally {
    Date.now = original;
  }
});

test('buildChatCommandFromFields persists advanced options', () => {
  const payload = buildChatCommandFromFields({
    enabled: true,
    keyword: 'Word',
    redeemName: '',
    triggerMethod: 'command',
    requirePrefix: false,
    matchAnywhere: true,
    allowOverlappingRuns: true,
    perUserCooldownSeconds: 15,
  });
  assert.strictEqual(payload.requirePrefix, false);
  assert.strictEqual(payload.matchAnywhere, true);
  assert.strictEqual(payload.allowOverlappingRuns, true);
  assert.strictEqual(payload.perUserCooldownSeconds, 15);
  assert.strictEqual(payload.keyword, 'word');
});

test('messageContainsWholeWord is case-insensitive', () => {
  assert.strictEqual(messageContainsWholeWord('Hello WORLD', 'world'), true);
});

console.log(`\n${passed} passed`);
