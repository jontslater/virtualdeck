/**
 * License provider configuration (env / dotenv loaded in main before require).
 */
function loadLicenseConfig() {
  const provider = String(process.env.VD_LICENSE_PROVIDER || 'mock').trim().toLowerCase();
  const apiKey = String(process.env.LEMONSQUEEZY_API_KEY || '').trim();
  const storeId = String(process.env.LEMONSQUEEZY_STORE_ID || '').trim();
  const productId = String(process.env.LEMONSQUEEZY_PRODUCT_ID || '').trim();

  return {
    provider: provider === 'lemonsqueezy' || provider === 'lemon_squeezy' ? 'lemonsqueezy' : 'mock',
    lemonSqueezy: {
      apiKey,
      storeId,
      productId,
    },
    /** Mock keys accepted in dev (comma-separated prefixes). */
    mockKeyPrefixes: String(process.env.VD_LICENSE_MOCK_PREFIXES || 'VD-MOCK-,VDTEST-')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

module.exports = { loadLicenseConfig };
