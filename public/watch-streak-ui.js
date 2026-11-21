// Watch Streak milestone alerts — dashboard settings (Tools → Watch Streak Alerts)

const WS_ANIMATIONS = ['fade', 'slide', 'pop'];
const WS_LAYOUTS = [
  { value: 'above', label: 'Media above text' },
  { value: 'beside', label: 'Media beside text' },
  { value: 'mediaOnly', label: 'Media only' },
];

function escapeHtmlWs(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

let watchStreakUiConfig = null;
let watchStreakExpandedIndex = -1;

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

async function watchStreakMediaUrl(relativePath) {
  if (!relativePath) return '';
  let origin = '';
  if (window.electronAPI?.getWatchStreakOverlayUrl) {
    const res = await window.electronAPI.getWatchStreakOverlayUrl();
    if (res?.url) origin = res.url.replace(/\/watch-streak.*$/, '');
  }
  if (!origin && window.electronAPI?.getOverlayUrl) {
    const base = await window.electronAPI.getOverlayUrl();
    origin = String(base || '').replace(/\/overlay.*$/, '');
  }
  if (!origin) origin = `${location.protocol}//${location.hostname}:8080`;
  return `${origin}/media/${encodeURIComponent(String(relativePath).replace(/^\/+/, ''))}`;
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

function layoutOptionsHtml(selected) {
  return WS_LAYOUTS.map(
    (o) => `<option value="${o.value}" ${selected === o.value ? 'selected' : ''}>${o.label}</option>`,
  ).join('');
}

function animOptionsHtml(selected) {
  return WS_ANIMATIONS.map((a) => `<option value="${a}" ${selected === a ? 'selected' : ''}>${a}</option>`).join('');
}

function tierMediaThumbHtml(tier, index) {
  const media = tier.mediaFile || '';
  if (!media) {
    return '<span class="ws-tier-thumb ws-tier-thumb-empty" title="Built-in card">◆</span>';
  }
  return `<img class="ws-tier-thumb" data-thumb-index="${index}" alt="" />`;
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
    const expanded = watchStreakExpandedIndex === index;
    const row = document.createElement('div');
    row.className = 'watch-streak-tier-row' + (expanded ? ' is-expanded' : ' is-collapsed');
    row.dataset.index = String(index);
    row.innerHTML = `
      <div class="watch-streak-tier-summary">
        <button type="button" class="ws-tier-expand" aria-expanded="${expanded}" title="Expand tier">
          <span class="ws-tier-chevron">${expanded ? '▾' : '▸'}</span>
        </button>
        <div class="ws-tier-summary-text">
          <strong>${tier.threshold}-stream milestone</strong>
          <span class="watch-streak-tier-preview">${escapeHtmlWs(tier.textTemplate || '')}</span>
        </div>
        ${tierMediaThumbHtml(tier, index)}
        <button type="button" class="preference-button ws-tier-test" data-threshold="${tier.threshold}">Test</button>
      </div>
      <div class="watch-streak-tier-body">
        <div class="ws-tier-section">
          <h4>Milestone</h4>
          <label>Milestone (streams)
            <input type="number" class="ws-tier-threshold" min="1" value="${tier.threshold}" />
          </label>
          <label>Alert text
            <input type="text" class="ws-tier-text" value="${escapeHtmlWs(tier.textTemplate || '')}" />
          </label>
          <label>Chat reply (optional)
            <input type="text" class="ws-tier-chat" value="${escapeHtmlWs(tier.chatMessage || '')}" />
          </label>
        </div>
        <div class="ws-tier-section">
          <h4>Custom media</h4>
          <p class="raid-muted ws-tier-hint">Image, GIF, WebM, or MP4 — served from the local overlay server. Leave empty to use the built-in escalating card.</p>
          <div class="ws-tier-media-row">
            <label>Media file
              <input type="text" class="ws-tier-media-path" value="${escapeHtmlWs(tier.mediaFile || '')}" placeholder="media/watch-streak-tier_50/…" readonly />
            </label>
            <button type="button" class="preference-button ws-tier-browse-media">Browse…</button>
            <button type="button" class="preference-button ws-tier-clear-media">Clear</button>
            <input type="file" class="ws-tier-media-file hidden" accept="image/*,video/webm,video/mp4,.gif,.webm,.mp4" />
          </div>
          <span class="ws-tier-media-preview-wrap">
            <img class="ws-tier-media-preview hidden" alt="Media preview" />
          </span>
          <label>Layout
            <select class="ws-tier-media-layout">${layoutOptionsHtml(tier.mediaLayout || 'above')}</select>
          </label>
        </div>
        <div class="ws-tier-section">
          <h4>Look &amp; motion</h4>
          <div class="watch-streak-colors-row">
            <label><span>Text</span> <input type="color" class="ws-tier-text-color" value="${tier.textColor || '#ffffff'}" title="Text color" /></label>
            <label><span>Accent</span> <input type="color" class="ws-tier-accent" value="${tier.accentColor || '#ffd54f'}" title="Accent color" /></label>
            <label><span>Card</span> <input type="color" class="ws-tier-bg" value="${tierBackgroundColorToInput(tier.backgroundColor)}" title="Card tint" /></label>
          </div>
          <label>Built-in effect (when card visible)
            <select class="ws-tier-effect">
              ${['glow', 'pulse', 'shine', 'flare', 'burst', 'epic', 'confetti']
                .map((e) => `<option value="${e}" ${tier.effect === e ? 'selected' : ''}>${e}</option>`)
                .join('')}
            </select>
          </label>
          <div class="ws-tier-anim-grid">
            <label>Enter animation <select class="ws-tier-enter">${animOptionsHtml(tier.enterAnimation || 'fade')}</select></label>
            <label>Exit animation <select class="ws-tier-exit">${animOptionsHtml(tier.exitAnimation || 'fade')}</select></label>
            <label>Display duration (ms)
              <input type="number" class="ws-tier-alert-duration" min="0" step="500" value="${tier.alertDurationMs || 0}" placeholder="0 = tier default" />
            </label>
          </div>
        </div>
        <div class="ws-tier-section">
          <h4>Sound</h4>
          <div class="ws-tier-sound-row">
            <label>Sound file
              <input type="text" class="ws-tier-sound" value="${escapeHtmlWs(tier.soundFile || '')}" placeholder="sounds/my-streak.mp3" />
            </label>
            <button type="button" class="preference-button ws-tier-browse-sound">Browse…</button>
            <input type="file" class="ws-tier-sound-file hidden" accept="audio/*" />
          </div>
          <label class="ws-tier-volume-label">Volume
            <input type="range" class="ws-tier-volume" min="0" max="100" value="${tier.soundVolume != null ? tier.soundVolume : 80}" />
            <span class="ws-tier-volume-val">${tier.soundVolume != null ? tier.soundVolume : 80}%</span>
          </label>
        </div>
        <div class="ws-tier-actions">
          <button type="button" class="preference-button ws-tier-test-detail" data-threshold="${tier.threshold}">Test this tier</button>
          <button type="button" class="preference-button ws-tier-remove">Remove tier</button>
        </div>
      </div>
    `;
    host.appendChild(row);
  });
  hydrateWatchStreakPreviews();
}

