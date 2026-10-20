#!/usr/bin/env node
// Static checks: AI audio settings live in a modal and every control id kept working.
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const modalStart = html.indexOf('<div id="ai-audio-modal"');
assert.ok(modalStart > 0, 'modal exists');
const panelAt = html.indexOf('id="ai-management-panel"');
assert.ok(panelAt > modalStart, 'panel is inside the modal');
assert.strictEqual(html.split('id="ai-management-panel"').length, 2, 'panel only once');
for (const id of ['ai-voice-selector', 'ai-voice-preview', 'ai-audio-overlay-url', 'copy-ai-audio-overlay-url', 'ai-settings-btn']) {
  const at = html.indexOf('id="' + id + '"');
  assert.ok(at > modalStart, id + ' inside modal');
  assert.strictEqual(html.split('id="' + id + '"').length, 2, id + ' unique');
}
assert.ok(html.includes('id="menu-view-ai-audio-settings"'), 'menu opener');
assert.ok(!html.includes('toggle-ai-management-panel'), 'old view toggle removed');
assert.ok(html.includes('toggle-ai-dashboard'), 'AI dashboard view toggle present');
assert.ok(html.includes('<script src="ai-audio-modal.js"></script>'));
const js = fs.readFileSync('public/script.js', 'utf8');
assert.ok(!js.includes("'toggle-ai-management-panel'"), 'visibility map entry removed');
assert.ok(fs.readFileSync('public/styles.css', 'utf8').includes('#ai-audio-modal.hidden'));
console.log('\u2705 test-ai-audio-modal.js passed');
