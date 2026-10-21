#!/usr/bin/env node
const assert = require('assert');
const { encodeField, decodeField } = require('./lib/portable-secret');

const material = '/tmp/vd-test/tc_config.json:oauth';
const plain = 'test-oauth-token-12345';
const wrapped = encodeField(material, plain, null);
assert.ok(wrapped && wrapped.enc === 'aes-gcm-fallback');
const back = decodeField(material, wrapped, null);
assert.strictEqual(back, plain);

console.log('✅ test-portable-secret.js passed');
