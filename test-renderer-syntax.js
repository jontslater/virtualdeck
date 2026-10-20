#!/usr/bin/env node
/**
 * Parse-check every browser script referenced from public/index.html.
 * A syntax error in any of these files prevents the whole renderer from loading.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = __dirname;
const indexHtml = path.join(repoRoot, 'public', 'index.html');
const html = fs.readFileSync(indexHtml, 'utf8');
const srcRe = /<script\s+src="([^"]+)"/g;
const relPaths = [];
let m;
while ((m = srcRe.exec(html)) !== null) {
  relPaths.push(m[1]);
}
assert.ok(relPaths.length > 0, 'public/index.html must list renderer script tags');

const failures = [];
for (const rel of relPaths) {
  const abs = path.normalize(path.join(repoRoot, 'public', rel));
  if (!fs.existsSync(abs)) {
    failures.push(`${rel}: file missing at ${abs}`);
    continue;
  }
  const result = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    failures.push(`${rel}: ${detail || 'node --check failed'}`);
  }
}

if (failures.length) {
  console.error('❌ Renderer script syntax check failed:\n');
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

console.log(`✅ Renderer syntax OK (${relPaths.length} scripts from public/index.html)`);
