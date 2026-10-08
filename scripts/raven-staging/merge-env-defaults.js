#!/usr/bin/env node
/**
 * Merge personal-build API keys into extra/raven/env.defaults template.
 * Used by stage-raven-runtime.ps1 (-BundleKeys) and test-prepare-build.js.
 */

const fs = require('fs');
const path = require('path');

const BUNDLEABLE_SUFFIX_RE = /(_API_KEY|_SECRET|_TOKEN|_ID|_KEY)$/;

const ENV_KEY_ALIASES = {
  OPENAI_API_KEY: 'LLM_API_KEY',
  ELEVENLABS_API_KEY: 'TTS_API_KEY',
};

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function getTemplateEnvKeys(templateText) {
  const keys = [];
  for (const raw of String(templateText || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^\s*([^=\s#]+)\s*=/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function isBundleableEnvKey(key, templateKeys) {
  const templateSet = templateKeys instanceof Set ? templateKeys : new Set(templateKeys);
  if (templateSet.has(key)) return true;
  return BUNDLEABLE_SUFFIX_RE.test(key);
}

function formatEnvValueForFile(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[\s#;"\\]/.test(str) || /^\s|\s$/.test(str)) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

function parseDotEnvText(text) {
  const map = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const hash = val.indexOf(' #');
    if (hash >= 0) val = val.slice(0, hash).trim();
    if (val.length >= 2) {
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
    }
    map[key] = val;
  }
  return map;
}

function dotEnvMapHasBundleableKeys(sourceMap, templateText) {
  const templateKeys = getTemplateEnvKeys(templateText);
  for (const [key, val] of Object.entries(sourceMap || {})) {
    if (isBlank(val)) continue;
    if (isBundleableEnvKey(key, templateKeys)) return true;
  }
  return false;
}

function mergeEnvDefaultsWithSource(templateText, sourceMap) {
  const templateKeys = getTemplateEnvKeys(templateText);
  const templateKeySet = new Set(templateKeys);
  const overlay = {};

  for (const [alias, target] of Object.entries(ENV_KEY_ALIASES)) {
    if (!isBlank(sourceMap[alias])) {
      if (isBlank(sourceMap[target])) {
        overlay[target] = sourceMap[alias];
      }
    }
  }

  for (const key of templateKeys) {
    if (!isBlank(sourceMap[key])) {
      overlay[key] = sourceMap[key];
    }
  }

  const extraKeys = [];
  for (const key of Object.keys(sourceMap || {}).sort()) {
    if (templateKeySet.has(key)) continue;
    if (isBlank(sourceMap[key])) continue;
    if (Object.prototype.hasOwnProperty.call(ENV_KEY_ALIASES, key)) continue;
    if (!isBundleableEnvKey(key, templateKeySet)) continue;
    extraKeys.push(key);
    overlay[key] = sourceMap[key];
  }

  const lines = [];
  for (const raw of String(templateText || '').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#') || raw.indexOf('=') < 1) {
      lines.push(raw);
      continue;
    }
    const eq = raw.indexOf('=');
    const key = raw.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(overlay, key)) {
      lines.push(`${key}=${formatEnvValueForFile(overlay[key])}`);
    } else {
      lines.push(raw);
    }
  }

  if (extraKeys.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push('# ===== Additional bundled keys (personal build) =====');
    for (const key of extraKeys) {
      lines.push(`${key}=${formatEnvValueForFile(overlay[key])}`);
    }
  }

  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const [cmd, arg1, arg2, arg3] = process.argv.slice(2);
  if (cmd === 'merge') {
    const templatePath = arg1;
    const sourcePath = arg2;
    const outPath = arg3;
    if (!templatePath || !sourcePath) {
      console.error('Usage: merge-env-defaults.js merge <template.env> <source.env> [out.env]');
      process.exit(2);
    }
    const merged = mergeEnvDefaultsWithSource(
      readUtf8(templatePath),
      parseDotEnvText(readUtf8(sourcePath)),
    );
    if (outPath) {
      fs.writeFileSync(outPath, merged, 'utf8');
    } else {
      process.stdout.write(merged);
    }
    return;
  }
  if (cmd === 'has-bundleable') {
    const sourcePath = arg1;
    const templatePath = arg2;
    if (!sourcePath || !templatePath) {
      console.error('Usage: merge-env-defaults.js has-bundleable <source.env> <template.env>');
      process.exit(2);
    }
    const ok = dotEnvMapHasBundleableKeys(
      parseDotEnvText(readUtf8(sourcePath)),
      readUtf8(templatePath),
    );
    process.exit(ok ? 0 : 1);
  }
  console.error('Unknown command. Use merge or has-bundleable.');
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  BUNDLEABLE_SUFFIX_RE,
  ENV_KEY_ALIASES,
  getTemplateEnvKeys,
  isBundleableEnvKey,
  formatEnvValueForFile,
  parseDotEnvText,
  dotEnvMapHasBundleableKeys,
  mergeEnvDefaultsWithSource,
};
