const {
  FEEDBACK_STATE_VERSION,
  FEEDBACK_MIN_DAYS_MS,
  FEEDBACK_MIN_SESSIONS,
} = require('./constants');

/**
 * @param {object} preferences
 * @returns {object}
 */
function getFeedbackState(preferences) {
  const prefs = preferences && typeof preferences === 'object' ? preferences : {};
  const raw = prefs.feedback && typeof prefs.feedback === 'object' ? prefs.feedback : {};
  return normalizeFeedbackState(raw);
}

/**
 * @param {object} raw
 * @returns {object}
 */
function normalizeFeedbackState(raw) {
  const state = raw && typeof raw === 'object' ? { ...raw } : {};
  if (state.stateVersion !== FEEDBACK_STATE_VERSION) {
    state.stateVersion = FEEDBACK_STATE_VERSION;
  }
  if (!state.firstLaunchAt) {
    state.firstLaunchAt = null;
  }
  if (typeof state.sessionCount !== 'number' || state.sessionCount < 0) {
    state.sessionCount = 0;
  }
  const status = String(state.promptStatus || 'pending');
  state.promptStatus = ['pending', 'snoozed', 'never', 'completed'].includes(status)
    ? status
    : 'pending';
  state.snoozedUntil = state.snoozedUntil || null;
  state.lastSubmittedAt = state.lastSubmittedAt || null;
  state.lastPromptShownAt = state.lastPromptShownAt || null;
  return state;
}

/**
 * Record one app session and first-launch timestamp in preferences.feedback.
 * @param {object} preferences
 * @param {number} [now]
 * @returns {{ preferences: object, feedback: object }}
 */
function recordFeedbackSession(preferences, now = Date.now()) {
  const prefs = preferences && typeof preferences === 'object' ? { ...preferences } : {};
  const feedback = getFeedbackState(prefs);
  if (!feedback.firstLaunchAt) {
    feedback.firstLaunchAt = new Date(now).toISOString();
  }
  feedback.sessionCount += 1;
  prefs.feedback = feedback;
  return { preferences: prefs, feedback };
}

/**
 * @param {object} feedback
 * @param {number} [now]
 * @returns {boolean}
 */
function shouldShowFeedbackPrompt(feedback, now = Date.now()) {
  const state = normalizeFeedbackState(feedback);
  if (state.promptStatus === 'never' || state.promptStatus === 'completed') {
    return false;
  }
  if (state.promptStatus === 'snoozed' && state.snoozedUntil) {
    const until = Date.parse(state.snoozedUntil);
    if (!Number.isNaN(until) && until > now) {
      return false;
    }
  }
  if (!state.firstLaunchAt) {
    return false;
  }
  const first = Date.parse(state.firstLaunchAt);
  if (Number.isNaN(first) || now - first < FEEDBACK_MIN_DAYS_MS) {
    return false;
  }
  if (state.sessionCount < FEEDBACK_MIN_SESSIONS) {
    return false;
  }
  return true;
}

/**
 * @param {object} preferences
 * @param {object} patch
 * @returns {object}
 */
function patchFeedbackInPreferences(preferences, patch) {
  const prefs = preferences && typeof preferences === 'object' ? { ...preferences } : {};
  const next = { ...getFeedbackState(prefs), ...(patch || {}) };
  prefs.feedback = normalizeFeedbackState(next);
  return prefs;
}

module.exports = {
  getFeedbackState,
  normalizeFeedbackState,
  recordFeedbackSession,
  shouldShowFeedbackPrompt,
  patchFeedbackInPreferences,
  FEEDBACK_STATE_VERSION,
};
