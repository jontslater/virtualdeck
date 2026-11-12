#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DECK_BACKUP_FORMAT,
  validateDeckBackupData,
  formatDeckExportBasename,
  buildDeckBackupPayload,
  readDeckBackupJsonFile,
  writeBundledMedia,
  applyMissingPathFlagsToProfiles,
  collectPathsFromProfile,
  isUserDataRelativePath,
} = require('./lib/deck-backup');

assert.strictEqual(validateDeckBackupData(null).ok, false);
assert.strictEqual(validateDeckBackupData({ format: 'nope' }).ok, false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-deck-backup-'));
const soundRel = 'sounds/test-tone.mp3';
fs.mkdirSync(path.join(tmp, 'sounds'), { recursive: true });
fs.writeFileSync(path.join(tmp, soundRel), Buffer.from([0x49, 0x44, 0x33]));

const profiles = {
  default: {
    buttons: [
      {
        id: 'b1',
        label: 'Tone',
        type: 'audio',
        src: soundRel,
        hotkey: 'F1',
      },
      {
        id: 'b2',
        label: 'Missing app',
        type: 'app',
        src: 'C:\\\\Games\\\\missing.exe',
      },
    ],
    uiSettings: { soundButtonOrder: ['b1', 'b2'], theme: null },
  },
};

const profilesMeta = {
  activeProfile: 'default',
  profiles: [{ id: 'default', name: 'Default Profile', created: '2026-01-01T00:00:00.000Z' }],
};

const macros = {
  m1: { name: 'Test macro', enabled: true, triggers: { hotkey: 'Ctrl+Shift+T' }, steps: [] },
};

assert.ok(collectPathsFromProfile(profiles.default).has(soundRel));
assert.ok(collectPathsFromProfile(profiles.default).has('C:\\\\Games\\\\missing.exe'));
assert.strictEqual(isUserDataRelativePath(soundRel), true);
assert.strictEqual(isUserDataRelativePath('C:\\\\x.exe'), false);

const payload = buildDeckBackupPayload({
  profilesMeta,
  profiles,
  macros,
  userDataPath: tmp,
  appVersion: '1.2.2',
});
assert.strictEqual(payload.format, DECK_BACKUP_FORMAT);
assert.ok(payload.bundledMedia[soundRel]);

const exportPath = path.join(tmp, 'deck-export.json');
fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2));
const validated = readDeckBackupJsonFile(exportPath);
assert.strictEqual(validated.ok, true);

const restoreRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-deck-restore-'));
writeBundledMedia({ bundledMedia: validated.data.bundledMedia, userDataPath: restoreRoot });
assert.ok(fs.existsSync(path.join(restoreRoot, soundRel)));

const flagged = applyMissingPathFlagsToProfiles(validated.data.profiles, restoreRoot);
assert.strictEqual(flagged.default.buttons[0].pathMissing, undefined);
assert.strictEqual(flagged.default.buttons[1].pathMissing, true);
assert.ok(Array.isArray(flagged.default.buttons[1].missingPaths));

const name = formatDeckExportBasename(new Date('2026-10-22T15:04:05Z'));
assert.ok(/^virtualdeck-deck-2026-10-22-\d{6}\.json$/.test(name), name);

const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
assert.ok(main.includes('backup-deck-layout'), 'main exposes deck backup IPC');
assert.ok(main.includes('restore-deck-layout'), 'main exposes deck restore IPC');

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(restoreRoot, { recursive: true, force: true });

console.log('✅ test-deck-backup.js passed');
