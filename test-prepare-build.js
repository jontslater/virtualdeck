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

const { stripBom, readFileUtf8 } = require('./lib/read-utf8');
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
for (const line of stagePs1.split(/\r?\n/)) {
  if (!/Get-Content/.test(line)) continue;
  if (!/-Raw/.test(line)) continue;
  assert.ok(
    /-Encoding\s/.test(line),
    `stage-raven-runtime.ps1 must not use Get-Content -Raw without -Encoding (use Read-TextFileUtf8NoBom): ${line.trim()}`,
  );
}
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
  parseEnvLikeRavenHost,
  unescapeQuotedEnvValue,
  dotEnvMapHasBundleableKeys,
  shouldIncludePersonalEnvEntry,
  getSkipReasonForEntry,
} = require('./scripts/raven-staging/merge-env-defaults');

assert.strictEqual(unescapeQuotedEnvValue('a\\nb'), 'a\nb', '\\n becomes newline in unescape helper');
assert.strictEqual(unescapeQuotedEnvValue('\\x'), 'x', '\\x becomes x');

const mergeTemplate = `# header
LLM_API_KEY=
TTS_API_KEY=
LLM_MODEL=gpt-4
`;

const denyRoots = ['E:\\AIChatBot', 'C:\\Users\\dev\\AppData\\Local\\Temp'];

const bulkSource = [
  'NEWS_API_KEY=news-secret',
  'OPENWEATHER_API_KEY=wx-secret',
  'OMDB_API_KEY=omdb-secret',
  'LLM_API_KEY=llm-secret',
  'PERSONA_SPEAKING_STYLE=dry wit',
  'LLM_MODEL_FAST=gpt-4o-mini',
  'TTS_OUTPUT_DEVICE=Speakers',
  'COMPUTERNAME=SHOULD-NOT-BUNDLE',
  'PATH=C:\\Windows\\System32',
  'RAVEN_ENV_PATH=C:\\secret\\raven.env',
  'EMPTY_KEY=',
].join('\n');

const { merged: mergedExtra, skipped: skippedExtra } = mergeEnvDefaultsWithSource(
  mergeTemplate,
  `${bulkSource}\n`,
  { denyPathRoots: denyRoots },
);
assert.ok(mergedExtra.includes('LLM_API_KEY=llm-secret'), 'template LLM_API_KEY should be overridden');
assert.ok(mergedExtra.includes('NEWS_API_KEY=news-secret'), 'extra NEWS_API_KEY should be appended');
assert.ok(mergedExtra.includes('PERSONA_SPEAKING_STYLE=dry wit'), 'persona settings should be appended verbatim');
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

const aliasSource = 'OPENAI_API_KEY=openai-alias\n';
const { merged: mergedAlias } = mergeEnvDefaultsWithSource(mergeTemplate, aliasSource);
assert.ok(mergedAlias.includes('LLM_API_KEY=openai-alias'), 'OPENAI_API_KEY should map to LLM_API_KEY');
assert.ok(!mergedAlias.includes('OPENAI_API_KEY='), 'alias should not be duplicated at end');

const roundTripSource = [
  'LLM_API_KEY=sk-test',
  'AI_PERSONALITY_PROMPT="Be kind # not sarcastic"',
  "SINGLE_QUOTED='say # quietly'",
  'WIN_PATH=D:\\Music',
  'SAY_HI=say "hi"',
  'ESCAPED_INLINE="a\\nb"',
  'MULTILINE_BLOCK="line one',
  'line two"',
].join('\n');

const roundTripTmp = path.join(__dirname, '.tmp-merge-roundtrip');
fs.rmSync(roundTripTmp, { recursive: true, force: true });
fs.mkdirSync(roundTripTmp, { recursive: true });
const roundTripSourcePath = path.join(roundTripTmp, 'source.env');
const roundTripOutPath = path.join(roundTripTmp, 'merged.env');
fs.writeFileSync(roundTripSourcePath, `${roundTripSource}\n`, 'utf8');

