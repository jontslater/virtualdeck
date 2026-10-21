#!/usr/bin/env node
const assert = require('assert');
const { createAdaptivePoll, isLocalFetchError } = require('./lib/service-poll');

assert.ok(isLocalFetchError(new Error('Failed to fetch')));

let ticks = 0;
const poll = createAdaptivePoll({
  baseIntervalMs: 20,
  maxIntervalMs: 80,
  when: () => ticks < 2,
  tick: async () => {
    ticks += 1;
    return false;
  },
});

poll.start();
setTimeout(() => {
  poll.stop();
  assert.ok(ticks >= 1);
  console.log('✅ test-service-poll.js passed');
}, 120);
