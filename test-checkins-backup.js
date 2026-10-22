#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  validateDailyCheckinsData,
  normalizeDailyCheckinsData,
  formatExportBasename,
  readCheckinsJsonFile,
  writeCheckinsJsonFile,
  backupCurrentCheckinsFile,
  defaultDailyCheckinsData,
} = require('./lib/checkins-backup');

assert.strictEqual(validateDailyCheckinsData(null).ok, false);
assert.strictEqual(validateDailyCheckinsData([]).ok, false);
assert.strictEqual(validateDailyCheckinsData({ viewers: [] }).ok, false);

const valid = validateDailyCheckinsData({
  viewers: { u1: { display_name: 'A', total_checkins: 2, last_checkin: '2026-01-01T00:00:00.000Z' } },
  liveDays: ['2026-01-01'],
  config: { enabled: true, rewardName: 'Daily Check-In' },
});
assert.strictEqual(valid.ok, true);
assert.strictEqual(valid.data.viewers.u1.total_checkins, 2);

const normalized = normalizeDailyCheckinsData({ viewers: {} });
assert.ok(normalized.config && normalized.config.rewardName);

const name = formatExportBasename(new Date('2026-10-22T15:04:05Z'));
assert.ok(/^checkins-2026-10-22-\d{6}\.json$/.test(name), name);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-checkins-'));
const checkinsPath = path.join(tmp, 'checkins.json');
writeCheckinsJsonFile(checkinsPath, defaultDailyCheckinsData());
const readBack = readCheckinsJsonFile(checkinsPath);
assert.strictEqual(readBack.ok, true);

writeCheckinsJsonFile(checkinsPath, { viewers: { x: { total_checkins: 1 } } });
const bak = backupCurrentCheckinsFile(checkinsPath);
assert.ok(bak && fs.existsSync(bak));

console.log('✅ test-checkins-backup.js passed');
