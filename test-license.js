#!/usr/bin/env node
/**
 * License entitlement, button cap, and offline grace tests.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { computeButtonEntitlements, FREE_BUTTON_CAP } = require('./lib/license/button-entitlements');
const { OFFLINE_GRACE_MS } = require('./lib/license/constants');
const { LicenseManager } = require('./lib/license/license-manager');

console.log('🧪 License module tests\n');

// --- Button cap ---
const profile = {
  buttons: Array.from({ length: 18 }, (_, i) => ({ id: `b${i}`, label: `Btn ${i}` })),
  uiSettings: { soundButtonOrder: [] },
};
const deck = computeButtonEntitlements(profile, false);
assert.strictEqual(deck.activeIds.size, FREE_BUTTON_CAP);
assert.strictEqual(deck.lockedIds.size, 18 - FREE_BUTTON_CAP);
assert.strictEqual(deck.canAddButton, false);
console.log('✅ Free tier locks buttons beyond', FREE_BUTTON_CAP);

const deckPro = computeButtonEntitlements(profile, true);
assert.strictEqual(deckPro.lockedIds.size, 0);
assert.strictEqual(deckPro.canAddButton, true);
console.log('✅ Licensed tier has no locked buttons');

// --- License manager (mock provider) ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-license-test-'));
process.env.VD_LICENSE_PROVIDER = 'mock';

const manager = new LicenseManager({
  userDataPath: tmp,
  safeStorage: null,
  onStatusChange: () => {},
});

(async () => {
  let ent = manager.getEntitlements();
  assert.strictEqual(ent.licensed, false);
  assert.strictEqual(ent.maxButtons, FREE_BUTTON_CAP);

  const triggerLocked = manager.canTriggerButton(profile, 'b17');
  assert.strictEqual(triggerLocked.allowed, false);
  const triggerActive = manager.canTriggerButton(profile, 'b0');
  assert.strictEqual(triggerActive.allowed, true);
  console.log('✅ Trigger gating respects locked slots (free tier)');

  const act = await manager.activate('VD-MOCK-TEST-KEY-12345');
  assert.strictEqual(act.success, true);
  ent = manager.getEntitlements();
  assert.strictEqual(ent.licensed, true);
  assert.strictEqual(ent.aiAssistant, true);
  console.log('✅ Mock activation grants Pro entitlements');

  manager._state.lastValidationOk = false;
  manager._state.lastSuccessfulValidationAt = Date.now() - OFFLINE_GRACE_MS - 1000;
  ent = manager.getEntitlements();
  assert.strictEqual(ent.licensed, false);
  console.log('✅ Grace expired downgrades to free');

  manager._state.lastSuccessfulValidationAt = Date.now() - 1000;
  manager._state.lastValidationOk = false;
  ent = manager.getEntitlements();
  assert.strictEqual(ent.licensed, true);
  assert.strictEqual(ent.graceActive, true);
  console.log('✅ Offline grace keeps license active');

  const addCheck = manager.canAddButton(profile);
  assert.strictEqual(addCheck.allowed, true);
  console.log('✅ Licensed users can keep >15 buttons (add allowed at data level)');

  await manager.deactivate();
  ent = manager.getEntitlements();
  assert.strictEqual(ent.licensed, false);
  console.log('✅ Deactivate clears entitlements');

  console.log('\n✅ All license tests passed');
})().catch((err) => {
  console.error('❌ License tests failed:', err);
  process.exit(1);
});
