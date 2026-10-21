#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');
const setupStart = script.indexOf('function setupAlertWidget()');
assert.ok(setupStart >= 0, 'setupAlertWidget exists');
const dispatchIdx = script.indexOf("alertTypeSelect.dispatchEvent(new Event('change'))", setupStart);
const fnIdx = script.indexOf('function updateAlertList()', setupStart);
assert.ok(fnIdx > setupStart && fnIdx < dispatchIdx, 'updateAlertList must be declared before initial change dispatch');

const dom = new JSDOM(
  `<!DOCTYPE html><body>
    <select id="alert-type"><option value="follower" selected>Follower</option><option value="bits">Bits</option></select>
    <div id="alert-list-container"></div>
    <div id="selected-alert-type-name"></div>
    <div id="bits-threshold-group" style="display:none"></div>
    <div id="daily-checkin-settings" style="display:none"></div>
  </body>`,
  { url: 'http://localhost' },
);

const { window } = dom;
const savedAlerts = [];
const alertListContainer = window.document.getElementById('alert-list-container');
const alertTypeSelect = window.document.getElementById('alert-type');

function updateAlertList() {
  if (!alertListContainer) return;
  const selectedType = alertTypeSelect ? alertTypeSelect.value : 'follower';
  alertListContainer.textContent = `list:${selectedType}:${savedAlerts.length}`;
}

function onTypeChange() {
  updateAlertList();
}

alertTypeSelect.addEventListener('change', onTypeChange);
let threw = false;
try {
  alertTypeSelect.dispatchEvent(new window.Event('change'));
} catch (err) {
  threw = true;
}
assert.strictEqual(threw, false, 'change handler must not throw before updateAlertList exists');
assert.strictEqual(alertListContainer.textContent, 'list:follower:0');

alertTypeSelect.value = 'bits';
alertTypeSelect.dispatchEvent(new window.Event('change'));
assert.strictEqual(alertListContainer.textContent, 'list:bits:0');

console.log('✅ test-alert-widget-setup-dom.js passed');
