#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const modalStart = html.indexOf('id="button-type-modal"');
const modalEnd = html.indexOf('id="settings-modal"', modalStart);
const modalBlock = html.slice(modalStart, modalEnd);
const types = ['audio', 'multi-media', 'meld-scene', 'macro'].map((t) => {
  const idx = modalBlock.indexOf(`data-type="${t}"`);
  return { t, idx };
});
types.forEach(({ t, idx }) => assert.ok(idx >= 0, `missing add option ${t}`));
for (let i = 1; i < types.length; i++) {
  assert.ok(types[i - 1].idx < types[i].idx, `add menu order: ${types[i - 1].t} before ${types[i].t}`);
}

assert.ok(html.indexOf('vd-console.js') < html.indexOf('script.js'), 'vd-console loads before app scripts');

const escapeJs = fs.readFileSync(path.join(__dirname, 'public/modal-escape.js'), 'utf8');
assert.ok(escapeJs.includes("'macros-modal': 'closeMacrosManager'"), 'macro manager Esc closer id');

const macrosJs = fs.readFileSync(path.join(__dirname, 'public/macros-ui.js'), 'utf8');
assert.ok(macrosJs.includes('window.createNewMacro = createNewMacro'), 'macro creator exposed globally');

console.log('✅ test-ui-polish.js passed');
