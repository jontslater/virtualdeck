#!/usr/bin/env node
const assert = require('assert');
const { isDailyCheckinRewardRedemption, normalizeRewardTitle } = require('./lib/daily-checkin-reward');

assert.strictEqual(normalizeRewardTitle(' Daily   Check-In '), 'daily check in');
assert.strictEqual(
  isDailyCheckinRewardRedemption(
    { reward: { title: 'Daily Check-In' } },
    { enabled: true, rewardName: 'Daily Check-In' },
  ),
  true,
);
assert.strictEqual(
  isDailyCheckinRewardRedemption(
    { reward: { title: 'daily check in' } },
    { enabled: true, rewardName: 'Daily Check-In' },
  ),
  true,
);
assert.strictEqual(
  isDailyCheckinRewardRedemption(
    { reward: { id: 'abc', title: 'Other' } },
    { enabled: true, rewardId: 'abc', rewardName: 'Daily Check-In' },
  ),
  true,
);
assert.strictEqual(
  isDailyCheckinRewardRedemption(
    { reward: { title: 'Sound Board' } },
    { enabled: true, rewardName: 'Daily Check-In' },
  ),
  false,
);
assert.strictEqual(
  isDailyCheckinRewardRedemption(
    { reward: { title: 'Daily Check-In' } },
    { enabled: false, rewardName: 'Daily Check-In' },
  ),
  false,
);

console.log('✅ test-daily-checkin-reward.js passed');
