/**
 * In-app "What's new" modal — version-gated auto prompt + Help menu entry.
 */
(function () {
  let promptTimer = null;
  let deferTimer = null;
  let focusTrapHandler = null;
  let openSource = 'menu';
  let pendingAutoVersion = null;

  function $(id) {
    return document.getElementById(id);
  }

  function api(method) {
    return window.electronAPI && typeof window.electronAPI[method] === 'function'
      ? window.electronAPI[method].bind(window.electronAPI)
      : null;
  }

  function isAlertOrOverlayActive() {
    if (window.alertQueue) {
      const status = window.alertQueue.getStatus();
      if (status && (status.isProcessing || status.queueLength > 0 || status.currentAlert)) {
        return true;
      }
    }
    const alertWidget = $('twitch-alert-widget');
    if (alertWidget && !alertWidget.classList.contains('hidden')) return true;
    const overlayWidget = $('overlay-widget');
    if (overlayWidget && !overlayWidget.classList.contains('hidden')) return true;
    return false;
  }

  async function getDeferContext() {
    const isLiveFn = api('isStreamLive');
    let isStreamLive = false;
    if (isLiveFn) {
      try {
        isStreamLive = !!(await isLiveFn());
      } catch (e) {
        isStreamLive = false;
      }
    }
    return {
      isStreamLive,
      alertActive: isAlertOrOverlayActive(),
      overlayPreviewActive: false,
    };
  }

  function resolveImageSrc(imagePath) {
    if (!imagePath) return null;
    const clean = String(imagePath).replace(/^public\//, '');
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) return clean;
    try {
      return new URL(clean, window.location.href).href;
    } catch (e) {
      return clean;
    }
  }

  function renderRelease(release) {
    const title = $('whats-new-modal-title');
    const intro = $('whats-new-intro');
    const list = $('whats-new-feature-list');
    if (!release || !list) return;
    const version = release.version || '';
    if (title) title.textContent = version ? `What's new in ${version}` : "What's new";
    if (intro) {
      intro.textContent = release.intro || release.headline || '';
      intro.classList.toggle('hidden', !intro.textContent);
    }
    list.innerHTML = '';
    const features = Array.isArray(release.features) ? release.features.slice(0, 3) : [];
    for (const feat of features) {
      const card = document.createElement('article');
      card.className = 'whats-new-feature';
      card.setAttribute('role', 'listitem');

      const imgSrc = resolveImageSrc(feat.image);
      if (imgSrc) {
        const fig = document.createElement('div');
        fig.className = 'whats-new-feature-media';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = feat.imageAlt || feat.title || '';
        img.loading = 'lazy';
        fig.appendChild(img);
        card.appendChild(fig);
      }

      const body = document.createElement('div');
      body.className = 'whats-new-feature-body';
      const h3 = document.createElement('h3');
      h3.textContent = feat.title || '';
      body.appendChild(h3);
      const p = document.createElement('p');
      p.textContent = feat.body || '';
      body.appendChild(p);

      if (feat.tryAction) {
        const tryBtn = document.createElement('button');
        tryBtn.type = 'button';
        tryBtn.className = 'preference-button whats-new-try-btn';
        tryBtn.textContent = feat.tryLabel || 'Try it';
        tryBtn.addEventListener('click', () => runTryAction(feat));
        body.appendChild(tryBtn);
      }

      card.appendChild(body);
      list.appendChild(card);
    }
  }

  function runTryAction(feat) {
    if (!feat || !feat.tryAction) return;
    const action = feat.tryAction;
    const payload = feat.tryPayload || {};
    closeWhatsNewModal(false);
    if (action === 'hydration-panel') {
      if (window.vdHydrationPanel && typeof window.vdHydrationPanel.openPanel === 'function') {
        window.vdHydrationPanel.openPanel();
        return;
      }
    }
    if (action === 'apply-theme') {
      const themeId = payload.themeId || 'thanksgiving';
      const applyTheme = api('applyTheme');
      if (applyTheme) {
        applyTheme(themeId);
        return;
      }
    }
    if (action === 'watch-streak-alerts') {
      if (typeof window.openWatchStreakAlertWidget === 'function') {
        window.openWatchStreakAlertWidget();
        return;
      }
      if (typeof window.openWatchStreakModal === 'function') {
        window.openWatchStreakModal();
        return;
      }
      const openIpc = api('openWatchStreakAlerts');
      if (openIpc) {
        void openIpc();
        return;
      }
    }
    if (typeof showCustomAlert === 'function') {
      showCustomAlert('This feature opens from the Tools menu once it is available in your build.', 'info');
    }
  }

  function installFocusTrap(modal) {
    removeFocusTrap();
    const dialog = modal && modal.querySelector('.whats-new-modal-content');
    if (!dialog) return;
    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    focusTrapHandler = (e) => {
      if (e.key !== 'Tab' || modal.classList.contains('hidden')) return;
      const nodes = Array.from(dialog.querySelectorAll(selector)).filter(
        (el) => !el.disabled && el.offsetParent !== null,
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', focusTrapHandler);
  }

  function removeFocusTrap() {
    if (focusTrapHandler) {
      document.removeEventListener('keydown', focusTrapHandler);
      focusTrapHandler = null;
    }
  }

  function closeWhatsNewModal(markSeen) {
    const modal = $('whats-new-modal');
    if (modal) modal.classList.add('hidden');
    removeFocusTrap();
    const disable = api('disableHotkeys');
    const enable = api('enableHotkeys');
    if (enable) enable();
    if (markSeen !== false && openSource === 'prompt') {
      const markSeenFn = api('whatsNewMarkSeen');
      if (markSeenFn) void markSeenFn();
    }
    openSource = 'menu';
    pendingAutoVersion = null;
    if (deferTimer) {
      clearTimeout(deferTimer);
      deferTimer = null;
    }
  }

  window.closeWhatsNewModal = closeWhatsNewModal;

  async function openWhatsNewModal(source, release) {
    openSource = source === 'prompt' ? 'prompt' : 'menu';
    const modal = $('whats-new-modal');
    if (!modal) return;
    if (release) renderRelease(release);
    modal.classList.remove('hidden');
    const disable = api('disableHotkeys');
    if (disable) disable();
    installFocusTrap(modal);
    const gotIt = $('whats-new-got-it');
    if (gotIt) gotIt.focus();
  }

  window.openWhatsNewModal = openWhatsNewModal;

  async function scheduleDeferredPrompt(release, delayMs) {
    if (deferTimer) clearTimeout(deferTimer);
    const delay = typeof delayMs === 'number' ? delayMs : 45000;
    deferTimer = setTimeout(() => {
      void tryAutoPrompt(release);
    }, delay);
  }

  async function tryAutoPrompt(release) {
    const getPrompt = api('whatsNewGetPrompt');
    if (!getPrompt) return;
    const data = await getPrompt();
    if (!data || !data.shouldPrompt) return;
    const ctx = await getDeferContext();
    const shouldDeferFn = api('whatsNewShouldDefer');
    let defer = !!(ctx.isStreamLive || ctx.alertActive);
    if (shouldDeferFn) {
      try {
        defer = !!(await shouldDeferFn(ctx));
      } catch (e) {
        defer = !!(ctx.isStreamLive || ctx.alertActive);
      }
    }
    if (defer) {
      scheduleDeferredPrompt(release, data.deferPollMs);
      return;
    }
    openWhatsNewModal('prompt', release || data.release);
  }

  function scheduleAutoPrompt() {
    const getPrompt = api('whatsNewGetPrompt');
    if (!getPrompt) return;
    void getPrompt().then((data) => {
      if (!data || !data.shouldPrompt || !data.release) return;
      if (promptTimer) clearTimeout(promptTimer);
      const delay = typeof data.promptDelayMs === 'number' ? data.promptDelayMs : 6000;
      pendingAutoVersion = data.appVersion;
      promptTimer = setTimeout(() => {
        void tryAutoPrompt(data.release);
      }, delay);
    });
  }

  function bindUi() {
    $('whats-new-modal-close')?.addEventListener('click', () => closeWhatsNewModal());
    $('whats-new-got-it')?.addEventListener('click', () => closeWhatsNewModal());
    $('whats-new-all-updates')?.addEventListener('click', () => {
      const openNotes = api('whatsNewOpenPatchNotes');
      if (openNotes) void openNotes();
    });

    const modal = $('whats-new-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeWhatsNewModal();
      });
    }

    $('menu-help-whats-new')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const getRelease = api('whatsNewGetRelease');
      if (getRelease) {
        void getRelease().then((data) => {
          if (data && data.release) openWhatsNewModal('menu', data.release);
        });
      }
      const helpDropdown = $('menu-help-dropdown');
      const helpMenuBtn = $('menu-help-btn');
      if (helpDropdown) helpDropdown.classList.add('hidden');
      if (helpMenuBtn) helpMenuBtn.setAttribute('aria-expanded', 'false');
    });

    const onOpen = api('onOpenWhatsNewModal');
    if (onOpen) {
      onOpen(() => {
        const getRelease = api('whatsNewGetRelease');
        if (getRelease) {
          void getRelease().then((data) => {
            if (data && data.release) openWhatsNewModal('menu', data.release);
          });
        }
      });
    }

    $('preferences-whats-new-btn')?.addEventListener('click', () => {
      if (typeof closePreferencesModal === 'function') closePreferencesModal();
      const getRelease = api('whatsNewGetRelease');
      if (getRelease) {
        void getRelease().then((data) => {
          if (data && data.release) openWhatsNewModal('menu', data.release);
        });
      }
    });

    const readyCb = api('onRendererReady');
    if (readyCb) {
      readyCb(() => scheduleAutoPrompt());
    } else {
      document.addEventListener('DOMContentLoaded', () => scheduleAutoPrompt());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi);
  } else {
    bindUi();
  }
})();