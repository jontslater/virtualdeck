#!/usr/bin/env node
/**
 * Unit tests for prepare-build packaging security helpers.
 * Run: node test-prepare-build.js
 */

const assert = require('assert');
const { envTextHasPopulatedSecrets, wouldElectronBuilderInclude } = require('./prepare-build');

const template = `
LLM_API_KEY=
TTS_API_KEY=
LLM_MODEL=gpt-4
`;

assert.strictEqual(envTextHasPopulatedSecrets(template), false, 'empty key lines should pass');

const crlfTemplate = 'LLM_API_KEY=\r\nTTS_API_KEY=\r\nLLM_MODEL=gpt-4\r\n';
assert.strictEqual(envTextHasPopulatedSecrets(crlfTemplate), false, 'CRLF empty keys should pass');

assert.strictEqual(
  envTextHasPopulatedSecrets('LLM_API_KEY=sk-proj-real-secret-key\n'),
  true,
  'real sk- key should fail',
);

assert.strictEqual(
  envTextHasPopulatedSecrets('TTS_API_KEY=your-key-here\n'),
  false,
  'placeholder should pass',
);

assert.strictEqual(wouldElectronBuilderInclude('.env'), false, '.env must not be in files list');
assert.strictEqual(wouldElectronBuilderInclude('main.js'), true, 'main.js is bundled');
assert.strictEqual(
  wouldElectronBuilderInclude('twitch-oauth-config.js'),
  false,
  'twitch oauth config must not be bundled',
);

console.log('✅ test-prepare-build.js passed');
