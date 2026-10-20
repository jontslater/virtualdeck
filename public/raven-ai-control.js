/**
 * Raven AI ON/OFF (bridge /api/ai/enabled) + presenter mode (controller /api/ai/mode).
 */
(function (global) {
  const lib = typeof require === 'function' ? require('../lib/raven-ai-control') : null;
  const DEFAULT_BRIDGE_BASE = (lib && lib.DEFAULT_BRIDGE_BASE) || 'http://localhost:3000';
  const DEFAULT_CONTROLLER_BASE = (lib && lib.DEFAULT_CONTROLLER_BASE) || 'http://localhost:3004';

  function normalizeBase(url, fallback) {
    if (lib) return lib.normalizeBase(url, fallback);
    const s = String(url || fallback || '').trim().replace(/\/+$/, '');
    return s || fallback;
  }

  function getBridgeBaseUrl() {
    try {
      const fromStorage = localStorage.getItem('VIRTUALDECK_HTTP_URL') || localStorage.getItem('RAVEN_BRIDGE_BASE_URL');
      if (fromStorage) return normalizeBase(fromStorage, DEFAULT_BRIDGE_BASE);
    } catch (e) {
      // ignore
    }
    return DEFAULT_BRIDGE_BASE;
  }

  function getControllerBaseUrl() {
    try {
      const fromStorage = localStorage.getItem('AI_STATUS_API_BASE_URL');
      if (fromStorage) return normalizeBase(fromStorage, DEFAULT_CONTROLLER_BASE);
    } catch (e) {
      // ignore
    }
    return DEFAULT_CONTROLLER_BASE;
  }

  function isNetworkUnreachableError(err) {
    if (lib) return lib.isNetworkUnreachableError(err);
    const msg = String(err && err.message ? err.message : err).toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed');
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs || 4000);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async function getAiEnabled(bridgeBase) {
    const base = normalizeBase(bridgeBase, getBridgeBaseUrl());
    const url = `${base}/api/ai/enabled`;
    try {
      const response = await fetchWithTimeout(url, {}, 2500);
      const body = await response.json().catch(() => ({}));
      const parsed = lib ? lib.parseEnabledResponse(body) : { enabled: body.enabled };
      return { ok: response.ok, enabled: parsed.enabled, raw: body, offline: false };
    } catch (err) {
      if (isNetworkUnreachableError(err)) {
        return { ok: false, enabled: null, offline: true };
      }
      throw err;
    }
  }

  async function postAiEnabled(enabled, bridgeBase) {
    const base = normalizeBase(bridgeBase, getBridgeBaseUrl());
    const url = `${base}/api/ai/enabled`;
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !!enabled }),
        },
        5000,
      );
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, offline: false, body };
    } catch (err) {
      if (isNetworkUnreachableError(err)) {
        return { ok: false, offline: true, error: err };
      }
      throw err;
    }
  }

  async function postPresenterMode(mode, controllerBase) {
    const base = normalizeBase(controllerBase, getControllerBaseUrl());
    const url = `${base}/api/ai/mode`;
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      },
      5000,
    );
    if (!response.ok) {
      throw new Error(`Failed to set AI mode (${response.status})`);
    }
    return await response.json().catch(() => ({}));
  }

  function presenterModeFromSelect(value) {
    if (lib) return lib.presenterModeFromValue(value);
    return String(value) === 'onstream' ? 'CHAT' : 'COPILOT';
  }

  /**
   * Turn Raven AI fully on or off (bridge enabled API + local sidecar via main process).
   */
  async function setAiSystemEnabled(enabled, options) {
    const presenter = options && options.presenterMode;
    const api = global.electronAPI || {};

    if (!enabled) {
      const bridgeResult = await postAiEnabled(false);
      if (typeof api.ravenStop === 'function') {
        await api.ravenStop();
      }
      return { enabled: false, bridge: bridgeResult, treatedAsOff: bridgeResult.offline || bridgeResult.ok };
    }

    if (typeof api.ravenStart === 'function') {
      await api.ravenStart();
    }
    let bridgeResult = await postAiEnabled(true);
    if (!bridgeResult.ok && !bridgeResult.offline) {
      await new Promise((r) => setTimeout(r, 1500));
      bridgeResult = await postAiEnabled(true);
    }
    if (presenter) {
      try {
        await postPresenterMode(presenter);
      } catch (err) {
        if (!isNetworkUnreachableError(err)) throw err;
      }
    }
    return { enabled: true, bridge: bridgeResult };
  }

  global.vdRavenAiControl = {
    getBridgeBaseUrl,
    getControllerBaseUrl,
    getAiEnabled,
    postAiEnabled,
    postPresenterMode,
    setAiSystemEnabled,
    presenterModeFromSelect,
    isNetworkUnreachableError,
  };
})(window);
