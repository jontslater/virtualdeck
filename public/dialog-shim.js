// Route window.alert/confirm through the main process (lib/native-dialog.js) so a
// native dialog can never leave the page unable to receive keystrokes (Electron on
// Windows). Must load before every other script. Synchronous, same return values.
(function () {
  var api = window.electronAPI;
  if (!api || typeof api.nativeDialog !== 'function') return;
  var text = function (m) { return m === undefined ? '' : String(m); };
  window.alert = function (message) { api.nativeDialog('alert', text(message)); };
  window.confirm = function (message) { return api.nativeDialog('confirm', text(message)) === true; };
  // Electron never supported prompt(); callers get null (same as before) without a stuck dialog.
  window.prompt = function () { return null; };
  window.__vdDialogShim = true;
})();
