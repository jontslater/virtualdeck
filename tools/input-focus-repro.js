// Repro harness: "form inputs stop accepting typing".
// Run ONLY with an isolated profile:
//   electron.exe --user-data-dir=<temp> tools/input-focus-repro.js <repoRoot> <outDir> <label> <mode>
// mode "dialogs": real (shown) window, native alert/confirm, measured with REAL OS keystrokes
//   delivered by tools/input-focus-helper.ps1 (keys only sent when this process owns the foreground window).
//   variant "native" = plain page (pre-fix behaviour); "fixed" = repo preload + dialog-shim + main handler.
// mode "modals": offscreen real public/index.html with an inert API stub (no IPC, all non-file requests
//   blocked); opens/closes every modal by every path, hotkey capture, in-app dialogs, then types.
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const fs = require('fs');
const path = require('path');

const argv = (() => {
  const i = process.argv.findIndex((a) => { try { return path.resolve(a) === path.resolve(__filename); } catch (e) { return false; } });
  return process.argv.slice(i >= 0 ? i + 1 : 2).filter((a) => !a.startsWith('--'));
})();
const repoRoot = path.resolve(argv[0] || path.join(__dirname, '..'));
const outDir = path.resolve(argv[1] || path.join(repoRoot, 'focus-repro'));
const label = argv[2] || 'run';
const mode = argv[3] || 'modals';
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, `log-${label}-${mode}.txt`);
fs.writeFileSync(logFile, '');
const log = (m) => { try { fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + what)), ms))]);
process.on('uncaughtException', (e) => { log('FATAL ' + (e && e.stack || e)); app.exit(3); });
setTimeout(() => { log('global timeout'); app.exit(2); }, 170000);
app.on('window-all-closed', () => {});
fs.writeFileSync(path.join(outDir, 'harness.pid'), String(process.pid));

// ---------- helper handshake (files) ----------
async function request(kind, payload, timeoutMs) {
  const id = kind + '-' + Date.now();
  const req = path.join(outDir, id + '.req');
  const res = path.join(outDir, id + '.res');
  fs.writeFileSync(req, JSON.stringify(payload || {}));
  const t0 = Date.now();
  while (Date.now() - t0 < (timeoutMs || 10000)) {
    if (fs.existsSync(res)) { const r = fs.readFileSync(res, 'utf8').trim(); try { fs.unlinkSync(res); } catch (_) {} return r; }
    await wait(100);
  }
  try { fs.unlinkSync(req); } catch (_) {}
  return 'helper-timeout';
}

async function dialogsMode() {
  const results = [];
  for (const variant of ['native', 'fixed']) {
    const fixed = variant === 'fixed';
    if (fixed) {
      require(path.join(repoRoot, 'lib', 'native-dialog.js')).registerNativeDialogIpc({ ipcMain, dialog, BrowserWindow });
    }
    const page = path.join(app.getPath('userData'), `page-${variant}.html`);
    fs.writeFileSync(page, `<!doctype html><html><head><title>VD focus repro ${variant}</title>
      ${fixed ? `<script src="${'file:///' + path.join(repoRoot, 'public', 'dialog-shim.js').replace(/\\/g, '/')}"></script>` : ''}
      </head><body style="font:16px Segoe UI;background:#222;color:#eee;padding:16px">
      <div>VirtualDeck input-focus repro (${variant}) - automated, closes itself</div>
      <input id="t" style="font-size:18px;width:300px" autocomplete="off">
      <script>window.runDialog = (k) => { window.__dlg = null; setTimeout(() => { const r = window[k]('VD focus repro: ' + k); window.__dlg = { done: true, r: String(r) }; }, 50); return true; };</script>
      </body></html>`);
    const win = new BrowserWindow({ width: 560, height: 220, x: 60, y: 60, show: true, title: 'VD focus repro ' + variant,
      webPreferences: fixed ? { preload: path.join(repoRoot, 'preload.js'), contextIsolation: true, nodeIntegration: false }
        : { contextIsolation: true, nodeIntegration: false } });
    await win.loadFile(page);
    // Windows foreground lock: restoring our own minimized window usually activates it.
    win.minimize(); await wait(300); win.restore(); await wait(300);
    for (const scenario of ['baseline', 'alert', 'confirm']) {
      win.show(); win.focus(); win.webContents.focus();
      await wait(600);
      await win.webContents.executeJavaScript(`t.value=''; t.focus(); true`);
      await wait(200);
      let dismissed = 'n/a';
      if (scenario !== 'baseline') {
        await win.webContents.executeJavaScript(`runDialog(${JSON.stringify(scenario)})`);
        await wait(700);
        dismissed = await request('dismiss', { pid: process.pid }, 12000);
        await withTimeout((async () => { for (;;) { const d = await win.webContents.executeJavaScript('window.__dlg'); if (d && d.done) return d; await wait(100); } })(), 15000, 'dialog return').catch((e) => log(e.message));
        await wait(500);
      }
      const state = {
        windowFocused: win.isFocused(),
        webContentsFocused: win.webContents.isFocused(),
        page: await win.webContents.executeJavaScript(`({ hasFocus: document.hasFocus(), active: document.activeElement && document.activeElement.id, dlg: window.__dlg })`)
      };
      const typed = await request('type', { pid: process.pid, text: 'q7w' }, 12000);
      await wait(600);
      const value = await win.webContents.executeJavaScript('t.value');
      const r = { variant, scenario, dismissed, typed, value, typingWorks: value === 'q7w', ...state };
      log('RESULT ' + JSON.stringify(r));
      results.push(r);
    }
    win.destroy();
    if (fixed) ipcMain.removeAllListeners('vd-native-dialog');
  }
  return results;
}

