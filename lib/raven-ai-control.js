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
};
