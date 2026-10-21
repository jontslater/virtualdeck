/** Free-tier deck limit (buttons / hotkeys). */
const FREE_BUTTON_CAP = 15;

/** Offline grace after last successful Lemon Squeezy validation (~7 days). */
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Background revalidation interval (24h). */
const REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

module.exports = {
  FREE_BUTTON_CAP,
  OFFLINE_GRACE_MS,
  REVALIDATE_INTERVAL_MS,
};
