// public/macro-scene-picker.js
// Scene dropdown for "Change Scene" macro steps. Loads the live scene list from the connected
// streaming app (Meld Studio / OBS / Streamlabs) via window.electronAPI.listStreamingScenes and
// falls back to manual text entry when nothing is connected. Saved value stays
// step.arguments.sceneName (string); step.arguments.app is optional ('meld' | 'obs' | 'streamlabs').
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDMacroScenePicker = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const SOURCES = [
    { value: '', label: 'Auto-detect' },
    { value: 'meld', label: 'Meld Studio' },
    { value: 'obs', label: 'OBS Studio' },
    { value: 'streamlabs', label: 'Streamlabs Desktop' },
  ];
  const MANUAL = '__manual__';
  const cache = {}; // source -> last list result

  /** Options for the scene <select>: live scenes plus the saved value if it is not in the list. */
  function buildSceneOptions(list, savedName) {
    const opts = [];
    const scenes = (list && list.success && Array.isArray(list.scenes)) ? list.scenes : [];
    const saved = String(savedName || '');
    opts.push({ value: '', label: '\u2014 choose a scene \u2014', selected: !saved });
    let found = false;
    scenes.forEach((s) => {
      const match = !!saved && (s.name === saved || s.id === saved);
      if (match) found = true;
      opts.push({ value: s.name, label: s.name, selected: match });
    });
    if (saved && !found) {
      opts.push({ value: saved, label: `${saved} (not in ${list && list.appLabel ? list.appLabel : 'current'} list)`, selected: true, missing: true });
    }
    opts.push({ value: MANUAL, label: 'Type a name\u2026', selected: false });
    return opts;
  }

  function describeStatus(list) {
    if (!list) return { text: 'Loading scenes\u2026', kind: '' };
    if (list.success) {
      const n = list.scenes.length;
      const others = (list.connected || []).filter((a) => a !== list.app);
      return { text: `Loaded ${n} scene${n === 1 ? '' : 's'} from ${list.appLabel}` + (others.length ? ` (also connected: ${others.join(', ')})` : ''), kind: 'ok' };
    }
    return { text: `${list.error || 'No streaming app connected'} \u2014 type the scene name below.`, kind: 'error' };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /**
   * Build the picker for a change_scene step. opts.listScenes(app) -> Promise<list result>;
   * defaults to window.electronAPI.listStreamingScenes.
   */
  function createScenePicker(step, opts = {}) {
    if (!step.arguments) step.arguments = {};
    const api = (typeof window !== 'undefined' && window.electronAPI) || {};
    const listScenes = opts.listScenes || (api.listStreamingScenes ? (app) => api.listStreamingScenes({ app }) : null);

    const wrap = el('div', 'step-args scene-picker');
    const row = el('div', 'scene-picker-row');
    const sourceSel = el('select', 'scene-source-select');
    sourceSel.title = 'Streaming app to load scenes from (and to switch at run time)';
    SOURCES.forEach((s) => {
      const o = el('option', null, s.label); o.value = s.value;
      if ((step.arguments.app || '') === s.value) o.selected = true;
      sourceSel.appendChild(o);
    });
    const sceneSel = el('select', 'scene-name-select');
    const refreshBtn = el('button', 'step-btn scene-refresh-btn', '\u21bb');
    refreshBtn.type = 'button';
    refreshBtn.title = 'Reload scenes from the streaming app';
    row.appendChild(sourceSel); row.appendChild(sceneSel); row.appendChild(refreshBtn);
    const status = el('div', 'scene-picker-status');
    const manualGroup = el('div', 'step-arg-group scene-manual');
    manualGroup.appendChild(el('label', null, 'sceneName:'));
    const manual = el('input', 'step-arg-input scene-manual-input');
    manual.type = 'text';
    manual.placeholder = 'Scene name (exactly as in your streaming app)';
    manual.value = step.arguments.sceneName || '';
    manualGroup.appendChild(manual);
    wrap.appendChild(row); wrap.appendChild(status); wrap.appendChild(manualGroup);

    if (api.getObsSceneConfig && api.setObsSceneConfig) {
      const det = el('details', 'scene-obs-config');
      det.appendChild(el('summary', null, 'OBS WebSocket connection'));
      const url = el('input', 'step-arg-input obs-url-input'); url.type = 'text'; url.placeholder = 'ws://127.0.0.1:4455';
      const pw = el('input', 'step-arg-input obs-password-input'); pw.type = 'password'; pw.placeholder = 'Password (OBS > Tools > WebSocket Server Settings)';
      const save = el('button', 'step-btn obs-save-btn', 'Save'); save.type = 'button';
      const note = el('div', 'scene-picker-status');
      det.appendChild(url); det.appendChild(pw); det.appendChild(save); det.appendChild(note);
      api.getObsSceneConfig().then((c) => {
        url.value = (c && c.url) || '';
        if (c && c.hasPassword) pw.placeholder = 'Password saved (leave blank to keep)';
      }).catch(() => {});
      save.addEventListener('click', async () => {
        const payload = { url: url.value.trim() };
        if (pw.value) payload.password = pw.value;
        const r = await api.setObsSceneConfig(payload).catch((e) => ({ success: false, error: e.message }));
        note.textContent = r && r.success ? 'Saved' + (r.note ? ' (' + r.note + ')' : '') : 'Error: ' + ((r && r.error) || 'save failed');
        note.className = 'scene-picker-status ' + (r && r.success ? 'ok' : 'error');
        pw.value = '';
        if (r && r.success) { clearSceneCache(); load(true); }
      });
      wrap.appendChild(det);
    }

    let lastList = null;
    let manualMode = false;
    const setManual = (on) => { manualGroup.style.display = on ? '' : 'none'; };
    const render = (list) => {
      lastList = list;
      const st = describeStatus(list);
      status.textContent = st.text;
      status.className = 'scene-picker-status' + (st.kind ? ' ' + st.kind : '');
      sceneSel.innerHTML = '';
      const live = !!(list && list.success);
      sceneSel.disabled = !live;
      buildSceneOptions(list, step.arguments.sceneName).forEach((o) => {
        const opt = el('option', o.missing ? 'missing' : null, o.label);
        opt.value = o.value; opt.selected = !!o.selected;
        sceneSel.appendChild(opt);
      });
      setManual(!live || manualMode);
      if (!live) manual.value = step.arguments.sceneName || '';
    };
    const load = async (force) => {
      const key = sourceSel.value || 'auto';
      if (!listScenes) { render({ success: false, error: 'Scene list not available in this window' }); return; }
      if (!force && cache[key]) { render(cache[key]); return; }
      render(null);
      refreshBtn.disabled = true;
      let res;
      try { res = await listScenes(sourceSel.value || undefined); } catch (err) { res = { success: false, error: err && err.message ? err.message : String(err) }; }
      if (!res || typeof res !== 'object') res = { success: false, error: 'No response from scene provider' };
      if (!Array.isArray(res.scenes)) res.scenes = [];
      cache[key] = res;
      refreshBtn.disabled = false;
      render(res);
    };

    sceneSel.addEventListener('change', () => {
      if (sceneSel.value === MANUAL) { manualMode = true; setManual(true); manual.focus(); return; }
      manualMode = false;
      setManual(false);
      step.arguments.sceneName = sceneSel.value;
    });
    manual.addEventListener('input', () => { step.arguments.sceneName = manual.value; });
    sourceSel.addEventListener('change', () => {
      if (sourceSel.value) step.arguments.app = sourceSel.value; else delete step.arguments.app;
      load(false);
    });
    refreshBtn.addEventListener('click', () => load(true));

    wrap._load = load;
    wrap._ready = load(false);
    wrap._getList = () => lastList;
    return wrap;
  }

  function clearSceneCache() { Object.keys(cache).forEach((k) => delete cache[k]); }

  return { createScenePicker, buildSceneOptions, describeStatus, clearSceneCache, SOURCES, MANUAL };
});
