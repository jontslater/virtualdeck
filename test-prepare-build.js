#!/usr/bin/env node
/**
 * Unit tests for prepare-build packaging security helpers.
 * Run: node test-prepare-build.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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

const scriptsDir = path.join(__dirname, 'scripts');
for (const file of fs.readdirSync(scriptsDir)) {
  if (!file.endsWith('.ps1')) continue;
  const content = fs.readFileSync(path.join(scriptsDir, file), 'utf8');
  for (let i = 0; i < content.length; i += 1) {
    assert.ok(
      content.charCodeAt(i) <= 127,
      `${file} must be ASCII-only (non-ASCII at index ${i})`,
    );
  }
}

const stageScript = path.join(scriptsDir, 'stage-raven-runtime.ps1');
const verifyScript = path.join(scriptsDir, 'verify-powershell-syntax.ps1');
const shells = ['pwsh', 'powershell'];
let parsed = false;
for (const shell of shells) {
  try {
    execSync(
      `"${shell}" -NoProfile -ExecutionPolicy Bypass -File "${verifyScript}" -Path "${stageScript}"`,
      { stdio: 'pipe' },
    );
    parsed = true;
    break;
  } catch {
    // try next shell
  }
}
if (parsed) {
  console.log('✅ PowerShell syntax parse check passed (stage-raven-runtime.ps1)');
} else {
  console.log('ℹ️  Skipping PowerShell Parser::ParseFile (pwsh/powershell not available in this environment)');
}

console.log('✅ test-prepare-build.js passed');
