#!/usr/bin/env node
const assert = require('assert');
const { listIcons, iconDataUrl, searchIcons } = require('./lib/deck-icon-catalog');

assert.ok(listIcons().length >= 10);
assert.ok(searchIcons('twitch').some((i) => i.id === 'brand-twitch'));
assert.ok(iconDataUrl('mic').startsWith('data:image/svg+xml'));

const json = require('./public/data/deck-icons.json');
assert.strictEqual(json.length, listIcons().length);

console.log('✅ test-deck-icon-catalog.js passed');
