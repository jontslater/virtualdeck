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

function statusEndpoint(base) {
  return `${normalizeBase(base, DEFAULT_CONTROLLER_BASE)}/api/ai/status`;
}

/**
 * Bridge GET /api/ai/enabled — 404 means legacy bridge without route but process is up.
 */
async function probeBridgeEnabled(fetchFn, bridgeBase, timeoutMs) {
  const url = enabledEndpoint(bridgeBase);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = controller && setTimeout(() => controller.abort(), timeoutMs || 2500);
  try {
    const response = await fetchFn(url, controller ? { signal: controller.signal } : {});
    if (response.status === 404) {
      return { reachable: true, ok: true, enabled: true, legacyBridge: true, status: 404 };
    }
    const body = await response.json().catch(() => ({}));
    const parsed = parseEnabledResponse(body);
    return {
      reachable: true,
      ok: response.ok,
      enabled: response.ok ? parsed.enabled : null,
      legacyBridge: false,
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

async function probeControllerStatus(fetchFn, controllerBase, timeoutMs) {
  const base = normalizeBase(controllerBase, DEFAULT_CONTROLLER_BASE);
  const paths = ['/api/ai/status', '/api/status', '/health'];
  for (const p of paths) {
    const url = `${base}${p}`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = controller && setTimeout(() => controller.abort(), timeoutMs || 2500);
    try {
      const response = await fetchFn(url, controller ? { signal: controller.signal } : {});
      if (response.ok || response.status === 404) {
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

/**
 * Dashboard "connected" = bridge or controller answers (not stuck on missing /api/ai/enabled).
 */
async function checkDashboardConnection(fetchFn, bridgeBase, controllerBase) {
  const bridge = await probeBridgeEnabled(fetchFn, bridgeBase);
  if (bridge.reachable && bridge.ok) {
    return { connected: true, source: bridge.legacyBridge ? 'bridge-legacy' : 'bridge-enabled', bridge };
  }
  const controller = await probeControllerStatus(fetchFn, controllerBase);
  if (controller.reachable) {
    return { connected: true, source: 'controller', controller };
  }
  if (bridge.offline && !controller.reachable) {
    return { connected: false, source: 'offline', bridge, controller };
  }
  return { connected: false, source: 'unreachable', bridge, controller };
}

module.exports = {
  DEFAULT_BRIDGE_BASE,
  DEFAULT_CONTROLLER_BASE,
  normalizeBase,
  isNetworkUnreachableError,
  enabledEndpoint,
  modeEndpoint,
  PRESENTER_MODES,
  presenterModeFromValue,
  parseEnabledResponse,
  statusEndpoint,
  probeBridgeEnabled,
  probeControllerStatus,
  checkDashboardConnection,
};
