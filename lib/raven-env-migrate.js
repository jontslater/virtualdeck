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

// Only rewrite the exact legacy local overlay URL; any other custom value is left alone.
const LEGACY_OVERLAY_HTTP_URL_LINE =
  /^([ \t]*VIRTUALDECK_HTTP_URL[ \t]*=[ \t]*)(["']?)https?:\/\/(?:localhost|127\.0\.0\.1):8080\/?\2([ \t]*(?:#.*)?)$/gm;

function migrateRavenEnvText(text) {
  const input = String(text == null ? '' : text);
  const output = input.replace(LEGACY_OVERLAY_HTTP_URL_LINE, (_m, prefix, _q, trailing) => `${prefix}${RAVEN_BRIDGE_HTTP_URL}${trailing || ''}`);
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
    log.log(`[Raven] VIRTUALDECK_HTTP_URL pointed at the VirtualDeck overlay server (8080); switched to the Raven bridge (${RAVEN_BRIDGE_HTTP_URL})`);
    return true;
  } catch (err) {
    log.warn('[Raven] raven.env migration skipped:', err && err.message);
    return false;
  }
}

module.exports = {
  RAVEN_BRIDGE_HTTP_URL,
  migrateRavenEnvText,
  migrateRavenEnvFile,
};
