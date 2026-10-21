const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  presenterModeFromValue,
  parseEnabledResponse,
  isNetworkUnreachableError,
  enabledEndpoint,
  probeBridgeEnabled,
  probeControllerStatus,
  checkDashboardConnection,
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
assert.ok(pre.includes('ravenTestLlmKey'), 'preload raven test LLM key');
assert.ok(pre.includes('ravenRestart'), 'preload raven restart IPC');

const main = read('main.js');
assert.ok(main.includes("ipcMain.handle('raven-start'") && main.includes("ipcMain.handle('raven-stop'"), 'main raven lifecycle IPC');

async function mockFetch(url) {
  if (url.includes(':3000/api/ai/enabled')) {
    return { status: 404, ok: false, json: async () => ({}) };
  }
  if (url.includes(':3004/api/ai/status')) {
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  }
  throw new Error('Failed to fetch');
}

(async () => {
  const legacy = await probeBridgeEnabled(mockFetch, 'http://localhost:3000');
  assert.strictEqual(legacy.legacyBridge, true);
  assert.strictEqual(legacy.enabled, true);

  const conn = await checkDashboardConnection(mockFetch, 'http://localhost:3000', 'http://localhost:3004');
  assert.strictEqual(conn.connected, true);
  assert.strictEqual(conn.source, 'bridge-legacy');

  const offlineBridge = async (url) => {
    if (url.includes(':3000')) throw new Error('Failed to fetch');
    if (url.includes(':3004/api/ai/status')) return { status: 200, ok: true, json: async () => ({}) };
    throw new Error('Failed to fetch');
  };
  const viaController = await checkDashboardConnection(offlineBridge, 'http://localhost:3000', 'http://localhost:3004');
  assert.strictEqual(viaController.connected, true);
  assert.strictEqual(viaController.source, 'controller');

  const ravenUi = read('public/raven-ai-control.js');
  assert.ok(ravenUi.includes('probeControllerStatus'), 'renderer controller probe fallback');

  console.log('test-raven-ai-control.js: OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
