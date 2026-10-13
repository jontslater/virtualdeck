/**
 * raven.env migrations applied by raven-host before Raven starts.
 *
 * VIRTUALDECK_HTTP_URL is the Raven *bridge* (AITuber virtualdeck-bridge on port 3000), which serves
 * GET /api/ai/macros and POST /api/ai/trigger-macro without auth. Older bundled env.defaults pointed
 * it at VirtualDeck's own overlay server on 8080. Since the auth hardening, every /api/ai/* route on
 * 8080 requires the VirtualDeck token (and 8080 has no macro routes anyway), so the controller's
 * macro whitelist fetch failed with "Failed to fetch macros: Unauthorized" and Raven loaded 0 macros.
 */
const RAVEN_BRIDGE_HTTP_URL = 'http://localhost:3000';

// Raven's original ElevenLabs voice (AITuber raven.env TTS_VOICE_ID, Jan 2026). Used whenever no voice is
// chosen: an empty TTS_VOICE_ID left Raven with no voice at all, so "Default Voice" produced no speech.
const RAVEN_DEFAULT_VOICE_ID = 'wJqPPQ618aTW29mptyoc';
const RAVEN_DEFAULT_VOICE_NAME = 'Raven (original)';
const EMPTY_TTS_VOICE_ID_LINE = /^([ \t]*TTS_VOICE_ID[ \t]*=)[ \t]*(?:""|'')?[ \t]*$/gm;

function resolveTtsVoiceId(voiceId) {
  const v = String(voiceId == null ? '' : voiceId).trim();
  return v || RAVEN_DEFAULT_VOICE_ID;
}

// Only rewrite the exact legacy local overlay URL; any other custom value is left alone.
const LEGACY_OVERLAY_HTTP_URL_LINE =
  /^([ \t]*VIRTUALDECK_HTTP_URL[ \t]*=[ \t]*)(["']?)https?:\/\/(?:localhost|127\.0\.0\.1):8080\/?\2([ \t]*(?:#.*)?)$/gm;

function migrateRavenEnvText(text) {
  const input = String(text == null ? '' : text);
  const output = input
    .replace(LEGACY_OVERLAY_HTTP_URL_LINE, (_m, prefix, _q, trailing) => `${prefix}${RAVEN_BRIDGE_HTTP_URL}${trailing || ''}`)
    .replace(EMPTY_TTS_VOICE_ID_LINE, (_m, prefix) => `${prefix}${RAVEN_DEFAULT_VOICE_ID}`);
  return { text: output, changed: output !== input };
}

/**
 * Apply migrations to a raven.env file in place. Returns true when the file was rewritten.
 * Never throws: a failed migration must not block Raven from starting.
 */
function migrateRavenEnvFile(filePath, fsImpl = require('fs'), log = console) {
  try {
    if (!filePath || !fsImpl.existsSync(filePath)) return false;
    const before = fsImpl.readFileSync(filePath, 'utf8');
    const { text, changed } = migrateRavenEnvText(before);
    if (!changed) return false;
    fsImpl.writeFileSync(filePath, text, 'utf8');
    log.log('[Raven] raven.env migrated (bridge URL / default voice)');
    return true;
  } catch (err) {
    log.warn('[Raven] raven.env migration skipped:', err && err.message);
    return false;
  }
}

module.exports = {
  RAVEN_BRIDGE_HTTP_URL,
  RAVEN_DEFAULT_VOICE_ID,
  RAVEN_DEFAULT_VOICE_NAME,
  resolveTtsVoiceId,
  migrateRavenEnvText,
  migrateRavenEnvFile,
};
