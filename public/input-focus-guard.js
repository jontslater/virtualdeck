// Keeps typing working in VirtualDeck form fields:
//  1. tells the main process when a text field has focus, so global shortcuts
//     (which swallow keys system-wide, e.g. bare "Num1") are suspended while typing;
//  2. if the focused element gets hidden (modal closed by Esc / outside click / code),
//     blurs it so keystrokes don't vanish into an invisible field.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.VDInputFocusGuard = api; api.install(window, document); }
})(this, function () {
  var NON_TEXT = { button: 1, submit: 1, reset: 1, checkbox: 1, radio: 1, range: 1, color: 1, file: 1, image: 1, hidden: 1 };

  function isTextEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    if (tag === 'TEXTAREA') return !el.disabled && !el.readOnly;
    if (tag === 'INPUT') return !el.disabled && !el.readOnly && !NON_TEXT[(el.type || 'text').toLowerCase()];
    return false;
  }

  function isHiddenElement(win, el) {
    if (!el || el === win.document.body || el === win.document.documentElement) return false;
    if (!el.isConnected) return true;
    if (typeof el.checkVisibility === 'function') return !el.checkVisibility({ checkVisibilityCSS: true });
    return el.getClientRects().length === 0;
  }

  function install(win, doc) {
    if (!win || !doc || win.__vdInputFocusGuard) return;
    win.__vdInputFocusGuard = true;
    var last = null;
    var send = function (active) {
      if (active === last) return;
      last = active;
      var api = win.electronAPI;
      if (api && typeof api.setTextInputActive === 'function') { try { api.setTextInputActive(active); } catch (_) {} }
    };
    var sync = function () { send(isTextEditable(doc.activeElement)); };
    doc.addEventListener('focusin', sync, true);
    doc.addEventListener('focusout', function () { win.setTimeout(sync, 0); }, true);
    win.addEventListener('blur', function () { send(false); });
    win.addEventListener('focus', sync);

    var pending = false;
    var check = function () {
      pending = false;
      var a = doc.activeElement;
      if (a && isHiddenElement(win, a)) { try { a.blur(); } catch (_) {} sync(); }
    };
    if (typeof win.MutationObserver === 'function') {
      new win.MutationObserver(function () {
        if (pending) return;
        pending = true;
        (win.requestAnimationFrame || win.setTimeout)(check);
      }).observe(doc.documentElement, { attributes: true, subtree: true, attributeFilter: ['class', 'style', 'hidden'] });
    }
  }

  return { isTextEditable: isTextEditable, isHiddenElement: isHiddenElement, install: install };
});
