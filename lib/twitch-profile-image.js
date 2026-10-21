/**
 * Twitch profile image URL sanitization (walk-on / raid favorites).
 * Only https://static-cdn.jtvnw.net is allowed.
 */
function sanitizeTwitchProfileImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'static-cdn.jtvnw.net') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

module.exports = {
  sanitizeTwitchProfileImageUrl,
};
