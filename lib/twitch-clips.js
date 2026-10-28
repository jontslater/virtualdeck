/**
 * Twitch clip helpers: Helix create/poll flow, macro template vars, Discord toggle.
 */

const TWITCH_CLIP_POLL_INTERVAL_MS = 1500;
const TWITCH_CLIP_POLL_MAX_MS = 15000;
const TWITCH_CLIP_COOLDOWN_MS = 20000;

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

function formatTwitchClipChatLine(url, requestedBy) {
  const who = requestedBy ? String(requestedBy).replace(/^@/, '') : '';
  return who ? `${who} clipped that: ${url}` : `Clip: ${url}`;
}

async function announceTwitchClipReady({
  url,
  requestedBy,
  discordConfig,
  sayInChat,
  postClipToDiscord,
}) {
  if (sayInChat) {
    await sayInChat(formatTwitchClipChatLine(url, requestedBy));
  }
  if (postClipToDiscord && shouldPostClipsToDiscord(discordConfig)) {
    const who = requestedBy ? String(requestedBy).replace(/^@/, '') : '';
    await postClipToDiscord(url, who ? `${who}'s clip` : 'Stream Clip');
  }
}

/**
 * Helix POST clips + poll GET clips?id= + optional chat/Discord announce (testable with mocks).
 */
async function executeTwitchClipHelixFlow({
  broadcasterId,
  clientId,
  token,
  fetchImpl,
  requestedBy,
  source,
  cooldownMs = TWITCH_CLIP_COOLDOWN_MS,
  lastClipAt = 0,
  sayInChat,
  discordConfig,
  postClipToDiscord,
  pollOptions = {},
} = {}) {
  const now = Date.now();
  if (now - lastClipAt < cooldownMs) {
    if (sayInChat) await sayInChat('Clip cooldown — try again in a few seconds.');
    return { ok: false, reason: 'cooldown' };
  }

  if (!broadcasterId || !clientId || !token) {
    if (sayInChat) await sayInChat("Can't clip — Twitch isn't connected.");
    return { ok: false, reason: 'not-connected' };
  }

  const fetchFn = fetchImpl || global.fetch;
  if (!fetchFn) {
    return { ok: false, reason: 'no-fetch' };
  }

  try {
    const resp = await fetchFn(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${encodeURIComponent(broadcasterId)}&has_delay=false`,
      {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = String((body && body.message) || resp.statusText || '');
      if (sayInChat) {
        if (resp.status === 401 || /scope/i.test(msg)) {
          await sayInChat('Clip failed — reconnect Twitch with the clips:edit scope.');
        } else if (resp.status === 404 || /not live/i.test(msg)) {
          await sayInChat("Can't clip — the stream doesn't look live.");
        } else {
          await sayInChat("Couldn't create a Twitch clip.");
        }
      }
      return { ok: false, reason: msg || String(resp.status) };
    }

    const clipId = body && body.data && body.data[0] && body.data[0].id;
    if (!clipId) {
      if (sayInChat) await sayInChat("Twitch didn't return a clip id.");
      return { ok: false, reason: 'no-id' };
    }

    const polled = await pollTwitchClipUntilReady({
      clipId,
      fetchImpl: fetchFn,
      clientId,
      token,
      ...pollOptions,
    });

    if (!polled.ok || !polled.url) {
      if (sayInChat) {
        await sayInChat('Clip may have failed — check your Twitch dashboard or try again.');
      }
      return { ok: false, reason: polled.reason || 'not-ready', id: clipId };
    }

    const url = polled.url;
    await announceTwitchClipReady({
      url,
      requestedBy,
      discordConfig,
      sayInChat,
      postClipToDiscord,
    });

    return { ok: true, url, id: clipId, clipAt: now, source };
  } catch (err) {
    if (sayInChat) await sayInChat("Couldn't create a Twitch clip.");
    return { ok: false, reason: err && err.message };
  }
}

module.exports = {
  TWITCH_CLIP_COOLDOWN_MS,
  TWITCH_CLIP_POLL_INTERVAL_MS,
  TWITCH_CLIP_POLL_MAX_MS,
  isTwitchClipReady,
  pollTwitchClipUntilReady,
  shouldPostClipsToDiscord,
  applyMacroTemplateVars,
  mergeClipResultIntoMacroVars,
  formatTwitchClipChatLine,
  announceTwitchClipReady,
  executeTwitchClipHelixFlow,
};
