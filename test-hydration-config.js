#!/usr/bin/env node
const assert = require('assert');
const {
  migrateHydrationConfig,
  coercePosition,
  applyHydrationDelta,
  undoLastHydrationDelta,
  shouldResetAtMidnight,
  applyMidnightReset,
  resolveStreamLiveTransition,
} = require('./lib/hydration-config');

const legacy = migrateHydrationConfig({
  streamGoal: 48,
  currentProgress: 12,
  positionX: 0,
  positionY: 0,
  resetOnLive: false,
  redemptionKeyword: 'water',
});
assert.strictEqual(legacy.positionX, 0);
assert.strictEqual(legacy.positionY, 0);
assert.strictEqual(legacy.resetMode, 'manual');
assert.strictEqual(legacy.streamGoal, 48);
assert.strictEqual(legacy.currentProgress, 12);

assert.strictEqual(coercePosition(0, 50), 0);

let cfg = migrateHydrationConfig({ streamGoal: 64, incrementAmount: 8, currentProgress: 0 });
const inc = applyHydrationDelta(cfg, 8);
cfg = inc.config;
assert.strictEqual(cfg.currentProgress, 8);
assert.strictEqual(inc.leveledUp, true);

const undo = undoLastHydrationDelta(cfg);
assert.strictEqual(undo.config.currentProgress, 0);
assert.strictEqual(undo.undone, true);

const midnightCfg = migrateHydrationConfig({ resetMode: 'midnight', lastMidnightResetDate: '2020-01-01' });
const fakeNow = new Date('2026-11-21T08:00:00');
assert.strictEqual(shouldResetAtMidnight(midnightCfg, fakeNow), true);
applyMidnightReset(midnightCfg, fakeNow);
assert.strictEqual(midnightCfg.currentProgress, 0);

const init = resolveStreamLiveTransition(null, true);
assert.strictEqual(init.shouldReset, false);
assert.strictEqual(init.previous, true);
const live = resolveStreamLiveTransition(false, true);
assert.strictEqual(live.shouldReset, true);

console.log('✅ test-hydration-config.js passed');