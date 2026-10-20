#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildDevApiCandidates,
  formatSpeakNetworkError,
  DEV_SPEAK_PATH,
} = require('./lib/raven-manual-speak');

assert.strictEqual(DEV_SPEAK_PATH, '/api/dev/speak');
assert.ok(buildDevApiCandidates(null).includes('http://localhost:3003'));
assert.ok(!buildDevApiCandidates('http://localhost:3002').includes('http://localhost:3002'));

const offline = formatSpeakNetworkError('Failed to fetch');
assert.ok(offline.includes('Tools → Raven AI'));

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');
assert.ok(!script.includes('localhost:3006/api/say'), 'Quick Say must not use wrong port');
assert.ok(script.includes('vdRavenManualSpeak.speakManualText'));

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
assert.ok(html.includes('raven-manual-speak.js'));
assert.ok(html.includes('ai-dashboard-say-status'));

console.log('✅ test-raven-manual-speak.js passed');
