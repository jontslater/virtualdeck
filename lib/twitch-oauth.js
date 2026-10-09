const path = require('path');
const { TWITCH_OAUTH_SCOPES } = require('./twitch-oauth-scopes');

function loadTwitchOAuthConfig() {
  try {
    // Optional local dev file (gitignored)
    return require(path.join(__dirname, '..', 'twitch-oauth-config'));
  } catch {
    return null;
  }
}

function buildTwitchAuthorizeUrl(options = {}) {
  const config = options.config || loadTwitchOAuthConfig();
  if (!config || !config.clientId || config.clientId === 'YOUR_TWITCH_CLIENT_ID') {
    return null;
  }
  const redirectUri = options.redirectUri || config.redirectUri;
  if (!redirectUri) return null;

  const scopes = options.scopes || TWITCH_OAUTH_SCOPES;
  const scopeStr = scopes.join(' ');
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopeStr,
  });
  if (options.forceVerify) {
    params.set('force_verify', 'true');
  }
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

async function validateTwitchAccessToken(fetchFn, accessToken) {
  const token = String(accessToken || '').replace(/^oauth:/i, '').trim();
  if (!token) {
    return { ok: false, error: 'missing_token' };
  }
  const resp = await fetchFn('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: data.message || String(resp.status), status: resp.status };
  }
  const scopes = typeof data.scopes === 'string'
    ? data.scopes.split(/\s+/).filter(Boolean)
    : Array.isArray(data.scopes) ? data.scopes : [];
  return {
    ok: true,
    clientId: data.client_id,
    login: data.login,
    userId: data.user_id,
    scopes,
    expiresIn: data.expires_in,
  };
}

module.exports = {
  loadTwitchOAuthConfig,
  buildTwitchAuthorizeUrl,
  validateTwitchAccessToken,
};
