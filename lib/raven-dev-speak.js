const fs = require('fs');
const path = require('path');
const { buildDevApiCandidates, DEV_SPEAK_PATH } = require('./raven-manual-speak');

async function fetchJson(fetchFn, url, options, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs || 12000);
  try {
    const res = await fetchFn(url, { ...(options || {}), signal: controller.signal });
    const raw = await res.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    return { res, raw, json };
  } finally {
    clearTimeout(t);
  }
}

function extractPlaybackPayload(json, userDataPath, overlayPort) {
  if (!json || typeof json !== 'object') return null;
  const port = overlayPort || 8080;
  const pick = (p) => {
    if (!p) return null;
    if (p.audioUrl) return { audioUrl: p.audioUrl, volume: p.volume };
    if (p.url) return { audioUrl: p.url, volume: p.volume };
    const rel = p.relativePath || p.filePath;
    if (!rel) return null;
    const abs = path.isAbsolute(rel) ? rel : path.join(userDataPath, rel);
    if (!fs.existsSync(abs)) return null;
    let relativePath = path.relative(userDataPath, abs).replace(/\\/g, '/');
    const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
    return {
      relativePath,
      audioUrl: `http://localhost:${port}/media/${encodedPath}?t=${Date.now()}`,
      volume: p.volume,
    };
  };
  return pick(json) || pick(json.playback) || pick(json.audio);
}

async function waitForAiCommandPlayback({
  fsApi,
  aiCommandsPath,
  sinceMtimeMs,
  timeoutMs,
  handleCommands,
}) {
  const deadline = Date.now() + (timeoutMs || 10000);
  while (Date.now() < deadline) {
    try {
      if (fsApi.existsSync(aiCommandsPath)) {
        const stat = fsApi.statSync(aiCommandsPath);
        if (stat.mtimeMs > sinceMtimeMs && stat.size > 0) {
          if (typeof handleCommands === 'function') handleCommands();
          return true;
        }
      }
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

/**
 * POST /api/dev/speak and route audio through the dashboard play-ai-tts pipeline when possible.
 */
async function speakViaDevApi(deps, text) {
  const {
    fetchFn,
    userDataPath,
    overlayPort,
    aiCommandsPath,
    getMainWindow,
    handleAIAudioCommands,
    storedDevBaseUrl,
  } = deps;
  const trimmed = String(text || '').trim();
  if (!trimmed) return { ok: false, error: 'empty_text' };

  const candidates = buildDevApiCandidates(storedDevBaseUrl);
  let lastError = 'Raven did not answer';
  const beforeMtime = (() => {
    try {
      return fs.existsSync(aiCommandsPath) ? fs.statSync(aiCommandsPath).mtimeMs : 0;
    } catch {
      return 0;
    }
  })();

  for (const base of candidates) {
    try {
      const { res, raw, json } = await fetchJson(
        fetchFn,
        `${base}${DEV_SPEAK_PATH}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            mood: 'neutral',
            urgency: 'med',
            playbackTarget: 'host',
            dashboardPlayback: true,
          }),
        },
        15000,
      );
      if (!res.ok) {
        lastError = raw || `HTTP ${res.status}`;
        continue;
      }

      const playback = extractPlaybackPayload(json, userDataPath, overlayPort);
      const win = getMainWindow && getMainWindow();
      if (playback && typeof deps.routeRavenTtsPlayback === 'function') {
        deps.routeRavenTtsPlayback(playback);
      }
      if (playback && win && !win.isDestroyed()) {
        win.webContents.send('play-ai-tts', {
          relativePath: playback.relativePath,
          audioUrl: playback.audioUrl,
          volume: playback.volume || 1.0,
        });
        return { ok: true, base, via: 'response' };
      }

      const waited = await waitForAiCommandPlayback({
        fsApi: fs,
        aiCommandsPath,
        sinceMtimeMs: beforeMtime,
        timeoutMs: 12000,
        handleCommands: handleAIAudioCommands,
      });
      if (waited && win && !win.isDestroyed()) {
        return { ok: true, base, via: 'ai-commands' };
      }

      return { ok: true, base, via: 'api-only', note: 'Speak accepted; waiting for host audio pipeline' };
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
  }
  return { ok: false, error: lastError };
}

module.exports = {
  speakViaDevApi,
  extractPlaybackPayload,
};
