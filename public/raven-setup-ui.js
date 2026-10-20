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

  function applySavedKeyPlaceholders(setup) {
    const llmInput = document.getElementById('raven-llm-api-key');
    const ttsInput = document.getElementById('raven-tts-api-key');
    if (llmInput) {
      llmInput.value = '';
      llmInput.placeholder = setup && setup.hasLlmKey ? 'Saved (enter new key to replace)' : 'sk-…';
    }
    if (ttsInput) {
      ttsInput.value = '';
      ttsInput.placeholder = setup && setup.hasTtsKey ? 'Saved (enter new key to replace)' : 'xi-…';
    }
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
    applySavedKeyPlaceholders(setup);
    if (statusLine && setup) {
      const llm = setup.llmProvider || 'openai';
      const tts = setup.ttsProvider || 'elevenlabs';
      const llmState = setup.hasLlmKey ? 'LLM key saved' : 'LLM key missing';
      const ttsState = setup.hasTtsKey ? 'TTS key saved' : 'TTS key missing';
      if (setup.configured) {
        statusLine.textContent = `Configured (${llm} + ${tts}). ${llmState}; ${ttsState}. Keys are stored in userData/raven.env.`;
      } else {
        statusLine.textContent = `Not configured — ${llmState}, ${ttsState}. Add keys below (${llm} + ${tts}).`;
      }
    }
    if (window.vdServiceGates && window.vdServiceGates.refreshRavenGate) {
      await window.vdServiceGates.refreshRavenGate();
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
    const testBtn = document.getElementById('raven-api-test-llm-btn');
    const openBtn = document.getElementById('raven-open-env-btn');
    const msg = document.getElementById('raven-api-save-message');
    const llmInput = document.getElementById('raven-llm-api-key');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!window.electronAPI || !window.electronAPI.ravenSaveApiKeys) return;
        const payload = {};
        if (llmInput && llmInput.value.trim()) payload.llmApiKey = llmInput.value.trim();
        const ttsInput = document.getElementById('raven-tts-api-key');
        if (ttsInput && ttsInput.value.trim()) payload.ttsApiKey = ttsInput.value.trim();
        if (!payload.llmApiKey && !payload.ttsApiKey) {
          if (msg) msg.textContent = 'Enter at least one key to save (leave blank to keep existing).';
          return;
        }
        const result = await window.electronAPI.ravenSaveApiKeys(payload);
        if (result && result.success) {
          const restarted = result.restart && result.restart.restarted;
          if (msg) {
            msg.textContent = restarted
              ? 'API keys saved and Raven restarted with the new keys.'
              : 'API keys saved to raven.env. Turn AI on or start Raven from Tools → Raven AI.';
          }
          if (llmInput) llmInput.value = '';
          if (ttsInput) ttsInput.value = '';
          await refreshRavenSetupPanel();
          await applyAiDashboardVisibility();
        } else if (msg) {
          msg.textContent = (result && result.error) || 'Could not save API keys.';
        }
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        if (!window.electronAPI || !window.electronAPI.ravenTestLlmKey) return;
        if (msg) msg.textContent = 'Testing OpenAI key…';
        const apiKey = llmInput && llmInput.value.trim() ? llmInput.value.trim() : undefined;
        const result = await window.electronAPI.ravenTestLlmKey(apiKey ? { apiKey } : {});
        if (msg) {
          msg.textContent = result && result.ok
            ? 'OpenAI key is valid.'
            : `OpenAI key test failed: ${(result && result.error) || 'unknown error'}`;
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
