/**
 * Raven AI ON/OFF (bridge /api/ai/enabled) + presenter mode (controller /api/ai/mode).
 */
(function (global) {
  const lib = global.__ravenAiControlLib || null;
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

  const fetchForLib = (url, opts) => fetchWithTimeout(url, opts, 2500);

  async function getAiEnabled(bridgeBase) {
    const base = normalizeBase(bridgeBase, getBridgeBaseUrl());
    if (lib && lib.probeBridgeEnabled) {
      return lib.probeBridgeEnabled(fetchForLib, base, 2500);
    }
    const url = `${base}/api/ai/enabled`;
    try {
      const response = await fetchWithTimeout(url, {}, 2500);
      if (lib && lib.isMissingBridgeEnabledRoute && lib.isMissingBridgeEnabledRoute(response.status)) {
        return { ok: true, enabled: true, legacyBridge: true, reachable: true, status: response.status, offline: false };
      }
      if (response.status === 404) {
        return { ok: true, enabled: true, legacyBridge: true, reachable: true, status: 404, offline: false };
      }
      const body = await response.json().catch(() => ({}));
      const parsed = lib ? lib.parseEnabledResponse(body) : { enabled: body.enabled };
      return { ok: response.ok, enabled: parsed.enabled, raw: body, offline: false, reachable: true, status: response.status };
    } catch (err) {
      if (isNetworkUnreachableError(err)) {
        return { ok: false, enabled: null, offline: true, reachable: false };
      }
      throw err;
    }
  }

  async function resolveDashboardAiEnabled(bridgeBase, controllerBase) {
    const bridgeBaseUrl = bridgeBase || getBridgeBaseUrl();
    const controllerBaseUrl = controllerBase || getControllerBaseUrl();
    if (lib && lib.resolveDashboardAiEnabled) {
      return lib.resolveDashboardAiEnabled(fetchForLib, bridgeBaseUrl, controllerBaseUrl);
    }
    const conn = await checkDashboardConnection(bridgeBaseUrl, controllerBaseUrl);
    return {
      ok: !!conn.connected,
      enabled: conn.connected ? true : null,
      source: conn.source,
    };
  }

  async function checkDashboardConnection(bridgeBase, controllerBase) {
    const bridgeBaseUrl = bridgeBase || getBridgeBaseUrl();
    const controllerBaseUrl = controllerBase || getControllerBaseUrl();
    if (lib && lib.checkDashboardConnection) {
      return lib.checkDashboardConnection(fetchForLib, bridgeBaseUrl, controllerBaseUrl);
    }
    const bridge = await getAiEnabled(bridgeBaseUrl);
    if (bridge.reachable && bridge.ok) {
      return {
        connected: true,
        source: bridge.legacyBridge ? 'bridge-legacy' : 'bridge-enabled',
        bridge,
      };
    }
    return { connected: false, source: 'offline', bridge };
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
      if (lib && lib.isMissingBridgeEnabledRoute && lib.isMissingBridgeEnabledRoute(response.status)) {
        return { ok: true, offline: false, legacyBridge: true, status: response.status };
      }
      if (response.status === 404) {
        return { ok: true, offline: false, legacyBridge: true, status: 404 };
      }
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, offline: false, body, status: response.status };
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
    if (!bridgeResult.ok && !bridgeResult.offline && !bridgeResult.legacyBridge) {
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
    resolveDashboardAiEnabled,
    checkDashboardConnection,
    postAiEnabled,
    postPresenterMode,
    setAiSystemEnabled,
    presenterModeFromSelect,
    isNetworkUnreachableError,
  };
})(window);