// ---------- modals mode ----------
function stubPreload() {
  const f = path.join(app.getPath('userData'), 'vd-stub-preload.js');
  fs.writeFileSync(f, `
    const noop = () => {};
    window.electronAPI = new Proxy({}, { get(t, k) {
      if (typeof k !== 'string' || k === 'then') return undefined;
      if (/^on[A-Z]/.test(k)) return () => noop;
      if (k === 'nativeDialog') return (kind) => kind === 'confirm' ? false : true;
      return () => Promise.resolve(null);
    } });
    window.alert = noop; window.confirm = () => false; window.prompt = () => null;
  `);
  return f;
}

async function modalsMode() {
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(file|data|blob|devtools):/i.test(d.url) }));
  const win = new BrowserWindow({ width: 1400, height: 900, show: false,
    webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, sandbox: false, preload: stubPreload(), backgroundThrottling: false } });
  win.webContents.on('console-message', (e, level, message, line, src) => { if (level >= 3) log('renderer[err] ' + String(message).slice(0, 200)); });
  await withTimeout(win.loadFile(path.join(repoRoot, 'public', 'index.html')), 20000, 'load index').catch((e) => log(e.message));
  await wait(2000);
  const js = (code) => win.webContents.executeJavaScript(code);
  const key = async (keyCode, modifiers) => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers: modifiers || [] });
    if (keyCode.length === 1) win.webContents.sendInputEvent({ type: 'char', keyCode, modifiers: modifiers || [] });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers: modifiers || [] });
    await wait(60);
  };
  const click = async (x, y) => {
    win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await wait(150);
  };
  // hide first-run popups/toasts so they don't count as "leftover overlays"
  await js(`(() => { ['first-run-twitch-popup'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    document.querySelectorAll('dialog[open]').forEach(d => d.close()); return true; })()`);
  // probe input on the base page (fixed, so coverage by any leftover backdrop is detected)
  // Normal stacking (z-index 1) so any leftover backdrop/overlay above it is detected; placed at the
  // first spot where the clean base page lets it be the hit-test target.
  const probeAt = await js(`(() => { const i = document.createElement('input'); i.id = 'vd-probe-input'; i.autocomplete = 'off';
    document.body.appendChild(i);
    for (const top of [70, 140, 220, 320, 420, 520, 620, 720]) for (const left of [300, 600, 900, 40]) {
      i.style.cssText = 'position:fixed;z-index:1;width:200px;height:28px;left:' + left + 'px;top:' + top + 'px;';
      const b = i.getBoundingClientRect();
      if (document.elementFromPoint(b.left + 100, b.top + 14) === i) return { left, top };
    }
    i.style.cssText = 'position:fixed;z-index:1;width:200px;height:28px;left:300px;top:70px;'; return { left: 300, top: 70, fallback: true }; })()`);
  log('probe placed at ' + JSON.stringify(probeAt));

  async function typingCheck(tag) {
    const r = await js(`(() => { const i = document.getElementById('vd-probe-input'); i.value = ''; const b = i.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    const hit = await js(`(() => { const el = document.elementFromPoint(${r.x}, ${r.y}); return el ? (el.id || el.tagName + '.' + String(el.className).slice(0,40)) : null; })()`);
    await click(r.x, r.y);
    for (const ch of 'ok5') await key(ch);
    const s = await js(`(() => { const i = document.getElementById('vd-probe-input'); const a = document.activeElement;
      const fixedCover = [...document.querySelectorAll('body *')].filter(el => { const cs = getComputedStyle(el); if (cs.position !== 'fixed' || el.id === 'vd-probe-input') return false;
        const b = el.getBoundingClientRect(); return b.width >= innerWidth * 0.9 && b.height >= innerHeight * 0.9 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none'; }).map(el => el.id || el.className);
      return { value: i.value, active: a && (a.id || a.tagName), inertAncestor: !!i.closest('[inert]'), ariaHiddenAncestor: !!i.closest('[aria-hidden="true"]'), fullscreenFixed: fixedCover }; })()`);
    const res = Object.assign({ tag, hit, typingWorks: s.value === 'ok5' }, s);
    log('CHECK ' + JSON.stringify(res));
    return res;
  }

  const MODALS = [
    ['ai-audio-modal', 'openAiAudioModal()'],
    ['raid-favorites-modal', 'openRaidFavoritesModal()'],
    ['preferences-modal', 'openPreferencesModal()'],
    ['macro-edit-modal', 'openMacroEditor()'],
    ['settings-modal', `document.getElementById('settings-modal').classList.remove('hidden')`],
    ['multi-media-modal', `document.getElementById('multi-media-modal').classList.remove('hidden')`],
    ['profile-modal', 'openProfileModal()'],
    ['about-modal', 'openAboutModal()'],
    ['alert-widget', 'showAlertWidget()'],
    ['overlay-widget', 'showOverlayWidget()']
  ];
  const results = [await typingCheck('initial')];
  for (const [id, open] of MODALS) {
    for (const pathName of ['close-button', 'escape', 'outside-click']) {
      const opened = await js(`(() => { try { ${open}; } catch (e) { return 'open error: ' + e.message; }
        const m = document.getElementById(${JSON.stringify(id)}); if (!m) return 'missing';
        // put focus INSIDE the modal (worst case for focus left on a hidden element)
        const f = [...m.querySelectorAll('input,textarea')].find(x => x.getClientRects().length); if (f) f.focus();
        return m.classList.contains('hidden') ? 'still hidden' : 'open'; })()`);
      await wait(250);
      let how = pathName;
      if (pathName === 'close-button') {
        const b = await js(`(() => { const m = document.getElementById(${JSON.stringify(id)});
          const c = m && [...m.querySelectorAll('.modal-close, [id$="-close"], .close-btn, .close-button, button[aria-label="Close"]')].find(x => x.getClientRects().length);
          if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: c.id || c.className }; })()`);
        if (b) { await click(b.x, b.y); how += ' (' + b.id + ')'; } else how += ' (none found)';
      } else if (pathName === 'escape') {
        await key('Escape');
      } else {
        await click(6, 6);
      }
      await wait(300);
      const closed = await js(`(() => { const m = document.getElementById(${JSON.stringify(id)}); return !!m && (m.classList.contains('hidden') || getComputedStyle(m).display === 'none'); })()`);
      // What the user gets right after this close path (no cleanup by the harness yet)
      const asLeft = await typingCheck(`${id} via ${how} [as left by the app]`);
      // force-close so the next path starts clean (record if the path itself didn't close it)
      await js(`(() => { const m = document.getElementById(${JSON.stringify(id)}); if (m && !m.classList.contains('hidden')) { try { ${id === 'macro-edit-modal' ? 'closeMacroEditor(); closeMacrosManager && closeMacrosManager();' : ''} } catch (e) {} m.classList.add('hidden'); } 
        { const mm = document.getElementById('macros-manager-modal'); if (mm) mm.classList.add('hidden'); } return true; })()`);
      await wait(150);
      // Re-open: is the modal usable again (content visible, its first field typeable)?
      const reopen = await js(`(() => { try { ${open}; } catch (e) { return { error: e.message }; }
        const m = document.getElementById(${JSON.stringify(id)}); const f = m && [...m.querySelectorAll('input[type=text],input:not([type]),textarea')][0];
        const content = m && m.firstElementChild; const cr = content ? content.getBoundingClientRect() : { width: 0, height: 0 };
        const r = { contentVisible: cr.width > 0 && cr.height > 0, staleInlineHidden: m ? m.querySelectorAll('[style*="display: none"].hidden').length : 0 };
        m && m.classList.add('hidden'); ${id === 'macro-edit-modal' ? "{ const mm = document.getElementById('macros-manager-modal'); if (mm) mm.classList.add('hidden'); }" : ''}
        return r; })()`);
      results.push(Object.assign(asLeft, { modal: id, path: how, opened, closedByPath: closed, reopenContentVisible: reopen.contentVisible, staleInlineHidden: reopen.staleInlineHidden }));
      log('REOPEN ' + id + ' ' + how + ' ' + JSON.stringify(reopen));
      // Reset DOM damage so each path is measured independently
      await js(`(() => { document.querySelectorAll('#' + ${JSON.stringify(id)} + ' .hidden[style*="display: none"]').forEach(e => { e.classList.remove('hidden'); e.style.display = ''; }); return true; })()`);
    }
  }
  // hotkey capture (#106): focus capture field, cancel with Esc / complete a combo / blur by clicking away
  for (const variant of ['escape', 'combo', 'click-away']) {
    await js(`openMacroEditor(); true`);
    await wait(200);
    const p = await js(`(() => { const h = document.getElementById('macro-hotkey'); const n = document.getElementById('macro-name'); const a = h.getBoundingClientRect(), b = n.getBoundingClientRect();
      const id = (el) => el ? (el.id || el.tagName + '.' + String(el.className).slice(0, 30)) : null;
      return { hx: a.left + a.width / 2, hy: a.top + a.height / 2, nx: b.left + b.width / 2, ny: b.top + b.height / 2,
        hitHotkey: id(document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2)), hitName: id(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)),
        modalOpen: !document.getElementById('macro-edit-modal').classList.contains('hidden'),
        hiddenBy: (() => { let el = h; while (el && el !== document.documentElement) { const cs = getComputedStyle(el); if (cs.display === 'none') return id(el) + ' class=' + el.className + ' inline=' + (el.getAttribute('style') || ''); el = el.parentElement; } return null; })() }; })()`);
    log('capture layout ' + JSON.stringify(p));
    await click(p.hx, p.hy);
    if (variant === 'escape') await key('Escape');
    if (variant === 'combo') await key('K', ['control', 'shift']);
    await click(p.nx, p.ny);
    await js(`document.getElementById('macro-name').value = ''; true`);
    for (const ch of 'abc') await key(ch);
    const v = await js(`({ name: document.getElementById('macro-name').value, active: document.activeElement && document.activeElement.id, hotkey: document.getElementById('macro-hotkey').value })`);
    const r = { tag: 'hotkey-capture ' + variant + ' then type in macro name', typingWorks: v.name === 'abc', ...v };
    log('CHECK ' + JSON.stringify(r));
    results.push(r);
    await js(`(() => { try { closeMacroEditor(); } catch (e) {} document.getElementById('macro-edit-modal').classList.add('hidden'); const mm = document.getElementById('macros-manager-modal'); if (mm) mm.classList.add('hidden'); return true; })()`);
    results.push(await typingCheck('after hotkey capture ' + variant));
  }
  // in-app dialogs: close by button and by Esc
  for (const [fn, btnText] of [['showCustomConfirm', 'Yes'], ['showCustomConfirm', 'No'], ['showCustomPrompt', 'OK'], ['showCustomPrompt', 'Cancel'], ['showCustomConfirm', '<Esc>'], ['showCustomPrompt', '<Esc>']]) {
    await js(`(() => { window.__dlgP = ${fn}('Repro?'); return true; })()`);
    await wait(250);
    if (btnText === '<Esc>') await key('Escape');
    else {
      const b = await js(`(() => { const btn = [...document.querySelectorAll('button')].reverse().find(x => x.textContent.trim() === ${JSON.stringify(btnText)} && x.getClientRects().length); if (!btn) return null; const r = btn.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (b) await click(b.x, b.y);
    }
    await wait(250);
    results.push(await typingCheck(`${fn} closed via ${btnText}`));
  }
  win.destroy();
  return results;
}

app.whenReady().then(async () => {
  const out = { label, mode, repoRoot };
  try { out.results = mode === 'dialogs' ? await dialogsMode() : await modalsMode(); }
  catch (e) { out.error = String(e && e.stack || e); log('ERROR ' + out.error); }
  fs.writeFileSync(path.join(outDir, `result-${label}-${mode}.json`), JSON.stringify(out, null, 2));
  try { fs.writeFileSync(path.join(outDir, 'harness.done'), '1'); } catch (_) {}
  app.exit(0);
});
