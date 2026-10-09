/**
 * Host wake name parsing and validation for Raven voice wake phrases.
 * Persisted in raven.env as HOST_WAKE_NAMES (comma-separated, first is primary).
 */

const DEFAULT_WAKE_NAME = 'Raven';
const MAX_WAKE_NAMES = 5;
const NAME_MIN_LEN = 1;
const NAME_MAX_LEN = 32;
const WAKE_NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9 '\-]*[A-Za-z0-9])?$/;

/**
 * @param {string} name
 * @returns {boolean}
 */
function isValidWakeNameToken(name) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN_LEN || trimmed.length > NAME_MAX_LEN) return false;
  return WAKE_NAME_PATTERN.test(trimmed);
}

/**
 * Parse comma-separated wake names from env value or user input.
 * @param {string} raw
 * @returns {{ ok: true, names: string[], primary: string, envValue: string } | { ok: false, error: string }}
 */
function parseAndValidateHostWakeNames(raw) {
  const parts = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const names = parts.length ? parts : [DEFAULT_WAKE_NAME];

  if (names.length > MAX_WAKE_NAMES) {
    return { ok: false, error: `At most ${MAX_WAKE_NAMES} wake names allowed` };
  }

  const seen = new Set();
  for (const name of names) {
    if (!isValidWakeNameToken(name)) {
      return {
        ok: false,
        error:
          'Each wake name must be 1–32 characters and use only letters, numbers, spaces, hyphens, and apostrophes',
      };
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: 'Duplicate wake names are not allowed' };
    }
    seen.add(key);
  }

  return {
    ok: true,
    names,
    primary: names[0],
    envValue: names.join(', '),
  };
}

/**
 * @param {Record<string, string>|undefined|null} configMap
 */
function getHostWakeNamesFromConfig(configMap) {
  const raw = configMap && configMap.HOST_WAKE_NAMES;
  const parsed = parseAndValidateHostWakeNames(raw || DEFAULT_WAKE_NAME);
  if (parsed.ok) return parsed;
  return parseAndValidateHostWakeNames(DEFAULT_WAKE_NAME);
}

/**
 * Default voice macro phrase using the primary wake name (lowercase).
 * @param {string} [primaryWakeName]
 */
function buildDefaultGoingLivePhrase(primaryWakeName) {
  const primary =
    (primaryWakeName && String(primaryWakeName).trim()) || DEFAULT_WAKE_NAME;
  return `${primary.toLowerCase()} we are going live`;
}

/**
 * Read HOST_WAKE_NAMES from raven.env in userData (sync).
 * @param {string} userDataPath
 */
function readHostWakeNamesFromUserData(userDataPath) {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(userDataPath, 'raven.env');
  if (!fs.existsSync(envPath)) {
    return getHostWakeNamesFromConfig({});
  }
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    const map = {};
    for (const raw of text.split(/\r?\n/)) {
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
    return getHostWakeNamesFromConfig(map);
  } catch (err) {
    return getHostWakeNamesFromConfig({});
  }
}

/** VirtualDeck cannot observe Raven's env watcher; users should restart if wake word unchanged. */
const WAKE_NAMES_REQUIRE_RAVEN_RESTART = true;

module.exports = {
  DEFAULT_WAKE_NAME,
  MAX_WAKE_NAMES,
  isValidWakeNameToken,
  parseAndValidateHostWakeNames,
  getHostWakeNamesFromConfig,
  buildDefaultGoingLivePhrase,
  readHostWakeNamesFromUserData,
  WAKE_NAMES_REQUIRE_RAVEN_RESTART,
};
