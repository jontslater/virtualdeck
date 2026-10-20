#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'public/styles.css'), 'utf8');

const widgetStart = html.indexOf('id="alert-widget"');
const widgetEnd = html.indexOf('<!-- Daily Check-In Statistics Modal -->', widgetStart);
assert.ok(widgetStart >= 0 && widgetEnd > widgetStart, 'alert widget block');
const widgetBlock = html.slice(widgetStart, widgetEnd);

assert.ok(widgetBlock.includes('alert-editor-sections'), 'stacked editor sections wrapper');
assert.ok(widgetBlock.includes('alert-preview-list-panel'), 'preview/list panel wrapper');
assert.ok(
  widgetBlock.indexOf('alert-form-section--media') < widgetBlock.indexOf('alert-form-section--style'),
  'media section before style section'
);
assert.ok(!widgetBlock.includes('grid-column: 2'), 'no inline grid column on alert editor');

assert.ok(css.includes('.alert-preview-list-panel'), 'preview/list panel styles');
assert.match(css, /\.alert-settings\s*\{[^}]*flex-direction:\s*column/s, 'alert-settings is single column');
assert.ok(!css.match(/\.alert-settings\s*\{[^}]*grid-template-columns/s), 'alert-settings is not a 2-col grid');
assert.match(css, /\.alert-preview-list-panel[^}]*align-items:\s*start/s, 'preview panel align-items start');

console.log('✅ test-alert-widget-layout.js passed');
