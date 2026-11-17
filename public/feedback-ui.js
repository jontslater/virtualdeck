/**
 * In-app feedback prompt + Help / Preferences entry points.
 */
(function () {
  const RATINGS = [
    { id: 'great', label: 'Great' },
    { id: 'good', label: 'Good' },
    { id: 'okay', label: 'Okay' },
    { id: 'rough', label: 'Not great' },
  ];

  const IDEAS = [
    { id: 'overlays', label: 'Better overlays & alerts' },
    { id: 'twitch', label: 'More Twitch tools' },
    { id: 'macros', label: 'Macros & automation' },
    { id: 'ai', label: 'AI assistant' },
    { id: 'themes', label: 'Themes & skins' },
    { id: 'performance', label: 'Performance & stability' },
    { id: 'other', label: 'Something else' },
  ];

  let openSource = 'menu';
  let promptTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function api(method) {
    return window.electronAPI && typeof window.electronAPI[method] === 'function'
      ? window.electronAPI[method].bind(window.electronAPI)
      : null;
  }

  function setStatus(message, isError) {
    const el = $('feedback-form-status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('feedback-form-status-error', !!isError);
  }

  function resetForm() {
    RATINGS.forEach((r) => {
      const input = $('feedback-rating-' + r.id);
      if (input) input.checked = false;
    });
    if ($('feedback-rating-comment')) $('feedback-rating-comment').value = '';
    if ($('feedback-feature-text')) $('feedback-feature-text').value = '';
    if ($('feedback-email')) $('feedback-email').value = '';
    if ($('feedback-honeypot')) $('feedback-honeypot').value = '';
    IDEAS.forEach((idea) => {
      const box = $('feedback-idea-' + idea.id);
      if (box) box.checked = false;
    });
    setStatus('', false);
  }

  function setPromptActionsVisible(show) {
    const row = $('feedback-prompt-actions');
    if (row) row.classList.toggle('hidden', !show);
  }

  function closeFeedbackModal() {
    const modal = $('feedback-modal');
    if (modal) modal.classList.add('hidden');
    resetForm();
    openSource = 'menu';
  }

  function openFeedbackModal(source) {
    openSource = source === 'prompt' ? 'prompt' : 'menu';
    setPromptActionsVisible(openSource === 'prompt');
    resetForm();
    const modal = $('feedback-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const first = $('feedback-rating-great');
      if (first) first.focus();
    }
    const patch = openSource === 'prompt' ? { lastPromptShownAt: new Date().toISOString() } : {};
    const patchState = api('feedbackPatchState');
    if (patchState) void patchState(patch);
  }

  window.openFeedbackModal = openFeedbackModal;
  window.closeFeedbackModal = closeFeedbackModal;

  async function submitFeedback() {
    const rating = RATINGS.map((r) => r.id).find((id) => {
      const input = $('feedback-rating-' + id);
      return input && input.checked;
    });
    const featureIdeas = IDEAS.filter((idea) => {
      const box = $('feedback-idea-' + idea.id);
      return box && box.checked;
    }).map((idea) => idea.id);
    const payload = {
      rating: rating || '',
      ratingComment: ($('feedback-rating-comment') && $('feedback-rating-comment').value) || '',
      featureIdeas,
      featureText: ($('feedback-feature-text') && $('feedback-feature-text').value) || '',
      email: ($('feedback-email') && $('feedback-email').value) || '',
      source: openSource,
      honeypot: ($('feedback-honeypot') && $('feedback-honeypot').value) || '',
    };
    const submit = api('feedbackSubmit');
    if (!submit) {
      setStatus('Feedback is only available in the desktop app.', true);
      return;
    }
    setStatus('Sending…', false);
    const submitBtn = $('feedback-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const result = await submit(payload);
      if (result && result.ok) {
        setStatus('Thanks — your feedback was sent.', false);
        const patchState = api('feedbackPatchState');
        if (patchState) {
          await patchState({
            promptStatus: 'completed',
            lastSubmittedAt: new Date().toISOString(),
          });
        }
        setTimeout(() => closeFeedbackModal(), 1200);
      } else {
        setStatus((result && result.error) || 'Could not send feedback. Try again later.', true);
      }
    } catch (err) {
      setStatus((err && err.message) || 'Could not send feedback.', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function snoozePrompt() {
    const patchState = api('feedbackPatchState');
    if (patchState) {
      await patchState({
        promptStatus: 'snoozed',
        snoozedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    closeFeedbackModal();
  }

  async function dismissForever() {
    const patchState = api('feedbackPatchState');
    if (patchState) {
      await patchState({ promptStatus: 'never' });
    }
    closeFeedbackModal();
  }

  function scheduleAutoPrompt() {
    const getState = api('feedbackGetState');
    if (!getState) return;
    void getState().then((data) => {
      if (!data || !data.shouldPrompt) return;
      if (promptTimer) clearTimeout(promptTimer);
      const delay = typeof data.promptDelayMs === 'number' ? data.promptDelayMs : 8000;
      promptTimer = setTimeout(() => {
        openFeedbackModal('prompt');
      }, delay);
    });
  }

  function bindUi() {
    const closeBtn = $('feedback-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeFeedbackModal);
    const cancelBtn = $('feedback-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeFeedbackModal);
    const submitBtn = $('feedback-submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', () => void submitFeedback());
    const snoozeBtn = $('feedback-snooze-btn');
    if (snoozeBtn) snoozeBtn.addEventListener('click', () => void snoozePrompt());
    const neverBtn = $('feedback-never-btn');
    if (neverBtn) neverBtn.addEventListener('click', () => void dismissForever());

    const modal = $('feedback-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFeedbackModal();
      });
    }

    const helpBtn = $('menu-help-feedback');
    if (helpBtn) {
      helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openFeedbackModal('menu');
        const helpDropdown = $('menu-help-dropdown');
        const helpMenuBtn = $('menu-help-btn');
        if (helpDropdown) helpDropdown.classList.add('hidden');
        if (helpMenuBtn) helpMenuBtn.setAttribute('aria-expanded', 'false');
      });
    }

    const prefBtn = $('preferences-feedback-btn');
    if (prefBtn) {
      prefBtn.addEventListener('click', () => {
        if (typeof closePreferencesModal === 'function') closePreferencesModal();
        openFeedbackModal('menu');
      });
    }

    const readyCb = api('onRendererReady');
    if (readyCb) {
      readyCb(() => scheduleAutoPrompt());
    } else {
      document.addEventListener('DOMContentLoaded', () => scheduleAutoPrompt());
    }

    const onOpenFeedback = api('onOpenFeedbackModal');
    if (onOpenFeedback) onOpenFeedback(() => openFeedbackModal('menu'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi);
  } else {
    bindUi();
  }
})();
