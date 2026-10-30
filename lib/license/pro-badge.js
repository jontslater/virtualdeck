/**
 * Desktop "Pro" badge — any active paid license tier (one-time AI key today, subscription later).
 */

const PAID_LICENSE_TIERS = Object.freeze({
  ONE_TIME: 'one_time',
  LIFETIME: 'lifetime',
  SUBSCRIPTION: 'subscription',
});

const PAID_TIER_VALUES = new Set(Object.values(PAID_LICENSE_TIERS));

function normalizeTier(value) {
  if (value === undefined || value === null || value === '') return null;
  const tier = String(value).trim().toLowerCase();
  return PAID_TIER_VALUES.has(tier) ? tier : null;
}

/**
 * Infer paid tier from activation metadata and entitlement snapshot.
 * @param {{ meta?: object|null, provider?: string|null }} stored
 * @param {{ licensed?: boolean, plan?: string, tier?: string }} entitlements
 */
function resolvePaidLicenseTier(stored = {}, entitlements = {}) {
  const fromMeta =
    normalizeTier(stored.meta && (stored.meta.tier || stored.meta.plan || stored.meta.billing)) ||
    normalizeTier(entitlements.tier) ||
    normalizeTier(entitlements.plan);
  if (fromMeta) return fromMeta;

  if (entitlements.licensed) {
    const provider = stored.provider || entitlements.provider;
    if (provider === 'lemonsqueezy' || provider === 'mock') {
      return PAID_LICENSE_TIERS.ONE_TIME;
    }
    return PAID_LICENSE_TIERS.LIFETIME;
  }

  return null;
}

/**
 * @param {object|null|undefined} status License status / entitlements object
 * @returns {boolean}
 */
function shouldShowGoProButton(status) {
  if (!status || typeof status !== 'object') return false;
  if (shouldShowProBadge(status)) return false;
  return Boolean(status.purchaseUrl);
}

function shouldShowProBadge(status) {
  if (!status || typeof status !== 'object') return false;
  if (status.showProBadge === true) return true;
  if (status.showProBadge === false) return false;
  if (status.licensed !== true) return false;

  const tier =
    normalizeTier(status.tier) ||
    resolvePaidLicenseTier(
      { meta: status.meta, provider: status.provider },
      status
    );
  if (tier && PAID_TIER_VALUES.has(tier)) return true;

  return status.aiAssistant === true;
}

/**
 * Attach tier + showProBadge for renderer UI (main process is source of truth).
 * @param {object} statusFields Fields returned to UI (entitlements + metadata)
 * @param {object|null} licenseState Raw persisted license state (optional meta)
 */
function enrichStatusWithProBadge(statusFields, licenseState = null) {
  const tier = resolvePaidLicenseTier(
    {
      meta: licenseState && licenseState.meta,
      provider: (licenseState && licenseState.provider) || statusFields.provider,
    },
    statusFields
  );
  const withTier = { ...statusFields, tier };
  return {
    ...withTier,
    showProBadge: shouldShowProBadge(withTier),
  };
}

module.exports = {
  PAID_LICENSE_TIERS,
  resolvePaidLicenseTier,
  shouldShowGoProButton,
  shouldShowProBadge,
  enrichStatusWithProBadge,
};
