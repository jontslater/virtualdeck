/**
 * Turn Raven controller /api/ai/status extras (lastError, lastIgnoredHeard) into
 * short dashboard notes so silence is explained. Works in the browser and in Node tests.
 */
(function (root) {
  const ERROR_TTL_MS = 10 * 60 * 1000;
  const IGNORED_TTL_MS = 60 * 1000;

  function ravenStatusNotes(status, now) {
    const t = typeof now === 'number' ? now : Date.now();
    const notes = [];
    if (!status || typeof status !== 'object') return notes;
    const err = status.lastError;
    if (err && err.message && t - (err.at || 0) < ERROR_TTL_MS) {
      notes.push({ level: 'error', text: `⚠️ ${String(err.message).slice(0, 140)}` });
    }
    const ig = status.lastIgnoredHeard;
    if (ig && ig.text && t - (ig.at || 0) < IGNORED_TTL_MS) {
      const why = ig.reason === 'no_wake_word' ? 'no wake word — start with "Raven"' : ig.reason || 'ignored';
      notes.push({ level: 'info', text: `Heard "${String(ig.text).slice(0, 60)}" (${why})` });
    }
    return notes;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { ravenStatusNotes };
  if (root) root.vdRavenStatusNotes = ravenStatusNotes;
})(typeof window !== 'undefined' ? window : null);
