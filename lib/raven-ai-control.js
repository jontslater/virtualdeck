/**
 * Raven bridge / controller AI enabled + mode helpers (shared with tests).
 */
const DEFAULT_BRIDGE_BASE = 'http://localhost:3000';
const DEFAULT_CONTROLLER_BASE = 'http://localhost:3004';

function normalizeBase(url, fallback) {
  const s = String(url || fallback || '').trim().replace(/\/+$/, '');
  return s || fallback;
}

function isNetworkUnreachableError(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return true;
  }
  if (err.name === 'AbortError') return false;
  return false;
}

function isMissingBridgeEnabledRoute(status) {
  return status === 404 || status === 405 || status === 501;
}

function enabledEndpoint(base) {
  return `${normalizeBase(base, DEFAULT_BRIDGE_BASE)}/api/ai/enabled`;
}

function modeEndpoint(base) {
  return `${normalizeBase(base, DEFAULT_CONTROLLER_BASE)}/api/ai/mode`;
}

/** Dashboard presenter modes (AITuber controller). */
const PRESENTER_MODES = {
  copilot: 'COPILOT',
  onstream: 'CHAT',
};

function presenterModeFromValue(value) {
  const raw = String(value || '').trim();
  const v = raw.toLowerCase();
  const upper = raw.toUpperCase();
  if (v === 'copilot' || upper === PRESENTER_MODES.copilot) return PRESENTER_MODES.copilot;
  if (
    v === 'onstream' ||
    v === 'on-stream' ||
    v === 'chat' ||
    upper === PRESENTER_MODES.onstream ||
    upper === 'JUST_CHATTING'
  ) {
    return PRESENTER_MODES.onstream;
  }
  return PRESENTER_MODES.copilot;
}

function parseEnabledResponse(body) {
  if (!body || typeof body !== 'object') return { enabled: null };
  if (typeof body.enabled === 'boolean') return { enabled: body.enabled };
  if (body.enabled === 'true') return { enabled: true };
  if (body.enabled === 'false') return { enabled: false };
  return { enabled: null };
}

function enabledFromControllerPayload(body) {
  if (!body || typeof body !== 'object') return { enabled: true, mode: null };
  const mode = body.mode || body.currentMode || body.aiMode || null;
  if (mode === 'MUTED' || mode === 'OFF') return { enabled: false, mode };
  if (typeof body.enabled === 'boolean') return { enabled: body.enabled, mode };
  if (body.enabled === 'false') return { enabled: false, mode };
  return { enabled: true, mode };
}

function statusEndpoint(base) {
  return `${normalizeBase(base, DEFAULT_CONTROLLER_BASE)}/api/ai/status`;
}

function httpResponseReachable(response) {
  return response && typeof response.status === 'number' && response.status >= 100 && response.status < 600;
}

/**
 * Bridge GET /api/ai/enabled — missing route (404) = legacy bridge, not an error.
 */
