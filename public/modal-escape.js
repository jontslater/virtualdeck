// Esc closes the topmost open modal CONTAINER through its own close function.
// The old global handler hid every element whose class merely contained "modal"
// (.modal-content, .modal-header, ...) with class "hidden" + inline display:none,
// but left the full-screen backdrop (#preferences-modal, #about-modal, ...) up:
// every click/keystroke hit an empty backdrop, and the inner display:none stuck,
// so re-opening showed an empty overlay until the app was reloaded.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.VDModalEscape = api;
})(this, function () {
  // container id -> global close function (falls back to adding .hidden on the container only)
  var CLOSERS = {
    'macro-edit-modal': 'closeMacroEditor',
    'macros-modal': 'closeMacrosManager',
    'raid-favorites-modal': 'closeRaidFavoritesModal',
    'preferences-modal': 'closePreferencesModal',
    'profile-modal': 'closeProfileModal',
    'ai-audio-modal': 'closeAiAudioModal',
    'settings-modal': 'closeSettingsModal',
    'multi-media-modal': 'closeMultiMediaModal',
    'twitch-alert-widget': 'closeTwitchAlertWidget',
    'alert-widget': 'hideAlertWidget',
    'overlay-widget': 'hideOverlayWidget'
  };
  var CONTAINER_SELECTOR = '[id$="-modal"], .modal, .overlay-widget, .alert-widget, #twitch-alert-widget';

  function isOpen(win, el) {
    if (!el || el.classList.contains('hidden')) return false;
    var cs = win.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
  }

  function zIndexOf(win, el) {
    var z = parseInt(win.getComputedStyle(el).zIndex, 10);
    return isNaN(z) ? 0 : z;
  }

  /** Topmost open container (highest z-index, then latest in DOM); nested containers never win over their ancestor. */
  function findTopmost(win, doc) {
    var all = Array.prototype.slice.call(doc.querySelectorAll(CONTAINER_SELECTOR));
    var open = all.filter(function (el) {
      if (!isOpen(win, el)) return false;
      for (var p = el.parentElement; p; p = p.parentElement) { if (all.indexOf(p) !== -1) return false; }
      return true;
    });
    var best = null;
    open.forEach(function (el, i) {
      var z = zIndexOf(win, el);
      if (!best || z > best.z || (z === best.z && i > best.i)) best = { el: el, z: z, i: i };
    });
    return best ? best.el : null;
  }

  function closeTopmost(win, doc) {
    // An in-app prompt/confirm dialog handles its own Esc; don't also close the modal behind it.
    if (doc.querySelector('[data-vd-dialog]')) return null;
    var el = findTopmost(win, doc);
    if (!el) return null;
    var fn = el.id && CLOSERS[el.id];
    if (fn && typeof win[fn] === 'function') {
      try { win[fn](); } catch (e) { el.classList.add('hidden'); }
    } else {
      el.classList.add('hidden');
    }
    if (!el.classList.contains('hidden') && isOpen(win, el)) el.classList.add('hidden');
    return el.id || el.className;
  }

  return { CLOSERS: CLOSERS, CONTAINER_SELECTOR: CONTAINER_SELECTOR, findTopmost: findTopmost, closeTopmost: closeTopmost, isOpen: isOpen };
});
