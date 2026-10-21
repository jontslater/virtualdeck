#!/usr/bin/env node
const assert = require('assert');
const { classifyUpdateError, createAppUpdater } = require('./lib/app-updater');

console.log('🧪 app-updater tests\n');

const offline = classifyUpdateError(new Error('getaddrinfo ENOTFOUND github.com'));
assert.strictEqual(offline.code, 'offline');

const rate = classifyUpdateError(Object.assign(new Error('rate limit'), { statusCode: 403 }));
assert.strictEqual(rate.code, 'rate_limit');

const missing = classifyUpdateError(new Error('404 latest.yml'));
assert.strictEqual(missing.code, 'no_release');
assert.strictEqual(missing.silent, true);

const packed = classifyUpdateError(new Error('Application is not packed'));
assert.strictEqual(packed.code, 'not_packaged');

let sent = [];
const updater = createAppUpdater({
  autoUpdater: {
    on() {},
    checkForUpdates: async () => ({}),
    downloadUpdate: async () => {},
    emit() {},
  },
  dialog: { showMessageBox: async () => ({ response: 0 }) },
  shell: { openExternal: () => {} },
  getWin: () => null,
  getPreferences: () => ({}),
  sendToRenderer: (ch, payload) => sent.push({ ch, payload }),
  isPackaged: () => false,
});

(async () => {
  const result = await updater.checkForUpdates({ manual: true });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.reason, 'not_packaged');
  console.log('✅ Dev / unpackaged builds skip updater with clear reason');

  const startupUpdater = createAppUpdater({
    autoUpdater: {
      on() {},
      checkForUpdates: async () => {
        console.log('✅ Startup would call checkForUpdates');
        return {};
      },
      emit() {},
    },
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    shell: { openExternal: () => {} },
    getWin: () => null,
    getPreferences: () => ({ autoUpdate: true }),
    sendToRenderer: () => {},
    isPackaged: () => true,
  });
  startupUpdater.maybeCheckOnStartup();
  await new Promise((r) => setTimeout(r, 20));

  console.log('\n✅ All app-updater tests passed');
})().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
