#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const policy = require('./lib/packaged-ui-policy');

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
assert.ok(pre.includes('backup-daily-checkins'), 'preload check-in backup IPC');
assert.ok(pre.includes('restore-daily-checkins'), 'preload check-in restore IPC');

assert.ok(html.includes('menu-tools-checkins-backup'), 'tools menu backup check-ins');
assert.ok(html.includes('preferences-checkins-backup'), 'preferences backup check-ins');
assert.ok(html.includes('vd-packaged-ui.js'), 'packaged UI bootstrap');
assert.ok(html.includes('id="overlay-ai-control-panel"'), 'overlay AI panel id for packaged hide');
assert.ok(html.includes('id="overlay-vtuber-controls"'), 'overlay VTuber section id for packaged hide');

assert.ok(!html.includes('LLM_PROVIDER'), 'Raven preferences must not mention LLM_PROVIDER');
assert.ok(html.includes('OpenAI only'), 'Raven preferences OpenAI-only copy');
assert.ok(html.includes('silent'), 'Raven preferences ElevenLabs silent copy');

for (const id of policy.PACKAGED_HIDDEN_ELEMENT_IDS) {
  assert.ok(html.includes(`id="${id}"`) || html.includes(`id='${id}'`), `packaged hide target ${id} exists in HTML`);
}
assert.ok(policy.PACKAGED_OMIT_MENU_LABELS.has('Developer Tools'));
assert.ok(policy.PACKAGED_OMIT_MENU_LABELS.has(policy.RAVEN_OPEN_ENV_MENU_LABEL));

const filtered = policy.filterMenuTemplateForPackaged(
  [{ label: 'Developer Tools' }, { label: 'OK', submenu: [{ label: policy.RAVEN_OPEN_ENV_MENU_LABEL }] }],
  true,
);
assert.strictEqual(filtered.length, 1);
assert.strictEqual(filtered[0].label, 'OK');
assert.strictEqual(filtered[0].submenu.length, 0);

console.log('✅ test-menu-paths.js passed');