const { merged: mergedRoundTrip, warnings: multilineWarnings } = mergeEnvDefaultsWithSource(
  mergeTemplate,
  fs.readFileSync(roundTripSourcePath, 'utf8'),
  { denyPathRoots: [] },
);
fs.writeFileSync(roundTripOutPath, mergedRoundTrip, 'utf8');

const sourceParsed = parseEnvLikeRavenHost(fs.readFileSync(roundTripSourcePath, 'utf8'));
const mergedParsed = parseEnvLikeRavenHost(fs.readFileSync(roundTripOutPath, 'utf8'));
for (const key of [
  'LLM_API_KEY',
  'AI_PERSONALITY_PROMPT',
  'SINGLE_QUOTED',
  'WIN_PATH',
  'SAY_HI',
  'ESCAPED_INLINE',
]) {
  assert.strictEqual(
    mergedParsed[key],
    sourceParsed[key],
    `raven-host parseEnv round-trip for ${key}`,
  );
}
assert.ok(
  mergedRoundTrip.includes('WIN_PATH=D:\\Music'),
  'Windows paths must not gain extra backslashes',
);
assert.ok(
  mergedRoundTrip.includes('AI_PERSONALITY_PROMPT="Be kind # not sarcastic"'),
  'quoted hash prompt copied verbatim',
);
assert.ok(mergedRoundTrip.includes('MULTILINE_BLOCK="line one'), 'multiline block copied verbatim');
assert.ok(
  multilineWarnings.some((w) => w.key === 'MULTILINE_BLOCK'),
  'multiline keys should emit warnings',
);
fs.rmSync(roundTripTmp, { recursive: true, force: true });

const quotedSource = 'AI_PERSONALITY_PROMPT="Be kind # not sarcastic"\nMULTILINE_PROMPT="line one\nline two"\n';
const parsedQuoted = parseDotEnvText(quotedSource);
assert.strictEqual(
  parsedQuoted.AI_PERSONALITY_PROMPT,
  'Be kind # not sarcastic',
  'hash inside double quotes should be preserved in parseDotEnvText',
);
assert.strictEqual(
  parsedQuoted.MULTILINE_PROMPT,
  'line one\nline two',
  'multiline double-quoted values should parse in parseDotEnvText',
);

assert.strictEqual(
  dotEnvMapHasBundleableKeys('PERSONA_NAME=Raven\n', mergeTemplate),
  true,
  'personal settings detection includes persona fields',
);
assert.strictEqual(
  dotEnvMapHasBundleableKeys('COMPUTERNAME=PC\n', mergeTemplate),
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

const bomMergeTmp = path.join(__dirname, '.tmp-merge-bom-utf8');
fs.rmSync(bomMergeTmp, { recursive: true, force: true });
fs.mkdirSync(bomMergeTmp, { recursive: true });
const bomSourcePath = path.join(bomMergeTmp, 'source.env');
const bomOutPath = path.join(bomMergeTmp, 'merged.env');
const bomBody = 'RAVEN_VOICE_ONLY=1\nPERSONA_NOTE=café — naïve ✨\n';
fs.writeFileSync(bomSourcePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(bomBody, 'utf8')]));
const { merged: bomMerged } = mergeEnvDefaultsWithSource(
  'RAVEN_VOICE_ONLY=\nPERSONA_NOTE=\n',
  fs.readFileSync(bomSourcePath, 'utf8'),
);
fs.writeFileSync(bomOutPath, bomMerged, 'utf8');
assert.ok(!bomMerged.startsWith('\uFEFF'), 'merged env.defaults must not start with BOM');
assert.ok(bomMerged.includes('RAVEN_VOICE_ONLY=1'), 'BOM-prefixed RAVEN_VOICE_ONLY must merge');
assert.ok(bomMerged.includes('café — naïve ✨'), 'UTF-8 persona text must survive merge');
const bomParsed = parseEnvLikeRavenHost(bomMerged);
assert.strictEqual(bomParsed.RAVEN_VOICE_ONLY, '1', 'RAVEN_VOICE_ONLY parsed after BOM source');
assert.strictEqual(bomParsed.PERSONA_NOTE, 'café — naïve ✨');
fs.rmSync(bomMergeTmp, { recursive: true, force: true });