async function hydrateWatchStreakPreviews() {
  const tiers = watchStreakUiConfig?.tiers || [];
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const row = document.querySelector(`.watch-streak-tier-row[data-index="${i}"]`);
    if (!row) continue;
    const thumb = row.querySelector('.ws-tier-thumb[data-thumb-index]');
    const preview = row.querySelector('.ws-tier-media-preview');
    if (tier.mediaFile && thumb) {
      thumb.src = await watchStreakMediaUrl(tier.mediaFile);
    }
    if (tier.mediaFile && preview) {
      preview.src = await watchStreakMediaUrl(tier.mediaFile);
      preview.classList.remove('hidden');
    }
  }
  const simple = watchStreakUiConfig?.simpleTier || {};
  const simplePrev = document.getElementById('watch-streak-simple-media-preview');
  if (simplePrev && simple.mediaFile) {
    simplePrev.src = await watchStreakMediaUrl(simple.mediaFile);
    simplePrev.classList.remove('hidden');
  }
}

function collectTierFromRow(row, baseTier = {}) {
  const threshold = parseInt(row.querySelector('.ws-tier-threshold')?.value, 10) || baseTier.threshold || 3;
  const mediaFile = row.querySelector('.ws-tier-media-path')?.value || baseTier.mediaFile || '';
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
    mediaFile,
    mediaType: baseTier.mediaType || '',
    mediaLayout: row.querySelector('.ws-tier-media-layout')?.value || 'above',
    enterAnimation: row.querySelector('.ws-tier-enter')?.value || 'fade',
    exitAnimation: row.querySelector('.ws-tier-exit')?.value || 'fade',
    alertDurationMs: parseInt(row.querySelector('.ws-tier-alert-duration')?.value, 10) || 0,
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
    mediaFile: document.getElementById('watch-streak-simple-media-path')?.value || simple.mediaFile || '',
    mediaLayout: document.getElementById('watch-streak-simple-media-layout')?.value || simple.mediaLayout || 'above',
    enterAnimation: document.getElementById('watch-streak-simple-enter')?.value || simple.enterAnimation || 'fade',
    exitAnimation: document.getElementById('watch-streak-simple-exit')?.value || simple.exitAnimation || 'fade',
    alertDurationMs: parseInt(document.getElementById('watch-streak-simple-duration')?.value, 10) || 0,
    mediaType: simple.mediaType || '',
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
  const sp = document.getElementById('watch-streak-simple-media-path');
  if (sp) sp.value = simple.mediaFile || '';
  const sl = document.getElementById('watch-streak-simple-media-layout');
  if (sl) sl.value = simple.mediaLayout || 'above';
  const se = document.getElementById('watch-streak-simple-enter');
  if (se) se.value = simple.enterAnimation || 'fade';
  const sx = document.getElementById('watch-streak-simple-exit');
  if (sx) sx.value = simple.exitAnimation || 'fade';
  const sd = document.getElementById('watch-streak-simple-duration');
  if (sd) sd.value = simple.alertDurationMs || 0;

  const urlEl = document.getElementById('watch-streak-overlay-url');
  if (urlEl) urlEl.textContent = await watchStreakOverlayUrl();

  if (watchStreakExpandedIndex < 0 && watchStreakUiConfig.tiers?.length) {
    watchStreakExpandedIndex = -1;
  }
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
    renderWatchStreakTiers();
    await refreshWatchStreakScopeWarning();
  } else if (typeof showCustomAlert === 'function') {
    showCustomAlert(res?.error || 'Failed to save', 'error');
  }
}

