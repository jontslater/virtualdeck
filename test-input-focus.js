// Regression tests: form inputs must keep accepting typing (native dialogs, global
// shortcuts, in-app dialog listeners, hidden focused fields).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { registerNativeDialogIpc, dialogReturnValue, buildDialogOptions, restoreWebContentsFocus } = require('./lib/native-dialog');
const { HotkeySuspension } = require('./lib/hotkey-suspension');
const guard = require('./public/input-focus-guard.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n    ' + (e && e.stack || e)); process.exitCode = 1; }
}
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');

console.log('input focus tests');

test('dialog shim routes alert/confirm through the main process synchronously', () => {
  const calls = [];
  const win = { electronAPI: { nativeDialog: (k, m) => { calls.push([k, m]); return k === 'confirm' ? m === 'yes?' : true; } } };
  vm.runInNewContext(read('public/dialog-shim.js'), { window: win });
  assert.strictEqual(win.__vdDialogShim, true);
  assert.strictEqual(win.alert('hi'), undefined);
  assert.strictEqual(win.confirm('yes?'), true);
  assert.strictEqual(win.confirm('no?'), false);
  assert.strictEqual(win.prompt('x', 'y'), null);
  win.alert();
  assert.deepStrictEqual(calls, [['alert', 'hi'], ['confirm', 'yes?'], ['confirm', 'no?'], ['alert', '']]);
});

test('dialog shim is a no-op without the preload API (browser / tests)', () => {
  const orig = () => 'native';
  const win = { alert: orig };
  vm.runInNewContext(read('public/dialog-shim.js'), { window: win });
  assert.strictEqual(win.alert, orig);
});

function fakeIpc() {
  const handlers = {};
  return { on: (ch, fn) => { handlers[ch] = fn; }, handlers };
}
function fakeWin() {
  const w = { focusCalls: 0, wcFocusCalls: 0, isDestroyed: () => false };
  w.focus = () => { w.focusCalls++; };
  w.webContents = { focus: () => { w.wcFocusCalls++; } };
  return w;
}

const modalEscape = require('./public/modal-escape.js');
function fakeDom(specs) {
  // specs: [{ id, cls, parent, hidden, z, display }]
  const els = specs.map((sp) => {
    const classes = new Set((sp.cls || '').split(/\s+/).filter(Boolean));
    if (sp.hidden) classes.add('hidden');
    const el = { id: sp.id || '', spec: sp, parentElement: null, style: {},
      classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
      get className() { return [...classes].join(' '); },
      getClientRects() { return el.classList.contains('hidden') || sp.display === 'none' ? [] : [1]; } };
    return el;
  });
  els.forEach((el) => { if (el.spec.parent) el.parentElement = els.find((e) => e.id === el.spec.parent); });
  const matches = (el) => /-modal$/.test(el.id) || el.classList.contains('modal') || el.classList.contains('overlay-widget') || el.classList.contains('alert-widget') || el.id === 'twitch-alert-widget';
  const doc = { querySelectorAll: () => els.filter(matches), querySelector: (sel) => sel === '[data-vd-dialog]' ? els.find((e) => e.spec.dialog) || null : null };
  const win = { getComputedStyle: (el) => ({ display: el.classList.contains('hidden') || el.spec.display === 'none' ? 'none' : 'block', visibility: 'visible', zIndex: String(el.spec.z == null ? 'auto' : el.spec.z) }) };
  return { els, doc, win, byId: (id) => els.find((e) => e.id === id) };
}

test('Esc closes the outer modal container (backdrop), never only its inner .modal-content', () => {
  const d = fakeDom([
    { id: 'preferences-modal' },
    { id: 'pref-content', cls: 'modal-content preferences-modal-content', parent: 'preferences-modal' },
    { id: 'pref-header', cls: 'modal-header', parent: 'pref-content' }
  ]);
  const closed = modalEscape.closeTopmost(d.win, d.doc);
  assert.strictEqual(closed, 'preferences-modal');
  assert.ok(d.byId('preferences-modal').classList.contains('hidden'), 'backdrop hidden');
  assert.ok(!d.byId('pref-content').classList.contains('hidden'), 'inner content untouched (re-open works)');
  assert.ok(!d.byId('pref-header').classList.contains('hidden'));
});

test('Esc uses the modal\'s own close function and only closes the topmost one', () => {
  const d = fakeDom([{ id: 'raid-favorites-modal', z: 1000 }, { id: 'macro-edit-modal', z: 2000 }, { id: 'about-modal', hidden: true, z: 3000 }]);
  const calls = [];
  d.win.closeMacroEditor = () => { calls.push('closeMacroEditor'); d.byId('macro-edit-modal').classList.add('hidden'); };
  assert.strictEqual(modalEscape.closeTopmost(d.win, d.doc), 'macro-edit-modal');
  assert.deepStrictEqual(calls, ['closeMacroEditor']);
  assert.ok(!d.byId('raid-favorites-modal').classList.contains('hidden'), 'modal underneath stays open');
  assert.strictEqual(modalEscape.closeTopmost(d.win, d.doc), 'raid-favorites-modal');
  assert.strictEqual(modalEscape.closeTopmost(d.win, d.doc), null, 'nothing left to close');
});

