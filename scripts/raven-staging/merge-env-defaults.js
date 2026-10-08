#!/usr/bin/env node
/**
 * Merge personal-build settings into extra/raven/env.defaults template.
 * Used by stage-raven-runtime.ps1 (-BundleKeys) and test-prepare-build.js.
 */

const fs = require('fs');
const path = require('path');

const ENV_KEY_ALIASES = {
  OPENAI_API_KEY: 'LLM_API_KEY',
  ELEVENLABS_API_KEY: 'TTS_API_KEY',
};

/** Env var names that must never ship in a personal installer. */
const DENIED_ENV_KEYS = new Set([
  'RAVEN_ENV_PATH',
  'RAVEN_ENV_FILE',
  'APPDATA',
  'LOCALAPPDATA',
  'USERPROFILE',
  'USERNAME',
  'USERDOMAIN',
  'USERDOMAIN_ROAMINGPROFILE',
  'COMPUTERNAME',
  'HOSTNAME',
  'PATH',
  'PATHEXT',
  'PSMODULEPATH',
  'WINDIR',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'HOMEDRIVE',
  'HOMEPATH',
  'TEMP',
  'TMP',
  'OS',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'PROCESSOR_ARCHITECTURE',
  'PROCESSOR_IDENTIFIER',
  'NUMBER_OF_PROCESSORS',
  'PUBLIC',
  'SESSIONNAME',
  'LOGONSERVER',
  'ALLUSERSPROFILE',
  'COMMONPROGRAMFILES',
  'COMMONPROGRAMFILES(X86)',
  'COMSPEC',
  'DRIVERDATA',
  'ONEDRIVE',
  'ONEDRIVECONSUMER',
  'ONEDRIVECOMMERCIAL',
]);

const SECRET_KEY_NAME_RE = /(_API_KEY|_SECRET|_TOKEN|_KEY)$/i;

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

function isSecretEnvKeyName(key) {
  return SECRET_KEY_NAME_RE.test(key);
}

