#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  clampPercent,
  normalizeButtonVolume,
  getEffectiveMultiplier,
  effectiveVolume,
  formatMasterVolumeLabel,
} = require('./lib/master-volume');

assert.strictEqual(clampPercent(150), 100);
assert.strictEqual(clampPercent(-5), 0);
assert.strictEqual(clampPercent('72.4'), 72);

assert.strictEqual(normalizeButtonVolume(0.5), 0.5);
assert.strictEqual(normalizeButtonVolume(80), 0.8);
assert.strictEqual(normalizeButtonVolume(undefined), 1);

assert.strictEqual(getEffectiveMultiplier({ percent: 50, muted: false }), 0.5);
assert.strictEqual(getEffectiveMultiplier({ percent: 50, muted: true }), 0);

assert.strictEqual(effectiveVolume(1, { percent: 100, muted: false }), 1);
assert.strictEqual(effectiveVolume(0.8, { percent: 50, muted: false }), 0.4);
assert.strictEqual(effectiveVolume(0.8, { percent: 50, muted: true }), 0);
assert.strictEqual(effectiveVolume(100, { percent: 25, muted: false }), 0.25);

assert.strictEqual(formatMasterVolumeLabel(80, false), '80%');
assert.strictEqual(formatMasterVolumeLabel(80, true), 'Muted');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
assert.ok(html.includes('id="master-volume-input"'), 'master volume slider in main UI');
assert.ok(html.includes('id="master-volume-mute"'), 'master volume mute control');
assert.ok(html.indexOf('master-volume.js') < html.indexOf('script.js'), 'master-volume loads before script.js');

const css = fs.readFileSync(path.join(__dirname, 'public/styles.css'), 'utf8');
assert.ok(css.includes('--master-volume-track'), 'master volume track skin variable');
assert.ok(css.includes('--master-volume-thumb'), 'master volume thumb skin variable');

console.log('✅ test-master-volume.js passed');
