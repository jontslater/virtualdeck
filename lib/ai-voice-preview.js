/**
 * ElevenLabs voice preview fetch (main process only). API key stays in raven.env.
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const { assertAllowedMainProcessFetchUrl } = require('./security');
const { getHostWakeNamesFromConfig } = require('./wake-names');
const sessionCache = new Map();

const VOICE_ID_RE = /^[a-zA-Z0-9]{10,64}$/;
const TTS_MODEL_ID = 'eleven_flash_v2_5';
const MAX_SAMPLE_CHARS = 100;

/**
 * @param {unknown} voiceId
 * @returns {{ ok: true, voiceId: string } | { ok: false, error: string }}
 */
function validateVoicePreviewVoiceId(voiceId) {
  if (typeof voiceId !== 'string' || !voiceId.trim()) {
    return { ok: false, error: 'voiceId is required' };
  }
  const id = voiceId.trim();
  if (!VOICE_ID_RE.test(id)) {
    return { ok: false, error: 'Invalid voiceId format' };
  }
  return { ok: true, voiceId: id };
}

/**
 * @param {unknown} previewUrl
 * @returns {{ ok: true, previewUrl: string } | { ok: false, error: string } | { ok: true, previewUrl: null }}
 */
function validateVoicePreviewUrl(previewUrl) {
  if (previewUrl === undefined || previewUrl === null || previewUrl === '') {
    return { ok: true, previewUrl: null };
  }
  if (typeof previewUrl !== 'string') {
    return { ok: false, error: 'previewUrl must be a string' };
  }
  const trimmed = previewUrl.trim();
  if (!trimmed) {
    return { ok: true, previewUrl: null };
  }
  try {
    assertAllowedMainProcessFetchUrl(trimmed);
  } catch (err) {
    return { ok: false, error: err.message || 'previewUrl not allowed' };
  }
  return { ok: true, previewUrl: trimmed };
}

/**
 * @param {unknown} payload
 */
function validateVoicePreviewRequest(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  const idResult = validateVoicePreviewVoiceId(payload.voiceId);
  if (!idResult.ok) return idResult;
  const urlResult = validateVoicePreviewUrl(payload.previewUrl);
  if (!urlResult.ok) return urlResult;
  return {
    ok: true,
    voiceId: idResult.voiceId,
    previewUrl: urlResult.previewUrl,
  };
}

function buildPreviewSampleLine(configMap) {
  const { primary } = getHostWakeNamesFromConfig(configMap);
  const line = `Hey, I'm ${primary}. This is how I sound.`;
  return line.length > MAX_SAMPLE_CHARS ? line.slice(0, MAX_SAMPLE_CHARS) : line;
}

function cacheKey(voiceId, previewUrl) {
  return crypto.createHash('sha256').update(`${voiceId}|${previewUrl || 'tts'}`).digest('hex');
}

function mapFetchError(status) {
  if (status === 401) return 'ElevenLabs rejected the API key (401). Check TTS_API_KEY in raven.env.';
  if (status === 429) return 'ElevenLabs rate limit (429). Try again in a moment.';
  return `ElevenLabs request failed (${status})`;
}

/**
 * @param {{ voiceId: string, previewUrl: string|null, apiKey: string, configMap: Record<string,string> }} opts
 */
async function fetchVoicePreviewAudio(opts) {
  const { voiceId, previewUrl, apiKey, configMap } = opts;
  if (!apiKey || !String(apiKey).trim()) {
    return { success: false, error: 'TTS_API_KEY not configured in raven.env' };
  }

  const key = cacheKey(voiceId, previewUrl);
  const cached = sessionCache.get(key);
  if (cached) {
    return { success: true, mimeType: cached.mimeType, dataBase64: cached.dataBase64, cached: true };
  }

  try {
    let res;
    let mimeType = 'audio/mpeg';

    if (previewUrl) {
      assertAllowedMainProcessFetchUrl(previewUrl);
      res = await fetch(previewUrl, { method: 'GET' });
      const ct = res.headers.get('content-type');
      if (ct && ct.startsWith('audio/')) mimeType = ct.split(';')[0].trim();
    } else {
      const text = buildPreviewSampleLine(configMap);
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: TTS_MODEL_ID,
        }),
      });
    }

    if (!res.ok) {
      return { success: false, error: mapFetchError(res.status) };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) {
      return { success: false, error: 'Empty audio response from ElevenLabs' };
    }

    const dataBase64 = buf.toString('base64');
    sessionCache.set(key, { mimeType, dataBase64 });
    return { success: true, mimeType, dataBase64, cached: false };
  } catch (err) {
    return {
      success: false,
      error: err && err.message ? `Network error: ${err.message}` : 'Network error fetching preview',
    };
  }
}

function clearVoicePreviewSessionCache() {
  sessionCache.clear();
}

module.exports = {
  validateVoicePreviewVoiceId,
  validateVoicePreviewUrl,
  validateVoicePreviewRequest,
  buildPreviewSampleLine,
  fetchVoicePreviewAudio,
  clearVoicePreviewSessionCache,
  TTS_MODEL_ID,
};
