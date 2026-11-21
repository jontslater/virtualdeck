/**
 * Hydration tracker dashboard panel (Tools → Hydration).
 */
(function () {
  const state = { config: null, overlayUrl: '', saving: false };

  function $(id) {
    return document.getElementById(id);
  }

  function api(name) {
    return window.electronAPI && window.electronAPI[name];
  }

  async function refreshOverlayUrl() {
    if (api('getHydrationUrl')) {
      const url = await api('getHydrationUrl');
      state.overlayUrl = url;
      const el = $('hydration-overlay-url');
      if (el) el.textContent = url;
      const frame = $('hydration-preview-frame');
      if (frame && url) frame.src = `${url}?preview=1`;
    }
  }

  function setField(id, value) {
    const el = $(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value != null ? value : '';
  }

  function readNumber(id, fallback) {
    const el = $(id);
    if (!el) return fallback;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function populateForm(cfg) {
    setField('hydration-goal-input', cfg.streamGoal);
    setField('hydration-drink-input', cfg.incrementAmount);
    setField('hydration-sip-input', cfg.sipAmount);
    setField('hydration-keyword-input', cfg.redemptionKeyword);
    setField('hydration-reward-id', cfg.rewardId || '');
    setField('hydration-units-select', cfg.units || 'oz');
    setField('hydration-gauge-select', cfg.gaugeStyle || 'circular');
    setField('hydration-show-plate', cfg.showPlate !== false);
    setField('hydration-match-theme', cfg.matchTheme);
    setField('hydration-size-input', cfg.gaugeSize);
    setField('hydration-pos-x-input', cfg.positionX);
    setField('hydration-pos-y-input', cfg.positionY);
    setField('hydration-fill-color', cfg.fillColor || cfg.waterColor);
    setField('hydration-text-color-input', cfg.textColor);
    setField('hydration-accent-color', cfg.accentColor);
    setField('hydration-plate-color', cfg.plateColor || cfg.backgroundColor);
    setField('hydration-reset-mode', cfg.resetMode || 'go-live');
    setField('hydration-reminder-minutes', cfg.reminderMinutes);
    setField('hydration-effects-enabled', cfg.enableEffects !== false);
    setField('hydration-effects-intensity', cfg.effectsIntensity || 'medium');
    setField('hydration-confetti', cfg.goalConfetti !== false);
    setField('hydration-sound-enabled', cfg.soundEnabled);
    setField('hydration-sound-path', cfg.soundPath);
    setField('hydration-sound-volume', Math.round((cfg.soundVolume ?? 0.7) * 100));
    setField('hydration-goal-sound-path', cfg.goalSoundPath);
    setField('hydration-goal-sound-volume', Math.round((cfg.goalSoundVolume ?? 0.7) * 100));
    setField('hydration-log-hotkey', cfg.logHotkey || '');
    const select = $('hydration-reward-select');
    if (select && cfg.rewardId) {
      const opt = Array.from(select.options).find((o) => o.dataset.rewardId === cfg.rewardId);
      if (opt) select.value = opt.value;
    }
  }

  function collectForm(existing) {
    const base = { ...(existing || {}), ...(state.config || {}) };
    return {
      ...base,
      streamGoal: readNumber('hydration-goal-input', 64),
      incrementAmount: readNumber('hydration-drink-input', 8),
      sipAmount: readNumber('hydration-sip-input', 4),
      redemptionKeyword: ($('hydration-keyword-input')?.value || 'hydrate').trim(),
      rewardId: $('hydration-reward-id')?.value || '',
      units: $('hydration-units-select')?.value || 'oz',
      gaugeStyle: $('hydration-gauge-select')?.value || 'circular',
      showPlate: $('hydration-show-plate')?.checked !== false,
      matchTheme: !!$('hydration-match-theme')?.checked,
      gaugeSize: readNumber('hydration-size-input', 200),
      positionX: readNumber('hydration-pos-x-input', 50),
      positionY: readNumber('hydration-pos-y-input', 50),
      fillColor: $('hydration-fill-color')?.value,
      waterColor: $('hydration-fill-color')?.value,
      textColor: $('hydration-text-color-input')?.value,
      accentColor: $('hydration-accent-color')?.value,
      plateColor: $('hydration-plate-color')?.value,
      backgroundColor: $('hydration-plate-color')?.value,
      resetMode: $('hydration-reset-mode')?.value || 'go-live',
      resetOnLive: ($('hydration-reset-mode')?.value || 'go-live') === 'go-live',
      reminderMinutes: readNumber('hydration-reminder-minutes', 0),
      enableEffects: $('hydration-effects-enabled')?.checked !== false,
      effectsIntensity: $('hydration-effects-intensity')?.value || 'medium',
      goalConfetti: $('hydration-confetti')?.checked !== false,
      soundEnabled: !!$('hydration-sound-enabled')?.checked,
      soundPath: $('hydration-sound-path')?.value?.trim() || '',
      soundVolume: readNumber('hydration-sound-volume', 70) / 100,
      goalSoundPath: $('hydration-goal-sound-path')?.value?.trim() || '',
      goalSoundVolume: readNumber('hydration-goal-sound-volume', 70) / 100,
      logHotkey: $('hydration-log-hotkey')?.value?.trim() || '',
    };
  }

  async function loadRewards() {
    const select = $('hydration-reward-select');
    const hint = $('hydration-reward-scope-hint');
    if (!select || !api('getChannelRewards')) return;
    const prev = select.value;
    try {
      const result = await api('getChannelRewards')();
      if (!result.ok) {
        if (hint) {
          hint.textContent =
            result.error ||
            'Could not load rewards. Use keyword fallback or reconnect Twitch with channel:read:redemptions.';
        }
        return;
      }
      const lib = window.vdChannelRewards;
      if (lib && lib.populateRewardSelect) {
        lib.populateRewardSelect(select, result.rewards, { valueField: 'id', placeholder: '— Keyword fallback —' });
      }
      if (hint) hint.textContent = `${result.rewards.length} custom rewards loaded.`;
      if (prev) select.value = prev;
      select.addEventListener('change', () => {
        const opt = select.options[select.selectedIndex];
        $('hydration-reward-id').value = opt?.dataset?.rewardId || '';
      });
    } catch (err) {
      if (hint) hint.textContent = err.message || String(err);
    }
  }

  async function saveConfig() {
    if (!api('saveHydrationConfig')) return;
    const existing = state.config || (await api('getHydrationConfig')());
    const merged = collectForm(existing);
    merged.currentProgress = existing.currentProgress;
    merged.progressHistory = existing.progressHistory;
    merged.dailyStreak = existing.dailyStreak;
    const res = await api('saveHydrationConfig')(merged);
    if (res && res.success) {
      state.config = merged;
      if (api('refreshHotkeys')) api('refreshHotkeys')();
      if (api('testHydration')) await api('testHydration')();
      if (typeof showCustomAlert === 'function') showCustomAlert('Hydration settings saved.', 'success');
    }
  }

  async function logDrink(amount) {
    if (!api('updateHydrationProgress')) return;
    await api('updateHydrationProgress')(amount);
    await previewPulse();
  }

  async function previewPulse() {
    if (api('testHydration')) await api('testHydration')();
  }

  function openPanel() {
    const modal = $('hydration-panel-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (api('disableHotkeys')) api('disableHotkeys')();
    loadPanel();
  }

  function closePanel() {
    const modal = $('hydration-panel-modal');
    if (modal) modal.classList.add('hidden');
    if (api('enableHotkeys')) api('enableHotkeys')();
  }

  async function loadPanel() {
    if (!api('getHydrationConfig')) return;
    state.config = await api('getHydrationConfig')();
    populateForm(state.config);
    await refreshOverlayUrl();
    await loadRewards();
    if (api('testHydration')) await api('testHydration')();
  }

  function bind() {
    $('hydration-panel-close')?.addEventListener('click', closePanel);
    $('hydration-panel-modal')?.addEventListener('click', (e) => {
      if (e.target === $('hydration-panel-modal')) closePanel();
    });
    $('hydration-save-btn')?.addEventListener('click', () => saveConfig());
    $('hydration-load-rewards-btn')?.addEventListener('click', () => loadRewards());
    $('hydration-log-drink-btn')?.addEventListener('click', () => logDrink());
    $('hydration-log-sip-btn')?.addEventListener('click', async () => {
      const sip = readNumber('hydration-sip-input', state.config?.sipAmount || 4);
      await logDrink(sip);
    });
    $('hydration-undo-btn')?.addEventListener('click', async () => {
      if (api('undoHydrationProgress')) {
        await api('undoHydrationProgress')();
        await previewPulse();
      }
    });
    $('hydration-reset-btn')?.addEventListener('click', async () => {
      if (!confirm('Reset hydration progress to 0?')) return;
      if (api('resetHydration')) await api('resetHydration')();
      await previewPulse();
    });
    $('hydration-copy-url-btn')?.addEventListener('click', () => {
      const text = state.overlayUrl || $('hydration-overlay-url')?.textContent || '';
      navigator.clipboard?.writeText(text).then(() => {
        if (typeof showCustomAlert === 'function') showCustomAlert('Hydration overlay URL copied.', 'success');
      });
    });
    $('hydration-match-theme')?.addEventListener('change', async (e) => {
      if (!e.target.checked) return;
      const style = getComputedStyle(document.documentElement);
      const accent = style.getPropertyValue('--accent-primary').trim() || '#4fc3f7';
      const text = style.getPropertyValue('--text-primary').trim() || '#ffffff';
      const bg = style.getPropertyValue('--bg-secondary').trim() || 'rgba(12,16,24,0.85)';
      setField('hydration-fill-color', accent);
      setField('hydration-accent-color', accent);
      setField('hydration-text-color-input', text);
      setField('hydration-plate-color', bg);
      await saveConfig();
    });
    if (api('onHydrationStateChanged')) {
      api('onHydrationStateChanged')(() => previewPulse());
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    $('menu-tools-hydration')?.addEventListener('click', openPanel);
  });

  window.vdHydrationPanel = { openPanel, closePanel, loadPanel };
})();