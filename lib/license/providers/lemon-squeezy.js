const fetch = require('node-fetch');

const API_BASE = 'https://api.lemonsqueezy.com/v1';

/**
 * Lemon Squeezy License API (activate / validate / deactivate).
 * @see https://docs.lemonsqueezy.com/api/license-api
 */
function createLemonSqueezyProvider({ apiKey }) {
  if (!apiKey) {
    throw new Error('LEMONSQUEEZY_API_KEY is required when VD_LICENSE_PROVIDER=lemonsqueezy');
  }

  async function post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg =
        (data && data.error) ||
        (data && data.errors && JSON.stringify(data.errors)) ||
        `HTTP ${res.status}`;
      return { ok: false, error: String(msg), status: res.status, raw: data };
    }
    return { ok: true, body: data || {} };
  }

  return {
    name: 'lemonsqueezy',
    async activate(licenseKey, instanceName) {
      const result = await post('/licenses/activate', {
        license_key: licenseKey,
        instance_name: instanceName,
      });
      if (!result.ok) return result;
      const data = result.body;
      if (data.activated === false) {
        return {
          ok: false,
          error: data.error || 'License could not be activated (already used or invalid)',
        };
      }
      return {
        ok: true,
        instance: data.instance,
        meta: data.meta,
        licenseKey: data.license_key,
      };
    },
    async validate(licenseKey, instanceId) {
      const result = await post('/licenses/validate', {
        license_key: licenseKey,
        instance_id: instanceId,
      });
      if (!result.ok) return result;
      const data = result.body;
      if (data.valid === false) {
        return { ok: false, error: data.error || 'License is not valid for this device' };
      }
      return { ok: true, meta: data.meta };
    },
    async deactivate(licenseKey, instanceId) {
      const result = await post('/licenses/deactivate', {
        license_key: licenseKey,
        instance_id: instanceId,
      });
      if (!result.ok) return result;
      return { ok: true, deactivated: result.body && result.body.deactivated };
    },
  };
}

module.exports = { createLemonSqueezyProvider };
