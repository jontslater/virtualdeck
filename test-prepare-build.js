#!/usr/bin/env node
/**
 * Unit tests for prepare-build packaging security helpers.
 * Run: node test-prepare-build.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  envTextHasPopulatedSecrets,
  wouldElectronBuilderInclude,
  scanDirectoryForCredentialFiles,
} = require('./prepare-build');

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
const tmpDir = path.join(__dirname, '.tmp-prepare-build-test');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(
  path.join(tmpDir, 'env.defaults'),
  'LLM_API_KEY=sk-secret-key-should-fail\n',
);
assert.strictEqual(scanDirectoryForCredentialFiles(tmpDir).length, 1, 'populated env.defaults should fail scan');
assert.strictEqual(
  scanDirectoryForCredentialFiles(tmpDir, { allowBundledEnvDefaults: true }).length,
  0,
  'personal build should skip env.defaults secret scan',
);
fs.rmSync(tmpDir, { recursive: true, force: true });

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

const { stripBom, readFileUtf8 } = require('./scripts/raven-staging/read-utf8');
assert.strictEqual(stripBom('\uFEFFhello'), 'hello', 'stripBom removes leading BOM');
assert.strictEqual(stripBom('plain'), 'plain', 'stripBom leaves plain text');
assert.strictEqual(stripBom(''), '', 'stripBom handles empty string');

const bomTmp = path.join(__dirname, '.tmp-raven-staging-bom');
fs.rmSync(bomTmp, { recursive: true, force: true });
fs.mkdirSync(bomTmp, { recursive: true });
const bomRewrites = path.join(bomTmp, 'rewrites.json');
const srcPkg = path.join(bomTmp, 'package.json');
const destPkg = path.join(bomTmp, 'out.json');
fs.writeFileSync(srcPkg, JSON.stringify({ name: 'x', dependencies: { lodash: '1.0.0' } }, null, 2));
fs.writeFileSync(bomRewrites, `\uFEFF${JSON.stringify({ lodash: 'file:./lodash' })}`);
assert.deepStrictEqual(
  JSON.parse(readFileUtf8(bomRewrites)),
  { lodash: 'file:./lodash' },
  'readFileUtf8 parses BOM-prefixed JSON',
);
execSync(
  `node "${path.join(__dirname, 'scripts/raven-staging/write-staged-package-json.js')}" "${srcPkg}" "${destPkg}" "${bomRewrites}"`,
  { stdio: 'pipe' },
);
const outPkg = JSON.parse(fs.readFileSync(destPkg, 'utf8'));
assert.strictEqual(outPkg.dependencies.lodash, 'file:./lodash', 'write-staged-package-json reads BOM rewrites');
fs.rmSync(bomTmp, { recursive: true, force: true });

const {
  workspaceClosure,
  buildDepRewrites,
  orderClosureForStaging,
} = require('./scripts/raven-staging/workspace-packages');
const wsTmp = path.join(__dirname, '.tmp-workspace-packages');
fs.rmSync(wsTmp, { recursive: true, force: true });
fs.mkdirSync(path.join(wsTmp, 'apps/controller'), { recursive: true });
fs.mkdirSync(path.join(wsTmp, 'packages/shared'), { recursive: true });
fs.mkdirSync(path.join(wsTmp, 'packages/director'), { recursive: true });
fs.writeFileSync(
  path.join(wsTmp, 'packages/shared/package.json'),
  JSON.stringify({ name: '@ai-streamer/shared', version: '0.0.0', dependencies: {} }),
);
fs.writeFileSync(
  path.join(wsTmp, 'packages/director/package.json'),
  JSON.stringify({
    name: '@ai-streamer/director',
    version: '0.0.0',
    dependencies: { '@ai-streamer/shared': 'workspace:*' },
  }),
);
fs.writeFileSync(
  path.join(wsTmp, 'apps/controller/package.json'),
  JSON.stringify({
    name: '@ai-streamer/controller',
    version: '0.0.0',
    dependencies: {
      '@ai-streamer/director': 'workspace:*',
      '@ai-streamer/shared': 'workspace:*',
    },
  }),
);
const controllerDir = path.join(wsTmp, 'apps/controller');
const { closureRels } = workspaceClosure(wsTmp, controllerDir, {
  omitFromResult: ['apps/controller', 'packages/integrations/virtualdeck'],
});
assert.deepStrictEqual(closureRels, ['packages/shared', 'packages/director']);
const ordered = orderClosureForStaging(wsTmp, closureRels);
assert.deepStrictEqual(ordered[0], 'packages/shared', 'shared must stage before director');
const rewrites = buildDepRewrites(wsTmp, 'apps/controller', closureRels);
assert.strictEqual(rewrites['@ai-streamer/shared'], 'file:../../packages/shared');
assert.strictEqual(rewrites['@ai-streamer/director'], 'file:../../packages/director');
fs.rmSync(wsTmp, { recursive: true, force: true });

console.log('✅ test-prepare-build.js passed');
