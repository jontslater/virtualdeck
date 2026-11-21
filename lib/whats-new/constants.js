/**
 * Public patch notes URL (opened in the system browser).
 * Verified on virtualdeck.app: `/patch-notes` returns 404; `/patch-notes.html` is the live page.
 * Override with VD_PATCH_NOTES_URL when testing.
 */
const PATCH_NOTES_URL =
  (typeof process !== 'undefined' && process.env && process.env.VD_PATCH_NOTES_URL) ||
  'https://virtualdeck.app/patch-notes.html';

const WHATS_NEW_STATE_VERSION = 1;

/** Delay after renderer-ready before auto prompt (avoid fighting first-run Twitch setup). */
const WHATS_NEW_PROMPT_DELAY_MS = 6000;

/** Poll while deferred (live stream / active alert). */
const WHATS_NEW_DEFER_POLL_MS = 45000;

module.exports = {
  PATCH_NOTES_URL,
  WHATS_NEW_STATE_VERSION,
  WHATS_NEW_PROMPT_DELAY_MS,
  WHATS_NEW_DEFER_POLL_MS,
};