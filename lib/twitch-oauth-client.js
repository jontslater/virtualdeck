const { TWITCH_OAUTH_SCOPES } = require('./twitch-oauth-scopes');

const TWITCH_DEVICE_URL = 'https://id.twitch.tv/oauth2/device';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';

function normalizeScopes(scopes) {
  const list = scopes || TWITCH_OAUTH_SCOPES;
  return Array.isArray(list) ? list : String(list).split(/\s+/).filter(Boolean);
}

function scopeString(scopes) {
  return normalizeScopes(scopes).join(' ');
}

async function requestDeviceCode(fetchFn, clientId, scopes) {
  const body = new URLSearchParams({
    client_id: clientId,
    scopes: scopeString(scopes),
  });
  const resp = await fetchFn(TWITCH_DEVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: data.message || data.error || String(resp.status), status: resp.status, data };
  }
  return { ok: true, data };
}

async function exchangeDeviceCode(fetchFn, clientId, deviceCode) {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
  const resp = await fetchFn(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = data.error || data.message || String(resp.status);
    return { ok: false, error: err, status: resp.status, data };
  }
  return { ok: true, data };
}

/**
 * Poll until authorized, expired, denied, or aborted.
 * @param {object} options - { intervalSec, expiresInSec, onSlowDown }
 */
async function pollDeviceCodeToken(fetchFn, clientId, deviceCode, options = {}) {
  const started = Date.now();
  let intervalMs = Math.max(1000, (options.intervalSec || 5) * 1000);
  const maxMs = (options.expiresInSec || 1800) * 1000;
  const signal = options.signal;

  while (Date.now() - started < maxMs) {
    if (signal && signal.aborted) {
      return { ok: false, error: 'aborted' };
    }
    const result = await exchangeDeviceCode(fetchFn, clientId, deviceCode);
    if (result.ok) {
      return result;
    }
    const err = result.error;
    if (err === 'authorization_pending') {
      await sleep(intervalMs, signal);
      continue;
    }
    if (err === 'slow_down') {
      intervalMs += 5000;
      if (options.onSlowDown) options.onSlowDown(intervalMs);
      await sleep(intervalMs, signal);
      continue;
    }
    if (err === 'access_denied' || err === 'expired_token') {
      return { ok: false, error: err, data: result.data };
    }
    return result;
  }
  return { ok: false, error: 'expired_token' };
}

async function refreshAccessTokenPublic(fetchFn, clientId, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const resp = await fetchFn(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: data.message || data.error || String(resp.status), status: resp.status, data };
  }
  return { ok: true, data };
}

function buildImplicitAuthorizeUrl(clientId, redirectUri, scopes, forceVerify) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: scopeString(scopes),
  });
  if (forceVerify) params.set('force_verify', 'true');
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

function parseImplicitCallbackUrl(callbackUrl) {
  try {
    const url = new URL(callbackUrl);
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    const params = hash ? new URLSearchParams(hash) : url.searchParams;
    const accessToken = params.get('access_token');
    const error = params.get('error') || params.get('error_description');
    if (error) return { ok: false, error };
    if (!accessToken) return { ok: false, error: 'missing_access_token' };
    return {
      ok: true,
      accessToken,
      scope: params.get('scope') || '',
      tokenType: params.get('token_type') || 'bearer',
    };
  } catch (e) {
    return { ok: false, error: e.message || 'invalid_callback_url' };
  }
}

async function fetchTwitchUserForToken(fetchFn, clientId, accessToken) {
  const token = String(accessToken || '').replace(/^oauth:/i, '').trim();
  const resp = await fetchFn(TWITCH_USERS_URL, {
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: data.message || String(resp.status) };
  }
  const user = data.data && data.data[0];
  if (!user) return { ok: false, error: 'no_user' };
  return { ok: true, user };
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      }, { once: true });
    }
  });
}

module.exports = {
  TWITCH_DEVICE_URL,
  TWITCH_TOKEN_URL,
  TWITCH_VALIDATE_URL,
  normalizeScopes,
  scopeString,
  requestDeviceCode,
  exchangeDeviceCode,
  pollDeviceCodeToken,
  refreshAccessTokenPublic,
  buildImplicitAuthorizeUrl,
  parseImplicitCallbackUrl,
  fetchTwitchUserForToken,
};
