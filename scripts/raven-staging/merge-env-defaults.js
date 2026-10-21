#!/usr/bin/env node
/**
 * Merge personal-build settings into extra/raven/env.defaults template.
 * Copies raw KEY=VALUE lines from the source file verbatim (no re-serialization).
 */

const fs = require('fs');
const path = require('path');
const { stripBom, readFileUtf8 } = require('./read-utf8');

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

/**
 * Same logic as raven-host.js parseEnv (line-based, strip outer quotes, no unescape).
 */
function parseEnvLikeRavenHost(text) {
  const map = {};
  for (const raw of stripBom(String(text || '')).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let val = line.slice(eq + 1).trim();
    const hash = val.indexOf(' #');
    if (hash >= 0) val = val.slice(0, hash).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[line.slice(0, eq).trim()] = val;
  }
  return map;
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

function unescapeQuotedEnvValue(content) {
  let out = '';
  let i = 0;
  while (i < content.length) {
    if (content[i] === '\\' && i + 1 < content.length) {
      const next = content[i + 1];
      if (next === 'n') {
        out += '\n';
        i += 2;
        continue;
      }
      if (next === 'r') {
        out += '\r';
        i += 2;
        continue;
      }
      if (next === '"') {
        out += '"';
        i += 2;
        continue;
      }
      if (next === '\\') {
        out += '\\';
        i += 2;
        continue;
      }
      out += next;
      i += 2;
      continue;
    }
    out += content[i];
    i += 1;
  }
  return out;
}

function isDoubleQuotedStringClosed(text) {
  const t = text.trimStart();
  if (!t.startsWith('"')) return true;
  let i = 1;
  while (i < t.length) {
    if (t[i] === '\\') {
      i += 2;
      continue;
    }
    if (t[i] === '"') return true;
    i += 1;
  }
  return false;
}

function valueSuffixFromRawLines(rawLines) {
  const first = rawLines[0];
  const eq = first.indexOf('=');
  let suffix = first.slice(eq + 1);
  for (let j = 1; j < rawLines.length; j += 1) {
    suffix += `\n${rawLines[j]}`;
  }
  return suffix;
}

function recordHasNonEmptyValue(record, parsedValues) {
  const suffix = valueSuffixFromRawLines(record.rawLines).trim();
  if (record.multiline) {
    return suffix.length > 0;
  }
  const val = parsedValues[record.key];
  if (!isBlank(val)) return true;
  return suffix.length > 0;
}

/**
 * @returns {Map<string, { key: string, rawLines: string[], multiline: boolean }>}
 */
function parseSourceEnvRecords(sourceText) {
  const records = new Map();
  const lines = String(sourceText || '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    i += 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawLines = [raw];
    let valueSuffix = valueSuffixFromRawLines(rawLines);
    while (
      valueSuffix.trimStart().startsWith('"') &&
      !isDoubleQuotedStringClosed(valueSuffix)
    ) {
      if (i >= lines.length) break;
      rawLines.push(lines[i]);
      i += 1;
      valueSuffix = valueSuffixFromRawLines(rawLines);
    }
    const multiline = rawLines.length > 1;
    records.set(key, { key, rawLines, multiline });
  }
  return records;
}

function renameEnvRecord(record, newKey) {
  const eq = record.rawLines[0].indexOf('=');
  const first = `${newKey}=${record.rawLines[0].slice(eq + 1)}`;
  return {
    key: newKey,
    rawLines: [first, ...record.rawLines.slice(1)],
    multiline: record.multiline,
  };
}

function dotEnvMapHasBundleableKeys(sourceText, templateText, denyRoots = []) {
  const normalizedSource = stripBom(String(sourceText || ''));
  const parsed = parseEnvLikeRavenHost(normalizedSource);
  const records = parseSourceEnvRecords(normalizedSource);
  for (const record of records.values()) {
    const val = parsed[record.key];
    const checkVal = record.multiline ? valueSuffixFromRawLines(record.rawLines).trim() : val;
    if (shouldIncludePersonalEnvEntry(record.key, checkVal, denyRoots)) return true;
  }
  return false;
}

function collectPersonalEnvOverlay(sourceText, templateText, denyRoots = []) {
  const normalizedSource = stripBom(String(sourceText || ''));
  const templateKeys = getTemplateEnvKeys(templateText);
  const templateKeySet = new Set(templateKeys);
  const parsed = parseEnvLikeRavenHost(normalizedSource);
  const records = parseSourceEnvRecords(normalizedSource);
  const included = new Map();
  const skipped = [];
  const warnings = [];
  const overlayValues = {};

  function tryInclude(key, record) {
    if (!record) return;
    const val = parsed[key];
    const suffix = valueSuffixFromRawLines(record.rawLines).trim();
    const effectiveVal = !isBlank(val) ? val : suffix;
    if (!recordHasNonEmptyValue(record, parsed)) return;
    const reason = getSkipReasonForEntry(
      key,
      record.multiline ? suffix : effectiveVal,
      denyRoots,
    );
    if (reason) {
      skipped.push({ key, reason });
      return;
    }
    if (record.multiline) {
      warnings.push({ key, reason: 'multiline-unsupported' });
    }
    included.set(key, record);
    overlayValues[key] = record.multiline ? suffix : effectiveVal;
  }

  for (const [alias, target] of Object.entries(ENV_KEY_ALIASES)) {
    const aliasRec = records.get(alias);
    if (!aliasRec) continue;
    if (isBlank(parsed[target]) && recordHasNonEmptyValue(aliasRec, parsed)) {
      tryInclude(target, renameEnvRecord(aliasRec, target));
    }
  }

  for (const key of templateKeys) {
    tryInclude(key, records.get(key));
  }

  const extraKeys = [];
  for (const key of [...records.keys()].sort()) {
    if (templateKeySet.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(ENV_KEY_ALIASES, key)) continue;
    if (included.has(key)) continue;
    const record = records.get(key);
    if (!recordHasNonEmptyValue(record, parsed)) continue;
    const val = parsed[key];
    const reason = getSkipReasonForEntry(
      key,
      record.multiline ? valueSuffixFromRawLines(record.rawLines).trim() : val,
      denyRoots,
    );
    if (reason) {
      skipped.push({ key, reason });
      continue;
    }
    if (record.multiline) {
      warnings.push({ key, reason: 'multiline-unsupported' });
    }
    extraKeys.push(key);
    included.set(key, record);
    overlayValues[key] = record.multiline
      ? valueSuffixFromRawLines(record.rawLines).trim()
      : val;
  }

  return { included, extraKeys, skipped, warnings, overlayValues };
}

function mergeEnvDefaultsWithSource(templateText, sourceText, options = {}) {
  const denyRoots = options.denyPathRoots || [];
  const { included, extraKeys, skipped, warnings, overlayValues } = collectPersonalEnvOverlay(
    sourceText,
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
    if (included.has(key)) {
      for (const srcLine of included.get(key).rawLines) {
        lines.push(srcLine);
      }
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
      for (const srcLine of included.get(key).rawLines) {
        lines.push(srcLine);
      }
    }
  }

  const merged = lines.join('\n').replace(/\n+$/, '') + '\n';
  return { merged, skipped, warnings, overlay: overlayValues };
}

function writeSkippedManifest(filePath, skipped) {
  if (!filePath) return;
  const body = skipped.map((s) => `${s.key}\t${s.reason}`).join('\n');
  fs.writeFileSync(filePath, body ? `${body}\n` : '', 'utf8');
}

function writeWarningsManifest(filePath, warnings) {
  if (!filePath) return;
  const body = warnings.map((w) => `${w.key}\t${w.reason}`).join('\n');
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

function writeFileUtf8NoBom(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
}

/** Used by tests / optional advanced parsing (not Raven runtime). */
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
    const recordLines = [raw];
    let valueSuffix = valueSuffixFromRawLines(recordLines);
    while (
      valueSuffix.trimStart().startsWith('"') &&
      !isDoubleQuotedStringClosed(valueSuffix)
    ) {
      if (i >= lines.length) break;
      recordLines.push(lines[i]);
      i += 1;
      valueSuffix = valueSuffixFromRawLines(recordLines);
    }
    const trimmedSuffix = valueSuffix.trim();
    if (trimmedSuffix.startsWith('"') && isDoubleQuotedStringClosed(valueSuffix)) {
      const inner = trimmedSuffix.slice(1, trimmedSuffix.lastIndexOf('"'));
      map[key] = unescapeQuotedEnvValue(inner);
      continue;
    }
    if (trimmedSuffix.startsWith("'") && trimmedSuffix.endsWith("'") && trimmedSuffix.length >= 2) {
      map[key] = trimmedSuffix.slice(1, -1);
      continue;
    }
    let val = valueSuffix.trim();
    const hash = val.indexOf(' #');
    if (hash >= 0) val = val.slice(0, hash).trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      map[key] = unescapeQuotedEnvValue(val.slice(1, -1));
    } else {
      map[key] = val;
    }
  }
  return map;
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
    const warningsPath = args[7];
    if (!templatePath || !sourcePath) {
      console.error(
        'Usage: merge-env-defaults.js merge <template.env> <source.env> [out.env] [skipped.tsv] [deny-paths.txt] [bundled.tsv] [warnings.tsv]',
      );
      process.exit(2);
    }
    const denyRoots = loadDenyPathRoots(denyPathsFile);
    const sourceText = readFileUtf8(sourcePath);
    const { merged, skipped, warnings, overlay } = mergeEnvDefaultsWithSource(
      readFileUtf8(templatePath),
      sourceText,
      { denyPathRoots: denyRoots },
    );
    if (outPath) writeFileUtf8NoBom(outPath, merged);
    else process.stdout.write(merged);
    writeSkippedManifest(skippedPath, skipped);
    writeBundledManifest(bundledManifestPath, overlay);
    writeWarningsManifest(warningsPath, warnings);
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
      readFileUtf8(sourcePath),
      readFileUtf8(templatePath),
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
  parseEnvLikeRavenHost,
  parseDotEnvText,
  unescapeQuotedEnvValue,
  parseSourceEnvRecords,
  dotEnvMapHasBundleableKeys,
  shouldIncludePersonalEnvEntry,
  getSkipReasonForEntry,
  valueContainsDeniedAbsolutePath,
  mergeEnvDefaultsWithSource,
  collectPersonalEnvOverlay,
  stripBom,
  writeFileUtf8NoBom,
};
