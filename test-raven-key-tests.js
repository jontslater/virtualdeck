'use strict';
const assert = require('assert');
const { EventEmitter } = require('events');
const { testOpenAiApiKey, testElevenLabsApiKey } = require('./lib/raven-llm-test');

function fakeRequest(status, body, seen) {
  return (options, cb) => {
    if (seen) seen.push(options);
    const req = new EventEmitter();
    req.end = () => setImmediate(() => {
      const res = new EventEmitter();
      res.statusCode = status;
      res.setEncoding = () => {};
      cb(res);
      if (body) res.emit('data', body);
      res.emit('end');
    });
    req.destroy = () => {};
    return req;
  };
}
function failingRequest() {
  return () => {
    const req = new EventEmitter();
    req.end = () => setImmediate(() => req.emit('error', new Error('getaddrinfo ENOTFOUND')));
    req.destroy = () => {};
    return req;
  };
}

(async () => {
  assert.strictEqual((await testOpenAiApiKey('')).ok, false);
  const seen = [];
  assert.strictEqual((await testOpenAiApiKey('sk-good', { request: fakeRequest(200, '{}', seen) })).ok, true);
  assert.strictEqual(seen[0].hostname, 'api.openai.com');
  let r = await testOpenAiApiKey('sk-bad', { request: fakeRequest(401, '{"error":{}}') });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.kind, 'invalid_key');
  assert.ok(!r.error.includes('sk-bad'), 'never echoes the key');
  r = await testOpenAiApiKey('sk-x', { request: fakeRequest(429, '{"error":{"code":"insufficient_quota"}}') });
  assert.strictEqual(r.kind, 'no_credit');
  r = await testOpenAiApiKey('sk-x', { request: failingRequest() });
  assert.strictEqual(r.kind, 'network');

  const seen2 = [];
  assert.strictEqual((await testElevenLabsApiKey('xi-good', { request: fakeRequest(200, '{}', seen2) })).ok, true);
  assert.strictEqual(seen2[0].hostname, 'api.elevenlabs.io');
  assert.strictEqual(seen2[0].headers['xi-api-key'], 'xi-good');
  r = await testElevenLabsApiKey('xi-bad', { request: fakeRequest(401, '{"detail":{"status":"invalid_api_key"}}') });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.kind, 'invalid_key');
  r = await testElevenLabsApiKey('xi-r', { request: fakeRequest(401, '{"detail":{"status":"missing_permissions"}}') });
  assert.strictEqual(r.ok, true); assert.ok(r.warning);
  r = await testElevenLabsApiKey('xi-x', { request: failingRequest() });
  assert.strictEqual(r.kind, 'network');

  console.log('test-raven-key-tests: ok');
})().catch((e) => { console.error(e); process.exit(1); });