const { patchSidecarEnvBom } = require('./scripts/raven-staging/patch-sidecar-env-bom');
const sampleSidecar = [
  'function applyEnvFile(path) {',
  "  const raw = fs.readFileSync(path, 'utf8');",
  '  return raw;',
  '}',
  'function parseEnv(text) { return text; }',
].join('\n');
const patchedSidecar = patchSidecarEnvBom(sampleSidecar);
assert.ok(patchedSidecar.includes('__vdStripEnvBom'), 'sidecar patch should inject BOM helper');
assert.ok(patchedSidecar.includes('__vdStripEnvBom(fs.readFileSync'), 'applyEnvFile read should be wrapped');

const nativeNodeLines = stagePs1.split(/\r?\n/).filter((line) => /&\s+\$(NodeExe|node)\b/.test(line));
for (const line of nativeNodeLines) {
  if (line.includes('workspace-packages.js') && line.includes('rewrites')) {
    assert.ok(
      line.includes('ClosureFilePath') || line.includes('$ClosureFilePath'),
      'rewrites must use closure file path, not inline JSON',
    );
  }
}

const LOCAL_REQUIRE_RE = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function resolveLocalModule(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function collectTransitiveLocalRequires(entryFile) {
  const repoRoot = path.resolve(__dirname);
  const seen = new Set();
  const files = [];
  const queue = [path.resolve(entryFile)];
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    assert.ok(fs.existsSync(file), `main process require graph references missing file: ${file}`);
    files.push(file);
    const text = fs.readFileSync(file, 'utf8');
    LOCAL_REQUIRE_RE.lastIndex = 0;
    let match = LOCAL_REQUIRE_RE.exec(text);
    while (match) {
      const resolved = resolveLocalModule(file, match[1]);
      if (
        resolved &&
        resolved.startsWith(`${repoRoot}${path.sep}`) &&
        !resolved.includes(`${path.sep}node_modules${path.sep}`)
      ) {
        queue.push(resolved);
      }
      match = LOCAL_REQUIRE_RE.exec(text);
    }
  }
  return files;
}

const mainProcessGraph = collectTransitiveLocalRequires(path.join(__dirname, 'main.js'));
for (const absPath of mainProcessGraph) {
  const rel = path.relative(__dirname, absPath).replace(/\\/g, '/');
  assert.ok(
    wouldElectronBuilderInclude(rel),
    `main process dependency must match package.json build.files: ${rel}`,
  );
  assert.ok(!rel.startsWith('scripts/'), `main process must not require scripts/: ${rel}`);
}
const { copyTreeSync, copyFileSyncSafe } = require('./lib/copy-tree-sync');
const copyTmp = path.join(__dirname, '.tmp-copy-tree-sync');
fs.rmSync(copyTmp, { recursive: true, force: true });
const copySrcRoot = path.join(copyTmp, 'src');
const copyDestRoot = path.join(copyTmp, 'dest');
fs.mkdirSync(path.join(copySrcRoot, 'skins', 'nested'), { recursive: true });
fs.writeFileSync(path.join(copySrcRoot, 'skins', 'theme.json'), '{"name":"test"}', 'utf8');
fs.writeFileSync(path.join(copySrcRoot, 'skins', 'nested', 'note.txt'), 'hello', 'utf8');
fs.writeFileSync(path.join(copySrcRoot, 'config.json'), '{}', 'utf8');
copyFileSyncSafe(path.join(copySrcRoot, 'config.json'), path.join(copyDestRoot, 'config.json'));
copyTreeSync(path.join(copySrcRoot, 'skins'), path.join(copyDestRoot, 'skins'));
assert.ok(fs.existsSync(path.join(copyDestRoot, 'config.json')), 'copyFileSyncSafe should copy a file');
assert.ok(
  fs.existsSync(path.join(copyDestRoot, 'skins', 'nested', 'note.txt')),
  'copyTreeSync should copy nested files',
);
assert.strictEqual(
  fs.readFileSync(path.join(copyDestRoot, 'skins', 'nested', 'note.txt'), 'utf8'),
  'hello',
);
fs.rmSync(copyTmp, { recursive: true, force: true });

