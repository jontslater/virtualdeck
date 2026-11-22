#!/usr/bin/env node
// Hydration settings panel must use a fixed full-screen overlay (body is display:flex).
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8') + fs.readFileSync('public/hydration-panel.css', 'utf8');
const modalJs = fs.readFileSync('public/modal-escape.js', 'utf8');
const panelJs = fs.readFileSync('public/hydration-panel.js', 'utf8');

const panelStart = html.indexOf('id="hydration-panel-modal"');
assert.ok(panelStart > 0, 'hydration-panel-modal exists in index.html');
assert.ok(html.includes('aria-modal="true"'), 'hydration panel is an aria modal');
assert.ok(html.includes('id="hydration-panel-title"'), 'hydration panel has labelled title');
assert.ok(!html.includes('hydration-panel-modal" class="hidden">\n    <div class="modal-content preferences-modal-content" style='), 'inline width override removed');

assert.match(css, /#hydration-panel-modal\s*\{[^}]*position:\s*fixed/s, 'overlay uses position:fixed');
assert.match(css, /#hydration-panel-modal\.hidden\s*\{[^}]*display:\s*none/s, 'hidden state defined');

assert.ok(modalJs.includes("'hydration-panel-modal': 'closeHydrationPanel'"), 'Esc closes via modal-escape');
assert.ok(panelJs.includes('window.closeHydrationPanel = closePanel'), 'global close for Esc handler');

console.log('✅ test-hydration-panel-modal.js passed');