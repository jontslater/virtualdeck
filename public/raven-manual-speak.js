/**
 * Manual TTS via Raven controller Dev API POST /api/dev/speak (shared by AI Audio + dashboard Quick Say).
 */
(function (global) {
  const lib = typeof require === 'function' ? require('../lib/raven-manual-speak') : null;
  const DEV_SPEAK_PATH = (lib && lib.DEV_SPEAK_PATH) || '/api/dev/speak';

  function isOverlayDevPort(url) {
    if (lib) return lib.isOverlayDevPort(url);
    return /:3002(\/|$)/.test(String(url || ''));
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs || 8000);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async function discoverDevApiBaseUrl() {
    try {
      const stored = localStorage.getItem('DEV_API_BASE_URL');
      if (isOverlayDevPort(stored)) {
        localStorage.removeItem('DEV_API_BASE_URL');
      }
    } catch (e) {
      // ignore
    }
    const stored = (() => {
      try {
        return localStorage.getItem('DEV_API_BASE_URL');
      } catch (e) {
        return null;
      }
    })();
    const candidates = lib ? lib.buildDevApiCandidates(stored) : ['http://localhost:3003', 'http://localhost:3013'];
    for (const base of candidates) {
      try {
        const r = await fetchWithTimeout(`${base}/api/dev/mode`, {}, 1200);
        if (r && (r.ok || r.status === 405)) {
          try {
            localStorage.setItem('DEV_API_BASE_URL', base);
          } catch (e) {
            // ignore
          }
          return base;
        }
      } catch (e) {
        // try next
      }
    }
    return 'http://localhost:3003';
  }

  function isAiDashboardOff() {
    const label = document.getElementById('ai-dashboard-toggle-label');
    return !!(label && String(label.textContent).trim().toUpperCase() === 'OFF');
  }

  async function isRavenSidecarRunning() {
    if (!global.electronAPI || typeof global.electronAPI.ravenIsRunning !== 'function') {
      return null;
    }
    try {
      const r = await global.electronAPI.ravenIsRunning();
      return !!(r && r.running);
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {string} text
   * @param {{ respectAiToggle?: boolean }} options
   */
  async function speakManualText(text, options) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return { ok: false, skipped: true };

    const respectToggle = !(options && options.respectAiToggle === false);
    if (respectToggle && isAiDashboardOff()) {
      return {
        ok: false,
        error:
          'AI System is OFF. Turn the dashboard toggle ON, or use Tools → Raven AI → Start Raven AI.',
      };
    }

    const running = await isRavenSidecarRunning();
    if (running === false) {
      return {
        ok: false,
        error: 'Raven is not running. Use Tools → Raven AI → Start Raven AI, then try Quick Say again.',
      };
    }

    try {
      if (global.electronAPI && typeof global.electronAPI.ravenDevSpeak === 'function') {
        const hostResult = await global.electronAPI.ravenDevSpeak({ text: trimmed });
        if (hostResult && hostResult.ok) return { ok: true, via: hostResult.via || 'host' };
        if (hostResult && hostResult.error) {
          return { ok: false, error: lib ? lib.formatSpeakNetworkError(hostResult.error) : hostResult.error };
        }
      }

      const devApiBaseUrl = await discoverDevApiBaseUrl();
      const res = await fetchWithTimeout(
        `${devApiBaseUrl}${DEV_SPEAK_PATH}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            mood: 'neutral',
            urgency: 'med',
            playbackTarget: 'host',
            dashboardPlayback: true,
          }),
        },
        10000,
      );
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        throw new Error(raw || `HTTP ${res.status}`);
      }
      return { ok: true };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const formatted = lib ? lib.formatSpeakNetworkError(raw) : raw;
      return { ok: false, error: formatted };
    }
  }

  function presentSpeakResult(result, options) {
    if (!result || result.skipped) return;
    if (result.ok) {
      if (options && options.onSuccess) options.onSuccess();
      else if (global.notificationManager) {
        global.notificationManager.show('Cashe will say it.', 'success');
      }
      return;
    }
    const msg = result.error || 'Speak failed';
    if (options && options.onError) options.onError(msg);
    else alert(msg);
  }

  global.vdRavenManualSpeak = {
    speakManualText,
    presentSpeakResult,
    discoverDevApiBaseUrl,
    isAiDashboardOff,
    isRavenSidecarRunning,
  };
})(window);
