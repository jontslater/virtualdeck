#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  normalizePlaybackMode,
  getSoundButtonKey,
  shouldStopOnTogglePress,
  persistPlaybackModeField,
} = require('./lib/sound-playback-mode');

assert.strictEqual(normalizePlaybackMode(undefined), 'repeat');
assert.strictEqual(normalizePlaybackMode('repeat'), 'repeat');
assert.strictEqual(normalizePlaybackMode('toggle'), 'toggle');
assert.strictEqual(normalizePlaybackMode('nope'), 'repeat');

assert.strictEqual(getSoundButtonKey({ id: 'b_1', label: 'X' }), 'b_1');
assert.strictEqual(getSoundButtonKey({ label: 'Airhorn' }), 'Airhorn');

const playing = { paused: false, ended: false };
assert.strictEqual(shouldStopOnTogglePress('toggle', playing), true);
assert.strictEqual(shouldStopOnTogglePress('repeat', playing), false);
assert.strictEqual(shouldStopOnTogglePress('toggle', { paused: true, ended: false }), false);

assert.strictEqual(persistPlaybackModeField('repeat'), undefined);
assert.strictEqual(persistPlaybackModeField('toggle'), 'toggle');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
assert.ok(html.includes('name="sound-playback-mode"'), 'playback mode radios in settings form');
assert.ok(html.includes('value="repeat"'), 'repeat playback option');
assert.ok(html.includes('value="toggle"'), 'toggle playback option');

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');
assert.ok(script.includes('soundboardActiveAudio'), 'tracks active toggle playback');
assert.ok(script.includes('normalizeSoundPlaybackMode'), 'normalizes playback mode in renderer');

const mainJs = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
assert.ok(mainJs.includes('playbackMode'), 'main process persists playbackMode');

console.log('✅ test-sound-playback-mode.js passed');