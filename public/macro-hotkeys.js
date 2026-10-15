// public/macro-hotkeys.js
// Shared (main + renderer) helpers for macro global hotkeys: parse/normalize Electron accelerators,
// build one from a keydown event, detect duplicates/conflicts, and format macro run results.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VDMacroHotkeys = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MODIFIER_ALIASES = {
    ctrl: 'Ctrl', control: 'Ctrl', cmdorctrl: 'Ctrl', commandorcontrol: 'Ctrl',
    alt: 'Alt', option: 'Alt', altgr: 'Alt',
    shift: 'Shift',
    super: 'Super', meta: 'Super', win: 'Super', cmd: 'Super', command: 'Super',
  };
  const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Super'];
  const NAMED_KEYS = {
    space: 'Space', tab: 'Tab', enter: 'Enter', return: 'Enter', escape: 'Escape', esc: 'Escape',
    backspace: 'Backspace', delete: 'Delete', del: 'Delete', insert: 'Insert', ins: 'Insert',
    home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
    up: 'Up', down: 'Down', left: 'Left', right: 'Right', plus: 'Plus',
    numadd: 'numadd', numsub: 'numsub', nummult: 'nummult', numdiv: 'numdiv', numdec: 'numdec',
    printscreen: 'PrintScreen', capslock: 'Capslock', numlock: 'Numlock', scrolllock: 'Scrolllock',
  };
  const PUNCTUATION = new Set(['-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', '`']);
  // Keys that must never be bound globally by a macro.
  const RESERVED = ['F12'];

  function normalizeKey(raw) {
    const k = String(raw || '').trim();
    if (!k) return null;
    if (/^[a-z]$/i.test(k)) return k.toUpperCase();
    if (/^[0-9]$/.test(k)) return k;
    const f = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(k);
    if (f) return 'F' + f[1];
    const num = /^num([0-9])$/i.exec(k);
    if (num) return 'num' + num[1];
    if (PUNCTUATION.has(k)) return k;
    return NAMED_KEYS[k.toLowerCase()] || null;
  }

  /** Parse an accelerator string. Returns { valid, accelerator, errors }. */
  function parseAccelerator(input) {
    const text = String(input == null ? '' : input).trim();
    if (!text) return { valid: false, accelerator: '', errors: ['Hotkey is empty'] };
    // Split on '+' but allow the literal Plus key written as "Ctrl++"
    const parts = text.replace(/\+\+$/, '+Plus').split('+').map((p) => p.trim()).filter(Boolean);
    const mods = new Set();
    let key = null;
    const errors = [];
    for (const part of parts) {
      const mod = MODIFIER_ALIASES[part.toLowerCase()];
      if (mod) { mods.add(mod); continue; }
      const k = normalizeKey(part);
      if (!k) { errors.push(`Unsupported key "${part}"`); continue; }
      if (key) { errors.push('Use exactly one non-modifier key'); continue; }
      key = k;
    }
    if (!key && errors.length === 0) errors.push('Add a non-modifier key (e.g. Ctrl+Shift+1)');
    if (key && mods.size === 0 && !/^F(1[3-9]|2[0-4]|[1-9]|1[01])$/.test(key)) {
      errors.push('Hotkey needs a modifier (Ctrl, Alt, Shift or Win) unless it is a function key');
    }
    const accelerator = key ? [...MODIFIER_ORDER.filter((m) => mods.has(m)), key].join('+') : '';
    if (accelerator && RESERVED.includes(accelerator)) errors.push(`${accelerator} is reserved by VirtualDeck`);
    return { valid: errors.length === 0, accelerator, errors };
  }

  function canonical(accel) {
    const p = parseAccelerator(accel);
    return p.accelerator ? p.accelerator.toLowerCase() : String(accel || '').trim().toLowerCase();
  }

  /**
   * Find conflicts for a macro hotkey.
   * macros: [{ id, name, triggers: { hotkey } }]; buttonHotkeys: [{ label, hotkey }]
   */
  function findHotkeyConflicts({ hotkey, macroId, macros = [], buttonHotkeys = [] }) {
    const target = canonical(hotkey);
    if (!target) return [];
    const conflicts = [];
    for (const m of macros) {
      if (!m || m.id === macroId) continue;
      const hk = m.triggers && m.triggers.hotkey;
      if (hk && canonical(hk) === target) conflicts.push(`Already used by macro "${m.name || m.id}"`);
    }
    for (const b of buttonHotkeys) {
      if (b && b.hotkey && canonical(b.hotkey) === target) conflicts.push(`Already used by button "${b.label || 'button'}"`);
    }
    if (RESERVED.map((r) => r.toLowerCase()).includes(target)) conflicts.push('Reserved by VirtualDeck');
    return conflicts;
  }

  const CODE_KEYS = {
    Space: 'Space', Tab: 'Tab', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Escape', Backspace: 'Backspace',
    Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
    Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
    NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
  };
  const MODIFIER_CODES = /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/;

  /** Build an accelerator from a keydown event. Returns { accelerator, complete }. */
  function acceleratorFromKeyEvent(e) {
    const mods = [];
    if (e.ctrlKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Super');
    const code = String(e.code || '');
    let key = null;
    if (!MODIFIER_CODES.test(code)) {
      let m;
      if ((m = /^Key([A-Z])$/.exec(code))) key = m[1];
      else if ((m = /^Digit([0-9])$/.exec(code))) key = m[1];
      else if ((m = /^Numpad([0-9])$/.exec(code))) key = 'num' + m[1];
      else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
      else key = CODE_KEYS[code] || null;
    }
    const accelerator = [...mods, ...(key ? [key] : [])].join('+');
    return { accelerator, complete: !!key };
  }

  /** Turn a run_macro result into per-step rows for the UI. */
  function formatMacroRunSteps(result) {
    const steps = (result && Array.isArray(result.steps)) ? result.steps : [];
    return steps.map((s) => ({
      label: `Step ${s.step}: ${s.description || s.tool}`,
      ok: !!s.success,
      detail: s.success ? 'OK' : String(s.error || 'Failed'),
    }));
  }

  return { parseAccelerator, findHotkeyConflicts, acceleratorFromKeyEvent, formatMacroRunSteps, canonical, RESERVED };
});
