const https = require('https');

/**
 * Validate Raven BYOK keys without logging them.
 * Both functions accept an optional `opts.request` (defaults to https.request) for tests.
 * Result: { ok: boolean, error?: string, kind?: 'invalid_key'|'no_credit'|'network'|'http', warning?: string }
 */
function getJson(options, opts = {}) {
  const request = opts.request || https.request;
  return new Promise((resolve) => {
    let req;
    try {
      req = request({ ...options, timeout: opts.timeoutMs || 15000 }, (res) => {
        let body = '';
        res.setEncoding && res.setEncoding('utf8');
        res.on('data', (c) => { if (body.length < 4096) body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
    } catch (err) {
      resolve({ status: 0, error: err.message || 'Network error' });
      return;
    }
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'Request timed out' }); });
    req.on('error', (err) => resolve({ status: 0, error: err.message || 'Network error' }));
    req.end();
  });
}

async function testOpenAiApiKey(apiKey, opts = {}) {
  const key = String(apiKey || '').trim();
  if (!key) return { ok: false, error: 'No API key provided' };
  const r = await getJson({
    hostname: 'api.openai.com',
    path: '/v1/models',
    method: 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  }, opts);
  if (r.status === 200) return { ok: true };
  if (r.status === 401) return { ok: false, kind: 'invalid_key', error: 'OpenAI rejected this key (unauthorized). Copy a fresh key from platform.openai.com/api-keys.' };
  if (r.status === 429 && /insufficient_quota/.test(r.body || '')) {
    return { ok: false, kind: 'no_credit', error: 'OpenAI key works but the account has no credit. Add billing at platform.openai.com.' };
  }
  if (r.status === 0) return { ok: false, kind: 'network', error: `Could not reach OpenAI: ${r.error}` };
  return { ok: false, kind: 'http', error: `OpenAI returned HTTP ${r.status}` };
}

async function testElevenLabsApiKey(apiKey, opts = {}) {
  const key = String(apiKey || '').trim();
  if (!key) return { ok: false, error: 'No API key provided' };
  const r = await getJson({
    hostname: 'api.elevenlabs.io',
    path: '/v1/user',
    method: 'GET',
    headers: { 'xi-api-key': key, Accept: 'application/json' },
  }, opts);
  if (r.status === 200) return { ok: true };
  if (r.status === 401 && /missing_permissions/i.test(r.body || '')) {
    // Restricted key: valid, but cannot read the user endpoint. Voice may still work.
    return { ok: true, warning: 'Key accepted (restricted key — make sure Text to Speech access is enabled).' };
  }
  if (r.status === 401 || r.status === 403) {
    return { ok: false, kind: 'invalid_key', error: 'ElevenLabs rejected this key. Copy it again from elevenlabs.io → Profile → API keys.' };
  }
  if (r.status === 0) return { ok: false, kind: 'network', error: `Could not reach ElevenLabs: ${r.error}` };
  return { ok: false, kind: 'http', error: `ElevenLabs returned HTTP ${r.status}` };
}

module.exports = { testOpenAiApiKey, testElevenLabsApiKey };
