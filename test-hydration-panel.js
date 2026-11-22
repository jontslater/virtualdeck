#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const panelJs = fs.readFileSync(path.join(__dirname, 'public/hydration-panel.js'), 'utf8');
assert.match(panelJs, /await api\('getHydrationUrl'\)\(\)/, 'getHydrationUrl IPC must be invoked, not referenced');
assert.ok(
  !/await api\('getHydrationUrl'\)[^(\s]/m.test(panelJs.replace(/await api\('getHydrationUrl'\)\(\)/g, '')),
  'no bare await api(getHydrationUrl) without ()',
);

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
assert.match(html, /id="hydration-panel-modal" class="alert-widget/);
assert.match(html, /hydration-panel-backdrop/);
assert.match(html, /hydration-browse-log-sound/);
assert.match(html, /class="url-display"/);

const pre = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
assert.match(pre, /pickAudioFileForSounds/);
assert.match(pre, /pick-audio-file-for-sounds/);

const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
assert.match(main, /pick-audio-file-for-sounds/);

const rewardsUi = fs.readFileSync(path.join(__dirname, 'public/channel-rewards-ui.js'), 'utf8');
assert.match(rewardsUi, /return \{ ok, rewards, error \}/);

console.log('✅ test-hydration-panel.js passed');