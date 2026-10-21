#!/usr/bin/env node
// Saved alert / walk-on sounds are read through get-media-file -> readMediaFileAsDataUrl.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readMediaFileAsDataUrl, mimeForPath } = require('./lib/media-file');
const SecurityManager = require('./lib/security');


const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-media-test-'));
const sm = new SecurityManager(root);
const rel = path.join('media', 'alert-1762197771754', 'sound_1762197771755.mp3');
fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
fs.writeFileSync(path.join(root, rel), Buffer.from([0x49, 0x44, 0x33, 0x04]));

const ok = readMediaFileAsDataUrl({ userDataPath: root, relativePath: rel, securityManager: sm });
assert.strictEqual(ok.success, true, 'saved alert sound loads: ' + ok.error);
assert.strictEqual(ok.mimeType, 'audio/mpeg');
assert.ok(ok.data.startsWith('data:audio/mpeg;base64,SUQz'));

// Windows-style stored path (what alerts save) also works
const ok2 = readMediaFileAsDataUrl({ userDataPath: root, relativePath: 'media\\alert-1762197771754\\sound_1762197771755.mp3', securityManager: sm });
if (process.platform === 'win32') assert.strictEqual(ok2.success, true);

const missing = readMediaFileAsDataUrl({ userDataPath: root, relativePath: 'media/nope.mp3', securityManager: sm });
assert.deepStrictEqual([missing.success, missing.error], [false, 'File not found']);

const trav = readMediaFileAsDataUrl({ userDataPath: root, relativePath: '../../etc/passwd', securityManager: sm });
assert.strictEqual(trav.success, false);
assert.match(trav.error, /traversal/i);

assert.strictEqual(mimeForPath('a.WAV'), 'audio/wav');
assert.strictEqual(mimeForPath('a.bin'), 'application/octet-stream');

// Guard against the regression itself
const main = fs.readFileSync('main.js', 'utf8');
const h = main.slice(main.indexOf("ipcMain.handle('get-media-file',"), main.indexOf("ipcMain.handle('get-media-file',") + 400);
assert.ok(h.includes('readMediaFileAsDataUrl'), 'handler uses the tested helper');
assert.ok(!h.includes('fullPath'), 'no undefined fullPath in handler');

fs.rmSync(root, { recursive: true, force: true });
console.log('\u2705 test-media-file.js passed');
