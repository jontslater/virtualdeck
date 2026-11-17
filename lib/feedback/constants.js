/** @typedef {'pending' | 'snoozed' | 'never' | 'completed'} FeedbackPromptStatus */

const FEEDBACK_STATE_VERSION = 1;

/** Days after first launch before the one-time prompt may appear. */
const FEEDBACK_MIN_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Minimum distinct app sessions (main-process startup count). */
const FEEDBACK_MIN_SESSIONS = 3;

/** "Remind me later" snooze duration. */
const FEEDBACK_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

/** Delay after renderer-ready before showing the non-blocking prompt. */
const FEEDBACK_PROMPT_DELAY_MS = 8000;

const FEEDBACK_RATINGS = Object.freeze(['great', 'good', 'okay', 'rough']);

const FEEDBACK_QUICK_IDEAS = Object.freeze([
  { id: 'overlays', label: 'Better overlays & alerts' },
  { id: 'twitch', label: 'More Twitch tools' },
  { id: 'macros', label: 'Macros & automation' },
  { id: 'ai', label: 'AI assistant features' },
  { id: 'themes', label: 'Themes & skins' },
  { id: 'performance', label: 'Performance & stability' },
  { id: 'other', label: 'Something else' },
]);

module.exports = {
  FEEDBACK_STATE_VERSION,
  FEEDBACK_MIN_DAYS_MS,
  FEEDBACK_MIN_SESSIONS,
  FEEDBACK_SNOOZE_MS,
  FEEDBACK_PROMPT_DELAY_MS,
  FEEDBACK_RATINGS,
  FEEDBACK_QUICK_IDEAS,
};
