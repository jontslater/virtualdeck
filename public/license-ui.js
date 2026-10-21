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
    if (!buttonId || !cachedDeck) return false;
    if (cachedStatus && (cachedStatus.licensed || cachedStatus.unlimitedButtons)) return false;
    if (cachedDeck.licensed || cachedDeck.unlimitedButtons) return false;
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
    const keyInput = document.getElementById('license-key-input');
    if (msg && status) {
      const label = status.licensed ? 'Licensed' : 'Free plan';
      const saved = status.hasLicenseKey ? ' Saved on this PC.' : '';
      msg.textContent = `${label} —${saved} ${status.message || ''}`.replace(/\s+/g, ' ').trim();
      msg.classList.toggle('license-status-licensed', !!status.licensed);
      msg.classList.toggle('license-status-free', !status.licensed);
    }
    if (keyInput) {
      keyInput.value = '';
      keyInput.placeholder = status && status.hasLicenseKey
        ? 'Saved on this PC — enter a new key only to replace it'
        : 'XXXX-XXXX-XXXX-XXXX';
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
    const keyToggle = document.getElementById('license-key-toggle-visibility');

    if (keyToggle && keyInput) {
      keyToggle.addEventListener('click', () => {
        const showing = keyInput.type === 'text';
        keyInput.type = showing ? 'password' : 'text';
        keyToggle.textContent = showing ? 'Show' : 'Hide';
      });
    }

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
          if (window.vdRavenSetup && typeof window.vdRavenSetup.promptAfterLicenseActivation === 'function') {
            await window.vdRavenSetup.promptAfterLicenseActivation();
          }
          if (window.vdRavenSetup && typeof window.vdRavenSetup.applyAiDashboardVisibility === 'function') {
            await window.vdRavenSetup.applyAiDashboardVisibility();
          }
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
          if (window.vdRavenSetup && typeof window.vdRavenSetup.applyAiDashboardVisibility === 'function') {
            await window.vdRavenSetup.applyAiDashboardVisibility();
          }
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
        const stats = document.getElementById('twitch-stats-container');
        const keepStats = !!(stats && !stats.classList.contains('hidden'));
        await refreshLicenseStatus();
        await refreshDeckEntitlements();
        paintLicensePreferences(cachedStatus);
        if (typeof loadButtons === 'function') await loadButtons();
        if (keepStats && stats) stats.classList.remove('hidden');
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
