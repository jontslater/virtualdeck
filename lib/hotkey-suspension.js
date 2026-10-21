'use strict';
/**
 * Decides when VirtualDeck's global shortcuts must be unregistered.
 *
 * globalShortcut swallows its keys system-wide, INCLUDING inside VirtualDeck's own
 * inputs. Bare-key hotkeys (e.g. "Num1", "F15") therefore make those keys untypeable
 * in every form field. We suspend shortcuts while a text field in VirtualDeck has
 * focus AND the VirtualDeck window is focused, and keep the old explicit
 * disable/enable (modals, hotkey capture) as a reason set instead of a toggle, so
 * an enable from one place can't re-arm shortcuts while another still needs them off.
 * When the window loses focus (alt-tab to a game/OBS) shortcuts come back.
 */
class HotkeySuspension {
  constructor({ register, unregisterAll, isWindowFocused }) {
    this._register = register;
    this._unregisterAll = unregisterAll;
    this._isWindowFocused = isWindowFocused || (() => false);
    this.reasons = new Set();
    this.textInputActive = false;
    this.suspendedNow = false;
  }

  shouldSuspend() {
    return this.reasons.size > 0 || (this.textInputActive && !!this._isWindowFocused());
  }

  apply() {
    const suspend = this.shouldSuspend();
    if (suspend && !this.suspendedNow) {
      this._unregisterAll();
      this.suspendedNow = true;
    } else if (!suspend && this.suspendedNow) {
      this.suspendedNow = false;
      this._register();
    }
    return this.suspendedNow;
  }

  add(reason) { this.reasons.add(reason); return this.apply(); }
  remove(reason) { this.reasons.delete(reason); return this.apply(); }
  setTextInputActive(active) { this.textInputActive = !!active; return this.apply(); }
}

module.exports = { HotkeySuspension };