// Each ipcMain.handle channel may be registered only once (a second handle() throws at runtime).
{
  const mainJsText = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const handleRe = /ipcMain\.handle(?:Once)?\(\s*(['"`])([^'"`]+)\1/g;
  const channelLines = new Map();
  let handleMatch;
  while ((handleMatch = handleRe.exec(mainJsText)) !== null) {
    const line = mainJsText.slice(0, handleMatch.index).split('\n').length;
    const list = channelLines.get(handleMatch[2]) || [];
    list.push(line);
    channelLines.set(handleMatch[2], list);
  }
  assert.ok(channelLines.size > 0, 'expected ipcMain.handle registrations in main.js');
  const duplicateChannels = [...channelLines.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([name, lines]) => `${name} (lines ${lines.join(', ')})`);
  assert.deepStrictEqual(
    duplicateChannels,
    [],
    `ipcMain.handle channels registered more than once in main.js: ${duplicateChannels.join('; ')}`,
  );
}

const {
  getExtraRavenKeepRelPaths,
  listStaleTopLevelStageEntries,
  assertExtraRavenStageDir,
} = require('./scripts/raven-staging/extra-raven-keep-paths');

const keepFromGit = getExtraRavenKeepRelPaths(__dirname);
assert.ok(keepFromGit.includes('README.md'), 'keep list should include README.md');
assert.ok(keepFromGit.includes('env.defaults'), 'keep list should include env.defaults');

const stageCleanTmp = path.join(__dirname, '.tmp-extra-raven-clean');
fs.rmSync(stageCleanTmp, { recursive: true, force: true });
const fakeRepo = path.join(stageCleanTmp, 'repo');
const fakeStage = path.join(fakeRepo, 'extra', 'raven');
fs.mkdirSync(path.join(fakeStage, 'app', 'apps', 'hud'), { recursive: true });
fs.mkdirSync(path.join(fakeStage, 'ffmpeg'), { recursive: true });
fs.writeFileSync(path.join(fakeStage, 'README.md'), '# tracked', 'utf8');
fs.writeFileSync(path.join(fakeStage, 'env.defaults'), 'LLM_API_KEY=\n', 'utf8');
fs.writeFileSync(path.join(fakeStage, 'README.txt'), 'stale', 'utf8');
fs.writeFileSync(path.join(fakeStage, 'app', 'trivia-questions.json'), '[]', 'utf8');
assert.throws(
  () => assertExtraRavenStageDir(fakeStage, path.join(fakeRepo, 'extra', 'evil')),
  /Refusing to clean outside extra\/raven/,
);
const stale = listStaleTopLevelStageEntries(fakeStage, keepFromGit);
assert.deepStrictEqual(
  stale.sort(),
  ['app', 'ffmpeg', 'README.txt'].sort(),
  'stale top-level entries should exclude git-tracked files only',
);
assert.ok(!stale.includes('README.md'));
assert.ok(!stale.includes('env.defaults'));
fs.rmSync(stageCleanTmp, { recursive: true, force: true });

const stagePs1Clean = fs.readFileSync(path.join(__dirname, 'scripts/stage-raven-runtime.ps1'), 'utf8');
assert.ok(
  stagePs1Clean.includes('Clear-StaleRavenStageOutput'),
  'stage script should clear stale output before staging',
);
assert.ok(
  stagePs1Clean.includes('Assert-ExtraRavenStageDirectory'),
  'stage clean must refuse paths outside extra/raven',
);

console.log('✅ test-prepare-build.js passed');
