/**
 * Raven API key setup in Preferences + post-license prompts.
 */
(function () {
  const AI_DASHBOARD_COMPONENT_ID = 'ai-dashboard-controls';

  async function getLicenseAi() {
    if (!window.electronAPI || typeof window.electronAPI.licenseGetStatus !== 'function') {
      return false;
    }
    const status = await window.electronAPI.licenseGetStatus();
    return !!(status && status.aiAssistant);
  }

  async function refreshRavenSetupPanel() {
    const section = document.getElementById('raven-api-preferences-section');
    const statusLine = document.getElementById('raven-api-status-line');
    const licensed = await getLicenseAi();
    if (section) {
      section.style.display = licensed ? '' : 'none';
    }
    if (!licensed || !window.electronAPI || typeof window.electronAPI.ravenGetSetupStatus !== 'function') {
      if (statusLine) statusLine.textContent = '';
      return null;
    }
    const setup = await window.electronAPI.ravenGetSetupStatus();
    if (statusLine && setup) {
      const llm = setup.llmProvider || 'openai';
      const tts = setup.ttsProvider || 'elevenlabs';
      if (setup.configured) {
        statusLine.textContent = `Configured (${llm} + ${tts}). Raven can start when you enable the AI dashboard.`;
      } else {
        statusLine.textContent = `Not configured yet — add your ${llm} and ${tts} API keys below, then start Raven from Tools → Raven AI.`;
      }
    }
    return setup;
  }

  async function applyAiDashboardVisibility() {
    const el = document.getElementById(AI_DASHBOARD_COMPONENT_ID);
    const checkbox = document.getElementById('toggle-ai-dashboard');
    if (!el) return;
    let eligible = false;
    try {
      const licensed = await getLicenseAi();
      let setup = null;
      if (licensed && window.electronAPI && window.electronAPI.ravenGetSetupStatus) {
        setup = await window.electronAPI.ravenGetSetupStatus();
      }
      eligible = licensed && setup && setup.configured;
    } catch (err) {
      console.warn('[Raven setup] dashboard visibility check failed', err);
    }
    if (!eligible) {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      if (checkbox) checkbox.checked = false;
      return;
    }
    let prefs = {};
    try {
      prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
    } catch (e) {
      prefs = {};
    }
    const visible = prefs.hasOwnProperty(AI_DASHBOARD_COMPONENT_ID)
      ? !!prefs[AI_DASHBOARD_COMPONENT_ID]
      : true;
    if (checkbox) checkbox.checked = visible;
    el.classList.toggle('hidden', !visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function bindRavenPreferences() {
    const saveBtn = document.getElementById('raven-api-save-btn');
    const openBtn = document.getElementById('raven-open-env-btn');
    const msg = document.getElementById('raven-api-save-message');
    const llmInput = document.getElementById('raven-llm-api-key');
    const ttsInput = document.getElementById('raven-tts-api-key');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!window.electronAPI || !window.electronAPI.ravenSaveApiKeys) return;
        const result = await window.electronAPI.ravenSaveApiKeys({
          llmApiKey: llmInput ? llmInput.value.trim() : '',
          ttsApiKey: ttsInput ? ttsInput.value.trim() : '',
        });
        if (result && result.success) {
          if (msg) msg.textContent = 'API keys saved to raven.env. Restart Raven (Tools → Raven AI) if it is already running.';
          if (llmInput) llmInput.value = '';
          if (ttsInput) ttsInput.value = '';
          await refreshRavenSetupPanel();
          await applyAiDashboardVisibility();
        } else if (msg) {
          msg.textContent = (result && result.error) || 'Could not save API keys.';
        }
      });
    }

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.ravenOpenEnvFile) {
          window.electronAPI.ravenOpenEnvFile();
        }
      });
    }
  }

  async function promptAfterLicenseActivation() {
    const licensed = await getLicenseAi();
    if (!licensed) return;
    const setup = await window.electronAPI.ravenGetSetupStatus();
    if (setup && setup.configured) {
      await applyAiDashboardVisibility();
      return;
    }
    const go = window.confirm(
      'VirtualDeck Pro is active.\n\n' +
        'Raven AI needs your own API keys (OpenAI for chat, ElevenLabs for voice by default).\n\n' +
        'Open Preferences now to enter them?',
    );
    if (go && window.electronAPI && window.electronAPI.openPreferences) {
      window.electronAPI.openPreferences();
    }
  }

  async function initRavenSetupUi() {
    bindRavenPreferences();
    await refreshRavenSetupPanel();
    await applyAiDashboardVisibility();

    if (window.electronAPI && window.electronAPI.onOpenPreferences) {
      window.electronAPI.onOpenPreferences(() => {
        refreshRavenSetupPanel();
      });
    }
    if (window.electronAPI && window.electronAPI.onLicenseStatusChanged) {
      window.electronAPI.onLicenseStatusChanged(async () => {
        await refreshRavenSetupPanel();
        await applyAiDashboardVisibility();
      });
    }
  }

  window.vdRavenSetup = {
    initRavenSetupUi,
    refreshRavenSetupPanel,
    applyAiDashboardVisibility,
    promptAfterLicenseActivation,
  };

  document.addEventListener('DOMContentLoaded', () => {
    initRavenSetupUi().catch((err) => console.warn('[Raven setup UI]', err));
  });
})();
