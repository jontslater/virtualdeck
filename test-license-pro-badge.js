#!/usr/bin/env node
/**
 * Pro badge visibility — derived from license entitlements (one-time + future subscription tiers).
 */
const assert = require('assert');
const {
  PAID_LICENSE_TIERS,
  resolvePaidLicenseTier,
  shouldShowProBadge,
  enrichStatusWithProBadge,
} = require('./lib/license/pro-badge');

console.log('🧪 License Pro badge tests\n');

assert.strictEqual(shouldShowProBadge(null), false);
assert.strictEqual(shouldShowProBadge({ licensed: false }), false);
assert.strictEqual(shouldShowProBadge({ licensed: false, aiAssistant: false }), false);
console.log('✅ Free / inactive status hides Pro badge');

assert.strictEqual(
  shouldShowProBadge({ licensed: true, aiAssistant: true, tier: PAID_LICENSE_TIERS.ONE_TIME }),
  true
);
console.log('✅ Active one-time Pro entitlements show badge');

assert.strictEqual(
  shouldShowProBadge({
    licensed: true,
    aiAssistant: true,
    tier: PAID_LICENSE_TIERS.SUBSCRIPTION,
  }),
  true
);
console.log('✅ Active subscription tier shows badge');

assert.strictEqual(
  resolvePaidLicenseTier({ meta: { plan: 'subscription' } }, { licensed: true }),
  PAID_LICENSE_TIERS.SUBSCRIPTION
);
console.log('✅ Subscription tier resolves from activation meta');

const enrichedFree = enrichStatusWithProBadge(
  { licensed: false, aiAssistant: false, provider: 'mock' },
  null
);
assert.strictEqual(enrichedFree.showProBadge, false);
assert.strictEqual(enrichedFree.tier, null);

const enrichedPro = enrichStatusWithProBadge(
  {
    licensed: true,
    aiAssistant: true,
    unlimitedButtons: true,
    provider: 'mock',
  },
  { meta: { provider: 'mock' }, provider: 'mock' }
);
assert.strictEqual(enrichedPro.showProBadge, true);
assert.strictEqual(enrichedPro.tier, PAID_LICENSE_TIERS.ONE_TIME);
console.log('✅ enrichStatusWithProBadge matches LicenseManager UI fields');

assert.strictEqual(shouldShowProBadge({ showProBadge: true, licensed: false }), true);
assert.strictEqual(shouldShowProBadge({ showProBadge: false, licensed: true, aiAssistant: true }), false);
console.log('✅ Explicit showProBadge flag is honored');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { LicenseManager } = require('./lib/license/license-manager');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-pro-badge-'));
process.env.VD_LICENSE_PROVIDER = 'mock';
const mgr = new LicenseManager({ userDataPath: tmp, safeStorage: null, onStatusChange: () => {} });
(async () => {
  assert.strictEqual(mgr.getStatusForUi().showProBadge, false);
  await mgr.activate('VD-MOCK-PRO-BADGE-KEY');
  assert.strictEqual(mgr.getStatusForUi().showProBadge, true);
  await mgr.deactivate();
  assert.strictEqual(mgr.getStatusForUi().showProBadge, false);
  console.log('✅ LicenseManager status drives showProBadge for activate/deactivate');
  console.log('\n✅ All license Pro badge tests passed');
})().catch((err) => {
  console.error('❌ License Pro badge tests failed:', err);
  process.exit(1);
});
