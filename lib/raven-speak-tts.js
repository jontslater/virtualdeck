'use strict';

const { speakViaDevApi } = require('./raven-dev-speak');
const { replacePlaceholders, appendSocialsToUserData } = require('./alert-placeholders');
const { RAVEN_AI_AUDIO_OVERLAY } = require('./ai-audio-overlay');

/**
 * Raven TTS for macros and deck buttons.
 *
 * Fallback behavior:
 * - Pro AI license required (same as Quick Say / raven-dev-speak). Always fails the step when denied.
 * - Raven not running, empty text, or Dev API errors: step fails by default.
 * - When `optional: true`, unavailable TTS is skipped with a console warning and `{ success: true, skipped: true }`.
 * - Synthesis provider (ElevenLabs vs Raven fallback voice) is decided by the Raven controller from raven.env.
 * - OBS routing uses lib/ai-audio-overlay.js (`aiAudio` only). Dashboard uses play-ai-tts. Other overlays are never used.
 */

function buildSpeakPlaceholderUserData(context, extraUserData) {
  const { config, twitchUserName } = context || {};
  const base =
    extraUserData && typeof extraUserData === 'object'
      ? { ...extraUserData }
      : {
          username: twitchUserName || 'Unknown',
          display_name: twitchUserName || 'Unknown',
          user: twitchUserName || 'Unknown',
        };
  return appendSocialsToUserData(base, config && config.socials);
}

function resolveSpeakTtsText(template, context, extraUserData) {
  const raw = String(template || '').trim();
  if (!raw) return '';
  const userData = buildSpeakPlaceholderUserData(context, extraUserData);
  return String(replacePlaceholders(raw, userData) || '').trim();
}

function checkAiLicense(licenseGate) {
  if (typeof licenseGate !== 'function') return { allowed: true };
  const gate = licenseGate();
  if (!gate || gate.allowed) return { allowed: true };
  return { allowed: false, message: gate.message || 'AI assistant requires a Pro license' };
}

function warn(log, msg) {
  const line = `[Speak TTS] ${msg}`;
  if (log && typeof log.warn === 'function') log.warn(line);
  else console.warn(line);
}

/**
 * @param {object} deps
 * @param {{ text: string, optional?: boolean, userData?: object, source?: string }} options
 */
async function executeSpeakTts(deps, options) {
  const {
    licenseGate,
    isRavenRunning,
    speakDeps,
    log,
  } = deps;
  const optional = !!(options && options.optional);
  const source = (options && options.source) || 'unknown';

  const license = checkAiLicense(licenseGate);
  if (!license.allowed) {
    return { success: false, error: license.message, source };
  }

  const resolved = resolveSpeakTtsText(options && options.text, deps.context, options && options.userData);
  if (!resolved) {
    const err = 'empty_text';
    if (optional) {
      warn(log, `Skipped empty speak text (${source})`);
      return { success: true, skipped: true, reason: err, source };
    }
    return { success: false, error: err, source };
  }

  if (typeof isRavenRunning === 'function') {
    const running = isRavenRunning();
    if (running === false) {
      const err = 'Raven is not running. Start Raven AI from Tools → Raven AI.';
      if (optional) {
        warn(log, `${err} (${source})`);
        return { success: true, skipped: true, reason: 'raven_not_running', source };
      }
      return { success: false, error: err, source };
    }
  }

  const speakFn = typeof deps.speakViaDevApi === 'function' ? deps.speakViaDevApi : speakViaDevApi;
  if (typeof speakFn !== 'function') {
    return { success: false, error: 'speak_pipeline_unavailable', source };
  }

  const out = await speakFn(speakDeps, resolved);
  if (!out || !out.ok) {
    const err = (out && out.error) || 'speak_failed';
    if (optional) {
      warn(log, `Skipped: ${err} (${source})`);
      return { success: true, skipped: true, reason: err, source, text: resolved };
    }
    return { success: false, error: err, source, text: resolved };
  }

  return {
    success: true,
    source,
    text: resolved,
    via: out.via,
    overlay: RAVEN_AI_AUDIO_OVERLAY,
  };
}

module.exports = {
  executeSpeakTts,
  resolveSpeakTtsText,
  buildSpeakPlaceholderUserData,
  checkAiLicense,
};
