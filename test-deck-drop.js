#!/usr/bin/env node
const assert = require('assert');
const { classifyDroppedFileName, labelFromFileName } = require('./lib/dropped-deck-file');

assert.strictEqual(classifyDroppedFileName('shortcut.lnk'), 'app');
assert.strictEqual(classifyDroppedFileName('app.exe'), 'app');
assert.strictEqual(classifyDroppedFileName('clip.ogg'), 'audio');
assert.strictEqual(labelFromFileName('My App.exe'), 'My App');

console.log('✅ test-deck-drop.js passed');
