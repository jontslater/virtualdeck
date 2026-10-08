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
const closureListFile = path.join(wsTmp, 'closure-list.json');
fs.writeFileSync(closureListFile, `\uFEFF${JSON.stringify(closureRels)}`);
const rewritesCli = execSync(
  `node "${path.join(__dirname, 'scripts/raven-staging/workspace-packages.js')}" rewrites "${wsTmp}" apps/controller "${closureListFile}"`,
  { encoding: 'utf8' },
).trim();
const fromFile = JSON.parse(rewritesCli);
assert.strictEqual(fromFile['@ai-streamer/shared'], 'file:../../packages/shared');
fs.rmSync(wsTmp, { recursive: true, force: true });

const stagePs1 = fs.readFileSync(stageScript, 'utf8');
const nativeJsonArgPatterns = [
  /&\s+\$NodeExe[^\n`]*ConvertTo-Json/i,
  /&\s+\$node[^\n`]*ConvertTo-Json/i,
  /workspace-packages\.js\s+'rewrites'[^\n]*ClosureJson/i,
  /'rewrites'[^\n]*\$ClosureJson/i,
];
for (const pattern of nativeJsonArgPatterns) {
  assert.ok(!pattern.test(stagePs1), `stage-raven-runtime.ps1 must not pass JSON to native node (${pattern})`);
}

const {
  mergeEnvDefaultsWithSource,
  parseDotEnvText,
  dotEnvMapHasBundleableKeys,
  shouldIncludePersonalEnvEntry,
  getSkipReasonForEntry,
} = require('./scripts/raven-staging/merge-env-defaults');

const mergeTemplate = `# header
LLM_API_KEY=
TTS_API_KEY=
LLM_MODEL=gpt-4
`;

const denyRoots = ['E:\\AIChatBot', 'C:\\Users\\dev\\AppData\\Local\\Temp'];

const { merged: mergedExtra, skipped: skippedExtra } = mergeEnvDefaultsWithSource(
  mergeTemplate,
  {
    NEWS_API_KEY: 'news-secret',
    OPENWEATHER_API_KEY: 'wx-secret',
    OMDB_API_KEY: 'omdb-secret',
    LLM_API_KEY: 'llm-secret',
    PERSONA_SPEAKING_STYLE: 'dry wit',
    LLM_MODEL_FAST: 'gpt-4o-mini',
    TTS_OUTPUT_DEVICE: 'Speakers',
    COMPUTERNAME: 'SHOULD-NOT-BUNDLE',
    PATH: 'C:\\Windows\\System32',
    RAVEN_ENV_PATH: 'C:\\secret\\raven.env',
    EMPTY_KEY: '',
  },
  { denyPathRoots: denyRoots },
);
assert.ok(mergedExtra.includes('LLM_API_KEY=llm-secret'), 'template LLM_API_KEY should be overridden');
assert.ok(mergedExtra.includes('NEWS_API_KEY=news-secret'), 'extra NEWS_API_KEY should be appended');
assert.ok(
  mergedExtra.includes('PERSONA_SPEAKING_STYLE="dry wit"'),
  'persona settings should be appended',
);
assert.ok(mergedExtra.includes('LLM_MODEL_FAST=gpt-4o-mini'), 'model overrides should be bundled');
assert.ok(!mergedExtra.includes('COMPUTERNAME'), 'machine env keys should be excluded');
assert.ok(!mergedExtra.includes('PATH='), 'PATH should be excluded');
assert.ok(!mergedExtra.includes('RAVEN_ENV_PATH'), 'RAVEN_ENV_PATH should be excluded');
assert.ok(!mergedExtra.includes('EMPTY_KEY'), 'blank values should be skipped');
assert.ok(
  skippedExtra.some((s) => s.key === 'COMPUTERNAME'),
  'skipped list should include denied machine keys',
);
assert.ok(mergedExtra.indexOf('# header') < mergedExtra.indexOf('LLM_API_KEY=llm-secret'), 'template order preserved');

const { merged: mergedAlias } = mergeEnvDefaultsWithSource(mergeTemplate, { OPENAI_API_KEY: 'openai-alias' });
assert.ok(mergedAlias.includes('LLM_API_KEY=openai-alias'), 'OPENAI_API_KEY should map to LLM_API_KEY');
assert.ok(!mergedAlias.includes('OPENAI_API_KEY='), 'alias should not be duplicated at end');

const quotedSource = 'AI_PERSONALITY_PROMPT="Be kind # not sarcastic"\nMULTILINE_PROMPT="line one\nline two"\n';
const parsedQuoted = parseDotEnvText(quotedSource);
assert.strictEqual(
  parsedQuoted.AI_PERSONALITY_PROMPT,
  'Be kind # not sarcastic',
  'hash inside double quotes should be preserved',
);
assert.strictEqual(parsedQuoted.MULTILINE_PROMPT, 'line one\nline two', 'multiline double-quoted values should parse');

const { merged: mergedRoundTrip } = mergeEnvDefaultsWithSource(
  'LLM_API_KEY=\n',
  parsedQuoted,
);
assert.ok(
  mergedRoundTrip.includes('AI_PERSONALITY_PROMPT="Be kind # not sarcastic"'),
  'quoted prompt with hash should round-trip',
);
assert.ok(mergedRoundTrip.includes('MULTILINE_PROMPT="line one\\nline two"'), 'multiline prompt should round-trip escaped');

assert.strictEqual(
  dotEnvMapHasBundleableKeys({ PERSONA_NAME: 'Raven' }, mergeTemplate),
  true,
  'personal settings detection includes persona fields',
);
assert.strictEqual(
  dotEnvMapHasBundleableKeys({ COMPUTERNAME: 'PC' }, mergeTemplate),
  false,
  'personal settings detection ignores denied machine vars',
);
assert.strictEqual(
  getSkipReasonForEntry('PATH', 'C:\\Windows', denyRoots),
  'denied-env-key',
);
assert.strictEqual(
  getSkipReasonForEntry('CUSTOM_ROOT', 'E:\\AIChatBot\\apps\\controller', denyRoots),
  'denied-dev-path',
);
assert.strictEqual(
  shouldIncludePersonalEnvEntry('STREAMER_DEV_USERS', 'jont', denyRoots),
  true,
);
const nativeNodeLines = stagePs1.split(/\r?\n/).filter((line) => /&\s+\$(NodeExe|node)\b/.test(line));
for (const line of nativeNodeLines) {
  if (line.includes('workspace-packages.js') && line.includes('rewrites')) {
    assert.ok(
      line.includes('ClosureFilePath') || line.includes('$ClosureFilePath'),
      'rewrites must use closure file path, not inline JSON',
    );
  }
}

console.log('✅ test-prepare-build.js passed');
