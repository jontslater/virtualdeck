/**
 * Hydration tracker dashboard panel (Tools → Hydration).
 */
(function () {
  const state = { config: null, overlayUrl: '', previewReady: false };
  let previewTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function api(name) {
    return window.electronAPI && window.electronAPI[name];
  }

  function hexToRgb(hex) {
    const h = String(hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length < 6) return { r: 12, g: 16, b: 24 };
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  function parsePlateColor(str) {
    const s = String(str || '').trim();
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
    if (m) {
      const a = m[4] != null ? Number(m[4]) : 1;
      const hex =
        '#' +
        [m[1], m[2], m[3]]
          .map((n) => {
            const x = Number(n);
            return (x < 16 ? '0' : '') + x.toString(16);
          })
          .join('');
      return { hex, opacity: Math.round(a * 100) };
    }
    if (s.startsWith('#')) return { hex: s.slice(0, 7), opacity: 82 };
    return { hex: '#0c1018', opacity: 82 };
  }

  function readPlateRgba() {
    const hex = $('hydration-plate-color-hex')?.value || '#0c1018';
    const op = readNumber('hydration-plate-opacity', 82) / 100;
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${op.toFixed(2)})`;
  }

  function syncPlateHiddenField() {
    const hidden = $('hydration-plate-color');
    if (hidden) hidden.value = readPlateRgba();
    const val = $('hydration-plate-opacity-val');
    if (val) val.textContent = `${Math.round(readNumber('hydration-plate-opacity', 82))}%`;
  }

  function normalizeOverlayUrl(value) {
    const s = value != null ? String(value).trim() : '';
    if (!s || s.includes('[native code]') || s.includes('function')) {
      return `http://localhost:8080/hydration`;
    }
    return s;
  }

  async function refreshOverlayUrl() {
    let url = '';
    if (api('getHydrationUrl')) {
      url = await api('getHydrationUrl')();
    }
    url = normalizeOverlayUrl(url);
    state.overlayUrl = url;
    const el = $('hydration-overlay-url');
    if (el) el.textContent = url;
    const frame = $('hydration-preview-frame');
    if (frame && url) {
      state.previewReady = false;
      frame.onload = () => {
        state.previewReady = true;
        pushPreviewToFrame();
        fitHydrationPreview();
        setTimeout(pushPreviewToFrame, 120);
      };
      frame.src = `${url.split('?')[0]}?preview=1&t=${Date.now()}`;
    }
    fitHydrationPreview();
  }

  function fitHydrationPreview() {
    const viewport = document.querySelector('#hydration-panel-modal .hydration-preview-viewport');
    const stage = $('hydration-preview-stage');
    if (!viewport || !stage) return;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight || (w > 0 ? (w * 9) / 16 : 0);
    if (w <= 0 || h <= 0) return;
    const scale = Math.min(w / 1920, h / 1080);
    stage.style.transform = `scale(${scale})`;
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
    const plate = parsePlateColor(cfg.plateColor || cfg.backgroundColor);
    setField('hydration-plate-color-hex', plate.hex);
    setField('hydration-plate-opacity', plate.opacity);
    syncPlateHiddenField();
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

  function buildPreviewPayload() {
    const existing = state.config || {};
    const merged = collectForm(existing);
    const progress = existing.currentProgress != null ? existing.currentProgress : 32;
    const goal = merged.streamGoal || 64;
    return {
      current: progress,
      goal,
      percentage: goal > 0 ? (progress / goal) * 100 : 0,
      streak: merged.dailyStreak || 2,
      units: merged.units || 'oz',
      config: { ...merged, currentProgress: progress },
    };
  }

  function pushPreviewToFrame() {
    const frame = $('hydration-preview-frame');
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage(
        { type: 'hydrationPreview', payload: buildPreviewPayload() },
        '*',
      );
    } catch (e) {
      /* cross-origin until loaded */
    }
  }

  function schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => pushPreviewToFrame(), 80);
  }

  function collectForm(existing) {
    syncPlateHiddenField();
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
      gaugeSize: readNumber('hydration-size-input', 280),
      positionX: readNumber('hydration-pos-x-input', 50),
      positionY: readNumber('hydration-pos-y-input', 50),
      fillColor: $('hydration-fill-color')?.value,
      waterColor: $('hydration-fill-color')?.value,
      textColor: $('hydration-text-color-input')?.value,
      accentColor: $('hydration-accent-color')?.value,
      plateColor: readPlateRgba(),
      backgroundColor: readPlateRgba(),
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

  function applyRewardSelectFromConfig(cfg) {
    const select = $('hydration-reward-select');
    if (!select || !cfg?.rewardId) return;
    const opt = Array.from(select.options).find((o) => o.dataset.rewardId === String(cfg.rewardId));
    if (opt) select.value = opt.value;
  }

  function rewardHintMessage(result) {
    if (!result) return 'Reconnect Twitch to load rewards.';
    if (!result.ok) {
      const err = result.error || '';
      if (/401|403|scope|unauthorized|forbidden/i.test(err)) {
        return 'Reconnect Twitch (needs channel:read:redemptions) to load rewards, or use keyword fallback.';
      }
      if (/not connected/i.test(err)) {
        return 'Reconnect Twitch in VirtualDeck to load channel point rewards.';
      }
      return err || 'Reconnect Twitch to load rewards.';
    }
    if (!result.rewards.length) {
      return 'No custom rewards on this channel yet. Create one on Twitch or use keyword fallback.';
    }
    return `${result.rewards.length} reward(s) loaded. Pick one or leave on keyword fallback.`;
  }

  async function loadRewards() {
    const select = $('hydration-reward-select');
    const hint = $('hydration-reward-scope-hint');
    const lib = window.vdChannelRewards;
    if (!select) return;
    if (!lib?.loadRewardsIntoSelect) {
      if (hint) hint.textContent = 'Reward list UI failed to load. Restart the app.';
      return;
    }
    const prev = select.value;
    try {
      const result = await lib.loadRewardsIntoSelect(select, {
        valueField: 'id',
        placeholder: '— Keyword fallback —',
      });
      if (hint) hint.textContent = rewardHintMessage(result);
      applyRewardSelectFromConfig(state.config);
      if (prev && Array.from(select.options).some((o) => o.value === prev)) {
        select.value = prev;
      }
      const opt = select.selectedOptions[0];
      if ($('hydration-reward-id')) {
        $('hydration-reward-id').value = opt?.dataset?.rewardId || '';
      }
    } catch (err) {
      lib.populateRewardSelect(select, [], { valueField: 'id', placeholder: '— Keyword fallback —' });
      if (hint) hint.textContent = err.message || 'Reconnect Twitch to load rewards.';
    }
  }

  async function browseSoundInto(inputId) {
    const input = $(inputId);
    if (!input) return;
    const pick = api('pickAudioFileForSounds');
    if (!pick) {
      if (typeof showCustomAlert === 'function') {
        showCustomAlert('Sound picker is unavailable. Enter a path under sounds/ manually.', 'error');
      }
      return;
    }
    const result = await pick();
    if (result?.canceled) return;
    if (result?.success && result.filePath) {
      input.value = result.filePath;
      schedulePreview();
      return;
    }
    if (typeof showCustomAlert === 'function') {
      showCustomAlert(result?.error || 'Could not add sound file.', 'error');
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
      pushPreviewToFrame();
      if (typeof showCustomAlert === 'function') showCustomAlert('Hydration settings saved.', 'success');
    }
  }

  async function logDrink(amount) {
    if (!api('updateHydrationProgress')) return;
    await api('updateHydrationProgress')(amount);
    state.config = await api('getHydrationConfig')();
    await previewPulse();
  }

  async function previewPulse() {
    if (api('testHydration')) await api('testHydration')();
    pushPreviewToFrame();
  }

  function openPanel() {
    const modal = $('hydration-panel-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (api('disableHotkeys')) api('disableHotkeys')();
    loadPanel();
    requestAnimationFrame(() => fitHydrationPreview());
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
    schedulePreview();
  }

  function bind() {
    $('hydration-panel-close')?.addEventListener('click', closePanel);
    $('hydration-panel-backdrop')?.addEventListener('click', closePanel);
    $('hydration-browse-log-sound')?.addEventListener('click', () => browseSoundInto('hydration-sound-path'));
    $('hydration-browse-goal-sound')?.addEventListener('click', () => browseSoundInto('hydration-goal-sound-path'));
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
        state.config = await api('getHydrationConfig')();
        await previewPulse();
      }
    });
    $('hydration-reset-btn')?.addEventListener('click', async () => {
      if (!confirm('Reset hydration progress to 0?')) return;
      if (api('resetHydration')) await api('resetHydration')();
      state.config = await api('getHydrationConfig')();
      await previewPulse();
    });
    $('hydration-copy-url-btn')?.addEventListener('click', () => {
      const text = state.overlayUrl || $('hydration-overlay-url')?.textContent || '';
      navigator.clipboard?.writeText(text).then(() => {
        if (typeof showCustomAlert === 'function') showCustomAlert('Hydration overlay URL copied.', 'success');
      });
    });
    $('hydration-reward-select')?.addEventListener('change', () => {
      const opt = $('hydration-reward-select')?.options[$('hydration-reward-select').selectedIndex];
      if ($('hydration-reward-id')) $('hydration-reward-id').value = opt?.dataset?.rewardId || '';
      schedulePreview();
    });
    $('hydration-match-theme')?.addEventListener('change', async (e) => {
      if (!e.target.checked) return;
      const style = getComputedStyle(document.documentElement);
      const accent = style.getPropertyValue('--accent-primary').trim() || '#4fc3f7';
      const text = style.getPropertyValue('--text-primary').trim() || '#ffffff';
      const bg = style.getPropertyValue('--bg-secondary').trim() || 'rgb(22, 33, 62)';
      setField('hydration-fill-color', accent);
      setField('hydration-accent-color', accent);
      setField('hydration-text-color-input', text);
      const parsed = parsePlateColor(bg);
      setField('hydration-plate-color-hex', parsed.hex);
      setField('hydration-plate-opacity', parsed.opacity);
      syncPlateHiddenField();
      schedulePreview();
    });
    $('hydration-plate-opacity')?.addEventListener('input', () => {
      syncPlateHiddenField();
      schedulePreview();
    });
    const scroll = document.querySelector('#hydration-panel-modal .hydration-scroll');
    scroll?.addEventListener('input', schedulePreview);
    scroll?.addEventListener('change', schedulePreview);

    if (api('onHydrationStateChanged')) {
      api('onHydrationStateChanged')((data) => {
        if (data) state.config = { ...state.config, ...data };
        schedulePreview();
      });
    }

    const previewViewport = document.querySelector('#hydration-panel-modal .hydration-preview-viewport');
    if (previewViewport && window.ResizeObserver) {
      const ro = new ResizeObserver(() => fitHydrationPreview());
      ro.observe(previewViewport);
    }
    window.addEventListener('resize', () => fitHydrationPreview());
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    $('menu-tools-hydration')?.addEventListener('click', (e) => {
      e.preventDefault();
      openPanel();
    });
  });

  window.closeHydrationPanel = closePanel;
  window.vdHydrationPanel = { openPanel, closePanel, loadPanel, buildPreviewPayload, pushPreviewToFrame };
})();