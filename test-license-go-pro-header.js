#!/usr/bin/env node
/**
 * Header "Go Pro" control — markup, styles, IPC wiring, and license-ui hooks.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const licenseUi = fs.readFileSync(path.join(root, 'public/license-ui.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

const badgeIdx = html.indexOf('id="header-pro-badge"');
const goProIdx = html.indexOf('id="header-go-pro-btn"');
assert.ok(goProIdx >= 0, 'header Go Pro button missing from index.html');
assert.ok(badgeIdx >= 0, 'header Pro badge missing from index.html');
assert.ok(goProIdx < badgeIdx, 'Go Pro button should appear before Pro badge in header');
assert.ok(html.includes('class="go-pro-btn'), 'Go Pro button uses go-pro-btn class');

assert.ok(css.includes('.go-pro-btn'), 'go-pro-btn styles missing');
assert.ok(css.includes('pointer-events: auto'), 'Go Pro button must be clickable inside header-plan-badges');

assert.ok(licenseUi.includes('header-go-pro-btn'), 'license-ui toggles Go Pro button');
assert.ok(licenseUi.includes('licenseOpenPurchaseUrl'), 'license-ui opens purchase via IPC');
assert.ok(licenseUi.includes('bindHeaderGoPro'), 'license-ui binds Go Pro click handler');

assert.ok(preload.includes("ipcRenderer.invoke('license-open-purchase-url')"), 'preload exposes purchase IPC');
assert.ok(mainJs.includes("ipcMain.handle('license-open-purchase-url'"), 'main handles purchase IPC');
assert.ok(
  mainJs.includes('licenseManager.getStatusForUi().purchaseUrl'),
  'purchase IPC uses LicenseManager purchaseUrl (not hardcoded in renderer)'
);

console.log('✅ test-license-go-pro-header.js passed');
