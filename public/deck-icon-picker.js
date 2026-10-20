/**
 * Searchable icon picker modal for deck buttons.
 */
(function (global) {
  let modal = null;
  let onPick = null;
  let iconUrlCache = {};

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'deck-icon-picker-modal';
    modal.className = 'hidden';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 520px; max-height: 80vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h2 style="margin:0;font-size:16px;">Choose icon</h2>
          <button type="button" class="modal-close" id="deck-icon-picker-close">✕</button>
        </div>
        <input type="search" id="deck-icon-picker-search" placeholder="Search icons (e.g. twitch, mic, obs)…" style="margin: 8px 0; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);" />
        <div id="deck-icon-picker-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; overflow-y: auto; flex: 1; padding: 4px;"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#deck-icon-picker-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    modal.querySelector('#deck-icon-picker-search').addEventListener('input', (e) => {
      renderGrid(e.target.value).catch((err) => console.warn('[icon picker]', err));
    });
    return modal;
  }

  async function renderGrid(query) {
    const grid = modal.querySelector('#deck-icon-picker-grid');
    const cat = global.vdDeckIconCatalog;
    if (!cat) return;
    const icons = await cat.searchIcons(query);
    grid.innerHTML = '';
    for (const meta of icons) {
      if (!iconUrlCache[meta.id]) {
        iconUrlCache[meta.id] = await cat.iconDataUrl(meta.id);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = meta.name;
      btn.style.cssText =
        'display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;color:var(--text-primary);font-size:10px;';
      const img = document.createElement('img');
      img.src = iconUrlCache[meta.id];
      img.alt = meta.name;
      img.width = 32;
      img.height = 32;
      btn.appendChild(img);
      btn.appendChild(document.createTextNode(meta.name));
      btn.addEventListener('click', () => {
        if (onPick) onPick({ source: 'library', id: meta.id });
        close();
      });
      grid.appendChild(btn);
    }
  }

  function open(pickCallback) {
    onPick = pickCallback;
    ensureModal();
    modal.classList.remove('hidden');
    const search = modal.querySelector('#deck-icon-picker-search');
    if (search) search.value = '';
    renderGrid('').catch((err) => console.warn('[icon picker]', err));
  }

  function close() {
    if (modal) modal.classList.add('hidden');
    onPick = null;
  }

  global.vdDeckIconPicker = { open, close };
})(window);
