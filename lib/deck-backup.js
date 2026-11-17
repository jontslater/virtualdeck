/**
 * Deck layout backup: profiles (buttons, order, labels, hotkeys), macros, and userData media.
 */
const path = require('path');

const DECK_BACKUP_FORMAT = 'virtualdeck-deck-backup';
const DECK_BACKUP_VERSION = 1;

const PATH_VALUE_KEYS = new Set(['src', 'path', 'filePath', 'targetPath']);

function formatDeckExportBasename(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `virtualdeck-deck-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`
  );
}

function normalizeRelPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function isHttpOrDataUrl(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return v.startsWith('data:') || /^https?:\/\//i.test(v);
}

function looksLikeWindowsAbsolutePath(p) {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\');
}

function isUserDataRelativePath(p) {
  if (typeof p !== 'string' || !p.trim()) return false;
  if (isHttpOrDataUrl(p)) return false;
  if (path.isAbsolute(p) || looksLikeWindowsAbsolutePath(p)) return false;
  if (p.includes('..')) return false;
  return true;
}

function collectPathStringsFromValue(value, out) {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectPathStringsFromValue(item, out);
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (PATH_VALUE_KEYS.has(key) && typeof child === 'string' && child.trim()) {
      if (!isHttpOrDataUrl(child)) out.add(child.trim());
    } else {
      collectPathStringsFromValue(child, out);
    }
  }
}

function collectPathsFromProfile(profileData) {
  const out = new Set();
  if (profileData && Array.isArray(profileData.buttons)) {
    for (const button of profileData.buttons) {
      collectPathStringsFromValue(button, out);
    }
  }
  return out;
}

function resolveStoredPath(userDataPath, pathRef) {
  if (typeof pathRef !== 'string' || !pathRef.trim()) return null;
  if (path.isAbsolute(pathRef) || looksLikeWindowsAbsolutePath(pathRef)) return path.normalize(pathRef);
  const rel = normalizeRelPath(pathRef);
  return path.join(userDataPath, ...rel.split('/'));
}

