/**
 * License UI — reads entitlements from main process only (no client-side bypass).
 */
(function () {
  let cachedDeck = null;
  let cachedStatus = null;

  async function refreshLicenseStatus() {
    if (!window.electronAPI || typeof window.electronAPI.licenseGetStatus !== 'function') {
      return null;
    }
    cachedStatus = await window.electronAPI.licenseGetStatus();
    return cachedStatus;
  }

  async function refreshDeckEntitlements() {
    if (!window.electronAPI || typeof window.electronAPI.licenseGetDeckEntitlements !== 'function') {
      return null;
    }
    cachedDeck = await window.electronAPI.licenseGetDeckEntitlements();
    return cachedDeck;
  }

  function getCachedDeckEntitlements() {
    return cachedDeck;
  }

  function isButtonLocked(buttonId) {
    if (!buttonId || !cachedDeck || cachedDeck.unlimitedButtons) return false;
    const locked = cachedDeck.lockedButtonIds || [];
    return locked.includes(buttonId);
  }

  function canAddButton() {
    if (!cachedDeck) return true;
    return cachedDeck.canAddButton !== false;
  }

  function showUpsell(message) {
    const text =
      message ||
      'VirtualDeck Pro unlocks the AI assistant and unlimited buttons. Open Preferences → License to activate your key.';
    if (typeof showCustomAlert === 'function') {
      showCustomAlert(text, 'info');
    } else {
      alert(text);
    }
  }

  function paintLicensePreferences(status) {
    const msg = document.getElementById('license-status-message');
    const purchase = document.getElementById('license-purchase-link');
    if (msg && status) {
      const label = status.licensed ? 'Licensed' : 'Free plan';
      msg.textContent = `${label} — ${status.message || ''}`;
      msg.classList.toggle('license-status-licensed', !!status.licensed);
      msg.classList.toggle('license-status-free', !status.licensed);
    }
    if (purchase && status && status.purchaseUrl) {
      purchase.href = status.purchaseUrl;
    }
  }

  async function loadLicensePreferencesPanel() {
    const status = await refreshLicenseStatus();
    paintLicensePreferences(status);
  }

  function bindLicensePreferences() {
    const activateBtn = document.getElementById('license-activate-btn');
    const deactivateBtn = document.getElementById('license-deactivate-btn');
    const revalidateBtn = document.getElementById('license-revalidate-btn');
    const keyInput = document.getElementById('license-key-input');

    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        const key = keyInput ? keyInput.value.trim() : '';
        if (!key) {
          showUpsell('Enter your license key first.');
          return;
        }
        const result = await window.electronAPI.licenseActivate(key);
        if (result && result.success) {
          await refreshLicenseStatus();
          await refreshDeckEntitlements();
          paintLicensePreferences(result.status || cachedStatus);
          if (typeof loadButtons === 'function') loadButtons();
          showUpsell('License activated. Thank you for supporting VirtualDeck!');
        } else {
          showUpsell((result && result.error) || 'Activation failed.');
        }
      });
    }

    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.licenseDeactivate();
        if (result && result.success) {
          await refreshLicenseStatus();
          await refreshDeckEntitlements();
          paintLicensePreferences(result.status || cachedStatus);
          if (typeof loadButtons === 'function') loadButtons();
        }
      });
    }

    if (revalidateBtn) {
      revalidateBtn.addEventListener('click', async () => {
        await window.electronAPI.licenseRevalidate();
        await refreshLicenseStatus();
        paintLicensePreferences(cachedStatus);
      });
    }
  }

  function applyLockedStylesToCard(card, button) {
    if (!card || !button || !button.id) return;
    if (!isButtonLocked(button.id)) return;
    card.classList.add('sound-card-locked');
    card.title =
      'Locked on the free plan (beyond 15 active slots). Upgrade in Preferences → License — your button is saved.';
    const editBtn = card.querySelector('.edit-button');
    if (editBtn) {
      editBtn.disabled = true;
      editBtn.title = 'Upgrade to VirtualDeck Pro to edit this button';
    }
    const hotkeyEl = card.querySelector('.sound-hotkey');
    if (hotkeyEl) {
      hotkeyEl.textContent = 'Locked — Pro required';
    }
  }

  async function initLicenseUi() {
    await refreshLicenseStatus();
    await refreshDeckEntitlements();
    bindLicensePreferences();

    if (window.electronAPI && typeof window.electronAPI.onLicenseStatusChanged === 'function') {
      window.electronAPI.onLicenseStatusChanged(async () => {
        await refreshLicenseStatus();
        await refreshDeckEntitlements();
        paintLicensePreferences(cachedStatus);
        if (typeof loadButtons === 'function') loadButtons();
      });
    }
    if (window.electronAPI && typeof window.electronAPI.onLicenseUpsell === 'function') {
      window.electronAPI.onLicenseUpsell((_event, payload) => {
        showUpsell(payload && payload.message);
      });
    }

    const openPrefs = window.electronAPI && window.electronAPI.onOpenPreferences;
    if (typeof openPrefs === 'function') {
      window.electronAPI.onOpenPreferences(() => {
        loadLicensePreferencesPanel();
      });
    }
  }

  window.vdLicense = {
    initLicenseUi,
    refreshDeckEntitlements,
    refreshLicenseStatus,
    getCachedDeckEntitlements,
    isButtonLocked,
    canAddButton,
    applyLockedStylesToCard,
    loadLicensePreferencesPanel,
    showUpsell,
  };

  document.addEventListener('DOMContentLoaded', () => {
    initLicenseUi().catch((err) => console.warn('[License UI]', err));
  });
})();
