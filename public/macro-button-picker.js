// public/macro-button-picker.js — searchable deck button picker for trigger_button macro steps.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDMacroButtonPicker = api;
})(typeof window !== 'undefined' ? window : null, function () {
  let catalogCache = null;
  let catalogLoadError = null;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  async function loadCatalog(force) {
    if (catalogCache && !force) return catalogCache;
    catalogLoadError = null;
    if (!window.electronAPI || !window.electronAPI.listMacroDeckButtons) {
      catalogLoadError = 'Deck button list is not available';
      catalogCache = [];
      return catalogCache;
    }
    try {
      const payload = await window.electronAPI.listMacroDeckButtons();
      catalogCache = Array.isArray(payload) ? payload : (payload && payload.buttons) || [];
      if (payload && payload.error) catalogLoadError = payload.error;
    } catch (err) {
      catalogLoadError = (err && err.message) || String(err);
      catalogCache = [];
    }
    return catalogCache;
  }

  function populateSelect(select, catalog, selectedId, filterText) {
    const q = String(filterText || '').trim().toLowerCase();
    const list = !q
      ? catalog
      : catalog.filter(
          (e) =>
            e.displayLabel.toLowerCase().includes(q) ||
            e.label.toLowerCase().includes(q) ||
            e.profileName.toLowerCase().includes(q),
        );

    select.innerHTML = '';
    const blank = el('option', null, '— Select a deck button —');
    blank.value = '';
    select.appendChild(blank);

    list.forEach((entry) => {
      const opt = el('option', null, entry.displayLabel || entry.label);
      opt.value = entry.buttonId;
      opt.dataset.label = entry.label;
      opt.dataset.profileName = entry.profileName;
      if (selectedId && entry.buttonId === selectedId) opt.selected = true;
      select.appendChild(opt);
    });

    if (selectedId && !list.some((e) => e.buttonId === selectedId)) {
      const missing = el(
        'option',
        null,
        `${(catalog.find((c) => c.buttonId === selectedId) || {}).label || 'Deleted button'} (missing)`,
      );
      missing.value = selectedId;
      missing.selected = true;
      missing.dataset.missing = '1';
      select.insertBefore(missing, select.firstChild.nextSibling);
    }
  }

  function applySelection(step, select, catalog) {
    if (!step.arguments) step.arguments = {};
    const value = select.value;
    if (!value) {
      delete step.arguments.buttonId;
      delete step.arguments.label;
      return;
    }
    const hit = (catalog || []).find((c) => c.buttonId === value);
    step.arguments.buttonId = value;
    step.arguments.label = hit ? hit.label : select.selectedOptions?.[0]?.dataset?.label || '';
  }

  function formatSelectedSummary(step, catalog) {
    const id = step.arguments && step.arguments.buttonId;
    if (!id) return 'No button selected';
    const hit = (catalog || []).find((c) => c.buttonId === id);
    if (hit) return `Selected: ${hit.displayLabel || hit.label} (id ${id})`;
    const label = step.arguments.label || 'Unknown';
    return `Selected: ${label} (id ${id})`;
  }

  function updateSelectionUi(step, select, catalog, summaryEl) {
    applySelection(step, select, catalog);
    if (summaryEl) summaryEl.textContent = formatSelectedSummary(step, catalog);
  }

  /**
   * Build UI for a trigger_button macro step.
   */
  function createButtonPicker(step) {
    if (!step.arguments) step.arguments = {};

    const wrap = el('div', 'step-args button-picker');
    const search = el('input', 'step-arg-input button-picker-search');
    search.type = 'search';
    search.placeholder = 'Search deck buttons…';
    search.autocomplete = 'off';

    const select = el('select', 'button-picker-select');
    select.size = 6;

    const selectedSummary = el('div', 'button-picker-selected scene-picker-status ok');
    selectedSummary.style.marginTop = '6px';

    const status = el('div', 'scene-picker-status');
    const warn = el('div', 'scene-picker-status');
    warn.style.color = 'var(--warning, #ff9800)';

    wrap.appendChild(el('label', null, 'Deck button:'));
    wrap.appendChild(search);
    wrap.appendChild(select);
    wrap.appendChild(selectedSummary);

    const refreshBtn = el('button', 'step-btn scene-refresh-btn', '↻');
    refreshBtn.type = 'button';
    refreshBtn.title = 'Reload deck buttons';
    wrap.appendChild(refreshBtn);
    wrap.appendChild(status);
    wrap.appendChild(warn);

    function showWarning(msg) {
      warn.textContent = msg || '';
      warn.classList.toggle('ok', false);
    }

    function syncWarnings(catalog) {
      const selectedId = step.arguments.buttonId || '';
      const hit = selectedId ? catalog.find((c) => c.buttonId === selectedId) : null;
      if (selectedId && !hit) {
        showWarning(
          `This button was deleted or moved. Pick another button (saved id: ${selectedId}${step.arguments.label ? `, was "${step.arguments.label}"` : ''}).`,
        );
      } else if (!selectedId && step.arguments.label) {
        showWarning(
          'This step uses an older name-only reference. Choose a button to save a stable id.',
        );
      } else {
        showWarning('');
      }
      selectedSummary.textContent = formatSelectedSummary(step, catalog);
    }

    async function refresh() {
      status.textContent = 'Loading deck buttons…';
      status.className = 'scene-picker-status';
      const catalog = await loadCatalog(true);
      if (catalogLoadError && !catalog.length) {
        status.textContent = catalogLoadError;
        status.className = 'scene-picker-status';
        showWarning('Save a label-only step or reconnect, then refresh.');
        return;
      }
      status.textContent = `${catalog.length} button${catalog.length === 1 ? '' : 's'} across all profiles`;
      status.className = 'scene-picker-status ok';

      const selectedId = step.arguments.buttonId || '';
      populateSelect(select, catalog, selectedId, search.value);
      syncWarnings(catalog);
    }

    function onPick(catalog) {
      updateSelectionUi(step, select, catalog, selectedSummary);
      syncWarnings(catalog);
    }

    search.addEventListener('input', () => {
      populateSelect(select, catalogCache || [], step.arguments.buttonId, search.value);
    });

    select.addEventListener('change', () => onPick(catalogCache || []));
    select.addEventListener('click', () => onPick(catalogCache || []));
    select.addEventListener('keyup', () => onPick(catalogCache || []));

    refreshBtn.addEventListener('click', () => refresh());

    refresh();

    return wrap;
  }

  function clearCatalogCache() {
    catalogCache = null;
  }

  return {
    loadCatalog,
    createButtonPicker,
    clearCatalogCache,
    applySelection,
    formatSelectedSummary,
  };
});
