const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  presenterModeFromValue,
  parseEnabledResponse,
  isNetworkUnreachableError,
  enabledEndpoint,
} = require('./lib/raven-ai-control');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, rel), 'utf8');
}

assert.strictEqual(presenterModeFromValue('copilot'), 'COPILOT');
assert.strictEqual(presenterModeFromValue('onstream'), 'CHAT');
assert.strictEqual(presenterModeFromValue('CHAT'), 'CHAT');

assert.deepStrictEqual(parseEnabledResponse({ enabled: true }), { enabled: true });
assert.deepStrictEqual(parseEnabledResponse({ enabled: false }), { enabled: false });
assert.deepStrictEqual(parseEnabledResponse({}), { enabled: null });

assert.ok(isNetworkUnreachableError(new Error('Failed to fetch')));
assert.ok(!isNetworkUnreachableError({ name: 'AbortError', message: 'aborted' }));

assert.strictEqual(enabledEndpoint('http://localhost:3000'), 'http://localhost:3000/api/ai/enabled');

const html = read('public/index.html');
assert.ok(html.includes('ai-dashboard-presenter-mode'), 'presenter mode select');
assert.ok(html.includes('raven-ai-control.js'), 'raven-ai-control script');

const pre = read('preload.js');
assert.ok(pre.includes('raven-start') && pre.includes('ravenStop'), 'preload raven lifecycle IPC');

const main = read('main.js');
assert.ok(main.includes("ipcMain.handle('raven-start'") && main.includes("ipcMain.handle('raven-stop'"), 'main raven lifecycle IPC');

console.log('test-raven-ai-control.js: OK');
