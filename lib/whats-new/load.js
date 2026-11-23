const fs = require('fs');
const path = require('path');
const { compareVersions } = require('./version');

const WHATS_NEW_DIR = path.join(__dirname, '..', '..', 'whats-new');

/**
 * @returns {string[]}
 */
function listReleaseVersions() {
  if (!fs.existsSync(WHATS_NEW_DIR)) return [];
  return fs
    .readdirSync(WHATS_NEW_DIR)
    .filter((name) => /^\d+\.\d+\.\d+\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ''))
    .sort((a, b) => compareVersions(a, b));
}

/**
 * @param {string} version
 * @returns {object | null}
 */
function loadReleaseFile(version) {
  const file = path.join(WHATS_NEW_DIR, `${version}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    console.warn('[whats-new] Failed to parse', file, err && err.message);
    return null;
  }
}

/**
 * Exact match, else newest release notes at or below appVersion (fallback).
 * @param {string} appVersion
 * @returns {{ release: object, resolvedVersion: string } | null}
 */
function resolveReleaseForAppVersion(appVersion) {
  const exact = loadReleaseFile(appVersion);
  if (exact) {
    return { release: exact, resolvedVersion: appVersion };
  }
  const versions = listReleaseVersions();
  let pick = null;
  for (const v of versions) {
    if (compareVersions(v, appVersion) <= 0) pick = v;
  }
  if (!pick) return null;
  const release = loadReleaseFile(pick);
  if (!release) return null;
  return { release, resolvedVersion: pick };
}

/**
 * @param {string} appVersion
 * @returns {boolean}
 */
function hasReleaseNotesForVersion(appVersion) {
  return !!loadReleaseFile(appVersion);
}

module.exports = {
  listReleaseVersions,
  loadReleaseFile,
  resolveReleaseForAppVersion,
  hasReleaseNotesForVersion,
  WHATS_NEW_DIR,
};