async function saveWatchStreakAsset(file, tierId, mediaType) {
  if (!file || !window.electronAPI?.saveMediaFileByPath) return null;
  const sourcePath = file.path;
  if (!sourcePath) return null;
  const buttonId = `watch-streak-${tierId || 'tier'}`;
  const res = await window.electronAPI.saveMediaFileByPath({
    sourcePath,
    buttonId,
    mediaType,
    originalName: file.name,
  });
  if (res?.success && res.filePath) {
    return String(res.filePath).replace(/\\/g, '/');
  }
  return null;
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
    watchStreakExpandedIndex = watchStreakUiConfig.tiers.length - 1;
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

  const runTierTest = async (threshold) => {
    await window.electronAPI.testWatchStreakTier({ threshold });
  };

  document.getElementById('watch-streak-tiers-list')?.addEventListener('click', async (e) => {
    const expandBtn = e.target.closest('.ws-tier-expand');
    if (expandBtn) {
      const row = expandBtn.closest('.watch-streak-tier-row');
      const idx = parseInt(row?.dataset.index, 10);
      if (Number.isFinite(idx)) {
        watchStreakExpandedIndex = watchStreakExpandedIndex === idx ? -1 : idx;
        renderWatchStreakTiers();
      }
      return;
    }
    const browseMedia = e.target.closest('.ws-tier-browse-media');
    if (browseMedia) {
      browseMedia.closest('.watch-streak-tier-row')?.querySelector('.ws-tier-media-file')?.click();
      return;
    }
    const browse = e.target.closest('.ws-tier-browse-sound');
    if (browse) {
      browse.closest('.watch-streak-tier-row')?.querySelector('.ws-tier-sound-file')?.click();
      return;
    }
    const clearMedia = e.target.closest('.ws-tier-clear-media');
    if (clearMedia) {
      const row = clearMedia.closest('.watch-streak-tier-row');
      const pathIn = row?.querySelector('.ws-tier-media-path');
      const idx = parseInt(row?.dataset.index, 10);
      if (pathIn) pathIn.value = '';
      if (Number.isFinite(idx) && watchStreakUiConfig?.tiers?.[idx]) {
        watchStreakUiConfig.tiers[idx].mediaFile = '';
        watchStreakUiConfig.tiers[idx].mediaType = '';
      }
      renderWatchStreakTiers();
      return;
    }
    const testBtn = e.target.closest('.ws-tier-test, .ws-tier-test-detail');
    if (testBtn) {
      const threshold = parseInt(testBtn.dataset.threshold, 10) || 10;
      await runTierTest(threshold);
      return;
    }
    const removeBtn = e.target.closest('.ws-tier-remove');
    if (removeBtn) {
      const row = removeBtn.closest('.watch-streak-tier-row');
      const idx = parseInt(row?.dataset.index, 10);
      if (Number.isFinite(idx)) {
        watchStreakUiConfig.tiers.splice(idx, 1);
        watchStreakExpandedIndex = -1;
        renderWatchStreakTiers();
      }
    }
  });

  document.getElementById('watch-streak-simple-test')?.addEventListener('click', async () => {
    await runTierTest(12);
  });

  document.getElementById('watch-streak-simple-browse-media')?.addEventListener('click', () => {
    document.getElementById('watch-streak-simple-media-file')?.click();
  });

  document.getElementById('watch-streak-simple-clear-media')?.addEventListener('click', () => {
    const pathIn = document.getElementById('watch-streak-simple-media-path');
    if (pathIn) pathIn.value = '';
    if (watchStreakUiConfig?.simpleTier) {
      watchStreakUiConfig.simpleTier.mediaFile = '';
      watchStreakUiConfig.simpleTier.mediaType = '';
    }
    const prev = document.getElementById('watch-streak-simple-media-preview');
    if (prev) {
      prev.src = '';
      prev.classList.add('hidden');
    }
  });

  document.getElementById('watch-streak-simple-browse-sound')?.addEventListener('click', () => {
    document.getElementById('watch-streak-simple-sound-file')?.click();
  });

  document.getElementById('watch-streak-tiers-list')?.addEventListener('change', async (e) => {
    const mediaInput = e.target.closest('.ws-tier-media-file');
    if (mediaInput?.files?.[0]) {
      const row = mediaInput.closest('.watch-streak-tier-row');
      const idx = parseInt(row?.dataset.index, 10);
      const base = watchStreakUiConfig.tiers?.[idx] || {};
      const file = mediaInput.files[0];
      const type = /\.(webm|mp4|mov)$/i.test(file.name) ? 'video' : 'image';
      const rel = await saveWatchStreakAsset(file, base.id || `tier_${base.threshold}`, type);
      if (rel) {
        const pathIn = row.querySelector('.ws-tier-media-path');
        if (pathIn) pathIn.value = rel;
        watchStreakUiConfig.tiers[idx] = { ...base, mediaFile: rel, mediaType: type === 'video' ? 'video' : /\.gif$/i.test(file.name) ? 'gif' : 'image' };
        await hydrateWatchStreakPreviews();
      }
      mediaInput.value = '';
      return;
    }
    const fileInput = e.target.closest('.ws-tier-sound-file');
    if (!fileInput?.files?.[0]) return;
    const row = fileInput.closest('.watch-streak-tier-row');
    const idx = parseInt(row?.dataset.index, 10);
    const base = watchStreakUiConfig.tiers?.[idx] || {};
    const text = row?.querySelector('.ws-tier-sound');
    const rel = await saveWatchStreakAsset(fileInput.files[0], `${base.id || base.threshold}-sound`, 'audio');
    if (rel && text) {
      text.value = rel;
      watchStreakUiConfig.tiers[idx] = { ...base, soundFile: rel };
    }
    fileInput.value = '';
  });

  document.getElementById('watch-streak-simple-media-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = /\.(webm|mp4|mov)$/i.test(file.name) ? 'video' : 'image';
    const rel = await saveWatchStreakAsset(file, 'simple_unified', type);
    if (rel) {
      document.getElementById('watch-streak-simple-media-path').value = rel;
      watchStreakUiConfig.simpleTier = {
        ...(watchStreakUiConfig.simpleTier || {}),
        mediaFile: rel,
        mediaType: type === 'video' ? 'video' : /\.gif$/i.test(file.name) ? 'gif' : 'image',
      };
      await hydrateWatchStreakPreviews();
    }
    e.target.value = '';
  });

  document.getElementById('watch-streak-simple-sound-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rel = await saveWatchStreakAsset(file, 'simple_unified-sound', 'audio');
    if (rel) {
      document.getElementById('watch-streak-simple-sound').value = rel;
    }
    e.target.value = '';
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
window.renderWatchStreakTiers = renderWatchStreakTiers;
window.loadWatchStreakSettingsUi = loadWatchStreakSettingsUi;
window.hydrateWatchStreakPreviews = hydrateWatchStreakPreviews;
window.watchStreakSetExpandedIndex = (index) => {
  watchStreakExpandedIndex = Number.isFinite(index) ? index : -1;
  renderWatchStreakTiers();
};