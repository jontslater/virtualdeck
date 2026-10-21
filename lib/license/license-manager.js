const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadLicenseConfig } = require('./config');
const { FREE_BUTTON_CAP, OFFLINE_GRACE_MS, REVALIDATE_INTERVAL_MS } = require('./constants');
const {
  computeButtonEntitlements,
  findButtonByLabel,
} = require('./button-entitlements');
const { LicenseSecureStore } = require('./secure-store');
const { createMockProvider } = require('./providers/mock');
const { createLemonSqueezyProvider } = require('./providers/lemon-squeezy');

function createProvider(config) {
  if (config.provider === 'lemonsqueezy') {
    return createLemonSqueezyProvider(config.lemonSqueezy);
  }
  return createMockProvider({ mockKeyPrefixes: config.mockKeyPrefixes });
}

class LicenseManager {
  constructor({ userDataPath, safeStorage, onStatusChange }) {
    this.userDataPath = userDataPath;
    this.config = loadLicenseConfig();
    this.provider = createProvider(this.config);
    this.store = new LicenseSecureStore(userDataPath, safeStorage);
    this.onStatusChange = onStatusChange || (() => {});
    this._revalidateTimer = null;
    this._state = this.store.load();
    this._normalizeLoadedState();
    this.instanceName = this._ensureInstanceName();
  }

  _normalizeLoadedState() {
    if (!this._state || !this._state.licenseKey) return;
    if (!this._state.lastSuccessfulValidationAt && this._state.activatedAt) {
      this._state.lastSuccessfulValidationAt = this._state.activatedAt;
    }
    if (this._state.lastValidationOk === undefined || this._state.lastValidationOk === null) {
      this._state.lastValidationOk = true;
    }
  }

  _ensureInstanceName() {
    const idPath = path.join(this.userDataPath, '.license-instance-name');
    try {
      if (fs.existsSync(idPath)) {
        const existing = fs.readFileSync(idPath, 'utf8').trim();
        if (existing) return existing;
      }
    } catch {
      // ignore
    }
    const name = `${os.hostname()}-${crypto.randomBytes(4).toString('hex')}`;
    try {
      fs.writeFileSync(idPath, name, { mode: 0o600 });
    } catch {
      // ignore
    }
    return name;
  }

  _hasStoredLicense() {
    return Boolean(this._state && this._state.licenseKey);
  }

  _lastSuccessfulValidationMs() {
    if (!this._state) return 0;
    const t = this._state.lastSuccessfulValidationAt || this._state.activatedAt;
    return t ? Number(t) : 0;
  }

  isWithinOfflineGrace(now = Date.now()) {
    const lastOk = this._lastSuccessfulValidationMs();
    if (!lastOk) return false;
    return now - lastOk < OFFLINE_GRACE_MS;
  }

  _isLicenseActive(now = Date.now()) {
    if (!this._hasStoredLicense()) return false;
    if (this._state.lastValidationOk) return true;
    return this.isWithinOfflineGrace(now);
  }

  getEntitlements(now = Date.now()) {
    const licensed = this._isLicenseActive(now);
    const graceActive = licensed && !this._state?.lastValidationOk && this.isWithinOfflineGrace(now);

    if (licensed) {
      return {
        licensed: true,
        aiAssistant: true,
        unlimitedButtons: true,
        maxButtons: null,
        freeButtonCap: FREE_BUTTON_CAP,
        provider: this.config.provider,
        graceActive,
        status: graceActive ? 'grace' : 'active',
        message: graceActive
          ? 'License in offline grace period — reconnect to validate within 7 days.'
          : 'VirtualDeck Pro active — AI assistant and unlimited buttons unlocked.',
      };
    }

    let status = 'free';
    let message = `Free plan: up to ${FREE_BUTTON_CAP} active buttons. Upgrade to unlock AI and unlimited buttons.`;
    if (this._hasStoredLicense() && !this.isWithinOfflineGrace(now)) {
      status = 'expired';
      message =
        'License could not be validated and the offline grace period ended. Enter your key again or check your connection.';
    }

    return {
      licensed: false,
      aiAssistant: false,
      unlimitedButtons: false,
      maxButtons: FREE_BUTTON_CAP,
      freeButtonCap: FREE_BUTTON_CAP,
      provider: this.config.provider,
      graceActive: false,
      status,
      message,
    };
  }

  getStatusForUi() {
    const ent = this.getEntitlements();
    const state = this._state || {};
    return {
      ...ent,
      hasLicenseKey: this._hasStoredLicense(),
      instanceName: this.instanceName,
      instanceId: state.instanceId || null,
      activatedAt: state.activatedAt || null,
      lastSuccessfulValidationAt: state.lastSuccessfulValidationAt || null,
      lastValidationAttemptAt: state.lastValidationAttemptAt || null,
      lastValidationError: state.lastValidationError || null,
      purchaseUrl: process.env.VD_LICENSE_PURCHASE_URL || 'https://virtualdeckapp.lemonsqueezy.com',
    };
  }

  getButtonEntitlementsForProfile(profile) {
    const ent = this.getEntitlements();
    const deck = computeButtonEntitlements(profile, ent.unlimitedButtons);
    return {
      ...ent,
      ...deck,
      lockedButtonIds: Array.from(deck.lockedIds),
      activeButtonIds: Array.from(deck.activeIds),
    };
  }

