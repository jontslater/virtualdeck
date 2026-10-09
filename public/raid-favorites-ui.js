// Raid Favorites UI (Twitch raid targets)

let raidFavoritesDragLogin = null;

function openRaidFavoritesModal() {
  const modal = document.getElementById('raid-favorites-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  refreshRaidFavoritesView();
}

function closeRaidFavoritesModal() {
  const modal = document.getElementById('raid-favorites-modal');
  if (modal) modal.classList.add('hidden');
}

async function refreshRaidFavoritesView() {
  await Promise.all([loadRaidFavoritesList(), loadRaidHistoryList(), refreshRaidLivePanel()]);
}

async function loadRaidFavoritesList() {
  const listEl = document.getElementById('raid-favorites-list');
  if (!listEl || !window.electronAPI?.raidFavoritesGet) return;
  const result = await window.electronAPI.raidFavoritesGet();
  if (!result.success) {
    listEl.innerHTML = `<p class="raid-error">${escapeHtml(result.error || 'Failed to load')}</p>`;
    return;
  }
  const favorites = result.favorites || [];
  if (favorites.length === 0) {
    listEl.innerHTML = '<p class="raid-muted">No favorites yet. Add channels you like to raid.</p>';
    return;
  }
  listEl.innerHTML = '';
  favorites.forEach((fav, index) => {
    const row = document.createElement('div');
    row.className = 'raid-fav-row';
    row.draggable = true;
    row.dataset.login = fav.login;
    row.innerHTML = `
      <span class="raid-drag-handle" title="Drag to reorder">⋮⋮</span>
      <div class="raid-fav-main">
        <strong>${escapeHtml(fav.login)}</strong>
        <input type="text" class="raid-note-input" data-login="${escapeHtml(fav.login)}" value="${escapeHtml(fav.note || '')}" placeholder="Optional note" />
      </div>
      <button type="button" class="raid-remove-btn" data-login="${escapeHtml(fav.login)}">Remove</button>
    `;
    row.addEventListener('dragstart', () => { raidFavoritesDragLogin = fav.login; });
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!raidFavoritesDragLogin || raidFavoritesDragLogin === fav.login) return;
      const order = favorites.map((x) => x.login);
      const from = order.indexOf(raidFavoritesDragLogin);
      const to = index;
      if (from < 0) return;
      order.splice(from, 1);
      order.splice(to, 0, raidFavoritesDragLogin);
      await window.electronAPI.raidFavoritesReorder({ orderedLogins: order });
      raidFavoritesDragLogin = null;
      loadRaidFavoritesList();
    });
    listEl.appendChild(row);
  });

  listEl.querySelectorAll('.raid-remove-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const login = btn.getAttribute('data-login');
      await window.electronAPI.raidFavoritesRemove({ login });
      refreshRaidFavoritesView();
    });
  });

  listEl.querySelectorAll('.raid-note-input').forEach((input) => {
    input.addEventListener('change', async () => {
      const login = input.getAttribute('data-login');
      await window.electronAPI.raidFavoritesUpdateNote({ login, note: input.value });
    });
  });
}

