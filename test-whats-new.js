#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  getWhatsNewState,
  isFreshWhatsNewInstall,
  recordFreshInstallBaseline,
  shouldAutoShowWhatsNew,
  shouldDeferWhatsNewPrompt,
  markWhatsNewSeen,
} = require('./lib/whats-new/state');
const { compareVersions } = require('./lib/whats-new/version');
const {
  loadReleaseFile,
  hasReleaseNotesForVersion,
  resolveReleaseForAppVersion,
} = require('./lib/whats-new/load');
const { PATCH_NOTES_URL, WHATS_NEW_STATE_VERSION } = require('./lib/whats-new/constants');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const pre = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');

assert.ok(html.includes('id="whats-new-modal"'), 'whats-new modal in HTML');
assert.ok(html.includes('menu-help-whats-new'), 'help menu whats-new entry');
assert.ok(html.includes('preferences-whats-new-btn'), 'preferences whats-new entry');
assert.ok(html.includes('whats-new-ui.js'), 'whats-new-ui script tag');
assert.ok(pre.includes('whats-new-get-prompt'), 'preload whats-new IPC');

assert.strictEqual(WHATS_NEW_STATE_VERSION, 1);
assert.ok(PATCH_NOTES_URL.includes('virtualdeck.app'), PATCH_NOTES_URL);

assert.strictEqual(compareVersions('1.2.6', '1.2.7'), -1);
assert.strictEqual(compareVersions('1.2.7', '1.2.8'), -1);

assert.strictEqual(hasReleaseNotesForVersion('1.2.8'), true);
const rel128 = loadReleaseFile('1.2.8');
assert.ok(rel128.features && rel128.features.length >= 2, '1.2.8 seed content');

let prefs = {};
const freshState = getWhatsNewState(prefs);
assert.strictEqual(isFreshWhatsNewInstall(freshState), true);
assert.strictEqual(shouldAutoShowWhatsNew(freshState, '1.2.8', true), false, 'fresh install skips auto');

({ preferences: prefs } = recordFreshInstallBaseline(prefs, '1.2.8'));
const afterBaseline = getWhatsNewState(prefs);
assert.strictEqual(afterBaseline.lastSeenVersion, '1.2.8');
assert.strictEqual(shouldAutoShowWhatsNew(afterBaseline, '1.2.8', true), false, 'same version');

prefs = markWhatsNewSeen({}, '1.2.7');
assert.strictEqual(shouldAutoShowWhatsNew(getWhatsNewState(prefs), '1.2.8', true), true, 'upgrade shows');

prefs = markWhatsNewSeen({}, '1.2.6');
assert.strictEqual(shouldAutoShowWhatsNew(getWhatsNewState(prefs), '1.2.7', true), true, '1.2.6 → 1.2.7');

assert.strictEqual(shouldDeferWhatsNewPrompt({ isStreamLive: true }), true);
assert.strictEqual(shouldDeferWhatsNewPrompt({ alertActive: true }), true);
assert.strictEqual(shouldDeferWhatsNewPrompt({}), false);

const resolved128 = resolveReleaseForAppVersion('1.2.8');
assert.strictEqual(resolved128.resolvedVersion, '1.2.8');
assert.strictEqual(resolved128.release.version, '1.2.8');

const resolved127 = resolveReleaseForAppVersion('1.2.7');
assert.strictEqual(resolved127.resolvedVersion, '1.2.7');
assert.strictEqual(resolved127.release.version, '1.2.7');

const resolved126 = resolveReleaseForAppVersion('1.2.6');
assert.strictEqual(resolved126.resolvedVersion, '1.2.6');

console.log('✅ test-whats-new.js passed');