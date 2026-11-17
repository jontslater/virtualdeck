/**
 * Per-button sound playback modes for audio deck buttons.
 * Default "repeat" matches legacy behavior (each trigger starts a new play, overlapping allowed).
 */

const SOUND_PLAYBACK_REPEAT = 'repeat';
const SOUND_PLAYBACK_TOGGLE = 'toggle';

function normalizePlaybackMode(raw) {
  if (raw === SOUND_PLAYBACK_TOGGLE) return SOUND_PLAYBACK_TOGGLE;
  return SOUND_PLAYBACK_REPEAT;
}

function getSoundButtonKey(button) {
  if (!button || typeof button !== 'object') return '';
  return String(button.id || button.label || button.name || '');
}

function isAudioActivelyPlaying(audio) {
  if (!audio) return false;
  return !audio.paused && !audio.ended;
}

function shouldStopOnTogglePress(mode, audio) {
  return normalizePlaybackMode(mode) === SOUND_PLAYBACK_TOGGLE && isAudioActivelyPlaying(audio);
}

function persistPlaybackModeField(mode) {
  return normalizePlaybackMode(mode) === SOUND_PLAYBACK_TOGGLE ? SOUND_PLAYBACK_TOGGLE : undefined;
}

module.exports = {
  SOUND_PLAYBACK_REPEAT,
  SOUND_PLAYBACK_TOGGLE,
  normalizePlaybackMode,
  getSoundButtonKey,
  isAudioActivelyPlaying,
  shouldStopOnTogglePress,
  persistPlaybackModeField,
};