#!/usr/bin/env node
/**
 * AI config: wake name validation/persistence helpers and voice preview IPC validation.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseAndValidateHostWakeNames,
  buildDefaultGoingLivePhrase,
  DEFAULT_WAKE_NAME,
} = require('./lib/wake-names');
const {
  validateVoicePreviewRequest,
  validateVoicePreviewVoiceId,
  validateVoicePreviewUrl,
  buildPreviewSampleLine,
} = require('./lib/ai-voice-preview');
const { assertAllowedMainProcessFetchUrl } = require('./lib/security');
const { AIConfigManager } = require('./lib/ai-config');

console.log('🧪 test-ai-config.js\n');

// Wake names
const defaultParsed = parseAndValidateHostWakeNames('');
assert.strictEqual(defaultParsed.ok, true);
assert.deepStrictEqual(defaultParsed.names, [DEFAULT_WAKE_NAME]);

const multi = parseAndValidateHostWakeNames('Jarvis, J, Jarvis Prime');
assert.strictEqual(multi.ok, true);
assert.strictEqual(multi.primary, 'Jarvis');
assert.strictEqual(multi.names.length, 3);

const badChar = parseAndValidateHostWakeNames('Raven!');
assert.strictEqual(badChar.ok, false);

const tooMany = parseAndValidateHostWakeNames('a, b, c, d, e, f');
assert.strictEqual(tooMany.ok, false);

assert.strictEqual(buildDefaultGoingLivePhrase('Jarvis'), 'jarvis we are going live');

// Network allowlist
assert.throws(() => assertAllowedMainProcessFetchUrl('http://api.elevenlabs.io/x'));
assert.throws(() => assertAllowedMainProcessFetchUrl('https://evil.example.com/x'));
const allowed = assertAllowedMainProcessFetchUrl('https://api.elevenlabs.io/v1/voices');
assert.strictEqual(allowed.hostname, 'api.elevenlabs.io');
assertAllowedMainProcessFetchUrl('https://storage.googleapis.com/bucket/preview.mp3');

// Voice preview IPC validation
assert.strictEqual(validateVoicePreviewVoiceId('').ok, false);
assert.strictEqual(validateVoicePreviewVoiceId('21m00Tcm4TlvDq8ikWAM').ok, true);
assert.strictEqual(validateVoicePreviewVoiceId('bad id!').ok, false);

const badUrl = validateVoicePreviewUrl('https://example.com/a.mp3');
assert.strictEqual(badUrl.ok, false);
const goodUrl = validateVoicePreviewUrl('https://storage.googleapis.com/x/y.mp3');
assert.strictEqual(goodUrl.ok, true);

const reqOk = validateVoicePreviewRequest({
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  previewUrl: 'https://storage.googleapis.com/a/b.mp3',
});
assert.strictEqual(reqOk.ok, true);

const reqBad = validateVoicePreviewRequest({ voiceId: 'x' });
assert.strictEqual(reqBad.ok, false);

const sample = buildPreviewSampleLine({ HOST_WAKE_NAMES: 'Nova' });
assert.ok(sample.includes('Nova'));
assert.ok(sample.length <= 100);

// Persistence via AIConfigManager (temp raven.env)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-ai-config-'));
const envPath = path.join(tmpDir, 'raven.env');
fs.writeFileSync(envPath, 'TTS_API_KEY=test\n', 'utf8');

const manager = new AIConfigManager();
manager.envPath = envPath;

const saved = manager.setWakeNames('Echo, Ree');
assert.strictEqual(saved.success, true);
assert.strictEqual(saved.primary, 'Echo');
const disk = fs.readFileSync(envPath, 'utf8');
assert.ok(/HOST_WAKE_NAMES=/.test(disk));
assert.ok(disk.includes('Echo') && disk.includes('Ree'));
const loaded = manager.getWakeNames();
assert.strictEqual(loaded.primary, 'Echo');
assert.deepStrictEqual(loaded.names, ['Echo', 'Ree']);

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('✅ test-ai-config.js passed\n');
