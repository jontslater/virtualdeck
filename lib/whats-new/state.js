const { WHATS_NEW_STATE_VERSION } = require('./constants');
const { compareVersions } = require('./version');

/**
 * @param {object} preferences
 * @returns {object}
 */
function getWhatsNewState(preferences) {
  const prefs = preferences && typeof preferences === 'object' ? preferences : {};
  const raw = prefs.whatsNew && typeof prefs.whatsNew === 'object' ? prefs.whatsNew : {};
  return normalizeWhatsNewState(raw);
}

/**
 * @param {object} raw
 * @returns {object}
 */
function normalizeWhatsNewState(raw) {
  const state = raw && typeof raw === 'object' ? { ...raw } : {};
  if (state.stateVersion !== WHATS_NEW_STATE_VERSION) {
    state.stateVersion = WHATS_NEW_STATE_VERSION;
  }
  state.lastSeenVersion = state.lastSeenVersion || null;
  state.deferredVersion = state.deferredVersion || null;
  state.lastPromptShownAt = state.lastPromptShownAt || null;
  return state;
}

/**
 * Fresh install: no recorded last-seen version.
 * @param {object} state
 * @returns {boolean}
 */
function isFreshWhatsNewInstall(state) {
  const normalized = normalizeWhatsNewState(state);
  return !normalized.lastSeenVersion;
}

/**
 * @param {object} preferences
 * @param {string} appVersion
 * @returns {{ preferences: object, state: object }}
 */
function recordFreshInstallBaseline(preferences, appVersion) {
  const prefs = preferences && typeof preferences === 'object' ? { ...preferences } : {};
  const state = getWhatsNewState(prefs);
  if (!state.lastSeenVersion) {
    state.lastSeenVersion = appVersion;
    state.deferredVersion = null;
  }
  prefs.whatsNew = state;
  return { preferences: prefs, state };
}

/**
 * @param {object} state
 * @param {string} appVersion
 * @param {boolean} hasReleaseNotes - entry exists for this app version
 * @returns {boolean}
 */
function shouldAutoShowWhatsNew(state, appVersion, hasReleaseNotes) {
  if (!hasReleaseNotes) return false;
  const normalized = normalizeWhatsNewState(state);
  if (isFreshWhatsNewInstall(normalized)) {
    return false;
  }
  if (!normalized.lastSeenVersion) return false;
  if (compareVersions(appVersion, normalized.lastSeenVersion) <= 0) {
    return false;
  }
  return true;
}

/**
 * @param {{ isStreamLive?: boolean, alertActive?: boolean, overlayPreviewActive?: boolean }} ctx
 * @returns {boolean}
 */
function shouldDeferWhatsNewPrompt(ctx) {
  if (!ctx || typeof ctx !== 'object') return false;
  if (ctx.isStreamLive) return true;
  if (ctx.alertActive) return true;
  if (ctx.overlayPreviewActive) return true;
  return false;
}

/**
 * @param {object} preferences
 * @param {string} appVersion
 * @returns {object}
 */
function markWhatsNewSeen(preferences, appVersion) {
  const prefs = preferences && typeof preferences === 'object' ? { ...preferences } : {};
  const state = getWhatsNewState(prefs);
  state.lastSeenVersion = appVersion;
  state.deferredVersion = null;
  prefs.whatsNew = state;
  return prefs;
}

/**
 * @param {object} preferences
 * @param {object} patch
 * @returns {object}
 */
function patchWhatsNewInPreferences(preferences, patch) {
  const prefs = preferences && typeof preferences === 'object' ? { ...preferences } : {};
  const next = { ...getWhatsNewState(prefs), ...(patch || {}) };
  prefs.whatsNew = normalizeWhatsNewState(next);
  return prefs;
}

module.exports = {
  getWhatsNewState,
  normalizeWhatsNewState,
  isFreshWhatsNewInstall,
  recordFreshInstallBaseline,
  shouldAutoShowWhatsNew,
  shouldDeferWhatsNewPrompt,
  markWhatsNewSeen,
  patchWhatsNewInPreferences,
  WHATS_NEW_STATE_VERSION,
};