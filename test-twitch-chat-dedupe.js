#!/usr/bin/env node
const assert = require('assert');
const { createTwitchMessageDeduper } = require('./lib/twitch-chat-dedupe');

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

console.log('🧪 Twitch chat dedupe tests\n');

test('isDuplicate returns false once per message id', () => {
  const d = createTwitchMessageDeduper();
  assert.strictEqual(d.isDuplicate({ id: 'abc-1' }), false);
  assert.strictEqual(d.isDuplicate({ id: 'abc-1' }), true);
  assert.strictEqual(d.isDuplicate({ id: 'abc-2' }), false);
});

test('missing id never dedupes', () => {
  const d = createTwitchMessageDeduper();
  assert.strictEqual(d.isDuplicate({}), false);
  assert.strictEqual(d.isDuplicate(null), false);
});

test('reset clears dedupe state', () => {
  const d = createTwitchMessageDeduper();
  assert.strictEqual(d.isDuplicate({ id: 'x' }), false);
  d.reset();
  assert.strictEqual(d.isDuplicate({ id: 'x' }), false);
});

console.log(`\n${passed} passed`);
