const nodeFetch = require('node-fetch');

const API_BASE = 'https://api.lemonsqueezy.com/v1';

/**
 * @param {Record<string, string>} fields
 */
function toFormBody(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  return params;
}

/**
 * Lemon Squeezy public License API (no store API key required).
 * @see https://docs.lemonsqueezy.com/api/license-api
 *
 * @param {{ storeId?: string, productId?: string, variantId?: string, fetchImpl?: typeof fetch }} options
 */
function createLemonSqueezyProvider(options = {}) {
  const storeId = options.storeId ? String(options.storeId).trim() : '';
  const productId = options.productId ? String(options.productId).trim() : '';
  const variantId = options.variantId ? String(options.variantId).trim() : '';
  const doFetch = options.fetchImpl || nodeFetch;

  function checkLicenseMeta(meta) {
    if (!meta) {
      return { ok: false, error: 'License response missing product metadata' };
    }
    if (storeId && String(meta.store_id) !== storeId) {
      return {
        ok: false,
        error: 'This license key is not valid for VirtualDeck (wrong store).',
      };
    }
    if (productId && String(meta.product_id) !== productId) {
      return {
        ok: false,
        error: 'This license key is not for VirtualDeck Pro.',
      };
    }
    if (variantId && String(meta.variant_id) !== variantId) {
      return {
        ok: false,
        error: 'This license key is not for the correct VirtualDeck product variant.',
      };
    }
    return { ok: true };
  }

  function checkLicenseKeyRecord(licenseKey) {
    if (!licenseKey || typeof licenseKey !== 'object') {
      return { ok: true };
    }
    const status = String(licenseKey.status || '').toLowerCase();
    if (status === 'disabled') {
      return { ok: false, error: 'This license key has been disabled.' };
    }
    if (status === 'expired') {
      return { ok: false, error: 'This license key has expired.' };
    }
    return { ok: true };
  }

  function mapApiError(data, fallback) {
    if (!data) return fallback;
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    return fallback;
  }

  function isTransientHttpStatus(status) {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  }

  async function post(path, fields) {
    let res;
    try {
      res = await doFetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: toFormBody(fields),
      });
    } catch (err) {
      const message = err && err.message ? err.message : 'Network error';
      return { ok: false, transient: true, error: `Could not reach license server: ${message}` };
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = mapApiError(data, `License server error (HTTP ${res.status})`);
      return {
        ok: false,
        transient: isTransientHttpStatus(res.status),
        error: msg,
        status: res.status,
        raw: data,
      };
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
        const msg = mapApiError(
          data,
          'License could not be activated (invalid key or activation limit reached)'
        );
        return { ok: false, error: msg };
      }

      const keyCheck = checkLicenseKeyRecord(data.license_key);
      if (!keyCheck.ok) return keyCheck;

      const metaCheck = checkLicenseMeta(data.meta);
      if (!metaCheck.ok) return metaCheck;

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
        return {
          ok: false,
          error: mapApiError(data, 'License is not valid for this device'),
        };
      }

      const keyCheck = checkLicenseKeyRecord(data.license_key);
      if (!keyCheck.ok) return keyCheck;

      const metaCheck = checkLicenseMeta(data.meta);
      if (!metaCheck.ok) return metaCheck;

      return { ok: true, meta: data.meta, licenseKey: data.license_key };
    },
    async deactivate(licenseKey, instanceId) {
      const result = await post('/licenses/deactivate', {
        license_key: licenseKey,
        instance_id: instanceId,
      });
      if (!result.ok) return result;
      const data = result.body;
      if (data.deactivated === false) {
        return {
          ok: false,
          error: mapApiError(data, 'License could not be deactivated'),
        };
      }
      return { ok: true, deactivated: true };
    },
  };
}

module.exports = { createLemonSqueezyProvider, API_BASE };
