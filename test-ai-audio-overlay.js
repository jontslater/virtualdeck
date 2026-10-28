#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  RAVEN_AI_AUDIO_OVERLAY,
  buildRavenPlayAudioMessage,
  isLegacyRavenTtsButtonTrigger,
  hasAiAudioOverlayClients,
} = require('./lib/ai-audio-overlay');

assert.strictEqual(RAVEN_AI_AUDIO_OVERLAY, 'aiAudio');

const msg = buildRavenPlayAudioMessage('http://localhost:8080/media/tts/foo.mp3', 0.8);
assert.strictEqual(msg.type, 'play-audio');
assert.strictEqual(msg.ravenTts, true);
assert.strictEqual(msg.volume, 0.8);
assert.strictEqual(msg.audioUrl, msg.src);

assert.ok(
  isLegacyRavenTtsButtonTrigger({
    type: 'buttonTrigger',
    options: { name: 'AI TTS' },
    centerMedia: [{ type: 'audio', src: 'x' }],
  }),
);
assert.ok(!isLegacyRavenTtsButtonTrigger({ type: 'buttonTrigger', options: { name: 'Follow Alert' } }));

const registry = new Map([['aiAudio', new Set(['ws1'])]]);
assert.strictEqual(hasAiAudioOverlayClients(registry), true);
assert.strictEqual(hasAiAudioOverlayClients(new Map()), false);

const mainJs = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
assert.ok(
  !mainJs.includes('broadcast to all overlays'),
  'main.js must not fall back to global Raven TTS broadcast',
);
assert.ok(
  mainJs.includes("broadcastToOverlay(playAudioMessage, RAVEN_AI_AUDIO_OVERLAY)"),
  'main.js must target aiAudio overlay only',
);
assert.ok(
  !mainJs.includes("name: 'AI TTS'"),
  'legacy buttonTrigger Raven TTS fallback removed from main.js',
);

const baseOverlay = fs.readFileSync(path.join(__dirname, 'overlays/baseOverlay/index.html'), 'utf8');
assert.ok(baseOverlay.includes('isRavenTtsOnlyButtonTrigger'), 'base overlay ignores Raven TTS buttonTrigger');

const scriptJs = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');
assert.ok(
  scriptJs.includes('speakManualText(speakText'),
  'alert Raven TTS uses speak pipeline (aiAudio + dashboard), not alert overlay audio',
);

console.log('✅ test-ai-audio-overlay.js passed');
