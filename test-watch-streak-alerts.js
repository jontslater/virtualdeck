#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  matchTier,
  parseWatchStreakEventSub,
  migrateWatchStreakConfig,
  migrateLeadersStore,
  recordStreakShare,
  resolveActiveTier,
  TWITCH_REPORTED_WATCH_STREAK_MILESTONES,
  formatAlertText,
  scopesIncludeWatchStreakChat,
} = require('./lib/watch-streak-alerts');

assert.deepStrictEqual(TWITCH_REPORTED_WATCH_STREAK_MILESTONES.slice(0, 3), [3, 5, 10]);

const cfg = migrateWatchStreakConfig({ enabled: true, tiers: [{ threshold: 5, textTemplate: 'five' }] });
assert.strictEqual(cfg.tiers[0].textTemplate, 'five');
assert.strictEqual(cfg.version, 1);

const tiers = [
  { threshold: 3, textTemplate: 'a' },
  { threshold: 10, textTemplate: 'b' },
  { threshold: 25, textTemplate: 'c' },
];
assert.strictEqual(matchTier(tiers, 4).threshold, 3);
assert.strictEqual(matchTier(tiers, 10).threshold, 10);
assert.strictEqual(matchTier(tiers, 99).threshold, 25);
assert.strictEqual(matchTier(tiers, 2), null);

const parsed = parseWatchStreakEventSub({
  notice_type: 'watch_streak',
  watch_streak: { streak_count: 12, channel_points_awarded: 400 },
  chatter_user_login: 'viewer1',
  chatter_user_name: 'ViewerOne',
  chatter_user_id: '42',
  message: { text: 'hello' },
});
assert.ok(parsed);
assert.strictEqual(parsed.streakCount, 12);
assert.strictEqual(parsed.channelPointsAwarded, 400);
assert.strictEqual(parsed.login, 'viewer1');
assert.strictEqual(parseWatchStreakEventSub({ notice_type: 'sub' }), null);

const simpleCfg = migrateWatchStreakConfig({ sameAlertForEveryStreak: true, tiers });
const resolved = resolveActiveTier(simpleCfg, 77);
assert.strictEqual(resolved.id, 'simple_unified');

let leaders = migrateLeadersStore({});
const r1 = recordStreakShare(leaders, { userId: '1', login: 'a', displayName: 'A', streakCount: 10 });
leaders = r1.store;
const r2 = recordStreakShare(leaders, { userId: '1', login: 'a', displayName: 'A', streakCount: 25 });
assert.strictEqual(r2.entry.highestSharedStreak, 25);
assert.strictEqual(r2.entry.lastSharedStreak, 25);

const text = formatAlertText('{user} — {count}', {
  displayName: 'Pat',
  streakCount: 5,
});
assert.strictEqual(text, 'Pat — 5');

assert.ok(scopesIncludeWatchStreakChat(['chat:read', 'user:read:chat']));
assert.ok(!scopesIncludeWatchStreakChat(['chat:read']));

const mainJs = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
assert.ok(mainJs.includes('watch-streak-config'), 'main persists watch streak config');
assert.ok(mainJs.includes('/watch-streak'), 'overlay route for watch streak');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
assert.ok(html.includes('watch-streak-settings-modal'), 'settings modal in index.html');

console.log('✅ test-watch-streak-alerts.js passed');