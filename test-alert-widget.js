#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');

// Must not shadow setupAlertWidget locals with a second global updateAlertList.
const globalAssigns = script.match(/window\.updateAlertList\s*=/g) || [];
assert.strictEqual(globalAssigns.length, 1, 'exactly one window.updateAlertList assignment');

const afterSetup = script.indexOf('// Global functions for inline event handlers');
assert.ok(afterSetup > 0, 'global handlers section exists');
const tail = script.slice(afterSetup, afterSetup + 400);
assert.ok(!tail.includes('if (!alertListContainer)'), 'global handler must not reference alertListContainer');

console.log('✅ test-alert-widget.js passed');
