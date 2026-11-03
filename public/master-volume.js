// Master volume UI + runtime scaling (keep lib/master-volume.js in sync for pure helpers)
(function (global) {
  const clampPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 100;
    return Math.min(100, Math.max(0, Math.round(n)));
  };

  const normalizeButtonVolume = (raw) => {
    if (raw === undefined || raw === null || raw === '') return 1;
    let n = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!Number.isFinite(n)) return 1;
    if (n > 1) n = n / 100;
    return Math.min(1, Math.max(0, n));
  };

  const getEffectiveMultiplier = (state) => {
    if (state && state.muted) return 0;
    const percent = state && state.percent !== undefined ? state.percent : 100;
    return clampPercent(percent) / 100;
  };

  const scaleNormalizedVolume = (normalizedVolume, state) =>
    normalizeButtonVolume(normalizedVolume) * getEffectiveMultiplier(state);

  const effectiveVolume = (buttonVolume, state) =>
    scaleNormalizedVolume(buttonVolume, state);

  const formatMasterVolumeLabel = (percent, muted) => {
    if (muted) return 'Muted';
    return `${clampPercent(percent)}%`;
  };

  const state = {
    percent: 100,
    muted: false,
    preMutePercent: 100,
  };

  let persistTimer = null;

  function getState() {
    return { percent: state.percent, muted: state.muted };
  }

  function syncUi() {
    const slider = document.getElementById('master-volume-input');
    const valueEl = document.getElementById('master-volume-value');
    const muteBtn = document.getElementById('master-volume-mute');
    if (slider && String(slider.value) !== String(state.percent)) {
      slider.value = String(state.percent);
    }
    if (valueEl) {
      valueEl.textContent = formatMasterVolumeLabel(state.percent, state.muted);
    }
    if (muteBtn) {
      const icon = state.muted || state.percent === 0 ? '🔇' : '🔊';
      muteBtn.textContent = icon;
      muteBtn.setAttribute(
        'aria-pressed',
        state.muted || state.percent === 0 ? 'true' : 'false',
      );
      muteBtn.title = state.muted
        ? 'Unmute master volume (M). Double-click sets slider to 0%.'
        : 'Mute master volume (M). Double-click sets slider to 0%.';
    }
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      if (global.profileManager && typeof global.profileManager.saveCurrentSettings === 'function') {
        global.profileManager.saveCurrentSettings().catch((err) => {
          console.warn('Failed to persist master volume:', err);
        });
      }
    }, 400);
  }

  function setPercent(percent, options = {}) {
    state.percent = clampPercent(percent);
    if (options.fromUser && state.muted && state.percent > 0) {
      state.muted = false;
    }
    if (state.percent === 0) {
      state.muted = true;
    }
    syncUi();
    if (options.persist !== false) schedulePersist();
  }

  function toggleMute() {
    if (state.muted || state.percent === 0) {
      state.muted = false;
      if (state.percent === 0) {
        state.percent = state.preMutePercent > 0 ? state.preMutePercent : 100;
      }
    } else {
      state.preMutePercent = state.percent > 0 ? state.percent : 100;
      state.muted = true;
    }
    syncUi();
    schedulePersist();
  }

  function quickZero() {
    if (state.percent > 0) {
      state.preMutePercent = state.percent;
    }
    state.percent = 0;
    state.muted = true;
    syncUi();
    schedulePersist();
  }

  function applySettings(uiSettings) {
    if (!uiSettings || typeof uiSettings !== 'object') return;
    const percent =
      uiSettings.masterVolume !== undefined ? uiSettings.masterVolume : 100;
    state.percent = clampPercent(percent);
    state.muted = !!uiSettings.masterVolumeMuted;
    if (state.percent === 0) state.muted = true;
    if (state.percent > 0 && !state.muted) {
      state.preMutePercent = state.percent;
    }
    syncUi();
  }

  function applyToAudioElement(element, buttonVolume) {
    if (!element || typeof element.volume !== 'number') return;
    const vol = effectiveVolume(buttonVolume, getState());
    element.volume = 0;
    element.volume = Math.max(0, Math.min(1, vol));
  }

  function scaleStoredVolume(storedVolume) {
    const base =
      storedVolume === undefined || storedVolume === null ? 1 : storedVolume;
    return Math.max(0, Math.min(1, effectiveVolume(base, getState())));
  }

  function bindControls() {
    const slider = document.getElementById('master-volume-input');
    const muteBtn = document.getElementById('master-volume-mute');
    if (slider) {
      slider.addEventListener('input', (e) => {
        setPercent(e.target.value, { fromUser: true });
      });
    }
    if (muteBtn) {
      muteBtn.addEventListener('click', () => toggleMute());
      muteBtn.addEventListener('dblclick', (e) => {
        e.preventDefault();
        quickZero();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        const controls = document.getElementById('sound-controls');
        if (controls && !controls.classList.contains('hidden')) {
          toggleMute();
        }
      }
    });
    syncUi();
  }

  global.masterVolume = {
    getState,
    getPercent: () => state.percent,
    isMuted: () => state.muted || state.percent === 0,
    applySettings,
    applyToAudioElement,
    scaleStoredVolume,
    effectiveVolume: (buttonVolume) => effectiveVolume(buttonVolume, getState()),
    toggleMute,
    quickZero,
    bindControls,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindControls);
  } else {
    bindControls();
  }
})(window);
