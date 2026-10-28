#!/usr/bin/env node
const assert = require('assert');
const { formatMacrosForRaven, matchVoiceMacroFromList } = require('./lib/raven-macro-api');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

console.log('🧪 Raven macro API helpers\n');

test('formatMacrosForRaven exposes id, name, phrase', () => {
  const out = formatMacrosForRaven([
    { id: 'a', name: 'A', enabled: true, triggers: { phrase: 'hey raven test' } },
    { id: 'b', name: 'B', enabled: false, triggers: { phrase: 'x' } },
  ]);
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0], { id: 'a', name: 'A', phrase: 'hey raven test', enabled: true });
});

test('matchVoiceMacroFromList uses wake names from raven.env', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-raven-macro-api-'));
  fs.writeFileSync(path.join(dir, 'raven.env'), 'HOST_WAKE_NAMES=Raven\n');
  const macros = [
    { id: 'run-ad', name: 'Run Ad', enabled: true, triggers: { phrase: 'hey raven, run ads' } },
  ];
  const m = matchVoiceMacroFromList(macros, 'hey raven run ads', dir);
  assert.strictEqual(m.matched, true);
  assert.strictEqual(m.macro.id, 'run-ad');
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(`\n${passed} passed`);
