#!/usr/bin/env node
const assert = require('assert');
const { isHydrationRewardRedemption } = require('./lib/hydration-redemption');

assert.strictEqual(
  isHydrationRewardRedemption(
    { reward: { id: 'abc', title: 'Other' } },
    { rewardId: 'abc', redemptionKeyword: 'hydrate' },
  ),
  true,
);
assert.strictEqual(
  isHydrationRewardRedemption(
    { reward: { id: 'wrong', title: 'Hydrate' } },
    { rewardId: 'abc' },
  ),
  false,
);
assert.strictEqual(
  isHydrationRewardRedemption(
    { reward: { title: 'Hydrate now!' } },
    { redemptionKeyword: 'hydrate' },
  ),
  true,
);
assert.strictEqual(
  isHydrationRewardRedemption(
    { reward: { title: 'Sound' }, user_input: 'please hydrate' },
    { redemptionKeyword: 'hydrate' },
  ),
  true,
);
assert.strictEqual(
  isHydrationRewardRedemption({ reward: { title: 'Hydrate' } }, { trackingEnabled: false }),
  false,
);

console.log('✅ test-hydration-redemption.js passed');