  canTriggerButton(profile, labelOrButton) {
    const ent = this.getEntitlements();
    if (ent.unlimitedButtons) return { allowed: true };
    const button =
      typeof labelOrButton === 'object'
        ? labelOrButton
        : findButtonByLabel(profile, labelOrButton);
    if (!button || !button.id) {
      return { allowed: true };
    }
    const deck = computeButtonEntitlements(profile, false);
    if (deck.lockedIds.has(button.id)) {
      return {
        allowed: false,
        reason: 'locked_button',
        message:
          'This button is locked on the free plan (only your first 15 active slots work). Upgrade to VirtualDeck Pro to unlock it — your data is still saved.',
      };
    }
    return { allowed: true };
  }

  canAddButton(profile) {
    const deck = computeButtonEntitlements(profile, this.getEntitlements().unlimitedButtons);
    if (deck.canAddButton) return { allowed: true };
    return {
      allowed: false,
      reason: 'button_cap',
      message: `Free plan is limited to ${FREE_BUTTON_CAP} buttons. Upgrade to VirtualDeck Pro for unlimited buttons and the AI assistant.`,
    };
  }

  canEditButton(profile, buttonId) {
    const ent = this.getEntitlements();
    if (ent.unlimitedButtons) return { allowed: true };
    const deck = computeButtonEntitlements(profile, false);
    if (buttonId && deck.lockedIds.has(buttonId)) {
      return {
        allowed: false,
        reason: 'locked_button',
        message:
          'This button is read-only on the free plan because it is beyond the 15 active slots. Upgrade to edit and trigger it again.',
      };
    }
    return { allowed: true };
  }

  canUseAiAssistant() {
    const ent = this.getEntitlements();
    if (ent.aiAssistant) return { allowed: true };
    return {
      allowed: false,
      reason: 'ai_requires_license',
      message:
        'The AI assistant (Raven) is part of VirtualDeck Pro. Purchase a license and enter your key in Preferences → License.',
    };
  }

  _persistState() {
    this.store.save(this._state);
    this.onStatusChange(this.getStatusForUi());
  }

  async activate(licenseKey) {
    const key = String(licenseKey || '').trim();
    if (!key) {
      return { success: false, error: 'License key is required' };
    }
    const result = await this.provider.activate(key, this.instanceName);
    if (!result.ok) {
      return { success: false, error: result.error || 'Activation failed' };
    }
    const now = Date.now();
    this._state = {
      licenseKey: key,
      instanceId: (result.instance && result.instance.id) || this.instanceName,
      instanceName: this.instanceName,
      activatedAt: now,
      lastSuccessfulValidationAt: now,
      lastValidationAttemptAt: now,
      lastValidationOk: true,
      lastValidationError: null,
      provider: this.provider.name,
      meta: result.meta || null,
    };
    this._persistState();
    return { success: true, status: this.getStatusForUi() };
  }

  async deactivate() {
    if (!this._hasStoredLicense()) {
      return { success: true, status: this.getStatusForUi() };
    }
    const key = this._state.licenseKey;
    const instanceId = this._state.instanceId || this.instanceName;
    try {
      await this.provider.deactivate(key, instanceId);
    } catch (err) {
      console.warn('[License] deactivate remote call failed:', err && err.message);
    }
    this._state = null;
    this.store.clear();
    this.onStatusChange(this.getStatusForUi());
    return { success: true, status: this.getStatusForUi() };
  }

  async revalidate() {
    if (!this._hasStoredLicense()) {
      return { success: true, skipped: true };
    }
    const key = this._state.licenseKey;
    const instanceId = this._state.instanceId || this.instanceName;
    const now = Date.now();
    this._state.lastValidationAttemptAt = now;
    try {
      const result = await this.provider.validate(key, instanceId);
      if (result.ok) {
        this._state.lastValidationOk = true;
        this._state.lastSuccessfulValidationAt = now;
        this._state.lastValidationError = null;
      } else if (result.transient) {
        // Offline / server errors: keep prior validation state; offline grace applies.
        this._state.lastValidationError =
          result.error || 'Could not reach license server (using offline grace if available)';
      } else {
        this._state.lastValidationOk = false;
        this._state.lastValidationError = result.error || 'Validation failed';
      }
    } catch (err) {
      // Network / unexpected errors must not revoke a recently validated license.
      this._state.lastValidationError =
        err && err.message ? err.message : 'Validation error (offline grace may apply)';
    }
    this._persistState();
    return { success: true, status: this.getStatusForUi() };
  }

  startPeriodicRevalidation() {
    if (this._revalidateTimer) return;
    const tick = () => {
      this.revalidate().catch((err) => {
        console.warn('[License] revalidate failed:', err && err.message);
      });
    };
    setTimeout(tick, 5000);
    this._revalidateTimer = setInterval(tick, REVALIDATE_INTERVAL_MS);
  }

  stopPeriodicRevalidation() {
    if (this._revalidateTimer) {
      clearInterval(this._revalidateTimer);
      this._revalidateTimer = null;
    }
  }
}

module.exports = { LicenseManager };
