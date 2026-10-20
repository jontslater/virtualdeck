const https = require('https');

/**
 * Validate an OpenAI API key via GET /v1/models (no key logging).
 */
function testOpenAiApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) {
    return Promise.resolve({ ok: false, error: 'No API key provided' });
  }
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/models',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
      (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve({ ok: true });
          return;
        }
        if (res.statusCode === 401) {
          resolve({ ok: false, error: 'Invalid API key (unauthorized)' });
          return;
        }
        resolve({ ok: false, error: `OpenAI returned HTTP ${res.statusCode}` });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Request timed out' });
    });
    req.on('error', (err) => {
      resolve({ ok: false, error: err.message || 'Network error' });
    });
    req.end();
  });
}

module.exports = { testOpenAiApiKey };
