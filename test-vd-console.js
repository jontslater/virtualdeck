#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
assert.ok(main.includes('installProductionConsole'), 'main installs production console policy');
assert.ok(main.includes('packagedArgvFlag'), 'main passes packaged flag to renderer');

const preload = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
assert.ok(preload.includes('__VD_IS_PACKAGED__'), 'preload exposes packaged flag');

const renderer = fs.readFileSync(path.join(__dirname, 'public/vd-console.js'), 'utf8');
assert.ok(renderer.includes('console.log = noop'), 'renderer silences log in packaged mode');

const lib = require('./lib/vd-console');
assert.ok(typeof lib.packagedArgvFlag === 'function');
assert.ok(typeof lib.installProductionConsole === 'function');

console.log('✅ test-vd-console.js passed');
