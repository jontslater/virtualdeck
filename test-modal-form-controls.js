#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'public/styles.css'), 'utf8');

assert.match(
  css,
  /\.modal-content input:not\(\[type="checkbox"\]\)/,
  'modal text inputs must not apply full width to checkboxes',
);

assert.match(
  css,
  /\.modal-content label:has\(> input\[type="checkbox"\]\)/,
  'modal checkbox labels should use inline flex layout',
);

assert.match(
  css,
  /\.modal-content label:has\(> input\[type="radio"\]\)/,
  'modal radio labels should use inline flex layout',
);

console.log('✅ test-modal-form-controls.js passed');
