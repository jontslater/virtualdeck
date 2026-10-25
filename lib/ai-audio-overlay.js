/**
 * Raven / AI TTS playback routing for OBS browser-source overlays.
 * Audio must only reach the dedicated aiAudio overlay (never alert/custom/vtuber overlays).
 */

const RAVEN_AI_AUDIO_OVERLAY = 'aiAudio';

/**
 * @param {string} audioUrl
 * @param {number} [volume]
 */
function buildRavenPlayAudioMessage(audioUrl, volume = 1.0) {
  const vol = typeof volume === 'number' && !Number.isNaN(volume) ? volume : 1.0;
  return {
    type: 'play-audio',
    src: audioUrl,
    url: audioUrl,
    audioUrl,
    volume: vol,
    ravenTts: true,
  };
}

/**
 * True when a buttonTrigger payload is the legacy Raven TTS fallback (should not play on generic overlays).
 * @param {object} payload
 */
function isLegacyRavenTtsButtonTrigger(payload) {
  if (!payload || payload.type !== 'buttonTrigger') return false;
  const name = payload.options && payload.options.name;
  if (name === 'AI TTS') return true;
  const media = []
    .concat(payload.centerMedia || [], payload.fullscreenMedia || [])
    .filter(Boolean);
  return media.some((m) => m.type === 'audio' && m.ravenTts === true);
}

/**
 * @param {Map<string, Set>} overlayRegistry
 */
function hasAiAudioOverlayClients(overlayRegistry) {
  if (!overlayRegistry || typeof overlayRegistry.get !== 'function') return false;
  const clients = overlayRegistry.get(RAVEN_AI_AUDIO_OVERLAY);
  return !!(clients && clients.size > 0);
}

module.exports = {
  RAVEN_AI_AUDIO_OVERLAY,
  buildRavenPlayAudioMessage,
  isLegacyRavenTtsButtonTrigger,
  hasAiAudioOverlayClients,
};
