/**
 * Dev / CI license provider — no network calls.
 */
function createMockProvider(options = {}) {
  const prefixes = options.mockKeyPrefixes || ['VD-MOCK-', 'VDTEST-'];

  function isKeyShapeValid(key) {
    const trimmed = String(key || '').trim();
    if (!trimmed) return false;
    if (prefixes.some((p) => trimmed.toUpperCase().startsWith(p.toUpperCase()))) {
      return true;
    }
    // Any non-trivial key works in mock mode for local testing
    return trimmed.length >= 12;
  }

  return {
    name: 'mock',
    async activate(licenseKey, instanceName) {
      if (!isKeyShapeValid(licenseKey)) {
        return {
          ok: false,
          error: 'Invalid license key (mock mode: use VD-MOCK-… or a key at least 12 characters)',
        };
      }
      return {
        ok: true,
        instance: { id: instanceName, name: instanceName },
        meta: { provider: 'mock', activatedAt: new Date().toISOString() },
      };
    },
    async validate(licenseKey, instanceName) {
      if (!isKeyShapeValid(licenseKey)) {
        return { ok: false, error: 'License key not found' };
      }
      return { ok: true, meta: { provider: 'mock' } };
    },
    async deactivate(licenseKey, instanceName) {
      if (!licenseKey) {
        return { ok: false, error: 'No license key' };
      }
      return { ok: true };
    },
  };
}

module.exports = { createMockProvider };