test('Esc with an in-app prompt/confirm open leaves the modal behind it alone', () => {
  const d = fakeDom([{ id: 'macro-edit-modal' }, { id: 'dlg', dialog: true }]);
  assert.strictEqual(modalEscape.closeTopmost(d.win, d.doc), null);
  assert.ok(!d.byId('macro-edit-modal').classList.contains('hidden'));
});

test('Esc closer: a close function that throws or does not hide still hides the container', () => {
  const d = fakeDom([{ id: 'profile-modal' }]);
  d.win.closeProfileModal = () => { throw new Error('x'); };
  modalEscape.closeTopmost(d.win, d.doc);
  assert.ok(d.byId('profile-modal').classList.contains('hidden'));
  const d2 = fakeDom([{ id: 'settings-modal' }]);
  d2.win.closeSettingsModal = () => {};
  modalEscape.closeTopmost(d2.win, d2.doc);
  assert.ok(d2.byId('settings-modal').classList.contains('hidden'));
});

test('wiring: old [class*="modal"] Esc sweep is gone; dialogs are marked; closer loaded before script.js', () => {
  const s = read('public/script.js');
  assert.ok(!s.includes(`[class*="modal"]:not(.hidden)`), 'old sweep removed');
  assert.ok(!/modal\.style\.display = 'none';/.test(s));
  assert.ok(s.includes('window.VDModalEscape.closeTopmost(window, document)'));
  assert.strictEqual(s.split("overlay.setAttribute('data-vd-dialog', '1')").length - 1, 3);
  const idx = read('public/index.html');
  assert.ok(idx.indexOf('modal-escape.js') > 0 && idx.indexOf('modal-escape.js') < idx.indexOf('src="script.js"'));
});

const asyncTests = [];
function testAsync(name, fn) { asyncTests.push([name, fn]); }

testAsync('main dialog handler: async parented box (main stays responsive), confirm mapping, focus handed back', async () => {
  const ipc = fakeIpc();
  const win = fakeWin();
  const shown = [];
  let nextIndex = 0;
  const dialog = {
    showMessageBox: (parent, opts) => { shown.push({ parent, opts }); return Promise.resolve({ response: nextIndex }); },
    showMessageBoxSync: () => { throw new Error('must not block the main process'); }
  };
  const timers = [];
  registerNativeDialogIpc({ ipcMain: ipc, dialog, BrowserWindow: { fromWebContents: () => win }, setTimeoutFn: (fn) => timers.push(fn) });
  const h = ipc.handlers['vd-native-dialog'];
  assert.ok(h, 'channel registered');
  const run = async (payload, idx) => { nextIndex = idx; const ev = { sender: {} }; h(ev, payload); assert.strictEqual('returnValue' in ev, false, 'handler returns before the box closes'); await new Promise((r) => setImmediate(r)); return ev.returnValue; };
  assert.strictEqual(await run({ kind: 'confirm', message: 'Delete?' }, 0), true);
  assert.strictEqual(await run({ kind: 'confirm', message: 'Delete?' }, 1), false);
  assert.strictEqual(await run({ kind: 'alert', message: 'Saved' }, 0), true);
  assert.strictEqual(shown[0].parent, win, 'dialog is parented to the window');
  assert.deepStrictEqual(shown[0].opts.buttons, ['OK', 'Cancel']);
  assert.deepStrictEqual(shown[2].opts.buttons, ['OK']);
  assert.strictEqual(win.wcFocusCalls, 3, 'webContents refocused after every dialog');
  timers.forEach((t) => t());
  assert.strictEqual(win.wcFocusCalls, 6, 'and once more after the OS settles');
});

testAsync('main dialog handler: failing/rejecting dialog still answers (confirm=false), renderer never hangs', async () => {
  for (const showMessageBox of [() => { throw new Error('boom'); }, () => Promise.reject(new Error('nope'))]) {
    const ipc = fakeIpc();
    registerNativeDialogIpc({ ipcMain: ipc, dialog: { showMessageBox }, BrowserWindow: { fromWebContents: () => null }, setTimeoutFn: () => {} });
    const ev = { sender: {} };
    ipc.handlers['vd-native-dialog'](ev, { kind: 'confirm', message: 'x' });
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(ev.returnValue, false);
    const ev2 = { sender: {} };
    ipc.handlers['vd-native-dialog'](ev2, null);
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(ev2.returnValue, true);
  }
});

