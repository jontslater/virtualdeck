#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const host = fs.readFileSync(path.join(__dirname, 'raven-host.js'), 'utf8');

assert.ok(!script.includes('Tools → Alerts'), 'use Tools → Alert Widget');
assert.ok(script.includes('Tools → Alert Widget'));
assert.ok(!script.includes('or Raven AI →'), 'Raven paths must use Tools → Raven AI →');
assert.ok(!script.includes('use Raven AI →'), 'Raven paths must use Tools → Raven AI →');
assert.ok(script.includes('Tools → Raven AI → Restart Raven AI'));

assert.ok(html.includes('menu-tools-raven-restart'), 'title bar Restart Raven item');
assert.ok(host.includes("label: 'Restart Raven AI'"), 'native Restart Raven menu item');

const pre = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
assert.ok(pre.includes('raven-restart'), 'preload raven restart IPC');

console.log('✅ test-menu-paths.js passed');
