// Watch Streak milestone alerts — dashboard settings (Tools → Watch Streak Alerts)

function escapeHtmlWs(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

let watchStreakUiConfig = null;

function tierBackgroundColorToInput(bg) {
  if (!bg || String(bg).includes('gradient')) return '#4a148c';
  const m = String(bg).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#4a148c';
  const hex = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

function inputColorToBackground(hex) {
  if (!hex) return 'rgba(74, 20, 140, 0.94)';
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return 'rgba(74, 20, 140, 0.94)';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `linear-gradient(135deg, rgba(${r},${g},${b},0.96), rgba(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)},0.92))`;
}

async function watchStreakOverlayUrl() {
  let base = '';
  if (window.electronAPI?.getWatchStreakOverlayUrl) {
    const res = await window.electronAPI.getWatchStreakOverlayUrl();
    if (res?.success && res.url) return res.url;
  }
  if (window.electronAPI?.getOverlayUrl) {
    base = await window.electronAPI.getOverlayUrl();
  }
  const origin = String(base || '').replace(/\/overlay.*$/, '');
  if (origin) return `${origin}/watch-streak`;
  return `${location.protocol}//${location.hostname}:8080/watch-streak`;
}

function openWatchStreakModal() {
  const modal = document.getElementById('watch-streak-settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  loadWatchStreakSettingsUi();
}

function closeWatchStreakModal() {
  const modal = document.getElementById('watch-streak-settings-modal');
  if (modal) modal.classList.add('hidden');
}

async function refreshWatchStreakScopeWarning() {
  const el = document.getElementById('watch-streak-scope-warning');
  if (!el || !window.electronAPI?.watchStreakHealth) return;
  try {
    const health = await window.electronAPI.watchStreakHealth();
    const issues = [];
    if (health.missingScope) {
      issues.push(`Reconnect Twitch to enable watch streak alerts (missing scope: ${health.scopeRequired}).`);
    }
    if (!health.eventSubConnected) {
      issues.push('Twitch EventSub is not connected.');
    }
    if (health.enabled && !health.hasChatNotificationSub) {
      issues.push('No EventSub subscription for channel.chat.notification yet — save settings or reconnect Twitch.');
    }
    if (issues.length) {
      el.style.display = 'block';
      el.textContent = issues.join(' ');
    } else {
      el.style.display = 'none';
      el.textContent = '';
    }
  } catch (err) {
    console.warn('watch streak health:', err);
  }
}

function renderWatchStreakTiers() {
  const host = document.getElementById('watch-streak-tiers-list');
  const perMode = document.getElementById('watch-streak-per-tier-panel');
  const simpleMode = document.getElementById('watch-streak-simple-tier-panel');
  if (!host || !watchStreakUiConfig) return;
  const same = !!document.getElementById('watch-streak-simple-mode')?.checked;
  if (perMode) perMode.style.display = same ? 'none' : 'block';
  if (simpleMode) simpleMode.style.display = same ? 'block' : 'none';
  if (same) return;

  host.innerHTML = '';
  (watchStreakUiConfig.tiers || []).forEach((tier, index) => {
    const row = document.createElement('div');
    row.className = 'watch-streak-tier-row';
    row.dataset.index = String(index);
    row.innerHTML = `
      <a class="watch-streak-tier-head" href="#">
        <strong>${tier.threshold}-stream milestone</strong>
        <span class="watch-streak-tier-preview">${escapeHtmlWs(tier.textTemplate || '')}</span>
      </a>
      <div class="watch-streak-tier-body">
        <label>Milestone (streams)
          <input type="number" class="ws-tier-threshold" min="1" value="${tier.threshold}" />
        </label>
        <label>Alert text
          <input type="text" class="ws-tier-text" value="${escapeHtmlWs(tier.textTemplate || '')}" />
        </label>
        <label>Chat reply (optional)
          <input type="text" class="ws-tier-chat" value="${escapeHtmlWs(tier.chatMessage || '')}" />
        </label>
        <div class="ws-tier-colors">
          <label>Text <input type="color" class="ws-tier-text-color" value="${tier.textColor || '#ffffff'}" /></label>
          <label>Accent <input type="color" class="ws-tier-accent" value="${tier.accentColor || '#ffd54f'}" /></label>
          <label>Card tint <input type="color" class="ws-tier-bg" value="${tierBackgroundColorToInput(tier.backgroundColor)}" /></label>
        </div>
        <div class="ws-tier-sound-row">
          <label>Sound file
            <input type="text" class="ws-tier-sound" value="${escapeHtmlWs(tier.soundFile || '')}" placeholder="sounds/my-streak.mp3" />
          </label>
          <button type="button" class="preference-button ws-tier-browse-sound">Browse…</button>
          <input type="file" class="ws-tier-sound-file hidden" accept="audio/*" />
        </div>
        <label>Effect
          <select class="ws-tier-effect">
            ${['glow', 'pulse', 'shine', 'flare', 'burst', 'epic', 'confetti']
              .map((e) => `<option value="${e}" ${tier.effect === e ? 'selected' : ''}>${e}</option>`)
              .join('')}
          </select>
        </label>
        <label class="ws-tier-volume-label">Volume
          <input type="range" class="ws-tier-volume" min="0" max="100" value="${tier.soundVolume != null ? tier.soundVolume : 80}" />
          <span class="ws-tier-volume-val">${tier.soundVolume != null ? tier.soundVolume : 80}%</span>
        </label>
        <button type="button" class="preference-button ws-tier-test" data-threshold="${tier.threshold}">Test this tier</button>
        <button type="button" class="preference-button ws-tier-remove">Remove tier</button>
      </div>
    `;
    host.appendChild(row);
  });
}

function collectTierFromRow(row, baseTier = {}) {
  const threshold = parseInt(row.querySelector('.ws-tier-threshold')?.value, 10) || baseTier.threshold || 3;
  return {
    ...baseTier,
    threshold,
    textTemplate: row.querySelector('.ws-tier-text')?.value || '',
    chatMessage: row.querySelector('.ws-tier-chat')?.value || '',
    textColor: row.querySelector('.ws-tier-text-color')?.value || '#ffffff',
    accentColor: row.querySelector('.ws-tier-accent')?.value || '#ffd54f',
    backgroundColor: inputColorToBackground(row.querySelector('.ws-tier-bg')?.value),
    effect: row.querySelector('.ws-tier-effect')?.value || 'glow',
    soundFile: row.querySelector('.ws-tier-sound')?.value || '',
    soundVolume: parseInt(row.querySelector('.ws-tier-volume')?.value, 10) || 80,
    scale: baseTier.scale,
    durationMs: baseTier.durationMs,
    id: baseTier.id || `tier_${threshold}`,
  };
}

function collectWatchStreakConfigFromForm() {
  const enabled = !!document.getElementById('watch-streak-enabled')?.checked;
  const sameAlertForEveryStreak = !!document.getElementById('watch-streak-simple-mode')?.checked;
  const cfg = { ...(watchStreakUiConfig || {}), enabled, sameAlertForEveryStreak, tiers: [] };
  if (!sameAlertForEveryStreak) {
    document.querySelectorAll('.watch-streak-tier-row').forEach((row, i) => {
      const base = (watchStreakUiConfig.tiers || [])[i] || {};
      cfg.tiers.push(collectTierFromRow(row, base));
    });
  }
  const simple = cfg.simpleTier || {};
  cfg.simpleTier = {
    ...simple,
    textTemplate: document.getElementById('watch-streak-simple-text')?.value || simple.textTemplate,
    chatMessage: document.getElementById('watch-streak-simple-chat')?.value || simple.chatMessage,
    effect: document.getElementById('watch-streak-simple-effect')?.value || simple.effect,
    soundFile: document.getElementById('watch-streak-simple-sound')?.value || simple.soundFile,
    soundVolume: parseInt(document.getElementById('watch-streak-simple-volume')?.value, 10) || 80,
  };
  return cfg;
}

async function loadWatchStreakSettingsUi() {
  if (!window.electronAPI?.getWatchStreakConfig) return;
  watchStreakUiConfig = await window.electronAPI.getWatchStreakConfig();
  document.getElementById('watch-streak-enabled').checked = !!watchStreakUiConfig.enabled;
  document.getElementById('watch-streak-simple-mode').checked = !!watchStreakUiConfig.sameAlertForEveryStreak;

  const simple = watchStreakUiConfig.simpleTier || {};
  document.getElementById('watch-streak-simple-text').value = simple.textTemplate || '';
  document.getElementById('watch-streak-simple-chat').value = simple.chatMessage || '';
  document.getElementById('watch-streak-simple-effect').value = simple.effect || 'shine';
  document.getElementById('watch-streak-simple-sound').value = simple.soundFile || '';
  document.getElementById('watch-streak-simple-volume').value = simple.soundVolume != null ? simple.soundVolume : 80;

  const urlEl = document.getElementById('watch-streak-overlay-url');
  if (urlEl) urlEl.textContent = await watchStreakOverlayUrl();

  renderWatchStreakTiers();
  await refreshWatchStreakScopeWarning();
  await loadWatchStreakLeadersUi();
}

async function loadWatchStreakLeadersUi() {
  const list = document.getElementById('watch-streak-leaders-list');
  if (!list || !window.electronAPI?.getWatchStreakLeaders) return;
  const res = await window.electronAPI.getWatchStreakLeaders();
  const leaders = res.leaders || [];
  if (!leaders.length) {
    list.innerHTML = '<p class="raid-muted">No shared streaks logged yet.</p>';
    return;
  }
  list.innerHTML = `
    <table class="watch-streak-leaders-table">
      <thead><tr><th>Viewer</th><th>Highest shared</th><th>Last shared</th></tr></thead>
      <tbody>
        ${leaders
          .map(
            (e) => `<tr>
            <td>${escapeHtmlWs(e.displayName || e.login)}</td>
            <td>${e.highestSharedStreak || 0}</td>
            <td>${e.lastSharedStreak || 0} <small>${escapeHtmlWs((e.lastSharedAt || '').slice(0, 10))}</small></td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

async function saveWatchStreakSettingsUi() {
  const payload = collectWatchStreakConfigFromForm();
  const res = await window.electronAPI.saveWatchStreakConfig(payload);
  if (res?.success) {
    watchStreakUiConfig = res.config || payload;
    if (typeof showCustomAlert === 'function') showCustomAlert('Watch streak settings saved', 'success');
    await refreshWatchStreakScopeWarning();
  } else if (typeof showCustomAlert === 'function') {
    showCustomAlert(res?.error || 'Failed to save', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('menu-tools-watch-streak');
  if (openBtn) openBtn.addEventListener('click', () => openWatchStreakModal());

  const closeBtn = document.getElementById('watch-streak-settings-close');
  if (closeBtn) closeBtn.addEventListener('click', () => closeWatchStreakModal());

  const modal = document.getElementById('watch-streak-settings-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeWatchStreakModal();
    });
  }

  document.getElementById('watch-streak-save')?.addEventListener('click', () => saveWatchStreakSettingsUi());

  document.getElementById('watch-streak-simple-mode')?.addEventListener('change', () => renderWatchStreakTiers());

  document.getElementById('watch-streak-add-tier')?.addEventListener('click', () => {
    const next = (watchStreakUiConfig.tiers?.slice(-1)[0]?.threshold || 0) + 5;
    watchStreakUiConfig.tiers = [...(watchStreakUiConfig.tiers || []), { threshold: next, textTemplate: '{user} hit {count} streams!' }];
    renderWatchStreakTiers();
  });

  document.getElementById('watch-streak-copy-url')?.addEventListener('click', async () => {
    const url = await watchStreakOverlayUrl();
    try {
      await navigator.clipboard.writeText(url);
      if (typeof showCustomAlert === 'function') showCustomAlert('Overlay URL copied', 'success');
    } catch (e) {
      console.warn(e);
    }
  });

  document.getElementById('watch-streak-clear-leaders')?.addEventListener('click', async () => {
    if (!confirm('Clear the top streakers log?')) return;
    await window.electronAPI.clearWatchStreakLeaders();
    await loadWatchStreakLeadersUi();
  });

  document.getElementById('watch-streak-tiers-list')?.addEventListener('click', async (e) => {
    const browse = e.target.closest('.ws-tier-browse-sound');
    if (browse) {
      const row = browse.closest('.watch-streak-tier-row');
      const fileInput = row?.querySelector('.ws-tier-sound-file');
      fileInput?.click();
      return;
    }
    const testBtn = e.target.closest('.ws-tier-test');
    if (testBtn) {
      const threshold = parseInt(testBtn.dataset.threshold, 10) || 10;
      await window.electronAPI.testWatchStreakTier({ threshold });
      return;
    }
    const removeBtn = e.target.closest('.ws-tier-remove');
    if (removeBtn) {
      const row = removeBtn.closest('.watch-streak-tier-row');
      const idx = parseInt(row?.dataset.index, 10);
      if (Number.isFinite(idx)) {
        watchStreakUiConfig.tiers.splice(idx, 1);
        renderWatchStreakTiers();
      }
    }
  });

  document.getElementById('watch-streak-simple-test')?.addEventListener('click', async () => {
    await window.electronAPI.testWatchStreakTier({ threshold: 12 });
  });

  document.getElementById('watch-streak-tiers-list')?.addEventListener('change', async (e) => {
    const fileInput = e.target.closest('.ws-tier-sound-file');
    if (!fileInput?.files?.[0]) return;
    const row = fileInput.closest('.watch-streak-tier-row');
    const text = row?.querySelector('.ws-tier-sound');
    if (window.electronAPI?.saveAudioFileToSounds) {
      const path = fileInput.files[0].path || '';
      const res = await window.electronAPI.saveAudioFileToSounds({
        originalPath: path,
        fileName: fileInput.files[0].name,
      });
      if (res?.relativePath && text) text.value = res.relativePath;
    } else if (text) {
      text.value = fileInput.files[0].name;
    }
  });

  document.getElementById('watch-streak-tiers-list')?.addEventListener('input', (e) => {
    const vol = e.target.closest('.ws-tier-volume');
    if (vol) {
      const lbl = vol.closest('.ws-tier-volume-label')?.querySelector('.ws-tier-volume-val');
      if (lbl) lbl.textContent = `${vol.value}%`;
    }
  });

  window.electronAPI?.onWatchStreakAlertFired?.(() => loadWatchStreakLeadersUi());
});

window.openWatchStreakModal = openWatchStreakModal;
window.closeWatchStreakModal = closeWatchStreakModal;