function loadDenyPathRoots(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeWinPathForCompare(p) {
  return path.win32.normalize(String(p)).replace(/\//g, '\\').toLowerCase();
}

function isGenericTempAbsolutePath(normalizedPath) {
  return (
    normalizedPath.includes('\\appdata\\local\\temp\\') ||
    normalizedPath.includes('\\appdata\\local\\temp') ||
    /\\temp\\[^\\]*$/i.test(normalizedPath)
  );
}

function valueContainsDeniedAbsolutePath(value, denyRoots) {
  const str = String(value);
  const parts = str.includes(';') ? str.split(';') : [str];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (!/^[A-Za-z]:[\\/]/.test(trimmed) && !/^\\\\/.test(trimmed)) continue;
    const norm = normalizeWinPathForCompare(trimmed);
    if (isGenericTempAbsolutePath(norm)) return true;
    for (const root of denyRoots) {
      const r = normalizeWinPathForCompare(root);
      if (!r) continue;
      if (norm === r || norm.startsWith(`${r}\\`)) return true;
    }
  }
  return false;
}

function getSkipReasonForEntry(key, value, denyRoots) {
  if (DENIED_ENV_KEYS.has(key)) return 'denied-env-key';
  if (valueContainsDeniedAbsolutePath(value, denyRoots)) return 'denied-dev-path';
  return null;
}

function shouldIncludePersonalEnvEntry(key, value, denyRoots) {
  if (isBlank(value)) return false;
  return !getSkipReasonForEntry(key, value, denyRoots);
}

/** @deprecated use shouldIncludePersonalEnvEntry */
function isBundleableEnvKey(key) {
  return shouldIncludePersonalEnvEntry(key, '1', []);
}

function formatEnvValueForFile(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[\s#;"\\]/.test(str) || /^\s|\s$/.test(str) || str.includes('\n') || str.includes('\r')) {
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r\n/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\n');
    return `"${escaped}"`;
  }
  return str;
}

function unescapeQuotedEnvValue(content) {
  return content
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function parseInlineQuotedDouble(valuePart) {
  const trimmed = valuePart.trimStart();
  if (!trimmed.startsWith('"')) return null;
  let i = 1;
  let out = '';
  while (i < trimmed.length) {
    const ch = trimmed[i];
    if (ch === '\\' && i + 1 < trimmed.length) {
      out += trimmed[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      return { value: unescapeQuotedEnvValue(out), rest: trimmed.slice(i + 1) };
    }
    out += ch;
    i += 1;
  }
  return { value: unescapeQuotedEnvValue(out), rest: '', open: true };
}

/**
 * Parse .env text the way raven-host parseEnv does, plus multiline double-quoted values.
 */
function parseDotEnvText(text) {
  const map = {};
  const lines = String(text || '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    i += 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let valuePart = line.slice(eq + 1);

    const inlineQuote = parseInlineQuotedDouble(valuePart);
    if (inlineQuote) {
      if (!inlineQuote.open) {
        map[key] = inlineQuote.value;
        continue;
      }
      let content = valuePart.trimStart().slice(1);
      while (i < lines.length) {
        const combined = parseInlineQuotedDouble(`"${content}`);
        if (combined && !combined.open) {
          map[key] = combined.value;
          break;
        }
        content += `\n${lines[i]}`;
        i += 1;
      }
      if (!Object.prototype.hasOwnProperty.call(map, key)) {
        map[key] = unescapeQuotedEnvValue(content);
      }
      continue;
    }

    let val = valuePart.trim();
    if (val.startsWith("'") && val.endsWith("'") && val.length >= 2) {
      map[key] = val.slice(1, -1);
      continue;
    }
    const hash = val.indexOf(' #');
    if (hash >= 0) val = val.slice(0, hash).trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = unescapeQuotedEnvValue(val.slice(1, -1));
    }
    map[key] = val;
  }
  return map;
}

function dotEnvMapHasBundleableKeys(sourceMap, templateText, denyRoots = []) {
  for (const [key, val] of Object.entries(sourceMap || {})) {
    if (shouldIncludePersonalEnvEntry(key, val, denyRoots)) return true;
  }
  return false;
}

function collectPersonalEnvOverlay(sourceMap, templateText, denyRoots = []) {
  const templateKeys = getTemplateEnvKeys(templateText);
  const templateKeySet = new Set(templateKeys);
  const overlay = {};
  const skipped = [];

  for (const [alias, target] of Object.entries(ENV_KEY_ALIASES)) {
    if (!isBlank(sourceMap[alias])) {
      const reason = getSkipReasonForEntry(alias, sourceMap[alias], denyRoots);
      if (reason) {
        skipped.push({ key: alias, reason });
      } else if (isBlank(sourceMap[target])) {
        overlay[target] = sourceMap[alias];
      }
    }
  }

  for (const key of templateKeys) {
    if (!isBlank(sourceMap[key])) {
      const reason = getSkipReasonForEntry(key, sourceMap[key], denyRoots);
      if (reason) skipped.push({ key, reason });
      else overlay[key] = sourceMap[key];
    }
  }

  const extraKeys = [];
  for (const key of Object.keys(sourceMap || {}).sort()) {
    if (templateKeySet.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(ENV_KEY_ALIASES, key)) continue;
    if (isBlank(sourceMap[key])) continue;
    const reason = getSkipReasonForEntry(key, sourceMap[key], denyRoots);
    if (reason) {
      skipped.push({ key, reason });
      continue;
    }
    extraKeys.push(key);
    overlay[key] = sourceMap[key];
  }

  return { overlay, extraKeys, skipped };
}

function mergeEnvDefaultsWithSource(templateText, sourceMap, options = {}) {
  const denyRoots = options.denyPathRoots || [];
  const { overlay, extraKeys, skipped } = collectPersonalEnvOverlay(
    sourceMap,
    templateText,
    denyRoots,
  );

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
    lines.push('# ===== Additional bundled settings (personal build) =====');
    for (const key of extraKeys) {
      lines.push(`${key}=${formatEnvValueForFile(overlay[key])}`);
    }
  }

  const merged = lines.join('\n').replace(/\n+$/, '') + '\n';
  return { merged, skipped, overlay };
}

function writeSkippedManifest(filePath, skipped) {
  if (!filePath) return;
  const body = skipped.map((s) => `${s.key}\t${s.reason}`).join('\n');
  fs.writeFileSync(filePath, body ? `${body}\n` : '', 'utf8');
}

function writeBundledManifest(filePath, overlay) {
  if (!filePath) return;
  const lines = [];
  for (const key of Object.keys(overlay).sort()) {
    if (isSecretEnvKeyName(key)) {
      lines.push(`${key}\tsecret\t${String(overlay[key]).length}`);
    } else {
      lines.push(`${key}\tsetting`);
    }
  }
  fs.writeFileSync(filePath, lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd === 'merge') {
    const templatePath = args[1];
    const sourcePath = args[2];
    const outPath = args[3];
    const skippedPath = args[4];
    const denyPathsFile = args[5];
    const bundledManifestPath = args[6];
    if (!templatePath || !sourcePath) {
      console.error(
        'Usage: merge-env-defaults.js merge <template.env> <source.env> [out.env] [skipped.tsv] [deny-paths.txt] [bundled.tsv]',
      );
      process.exit(2);
    }
    const denyRoots = loadDenyPathRoots(denyPathsFile);
    const sourceMap = parseDotEnvText(readUtf8(sourcePath));
    const { merged, skipped, overlay } = mergeEnvDefaultsWithSource(
      readUtf8(templatePath),
      sourceMap,
      { denyPathRoots: denyRoots },
    );
    if (outPath) fs.writeFileSync(outPath, merged, 'utf8');
    else process.stdout.write(merged);
    writeSkippedManifest(skippedPath, skipped);
    writeBundledManifest(bundledManifestPath, overlay);
    return;
  }
  if (cmd === 'has-bundleable' || cmd === 'has-personal-settings') {
    const sourcePath = args[1];
    const templatePath = args[2];
    const denyPathsFile = args[3];
    if (!sourcePath || !templatePath) {
      console.error(
        'Usage: merge-env-defaults.js has-personal-settings <source.env> <template.env> [deny-paths.txt]',
      );
      process.exit(2);
    }
    const denyRoots = loadDenyPathRoots(denyPathsFile);
    const ok = dotEnvMapHasBundleableKeys(
      parseDotEnvText(readUtf8(sourcePath)),
      readUtf8(templatePath),
      denyRoots,
    );
    process.exit(ok ? 0 : 1);
  }
  console.error('Unknown command. Use merge or has-personal-settings.');
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  DENIED_ENV_KEYS,
  ENV_KEY_ALIASES,
  SECRET_KEY_NAME_RE,
  getTemplateEnvKeys,
  isBundleableEnvKey,
  isSecretEnvKeyName,
  formatEnvValueForFile,
  parseDotEnvText,
  dotEnvMapHasBundleableKeys,
  shouldIncludePersonalEnvEntry,
  getSkipReasonForEntry,
  valueContainsDeniedAbsolutePath,
  mergeEnvDefaultsWithSource,
  collectPersonalEnvOverlay,
};