function fileExistsAtRef(userDataPath, pathRef, fsImpl) {
  const abs = resolveStoredPath(userDataPath, pathRef);
  if (!abs) return false;
  try {
    return fsImpl.existsSync(abs) && fsImpl.statSync(abs).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {unknown} data
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
function validateDeckBackupData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'File must contain a VirtualDeck deck backup object.' };
  }
  if (data.format !== DECK_BACKUP_FORMAT) {
    return { ok: false, error: `Unknown backup format (expected "${DECK_BACKUP_FORMAT}").` };
  }
  const version = data.version;
  if (version !== DECK_BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version ${String(version)}.` };
  }
  if (!data.profilesMeta || typeof data.profilesMeta !== 'object' || Array.isArray(data.profilesMeta)) {
    return { ok: false, error: 'Missing or invalid "profilesMeta".' };
  }
  if (!Array.isArray(data.profilesMeta.profiles)) {
    return { ok: false, error: '"profilesMeta.profiles" must be an array.' };
  }
  if (!data.profiles || typeof data.profiles !== 'object' || Array.isArray(data.profiles)) {
    return { ok: false, error: 'Missing or invalid "profiles" object.' };
  }
  for (const entry of data.profilesMeta.profiles) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') {
      return { ok: false, error: 'Each profile entry must have an id.' };
    }
    if (!Object.prototype.hasOwnProperty.call(data.profiles, entry.id)) {
      return { ok: false, error: `Profile "${entry.id}" is listed in metadata but missing from profiles.` };
    }
    const profile = data.profiles[entry.id];
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return { ok: false, error: `Profile "${entry.id}" data must be an object.` };
    }
    if (!Array.isArray(profile.buttons)) {
      return { ok: false, error: `Profile "${entry.id}" must include a buttons array.` };
    }
  }
  if (data.macros !== undefined && (typeof data.macros !== 'object' || data.macros === null || Array.isArray(data.macros))) {
    return { ok: false, error: '"macros" must be an object when present.' };
  }
  if (
    data.bundledMedia !== undefined &&
    (typeof data.bundledMedia !== 'object' || data.bundledMedia === null || Array.isArray(data.bundledMedia))
  ) {
    return { ok: false, error: '"bundledMedia" must be an object when present.' };
  }
  return { ok: true, data };
}

function readDeckBackupJsonFile(filePath, fsImpl = require('fs')) {
  const text = fsImpl.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  return validateDeckBackupData(parsed);
}

function collectBundledMediaForExport({ profiles, userDataPath, fsImpl = require('fs') }) {
  const relPaths = new Set();
  for (const profileData of Object.values(profiles)) {
    for (const p of collectPathsFromProfile(profileData)) {
      if (isUserDataRelativePath(p)) relPaths.add(normalizeRelPath(p));
    }
  }
  const bundledMedia = {};
  for (const rel of relPaths) {
    const abs = path.join(userDataPath, ...rel.split('/'));
    if (!fsImpl.existsSync(abs) || !fsImpl.statSync(abs).isFile()) continue;
    bundledMedia[rel] = {
      encoding: 'base64',
      data: fsImpl.readFileSync(abs).toString('base64'),
    };
  }
  return bundledMedia;
}

function summarizeDeckBackup(backup) {
  let buttonCount = 0;
  for (const profile of Object.values(backup.profiles || {})) {
    if (profile && Array.isArray(profile.buttons)) buttonCount += profile.buttons.length;
  }
  const profileCount = (backup.profilesMeta && backup.profilesMeta.profiles && backup.profilesMeta.profiles.length) || 0;
  const macroCount = backup.macros ? Object.keys(backup.macros).length : 0;
  const mediaCount = backup.bundledMedia ? Object.keys(backup.bundledMedia).length : 0;
  return { profileCount, buttonCount, macroCount, mediaCount };
}

function buildDeckBackupPayload({
  profilesMeta,
  profiles,
  macros,
  userDataPath,
  appVersion,
  fsImpl = require('fs'),
}) {
  const bundledMedia = collectBundledMediaForExport({ profiles, userDataPath, fsImpl });
  return {
    format: DECK_BACKUP_FORMAT,
    version: DECK_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion || null,
    profilesMeta,
    profiles,
    macros: macros || {},
    bundledMedia,
  };
}

function writeBundledMedia({ bundledMedia, userDataPath, fsImpl = require('fs') }) {
  if (!bundledMedia || typeof bundledMedia !== 'object') return;
  for (const [rel, payload] of Object.entries(bundledMedia)) {
    if (!payload || payload.encoding !== 'base64' || typeof payload.data !== 'string') continue;
    const safeRel = normalizeRelPath(rel);
    if (!isUserDataRelativePath(safeRel)) continue;
    const abs = path.join(userDataPath, ...safeRel.split('/'));
    fsImpl.mkdirSync(path.dirname(abs), { recursive: true });
    fsImpl.writeFileSync(abs, Buffer.from(payload.data, 'base64'));
  }
}

function markMissingPathsOnButton(button, userDataPath, fsImpl) {
  if (!button || typeof button !== 'object') return button;
  const missing = [];
  const refs = new Set();
  collectPathStringsFromValue(button, refs);
  for (const ref of refs) {
    if (!fileExistsAtRef(userDataPath, ref, fsImpl)) {
      missing.push(ref);
    }
  }
  if (missing.length > 0) {
    button.pathMissing = true;
    button.missingPaths = missing;
  } else {
    delete button.pathMissing;
    delete button.missingPaths;
  }
  return button;
}

function applyMissingPathFlagsToProfiles(profiles, userDataPath, fsImpl = require('fs')) {
  const next = {};
  for (const [id, profile] of Object.entries(profiles)) {
    const copy = JSON.parse(JSON.stringify(profile));
    if (Array.isArray(copy.buttons)) {
      copy.buttons = copy.buttons.map((b) => markMissingPathsOnButton(b, userDataPath, fsImpl));
    }
    next[id] = copy;
  }
  return next;
}

function backupFileIfExists(filePath, fsImpl = require('fs')) {
  if (!fsImpl.existsSync(filePath)) return null;
  const bakPath = `${filePath}.bak`;
  fsImpl.copyFileSync(filePath, bakPath);
  return bakPath;
}

function writeDeckBackupJsonFile(filePath, data, fsImpl = require('fs')) {
  fsImpl.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function listOrphanProfileIds(existingProfileIds, backupProfileIds) {
  const keep = new Set(backupProfileIds);
  return existingProfileIds.filter((id) => !keep.has(id));
}

module.exports = {
  DECK_BACKUP_FORMAT,
  DECK_BACKUP_VERSION,
  formatDeckExportBasename,
  normalizeRelPath,
  isUserDataRelativePath,
  collectPathsFromProfile,
  collectPathStringsFromValue,
  validateDeckBackupData,
  readDeckBackupJsonFile,
  buildDeckBackupPayload,
  summarizeDeckBackup,
  writeBundledMedia,
  applyMissingPathFlagsToProfiles,
  markMissingPathsOnButton,
  backupFileIfExists,
  writeDeckBackupJsonFile,
  listOrphanProfileIds,
  fileExistsAtRef,
  resolveStoredPath,
};
