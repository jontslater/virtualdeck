/**
 * Twitch clip helpers: Helix polling, macro template vars, mod/broadcaster gate, Discord toggle.
 */

const TWITCH_CLIP_POLL_INTERVAL_MS = 1500;
const TWITCH_CLIP_POLL_MAX_MS = 15000;

function isTwitchClipReady(clip) {
  if (!clip) return false;
  const url = clip.url || clip.edit_url;
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * Poll GET helix/clips?id= until the clip URL is available or timeout.
 */
async function pollTwitchClipUntilReady({
  clipId,
  fetchImpl,
  clientId,
  token,
  intervalMs = TWITCH_CLIP_POLL_INTERVAL_MS,
  maxWaitMs = TWITCH_CLIP_POLL_MAX_MS,
} = {}) {
  if (!clipId) {
    return { ok: false, reason: 'no-id' };
  }
  const fetchFn = fetchImpl || global.fetch;
  if (!fetchFn) {
    return { ok: false, reason: 'no-fetch' };
  }
  const start = Date.now();
  let lastBody = null;
  while (Date.now() - start < maxWaitMs) {
    const resp = await fetchFn(
      `https://api.twitch.tv/helix/clips?id=${encodeURIComponent(clipId)}`,
      {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const body = await resp.json().catch(() => ({}));
    lastBody = body;
    const clip = body && body.data && body.data[0];
    if (resp.ok && isTwitchClipReady(clip)) {
      const url = (clip.url || clip.edit_url || '').trim();
      return { ok: true, url, id: clipId, clip };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: false, reason: 'timeout', id: clipId, lastBody };
}

function shouldPostClipsToDiscord(discordConfig) {
  if (!discordConfig || !discordConfig.webhookUrl) return false;
  if (discordConfig.postClipsToDiscord === false) return false;
  return true;
}

function applyMacroTemplateVars(value, vars) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (vars[key] != null && vars[key] !== '') return String(vars[key]);
      return `{{${key}}}`;
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => applyMacroTemplateVars(v, vars));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = applyMacroTemplateVars(v, vars);
    }
    return out;
  }
  return value;
}

function mergeClipResultIntoMacroVars(vars, result) {
  const next = { ...(vars || {}) };
  if (!result || typeof result !== 'object') return next;
  const url = result.clipUrl || result.url;
  const id = result.clipId || result.id;
  if (url) next.clipUrl = url;
  if (id) next.clipId = id;
  return next;
}

function isTwitchClipCommandAuthorized(username, tags, channelLogin) {
  if (!username) return false;
  const uname = String(username).replace(/^@/, '').trim().toLowerCase();
  const channel = String(channelLogin || '').replace(/^#/, '').trim().toLowerCase();
  if (channel && uname === channel) return true;
  if (tags && tags.mod) return true;
  const badges = (tags && tags.badges) || {};
  if (badges.broadcaster || badges.moderator || badges.mod) return true;
  return false;
}

module.exports = {
  TWITCH_CLIP_POLL_INTERVAL_MS,
  TWITCH_CLIP_POLL_MAX_MS,
  isTwitchClipReady,
  pollTwitchClipUntilReady,
  shouldPostClipsToDiscord,
  applyMacroTemplateVars,
  mergeClipResultIntoMacroVars,
  isTwitchClipCommandAuthorized,
};
