// AI Audio Settings modal (moved out of the main layout; element ids inside are unchanged)
(function () {
  function modal() { return document.getElementById('ai-audio-modal'); }
  function openAiAudioModal() { const m = modal(); if (m) m.classList.remove('hidden'); }
  function closeAiAudioModal() { const m = modal(); if (m) m.classList.add('hidden'); }
  window.openAiAudioModal = openAiAudioModal;
  window.closeAiAudioModal = closeAiAudioModal;
  function init() {
    const openBtn = document.getElementById('menu-view-ai-audio-settings');
    if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); openAiAudioModal(); });
    const closeBtn = document.getElementById('ai-audio-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeAiAudioModal);
    const m = modal();
    if (m) m.addEventListener('click', (e) => { if (e.target === m) closeAiAudioModal(); });
    document.addEventListener('keydown', (e) => {
      const el = modal();
      if (e.key === 'Escape' && el && !el.classList.contains('hidden')) closeAiAudioModal();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