test('dialog helpers', () => {
  assert.strictEqual(dialogReturnValue('confirm', 0), true);
  assert.strictEqual(dialogReturnValue('confirm', 1), false);
  assert.strictEqual(dialogReturnValue('alert', 0), true);
  assert.strictEqual(buildDialogOptions('alert', null).message, '');
  assert.strictEqual(buildDialogOptions('confirm', 'x').cancelId, 1);
  assert.strictEqual(restoreWebContentsFocus(null), false);
  assert.strictEqual(restoreWebContentsFocus({ isDestroyed: () => true }), false);
});

function suspension(focused) {
  const log = [];
  const s = new HotkeySuspension({ register: () => log.push('register'), unregisterAll: () => log.push('unregisterAll'), isWindowFocused: () => focused.value });
  return { s, log };
}

test('global shortcuts are suspended while typing in VirtualDeck (bare Num1 etc. no longer eat keys)', () => {
  const focused = { value: true };
  const { s, log } = suspension(focused);
  assert.strictEqual(s.setTextInputActive(true), true);
  assert.deepStrictEqual(log, ['unregisterAll']);
  assert.strictEqual(s.setTextInputActive(false), false);
  assert.deepStrictEqual(log, ['unregisterAll', 'register']);
});

test('alt-tab away with the caret still in a field: shortcuts come back for the game/OBS', () => {
  const focused = { value: true };
  const { s, log } = suspension(focused);
  s.setTextInputActive(true);
  focused.value = false; s.apply();          // window blur
  assert.deepStrictEqual(log, ['unregisterAll', 'register']);
  focused.value = true; s.apply();           // window focus again, field still focused
  assert.deepStrictEqual(log, ['unregisterAll', 'register', 'unregisterAll']);
});

test('explicit disable/enable is a reason, not a toggle: enable while typing does not re-arm', () => {
  const focused = { value: true };
  const { s, log } = suspension(focused);
  s.add('renderer');
  s.setTextInputActive(true);
  s.remove('renderer');                       // e.g. a modal's close handler calls enableHotkeys
  assert.strictEqual(s.suspendedNow, true);
  assert.deepStrictEqual(log, ['unregisterAll']);
  s.setTextInputActive(false);
  assert.deepStrictEqual(log, ['unregisterAll', 'register']);
  s.remove('renderer'); s.remove('renderer'); // stray enables are harmless
  assert.deepStrictEqual(log, ['unregisterAll', 'register']);
});

test('input focus guard: text-editable detection', () => {
  const el = (tag, extra) => Object.assign({ nodeType: 1, tagName: tag, disabled: false, readOnly: false }, extra || {});
  assert.ok(guard.isTextEditable(el('INPUT', { type: 'text' })));
  assert.ok(guard.isTextEditable(el('INPUT', { type: 'number' })));
  assert.ok(guard.isTextEditable(el('INPUT', { type: '' })));
  assert.ok(guard.isTextEditable(el('TEXTAREA')));
  assert.ok(guard.isTextEditable(el('DIV', { isContentEditable: true })));
  assert.ok(!guard.isTextEditable(el('INPUT', { type: 'checkbox' })));
  assert.ok(!guard.isTextEditable(el('INPUT', { type: 'text', disabled: true })));
  assert.ok(!guard.isTextEditable(el('BUTTON')));
  assert.ok(!guard.isTextEditable(null));
});

test('wiring: shim loads before every other script; preload + main expose the channels', () => {
  const idx = read('public/index.html');
  const firstScript = idx.match(/<script src="([^"]+)"/)[1];
  assert.strictEqual(firstScript, 'dialog-shim.js');
  assert.ok(idx.indexOf('input-focus-guard.js') < idx.indexOf('src="script.js"'));
  const pre = read('preload.js');
  assert.ok(pre.includes("ipcRenderer.sendSync('vd-native-dialog'"));
  assert.ok(pre.includes("ipcRenderer.send('text-input-active'"));
  const main = read('main.js');
  assert.ok(main.includes('registerNativeDialogIpc({ ipcMain, dialog, BrowserWindow })'));
  assert.ok(main.includes('installWindowFocusRelay(win)'));
  assert.ok(main.includes("hotkeySuspension.add('renderer')") && main.includes("hotkeySuspension.remove('renderer')"));
  assert.ok(!/ipcMain\.on\('disable-hotkeys', \(\) => \{\n\s*globalShortcut\.unregisterAll\(\);/.test(main), 'old raw toggle removed');
});

test('in-app dialogs remove their document keydown listener on every close path', () => {
  const s = read('public/script.js');
  const n = s.split("document.removeEventListener('keydown', handleKeydown);\n      if (previousFocus").length - 1;
  assert.strictEqual(n, 3);
  assert.ok(!/window\.prompt\(/.test(s), 'no prompt() (unsupported in Electron)');
});

(async () => {
  for (const [name, fn] of asyncTests) {
    try { await fn(); passed++; console.log('  ok ' + name); }
    catch (e) { console.error('  FAIL ' + name + '\n    ' + (e && e.stack || e)); process.exitCode = 1; }
  }
  console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
})();
