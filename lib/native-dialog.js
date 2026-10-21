'use strict';
/**
 * Native alert/confirm replacement that does not leave the page deaf to the keyboard.
 *
 * Renderer window.alert()/confirm() on Windows (Electron) can return with the
 * BrowserWindow focused but its webContents NOT focused: inputs look focused but
 * every keystroke is dropped until the app is reloaded or alt-tabbed.
 * public/dialog-shim.js routes alert/confirm here (synchronously, so callers keep
 * their `if (confirm(...))` semantics); we show a parented (async) message box from
 * the main process and then explicitly hand keyboard focus back to the webContents.
 */

const CHANNEL = 'vd-native-dialog';

function restoreWebContentsFocus(win) {
  if (!win || (typeof win.isDestroyed === 'function' && win.isDestroyed())) return false;
  try {
    if (typeof win.focus === 'function') win.focus();
    if (win.webContents && typeof win.webContents.focus === 'function') win.webContents.focus();
    return true;
  } catch (_) {
    return false;
  }
}

function buildDialogOptions(kind, message, title) {
  const isConfirm = kind === 'confirm';
  return {
    type: isConfirm ? 'question' : 'info',
    title: title || 'VirtualDeck',
    message: String(message == null ? '' : message).slice(0, 4000),
    buttons: isConfirm ? ['OK', 'Cancel'] : ['OK'],
    defaultId: 0,
    cancelId: isConfirm ? 1 : 0,
    noLink: true
  };
}

/** Pure mapping from showMessageBoxSync's button index to the renderer return value. */
function dialogReturnValue(kind, buttonIndex) {
  return kind === 'confirm' ? buttonIndex === 0 : true;
}

function registerNativeDialogIpc({ ipcMain, dialog, BrowserWindow, setTimeoutFn }) {
  const later = setTimeoutFn || setTimeout;
  ipcMain.on(CHANNEL, (event, payload) => {
    const p = payload || {};
    const kind = p.kind === 'confirm' ? 'confirm' : 'alert';
    let win = null;
    try { win = BrowserWindow.fromWebContents(event.sender); } catch (_) { win = null; }
    // Async box in main (the main process keeps serving overlays/JARVIS/websockets while it
    // is open); the renderer stays blocked in sendSync until returnValue is set, so
    // alert/confirm keep their synchronous semantics.
    const finish = (index) => {
      try { event.returnValue = dialogReturnValue(kind, index); } catch (_) {}
      // Give keyboard focus back to the page (now and once more after the OS settles).
      restoreWebContentsFocus(win);
      later(() => restoreWebContentsFocus(win), 50);
    };
    const fallback = kind === 'confirm' ? 1 : 0;
    try {
      const opts = buildDialogOptions(kind, p.message, p.title);
      const shown = win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts);
      Promise.resolve(shown).then((r) => finish(r && typeof r.response === 'number' ? r.response : fallback), (err) => {
        console.warn('[native-dialog] showMessageBox failed:', err && err.message);
        finish(fallback);
      });
    } catch (err) {
      console.warn('[native-dialog] showMessageBox failed:', err && err.message);
      finish(fallback);
    }
  });
}

/**
 * Safety net: whenever the window regains focus (alt-tab back, dialog closed,
 * devtools closed), make sure the webContents has keyboard focus too.
 */
function installWindowFocusRelay(win) {
  if (!win || typeof win.on !== 'function') return;
  win.on('focus', () => {
    try {
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDevToolsFocused?.()) win.webContents.focus();
    } catch (_) {}
  });
}

module.exports = { CHANNEL, restoreWebContentsFocus, buildDialogOptions, dialogReturnValue, registerNativeDialogIpc, installWindowFocusRelay };
