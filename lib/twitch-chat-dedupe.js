'use strict';

/**
 * Dedupe Twitch IRC chat messages by Twitch message id (tags.id).
 * Guards against duplicate handlers when chat is reconnected without tearing down the old client.
 */
function createTwitchMessageDeduper({ windowMs = 120_000, maxEntries = 5000 } = {}) {
  const seen = new Map();

  function prune(now) {
    const cutoff = now - windowMs;
    for (const [id, ts] of seen) {
      if (ts < cutoff) seen.delete(id);
    }
    while (seen.size > maxEntries) {
      const first = seen.keys().next().value;
      if (first === undefined) break;
      seen.delete(first);
    }
  }

  /**
   * @returns {boolean} true if this message should be skipped as a duplicate
   */
  function isDuplicate(tags) {
    const id = tags && tags.id;
    if (!id) return false;
    const now = Date.now();
    if (seen.has(id)) return true;
    seen.set(id, now);
    prune(now);
    return false;
  }

  function reset() {
    seen.clear();
  }

  return { isDuplicate, reset };
}

module.exports = { createTwitchMessageDeduper };