async function probeBridgeEnabled(fetchFn, bridgeBase, timeoutMs) {
  const url = enabledEndpoint(bridgeBase);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = controller && setTimeout(() => controller.abort(), timeoutMs || 2500);
  try {
    const response = await fetchFn(url, controller ? { signal: controller.signal } : {});
    if (isMissingBridgeEnabledRoute(response.status)) {
      return {
        reachable: true,
        ok: true,
        enabled: true,
        legacyBridge: true,
        missingRoute: true,
        status: response.status,
      };
    }
    const body = await response.json().catch(() => ({}));
    const parsed = parseEnabledResponse(body);
    return {
      reachable: httpResponseReachable(response),
      ok: response.ok,
      enabled: response.ok ? parsed.enabled : null,
      legacyBridge: false,
      missingRoute: false,
      status: response.status,
    };
  } catch (err) {
    if (isNetworkUnreachableError(err)) {
      return { reachable: false, ok: false, enabled: null, offline: true };
    }
    throw err;
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Controller reachability — prefer /api/ai/status (source of truth when bridge has no /enabled).
 */
async function probeControllerStatus(fetchFn, controllerBase, timeoutMs) {
  const base = normalizeBase(controllerBase, DEFAULT_CONTROLLER_BASE);
  const paths = ['/api/ai/status', '/api/status', '/health'];
  for (const p of paths) {
    const url = `${base}${p}`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = controller && setTimeout(() => controller.abort(), timeoutMs || 2500);
    try {
      const response = await fetchFn(url, controller ? { signal: controller.signal } : {});
      if (httpResponseReachable(response)) {
        return { reachable: true, ok: response.ok, status: response.status, path: p };
      }
    } catch (err) {
      if (!isNetworkUnreachableError(err)) throw err;
    } finally {
      if (t) clearTimeout(t);
    }
  }
  return { reachable: false, ok: false };
}

async function probeControllerAiStatus(fetchFn, controllerBase, timeoutMs) {
  const base = normalizeBase(controllerBase, DEFAULT_CONTROLLER_BASE);
  const url = `${base}/api/ai/status`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = controller && setTimeout(() => controller.abort(), timeoutMs || 2500);
  try {
    const response = await fetchFn(url, controller ? { signal: controller.signal } : {});
    if (!httpResponseReachable(response)) {
      return { reachable: false, ok: false, enabled: null };
    }
    const body = await response.json().catch(() => ({}));
    const parsed = enabledFromControllerPayload(body);
    return {
      reachable: true,
      ok: response.ok,
      status: response.status,
      enabled: response.ok ? parsed.enabled : true,
      mode: parsed.mode,
      body,
    };
  } catch (err) {
    if (isNetworkUnreachableError(err)) {
      return { reachable: false, ok: false, enabled: null, offline: true };
    }
    throw err;
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Dashboard "connected" — controller /api/ai/status first, then bridge (legacy /enabled).
 */
async function checkDashboardConnection(fetchFn, bridgeBase, controllerBase) {
  const controller = await probeControllerStatus(fetchFn, controllerBase);
  if (controller.reachable) {
    return { connected: true, source: 'controller', controller };
  }
  const bridge = await probeBridgeEnabled(fetchFn, bridgeBase);
  if (bridge.reachable && (bridge.ok || bridge.legacyBridge || bridge.missingRoute)) {
    return {
      connected: true,
      source: bridge.legacyBridge || bridge.missingRoute ? 'bridge-legacy' : 'bridge-enabled',
      bridge,
      controller,
    };
  }
  if (bridge.offline && !controller.reachable) {
    return { connected: false, source: 'offline', bridge, controller };
  }
  return { connected: false, source: 'unreachable', bridge, controller };
}

/**
 * AI ON/OFF for dashboard — use bridge /enabled only when present; else controller status.
 */
async function resolveDashboardAiEnabled(fetchFn, bridgeBase, controllerBase) {
  const controller = await probeControllerAiStatus(fetchFn, controllerBase);
  if (controller.reachable) {
    return {
      ok: true,
      enabled: controller.enabled !== false,
      source: 'controller',
      mode: controller.mode,
      controller,
    };
  }
  const bridge = await probeBridgeEnabled(fetchFn, bridgeBase);
  if (bridge.legacyBridge || bridge.missingRoute) {
    return {
      ok: true,
      enabled: true,
      source: 'bridge-legacy',
      bridge,
    };
  }
  if (bridge.ok && typeof bridge.enabled === 'boolean') {
    return { ok: true, enabled: bridge.enabled, source: 'bridge-enabled', bridge };
  }
  if (bridge.offline) {
    return { ok: false, enabled: null, offline: true, source: 'offline', bridge };
  }
  return { ok: false, enabled: null, source: 'unreachable', bridge };
}

module.exports = {
  DEFAULT_BRIDGE_BASE,
  DEFAULT_CONTROLLER_BASE,
  normalizeBase,
  isNetworkUnreachableError,
  isMissingBridgeEnabledRoute,
  enabledEndpoint,
  modeEndpoint,
  PRESENTER_MODES,
  presenterModeFromValue,
  parseEnabledResponse,
  enabledFromControllerPayload,
  statusEndpoint,
  probeBridgeEnabled,
  probeControllerStatus,
  probeControllerAiStatus,
  checkDashboardConnection,
  resolveDashboardAiEnabled,
};
