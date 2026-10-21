#!/usr/bin/env node
const assert = require('assert');
const { JSDOM } = require('jsdom');
const { populateRewardSelect, findRewardOptionById } = require('./lib/channel-rewards');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

const select = document.createElement('select');
populateRewardSelect(select, [{ id: 'r1', title: 'Daily Check-In', cost: 100 }], { valueField: 'id' });
assert.strictEqual(select.options.length, 2);
assert.strictEqual(select.options[1].value, 'r1');
assert.strictEqual(select.options[1].dataset.rewardTitle, 'Daily Check-In');

const found = findRewardOptionById(select, 'r1');
assert.ok(found);
assert.strictEqual(found.dataset.rewardId, 'r1');

const html = require('fs').readFileSync(require('path').join(__dirname, 'public/index.html'), 'utf8');
assert.ok(html.includes('channel-rewards-ui.js'), 'channel rewards UI script');
assert.ok(html.includes('daily-checkin-reward-select'), 'daily check-in reward select');

const pre = require('fs').readFileSync(require('path').join(__dirname, 'preload.js'), 'utf8');
assert.ok(pre.includes('twitchEventSubHealth'), 'preload EventSub health IPC');

console.log('✅ test-channel-rewards.js passed');
