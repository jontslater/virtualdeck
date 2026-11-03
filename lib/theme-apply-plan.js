/**
 * Pure helpers for theme apply decisions (used by tests and documentation of import flow).
 */

const BUILT_IN_THEMES = ['dark', 'light', 'red', 'purple', 'blue', 'darkpop'];

/**
 * @param {string} themeName
 * @param {string[]} availableSkinIds
 * @param {{ force?: boolean }} [options]
 * @returns {{ apply: boolean, reason: string }}
 */
function planThemeApply(themeName, availableSkinIds, options = {}) {
  const force = !!options.force;
  if (!themeName || typeof themeName !== 'string') {
    return { apply: false, reason: 'missing-theme' };
  }
  if (BUILT_IN_THEMES.includes(themeName)) {
    return { apply: true, reason: 'built-in' };
  }
  if (availableSkinIds.includes(themeName)) {
    return { apply: true, reason: 'listed-skin' };
  }
  if (force) {
    return { apply: true, reason: 'forced-after-import' };
  }
  return { apply: false, reason: 'unknown-skin' };
}

module.exports = { BUILT_IN_THEMES, planThemeApply };