async function loadRaidHistoryList() {
  const listEl = document.getElementById('raid-history-list');
  if (!listEl || !window.electronAPI?.raidFavoritesGet) return;
  const result = await window.electronAPI.raidFavoritesGet();
  if (!result.success) return;
  const history = result.history || [];
  if (history.length === 0) {
    listEl.innerHTML = '<p class="raid-muted">Raids you start will appear here.</p>';
    return;
  }
  listEl.innerHTML = '';
  history.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'raid-history-row';
    const when = item.raidedAt ? new Date(item.raidedAt).toLocaleString() : '';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.login)}</strong>
        <span class="raid-muted">${escapeHtml(when)}</span>
      </div>
      <button type="button" class="raid-add-fav-btn" data-login="${escapeHtml(item.login)}">Add to favorites</button>
    `;
    row.querySelector('.raid-add-fav-btn').addEventListener('click', async () => {
      const res = await window.electronAPI.raidFavoritesAddFromHistory({ login: item.login });
      if (!res.success) {
        showCustomAlert(res.error || 'Could not add favorite', 'error');
      } else {
        showCustomAlert(`Added ${item.login} to favorites`, 'success');
        refreshRaidFavoritesView();
      }
    });
    listEl.appendChild(row);
  });
}

async function refreshRaidLivePanel() {
  const panel = document.getElementById('raid-live-panel');
  const scopeBanner = document.getElementById('raid-scope-banner');
  if (!panel || !window.electronAPI?.raidFavoritesLiveCheck) return;

  panel.innerHTML = '<p class="raid-muted">Checking live status…</p>';
  const result = await window.electronAPI.raidFavoritesLiveCheck({ forceRefresh: false });
  if (!result.success) {
    panel.innerHTML = `<p class="raid-error">${escapeHtml(result.error || 'Live check failed')}</p>`;
    return;
  }

  if (scopeBanner) {
    if (result.hasRaidScope) {
      scopeBanner.classList.add('hidden');
      scopeBanner.textContent = '';
    } else {
      scopeBanner.classList.remove('hidden');
      scopeBanner.innerHTML = `Reconnect Twitch to enable raids (needs <code>channel:manage:raids</code>). 
        <button type="button" id="raid-reconnect-twitch-btn" class="raid-link-btn">Reconnect Twitch</button>`;
      const reconnectBtn = document.getElementById('raid-reconnect-twitch-btn');
      if (reconnectBtn) {
        reconnectBtn.addEventListener('click', openTwitchReconnectForRaids);
      }
    }
  }

  const favorites = result.favorites || [];
  if (favorites.length === 0) {
    panel.innerHTML = '<p class="raid-muted">Add favorites to see who is live.</p>';
    return;
  }

  panel.innerHTML = '';
  favorites.forEach((ch) => {
    const card = document.createElement('div');
    card.className = `raid-live-card ${ch.live ? 'is-live' : 'is-offline'}`;
    const img = ch.profileImageUrl
      ? `<img class="raid-avatar" src="${escapeHtml(ch.profileImageUrl)}" alt="" />`
      : '<div class="raid-avatar raid-avatar-placeholder"></div>';
    const liveMeta = ch.live
      ? `<div class="raid-live-meta">${escapeHtml(ch.title || '')}<br><span class="raid-muted">${escapeHtml(ch.gameName || '')} · ${ch.viewerCount || 0} viewers</span></div>`
      : '<div class="raid-live-meta raid-muted">Offline</div>';
    card.innerHTML = `
      ${img}
      <div class="raid-live-body">
        <strong>${escapeHtml(ch.login)}</strong>
        ${liveMeta}
      </div>
      <div class="raid-live-actions">
        ${ch.live ? `<button type="button" class="raid-start-btn" data-login="${escapeHtml(ch.login)}">Raid</button>` : ''}
      </div>
    `;
    const raidBtn = card.querySelector('.raid-start-btn');
    if (raidBtn) {
      raidBtn.addEventListener('click', () => confirmAndStartRaid(ch.login));
    }
    panel.appendChild(card);
  });

  const cached = result.cached ? ' (cached)' : '';
  const foot = document.createElement('p');
  foot.className = 'raid-muted raid-live-foot';
  foot.textContent = `Updated ${result.checkedAt || ''}${cached}`;
  panel.appendChild(foot);
}

async function openTwitchReconnectForRaids() {
  if (!window.electronAPI?.getTwitchOAuthAuthorizeUrl) {
    showCustomAlert('Configure twitch-oauth-config.js or use twitchtokengenerator.com with channel:manage:raids scope.', 'info');
    return;
  }
  const res = await window.electronAPI.getTwitchOAuthAuthorizeUrl();
  if (res.success && res.authorizeUrl) {
    window.open(res.authorizeUrl, '_blank');
  } else {
    showCustomAlert('OAuth app not configured. Regenerate your token with the channel:manage:raids scope.', 'info');
  }
}

async function confirmAndStartRaid(login) {
  const ok = confirm(`Start a raid to ${login}? This will redirect your viewers on Twitch.`);
  if (!ok) return;
  const result = await window.electronAPI.raidFavoritesStartRaid({ login });
  if (!result.success) {
    if (result.needsReconnect) {
      showCustomAlert(result.error || 'Reconnect Twitch to enable raids', 'error');
      openTwitchReconnectForRaids();
    } else {
      showCustomAlert(result.error || 'Raid failed', 'error');
    }
    return;
  }
  showCustomAlert(`Raid started to ${login}`, 'success');
  refreshRaidFavoritesView();
}

function initRaidFavoritesUI() {
  const openBtn = document.getElementById('menu-tools-raid-favorites');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRaidFavoritesModal();
    });
  }

  const closeBtn = document.getElementById('raid-favorites-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeRaidFavoritesModal);

  const addBtn = document.getElementById('raid-favorites-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const loginInput = document.getElementById('raid-favorites-add-login');
      const noteInput = document.getElementById('raid-favorites-add-note');
      const login = loginInput?.value?.trim();
      const note = noteInput?.value?.trim() || '';
      if (!login) {
        showCustomAlert('Enter a Twitch channel name', 'error');
        return;
      }
      const res = await window.electronAPI.raidFavoritesAdd({ login, note });
      if (!res.success) {
        showCustomAlert(res.error || 'Could not add favorite', 'error');
        return;
      }
      if (loginInput) loginInput.value = '';
      if (noteInput) noteInput.value = '';
      refreshRaidFavoritesView();
    });
  }

  const refreshBtn = document.getElementById('raid-live-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await window.electronAPI.raidFavoritesLiveCheck({ forceRefresh: true });
      refreshRaidLivePanel();
    });
  }

  const cancelBtn = document.getElementById('raid-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      const res = await window.electronAPI.raidFavoritesCancelRaid();
      if (!res.success) {
        showCustomAlert(res.error || 'Could not cancel raid', 'error');
      } else {
        showCustomAlert('Raid cancelled', 'success');
      }
    });
  }

  if (window.electronAPI?.onRaidFavoritesHistoryUpdated) {
    window.electronAPI.onRaidFavoritesHistoryUpdated(() => {
      loadRaidHistoryList();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    initRaidFavoritesUI();
  } catch (err) {
    console.error('Raid favorites UI init failed:', err);
  }
});
