/**
 * Hide dev-only / non-functional UI when running from an installed build.
 */
(function () {
  if (window.__VD_IS_PACKAGED__ !== true) return;

  const HIDDEN_IDS = [
    'menu-tools-devtools',
    'menu-tools-raven-settings',
    'raven-open-env-btn',
    'ai-trivia-btn',
    'ai-dnd-btn',
    'ai-settings-btn',
    'overlay-ai-control-panel',
    'overlay-vtuber-controls',
    'export-winners-btn',
    'dnd-campaign-panel',
  ];

  function hideById(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-vd-hidden-packaged', '1');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    if (el.tagName === 'BUTTON') {
      el.disabled = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    HIDDEN_IDS.forEach(hideById);
  });
})();
