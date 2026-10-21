/**
 * Registers each enabled macro's global hotkey with Electron's globalShortcut, and only touches
 * the accelerators it registered itself (soundboard button hotkeys are registered separately).
 */
const { parseAccelerator } = require('../public/macro-hotkeys');

class MacroHotkeyRegistrar {
  constructor({ globalShortcut, onTrigger, log = console }) {
    this.globalShortcut = globalShortcut;
    this.onTrigger = onTrigger;
    this.log = log;
    this.registered = new Map(); // accelerator -> macroId
  }

  unregisterOwn() {
    for (const accel of this.registered.keys()) {
      try { this.globalShortcut.unregister(accel); } catch (_) { /* ignore */ }
    }
    this.registered.clear();
  }

  /** Re-register from the current macro list. Returns { registered: [...], failed: [...] }. */
  sync(macros) {
    this.unregisterOwn();
    const registered = [];
    const failed = [];
    for (const macro of macros || []) {
      const raw = macro && macro.triggers && macro.triggers.hotkey;
      if (!raw || macro.enabled === false) continue;
      const parsed = parseAccelerator(raw);
      if (!parsed.valid) {
        failed.push({ id: macro.id, hotkey: raw, reason: parsed.errors.join('; ') });
        continue;
      }
      const accel = parsed.accelerator;
      if (this.registered.has(accel)) {
        failed.push({ id: macro.id, hotkey: accel, reason: 'Duplicate macro hotkey' });
        continue;
      }
      let ok = false;
      try {
        if (this.globalShortcut.isRegistered && this.globalShortcut.isRegistered(accel)) {
          failed.push({ id: macro.id, hotkey: accel, reason: 'Already in use by a button hotkey' });
          continue;
        }
        const id = macro.id;
        ok = this.globalShortcut.register(accel, () => this.onTrigger(id));
      } catch (err) {
        failed.push({ id: macro.id, hotkey: accel, reason: err.message || String(err) });
        continue;
      }
      if (ok) {
        this.registered.set(accel, macro.id);
        registered.push({ id: macro.id, hotkey: accel });
      } else {
        failed.push({ id: macro.id, hotkey: accel, reason: 'Windows or another app already uses this shortcut' });
      }
    }
    if (failed.length) this.log.warn('[MacroHotkeys] Not registered:', failed);
    return { registered, failed };
  }
}

module.exports = { MacroHotkeyRegistrar };
