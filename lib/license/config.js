/**
 * License provider configuration (env / dotenv loaded in main before require).
 */
function loadPackagedEnvDefaults() {
  try {
    return require('./packaged-env.json');
  } catch {
    return {};
  }
}

function loadLicenseConfig() {
  const packaged = loadPackagedEnvDefaults();
  const provider = String(
    process.env.VD_LICENSE_PROVIDER || packaged.VD_LICENSE_PROVIDER || 'mock',
  ).trim().toLowerCase();
  const storeId = String(
    process.env.LEMONSQUEEZY_STORE_ID || packaged.LEMONSQUEEZY_STORE_ID || '',
  ).trim();
  const productId = String(
    process.env.LEMONSQUEEZY_PRODUCT_ID || packaged.LEMONSQUEEZY_PRODUCT_ID || '',
  ).trim();
  const variantId = String(
    process.env.LEMONSQUEEZY_VARIANT_ID || packaged.LEMONSQUEEZY_VARIANT_ID || '',
  ).trim();

  return {
    provider: provider === 'lemonsqueezy' || provider === 'lemon_squeezy' ? 'lemonsqueezy' : 'mock',
    lemonSqueezy: {
      storeId,
      productId,
      variantId,
    },
    /** Mock keys accepted in dev (comma-separated prefixes). */
    mockKeyPrefixes: String(process.env.VD_LICENSE_MOCK_PREFIXES || 'VD-MOCK-,VDTEST-')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

module.exports = { loadLicenseConfig };
