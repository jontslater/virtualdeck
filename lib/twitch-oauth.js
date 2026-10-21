const path = require('path');
const { TWITCH_OAUTH_SCOPES } = require('./twitch-oauth-scopes');

/** Public VirtualDeck Twitch app (override with TWITCH_CLIENT_ID). */
const DEFAULT_TWITCH_CLIENT_ID = '6xnmuyhhtmfpqugw2cn9j5njh770ct';

function loadTwitchOAuthConfig() {
  try {
    // Optional local dev file (gitignored)
    return require(path.join(__dirname, '..', 'twitch-oauth-config'));
  } catch {
    return null;
  }
}

function getTwitchOAuthClientId() {
  const fromEnv = process.env.TWITCH_CLIENT_ID ? String(process.env.TWITCH_CLIENT_ID).trim() : '';
  if (fromEnv) return fromEnv;
  const config = loadTwitchOAuthConfig();
  const fromConfig = config && config.clientId && config.clientId !== 'YOUR_TWITCH_CLIENT_ID'
    ? String(config.clientId).trim()
    : '';
  if (fromConfig) return fromConfig;
  return DEFAULT_TWITCH_CLIENT_ID;
}

function getTwitchOAuthRedirectUri() {
  const config = loadTwitchOAuthConfig();
  if (config && config.redirectUri) return config.redirectUri;
  if (process.env.TWITCH_REDIRECT_URI) return process.env.TWITCH_REDIRECT_URI;
  return 'http://localhost:17563/oauth/callback';
}

function buildTwitchAuthorizeUrl(options = {}) {
  const clientId = options.clientId || getTwitchOAuthClientId();
  if (!clientId) {
    return null;
  }
  const config = options.config || loadTwitchOAuthConfig();
  const redirectUri = options.redirectUri || (config && config.redirectUri) || getTwitchOAuthRedirectUri();
  if (!redirectUri) return null;

  const scopes = options.scopes || TWITCH_OAUTH_SCOPES;
  const scopeStr = scopes.join(' ');
  const params = new URLSearchParams({
    client_id: clientId,
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
  DEFAULT_TWITCH_CLIENT_ID,
  loadTwitchOAuthConfig,
  getTwitchOAuthClientId,
  getTwitchOAuthRedirectUri,
  buildTwitchAuthorizeUrl,
  validateTwitchAccessToken,
};
