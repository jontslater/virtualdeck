#!/usr/bin/env node
/**
 * License must persist under userData across process restarts; startup validation must not wipe grace.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LicenseManager } = require('./lib/license/license-manager');
const { LicenseSecureStore, LICENSE_FILENAME } = require('./lib/license/secure-store');
const { OFFLINE_GRACE_MS } = require('./lib/license/constants');

console.log('🧪 License persistence tests\n');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-license-persist-'));
process.env.VD_LICENSE_PROVIDER = 'mock';

function createManager() {
  return new LicenseManager({
    userDataPath: tmp,
    safeStorage: null,
    onStatusChange: () => {},
  });
}

(async () => {
  const licensePath = LicenseSecureStore.licenseFilePath(tmp);
  assert.ok(licensePath.startsWith(tmp), 'license file must live under userData');
  assert.ok(!licensePath.includes('node_modules'), 'license must not be stored in app dir');

  const m1 = createManager();
  const act = await m1.activate('VD-MOCK-PERSIST-KEY-999');
  assert.strictEqual(act.success, true);
  assert.ok(fs.existsSync(licensePath), 'license.dat written on activate');
  assert.ok(fs.existsSync(path.join(tmp, 'license.dat.bak')), 'portable backup written');

  const m2 = createManager();
  let ent = m2.getEntitlements();
  assert.strictEqual(ent.licensed, true, 'new manager instance reads persisted license');
  assert.strictEqual(ent.aiAssistant, true);
  assert.strictEqual(m2.getStatusForUi().hasLicenseKey, true);
  console.log('✅ License survives reload from userData');

  m2._state.lastValidationOk = true;
  m2._state.lastSuccessfulValidationAt = Date.now() - 2000;
  m2._persistState();

  const m3 = createManager();
  const origValidate = m3.provider.validate.bind(m3.provider);
  m3.provider.validate = async () => ({
    ok: false,
    transient: true,
    error: 'offline on startup',
  });
  await m3.revalidate();
  ent = m3.getEntitlements();
  assert.strictEqual(ent.licensed, true);
  assert.strictEqual(m3._state.lastValidationOk, true);
  m3.provider.validate = origValidate;
  console.log('✅ Startup transient revalidate does not revoke license');

  const m4 = createManager();
  m4._state.lastValidationOk = true;
  m4._state.lastSuccessfulValidationAt = Date.now() - 1000;
  m4.provider.validate = async () => ({ ok: false, error: 'invalid', transient: false });
  await m4.revalidate();
  ent = m4.getEntitlements();
  assert.strictEqual(ent.licensed, true);
  assert.strictEqual(ent.graceActive, true);
  console.log('✅ Non-transient validation failure keeps offline grace entitlements');

  m4._state.lastSuccessfulValidationAt = Date.now() - OFFLINE_GRACE_MS - 5000;
  m4._state.lastValidationOk = false;
  ent = m4.getEntitlements();
  assert.strictEqual(ent.licensed, false);
  console.log('✅ Grace expiry still downgrades after persisted state');

  assert.strictEqual(LICENSE_FILENAME, 'license.dat');
  console.log('\n✅ License persistence tests passed');
})().catch((err) => {
  console.error('❌ License persistence tests failed:', err);
  process.exit(1);
});
