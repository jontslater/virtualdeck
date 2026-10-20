#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
assert.ok(html.includes('id="raven-api-preferences-section"'), 'Raven API preferences section');
assert.ok(html.includes('id="raven-llm-api-key"'), 'LLM key field');
assert.ok(html.includes('toggle-ai-dashboard'), 'AI dashboard view toggle');
assert.ok(!html.includes('Numpad Currently Not supported'), 'numpad banner removed');
assert.ok(html.includes('alert-settings-primary'), 'alert editor left column wrapper');
assert.ok(html.includes('license-key-toggle-visibility'), 'license key show/hide toggle');
assert.ok(html.includes('raven-setup-ui.js'), 'raven setup script included');
assert.ok(html.includes('id="raven-api-test-llm-btn"'), 'Raven test LLM button');
assert.ok(html.includes('id="deck-icon-source"'), 'deck icon picker in settings');
assert.ok(html.includes('deck-icon-picker.js'), 'deck icon picker script');

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');
assert.ok(script.includes('buildDefaultAppIconDataUrl'), 'default app icon helper');
assert.ok(script.includes('insertAppIconIntoCard'), 'DOM icon insertion');
assert.ok(script.includes('allowOfflineMute'), 'offline MUTED handling for AI toggle');
assert.ok(!script.includes('alt="App Icon" class="app-icon"'), 'app icons must not be built via innerHTML strings');

const host = fs.readFileSync(path.join(__dirname, 'raven-host.js'), 'utf8');
assert.ok(host.includes('function getSetupStatus'), 'raven getSetupStatus');
assert.ok(host.includes('function updateApiKeys'), 'raven updateApiKeys');
assert.ok(host.includes('function formatEnvValue'), 'raven env value quoting');
assert.ok(host.includes('restartRavenIfRunning'), 'raven restart after key save');

console.log('✅ test-raven-setup.js passed');
