/**
 * Registry of deck button types that invoke host actions (not raw audio/multi-media payloads).
 * Macro steps use lib/jarvis-macro-allowlist.js + public/macros-ui.js ALLOWLISTED_TOOLS.
 */

const DECK_BUTTON_ACTIONS = {
  'twitch-clip': {
    type: 'twitch-clip',
    label: 'Twitch Clip',
    ipc: 'createTwitchClip',
  },
  'post-socials': {
    type: 'post-socials',
    label: 'Post Socials',
    ipc: 'post-socials',
  },
  'run-ad': {
    type: 'run-ad',
    label: 'Run Ad',
    ipc: 'start-twitch-commercial',
  },
  'speak-tts': {
    type: 'speak-tts',
    label: 'Speak (TTS)',
    ipc: 'speak-tts-deck',
    configFields: ['speakText'],
    placeholderHint: '{user}, {username}, {display_name}, {message}, …',
  },
};

function isDeckButtonActionType(type) {
  return Boolean(type && DECK_BUTTON_ACTIONS[type]);
}

function getDeckButtonAction(type) {
  return type ? DECK_BUTTON_ACTIONS[type] || null : null;
}

module.exports = {
  DECK_BUTTON_ACTIONS,
  isDeckButtonActionType,
  getDeckButtonAction,
};
