/**
 * UI surfaces hidden in packaged (installed) builds. Dev / unpackaged keeps them.
 */

const RAVEN_OPEN_ENV_MENU_LABEL = 'Open Raven settings (raven.env)...';

/** Renderer element ids removed when window.__VD_IS_PACKAGED__ is true. */
const PACKAGED_HIDDEN_ELEMENT_IDS = [
  'menu-tools-devtools',
  'menu-tools-raven-settings',
  'raven-open-env-btn',
  'ai-trivia-btn',
  'ai-dnd-btn',
  'ai-settings-btn',
  'overlay-ai-control-panel',
  'overlay-vtuber-controls',
  'export-winners-btn',
];

/** Native application menu labels omitted when app.isPackaged. */
const PACKAGED_OMIT_MENU_LABELS = new Set(['Developer Tools', RAVEN_OPEN_ENV_MENU_LABEL]);

function filterMenuTemplateForPackaged(template, isPackaged) {
  if (!isPackaged || !Array.isArray(template)) return template;
  return template
    .map((item) => {
      if (!item || typeof item !== 'object') return item;
      if (item.label && PACKAGED_OMIT_MENU_LABELS.has(item.label)) return null;
      if (item.submenu) {
        return { ...item, submenu: filterMenuTemplateForPackaged(item.submenu, true) };
      }
      return item;
    })
    .filter(Boolean);
}

function filterRavenMenuItems(items, isPackaged) {
  if (!isPackaged || !Array.isArray(items)) return items;
  return items.filter((item) => item && item.label !== RAVEN_OPEN_ENV_MENU_LABEL);
}

module.exports = {
  RAVEN_OPEN_ENV_MENU_LABEL,
  PACKAGED_HIDDEN_ELEMENT_IDS,
  PACKAGED_OMIT_MENU_LABELS,
  filterMenuTemplateForPackaged,
  filterRavenMenuItems,
};
