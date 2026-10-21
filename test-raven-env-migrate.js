#!/usr/bin/env node
/**
 * raven.env migration: VIRTUALDECK_HTTP_URL must point at the Raven bridge (3000), not the
 * auth-protected VirtualDeck overlay server (8080) — otherwise the macro whitelist fetch 401s.
 */
const assert = require('assert');
{
  const m = require('./lib/raven-env-migrate');
  assert.strictEqual(m.RAVEN_DEFAULT_VOICE_ID, 'wJqPPQ618aTW29mptyoc');
  assert.strictEqual(m.resolveTtsVoiceId(''), 'wJqPPQ618aTW29mptyoc');
  assert.strictEqual(m.resolveTtsVoiceId('  '), 'wJqPPQ618aTW29mptyoc');
  assert.strictEqual(m.resolveTtsVoiceId('abc123'), 'abc123');
  const r = m.migrateRavenEnvText('A=1\nTTS_VOICE_ID=\nB=2\n');
  assert.ok(r.changed); assert.ok(r.text.includes('TTS_VOICE_ID=wJqPPQ618aTW29mptyoc\n'));
  const keep = m.migrateRavenEnvText('TTS_VOICE_ID=customVoice123\n');
  assert.strictEqual(keep.changed, false);
  const fs2 = require('fs');
  for (const f of ['extra/raven/env.defaults', 'scripts/raven-env.defaults.template']) {
    assert.ok(fs2.readFileSync(f, 'utf8').includes('TTS_VOICE_ID=wJqPPQ618aTW29mptyoc'), f + ' default voice');
  }
}
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RAVEN_BRIDGE_HTTP_URL, migrateRavenEnvText, migrateRavenEnvFile } = require('./lib/raven-env-migrate');

assert.strictEqual(RAVEN_BRIDGE_HTTP_URL, 'http://localhost:3000');

const cases = [
  ['VIRTUALDECK_HTTP_URL=http://localhost:8080', 'VIRTUALDECK_HTTP_URL=http://localhost:3000'],
  ['VIRTUALDECK_HTTP_URL=http://127.0.0.1:8080/', 'VIRTUALDECK_HTTP_URL=http://localhost:3000'],
  ['VIRTUALDECK_HTTP_URL="http://localhost:8080"', 'VIRTUALDECK_HTTP_URL=http://localhost:3000'],
  ['  VIRTUALDECK_HTTP_URL = http://localhost:8080  # old', '  VIRTUALDECK_HTTP_URL = http://localhost:3000  # old'],
];
for (const [input, expected] of cases) {
  const r = migrateRavenEnvText(input);
  assert.strictEqual(r.text, expected, `migrate ${input}`);
  assert.strictEqual(r.changed, true);
}

const untouched = [
  'VIRTUALDECK_HTTP_URL=http://localhost:3000',
  'VIRTUALDECK_HTTP_URL=http://192.168.1.20:8080',
  'VIRTUALDECK_HTTP_URL=http://localhost:18080',
  '# VIRTUALDECK_HTTP_URL=http://localhost:8080',
  'OTHER_URL=http://localhost:8080',
];
for (const input of untouched) {
  const r = migrateRavenEnvText(input);
  assert.strictEqual(r.changed, false, `must not touch: ${input}`);
  assert.strictEqual(r.text, input);
}

// Multi-line file with CRLF: only the one line changes, everything else (keys, comments, EOLs) is preserved.
const crlf = ['LLM_API_KEY=abc', '# comment', 'VIRTUALDECK_HTTP_URL=http://localhost:8080', 'HOST_WAKE_NAMES=Raven', ''].join('\r\n');
const migrated = migrateRavenEnvText(crlf);
assert.strictEqual(migrated.text, crlf.replace('http://localhost:8080', 'http://localhost:3000'));

// File helper: rewrites once, idempotent, never throws.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-raven-env-migrate-'));
const file = path.join(tmp, 'raven.env');
fs.writeFileSync(file, 'TTS_API_KEY=\nVIRTUALDECK_HTTP_URL=http://localhost:8080\n', 'utf8');
const quiet = { log() {}, warn() {} };
assert.strictEqual(migrateRavenEnvFile(file, fs, quiet), true);
assert.strictEqual(fs.readFileSync(file, 'utf8'), 'TTS_API_KEY=\nVIRTUALDECK_HTTP_URL=http://localhost:3000\n');
assert.strictEqual(migrateRavenEnvFile(file, fs, quiet), false, 'second run is a no-op');
assert.strictEqual(migrateRavenEnvFile(path.join(tmp, 'missing.env'), fs, quiet), false);
const throwingFs = { existsSync: () => true, readFileSync: () => { throw new Error('boom'); } };
assert.strictEqual(migrateRavenEnvFile(file, throwingFs, quiet), false);
fs.rmSync(tmp, { recursive: true, force: true });

// Shipped defaults must point at the bridge.
for (const rel of ['scripts/raven-env.defaults.template', 'extra/raven/env.defaults']) {
  const text = fs.readFileSync(path.join(__dirname, rel), 'utf8');
  const line = text.split(/\r?\n/).find((l) => /^VIRTUALDECK_HTTP_URL=/.test(l));
  assert.strictEqual(line, 'VIRTUALDECK_HTTP_URL=http://localhost:3000', `${rel} must use the Raven bridge`);
}

// raven-host must run the migration whenever it prepares raven.env.
const host = fs.readFileSync(path.join(__dirname, 'raven-host.js'), 'utf8');
assert.match(host, /require\('\.\/lib\/raven-env-migrate'\)/);
assert.match(host, /migrateRavenEnvFile\(dest\)/);

console.log('✅ test-raven-env-migrate.js passed');
