#!/usr/bin/env node
/**
 * Patch staged extra/raven/sidecar.js so env file reads strip a leading UTF-8 BOM.
 * Idempotent; no-op when sidecar has no applyEnvFile or is already patched.
 */

const fs = require('fs');

const MARKER = '// VirtualDeck: UTF-8 BOM-safe env file reads';

function patchSidecarEnvBom(source) {
  if (!source.includes('applyEnvFile')) {
    return source;
  }
  const applyIdx = source.indexOf('function applyEnvFile');
  const applySlice = source.slice(applyIdx, applyIdx + 4000);
  if (
    applySlice.includes(MARKER) ||
    applySlice.includes('__vdStripEnvBom') ||
    applySlice.includes('0xfeff')
  ) {
    return source;
  }

  let out = source;
  if (!out.includes(MARKER)) {
    out = `${MARKER}\nfunction __vdStripEnvBom(t) {\n  return t && t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;\n}\n\n${out}`;
  }

  const fnIdx = out.indexOf('function applyEnvFile');
  if (fnIdx >= 0) {
    const tail = out.slice(fnIdx);
    const patchedTail = tail.replace(
      /(const|let|var)\s+(\w+)\s*=\s*fs\.readFileSync\(([^)]+)\)/,
      '$1 $2 = __vdStripEnvBom(fs.readFileSync($3))',
    );
    if (patchedTail !== tail) {
      out = out.slice(0, fnIdx) + patchedTail;
    }
  }

  if (out.includes('function parseEnv(') && !out.includes('__vdStripEnvBom(String')) {
    out = out.replace(
      /function parseEnv\s*\(\s*(\w+)\s*\)\s*\{/,
      'function parseEnv($1) {\n  $1 = __vdStripEnvBom(String($1 || \'\'));',
    );
  }

  return out;
}

function main() {
  const target = process.argv[2];
  if (!target || !fs.existsSync(target)) {
    process.exit(0);
  }
  const original = fs.readFileSync(target, 'utf8');
  const patched = patchSidecarEnvBom(original);
  if (patched !== original) {
    fs.writeFileSync(target, patched, 'utf8');
  }
}

if (require.main === module) {
  main();
}

module.exports = { patchSidecarEnvBom };
