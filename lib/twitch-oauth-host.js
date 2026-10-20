const http = require('http');
const {
  requestDeviceCode,
  pollDeviceCodeToken,
  refreshAccessTokenPublic,
  buildImplicitAuthorizeUrl,
  parseImplicitCallbackUrl,
  fetchTwitchUserForToken,
} = require('./twitch-oauth-client');
const { getTwitchOAuthClientId, getTwitchOAuthRedirectUri, validateTwitchAccessToken } = require('./twitch-oauth');
const { TWITCH_OAUTH_SCOPES } = require('./twitch-oauth-scopes');

/**
 * Registers Twitch OAuth IPC and session restore helpers.
 * @param {object} deps
 */
function createTwitchOAuthHost(deps) {
  const {
    fetchFn,
    safeStorage,
    shell,
    getMainWindow,
    loadTcConfig,
    saveTcConfig,
    startTwitchChatConnection,
    ipcMain,
  } = deps;

  let activeAbort = null;
  let implicitServer = null;
  let implicitCloseTimer = null;

  function send(channel, payload) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }

  function encryptField(plain) {
    if (!plain || !safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.encryptString(String(plain)).toString('base64');
  }

  function decryptField(b64) {
    if (!b64 || !safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(b64, 'base64'));
    } catch {
      return null;
    }
  }

  function readStoredTokens(tc) {
    const cfg = tc || loadTcConfig();
    let accessToken = cfg.accessToken || cfg.oauth_token || '';
    if (!accessToken && cfg.oauth_token_encrypted) {
      accessToken = decryptField(cfg.oauth_token_encrypted) || '';
    }
    let refreshToken = cfg.refreshToken || '';
    if (!refreshToken && cfg.refresh_token_encrypted) {
      refreshToken = decryptField(cfg.refresh_token_encrypted) || '';
    }
    return {
      accessToken: String(accessToken || '').replace(/^oauth:/i, '').trim(),
      refreshToken: String(refreshToken || '').trim(),
      expiresAt: cfg.oauthExpiresAt || cfg.oauth_expires_at || null,
      clientId: cfg.clientId || getTwitchOAuthClientId(),
      username: cfg.username || '',
      userId: cfg.userId || cfg.user_id || null,
    };
  }

  function persistOAuthSession({ accessToken, refreshToken, expiresIn, clientId, username, userId }) {
    const tc = loadTcConfig();
    const token = String(accessToken || '').replace(/^oauth:/i, '').trim();
    tc.username = username ? String(username).toLowerCase() : tc.username;
    tc.userId = userId || tc.userId;
    tc.clientId = clientId || tc.clientId || getTwitchOAuthClientId();
    tc.accessToken = token;
    tc.oauth_token = token;
    tc.refreshToken = refreshToken || tc.refreshToken || '';
    if (typeof expiresIn === 'number' && expiresIn > 0) {
      tc.oauthExpiresAt = Date.now() + expiresIn * 1000;
    }
    if (tc.accessToken && safeStorage.isEncryptionAvailable()) {
      const enc = encryptField(tc.accessToken);
      if (enc) {
        tc.oauth_token_encrypted = enc;
        delete tc.accessToken;
        delete tc.oauth_token;
      }
    }
    if (tc.refreshToken && safeStorage.isEncryptionAvailable()) {
      const encRefresh = encryptField(tc.refreshToken);
      if (encRefresh) {
        tc.refresh_token_encrypted = encRefresh;
        delete tc.refreshToken;
      }
    }
    saveTcConfig(tc);
    return readStoredTokens(tc);
  }

  function clearOAuthSessionFields(tc) {
    const next = { ...tc };
    delete next.accessToken;
    delete next.oauth_token;
    delete next.oauth_token_encrypted;
    delete next.refreshToken;
    delete next.refresh_token_encrypted;
    delete next.oauthExpiresAt;
    delete next.oauth_expires_at;
    delete next.username;
    delete next.userId;
    delete next.user_id;
    delete next.clientId;
    return next;
  }

  async function connectFromStoredSession() {
    const clientId = getTwitchOAuthClientId();
    if (!clientId) return { ok: false, error: 'missing_client_id' };
    let session = readStoredTokens();
    if (!session.accessToken && !session.refreshToken) {
      return { ok: false, error: 'no_session' };
    }
    const now = Date.now();
    const expiresAt = session.expiresAt ? Number(session.expiresAt) : 0;
    const needsRefresh = session.refreshToken && expiresAt && now > expiresAt - 60_000;
    if ((!session.accessToken || needsRefresh) && session.refreshToken) {
      const refreshed = await refreshAccessTokenPublic(fetchFn, clientId, session.refreshToken);
      if (!refreshed.ok) {
        return { ok: false, error: refreshed.error || 'refresh_failed', needsReconnect: true };
      }
      const data = refreshed.data;
      session = persistOAuthSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || session.refreshToken,
        expiresIn: data.expires_in,
        clientId,
        username: session.username,
        userId: session.userId,
      });
    }
    if (!session.accessToken) {
      return { ok: false, error: 'missing_access_token', needsReconnect: true };
    }
    let validation = await validateTwitchAccessToken(fetchFn, session.accessToken);
    if (!validation.ok) {
      if (session.refreshToken) {
        const refreshed = await refreshAccessTokenPublic(fetchFn, clientId, session.refreshToken);
        if (!refreshed.ok) {
          return { ok: false, error: refreshed.error || 'token_invalid', needsReconnect: true };
        }
        const data = refreshed.data;
        session = persistOAuthSession({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || session.refreshToken,
          expiresIn: data.expires_in,
          clientId,
          username: session.username,
          userId: session.userId,
        });
        validation = await validateTwitchAccessToken(fetchFn, session.accessToken);
      } else {
        return { ok: false, error: validation.error || 'token_invalid', needsReconnect: true };
      }
    }
    if (validation.ok) {
      session = persistOAuthSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: validation.expiresIn,
        clientId,
        username: validation.login || session.username,
        userId: validation.userId || session.userId,
      });
    }
    let finalSession = readStoredTokens();
    let username = finalSession.username;
    if (!username) {
      const userLookup = await fetchTwitchUserForToken(fetchFn, clientId, finalSession.accessToken);
      if (userLookup.ok) {
        finalSession = persistOAuthSession({
          accessToken: finalSession.accessToken,
          refreshToken: finalSession.refreshToken,
          expiresIn: null,
          clientId,
          username: userLookup.user.login,
          userId: userLookup.user.id,
        });
        username = userLookup.user.login;
      }
    }
    if (!username) return { ok: false, error: 'missing_username', needsReconnect: true };
    startTwitchChatConnection({
      username,
      oauth: finalSession.accessToken,
      clientId: finalSession.clientId || clientId,
    });
    send('twitch-oauth-success', { username });
    return { ok: true, username };
  }

  function stopImplicitServer() {
    if (implicitCloseTimer) {
      clearTimeout(implicitCloseTimer);
      implicitCloseTimer = null;
    }
    if (implicitServer) {
      try { implicitServer.close(); } catch { /* ignore */ }
      implicitServer = null;
    }
  }

  function cancelActiveFlow() {
    if (activeAbort) {
      try { activeAbort.abort(); } catch { /* ignore */ }
      activeAbort = null;
    }
    stopImplicitServer();
  }

  async function runDeviceFlow() {
    const clientId = getTwitchOAuthClientId();
    if (!clientId) {
      return { ok: false, error: 'missing_client_id' };
    }
    cancelActiveFlow();
    activeAbort = new AbortController();
    const signal = activeAbort.signal;

    send('twitch-oauth-progress', { phase: 'starting', message: 'Requesting device code…' });
    const device = await requestDeviceCode(fetchFn, clientId, TWITCH_OAUTH_SCOPES);
    if (!device.ok) {
      return { ok: false, error: device.error || 'device_code_failed', useImplicitFallback: true };
    }
    const {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      expires_in: expiresIn,
      interval,
    } = device.data;

    send('twitch-oauth-progress', {
      phase: 'authorize',
      userCode,
      verificationUri,
      message: 'Open Twitch in your browser and authorize VirtualDeck.',
    });
    if (verificationUri) shell.openExternal(verificationUri);

    const tokenResult = await pollDeviceCodeToken(fetchFn, clientId, deviceCode, {
      intervalSec: interval || 5,
      expiresInSec: expiresIn || 1800,
      signal,
      onSlowDown: () => {
        send('twitch-oauth-progress', { phase: 'polling', message: 'Waiting for authorization…' });
      },
    });
    activeAbort = null;

    if (!tokenResult.ok) {
      return { ok: false, error: tokenResult.error || 'device_poll_failed' };
    }
    const data = tokenResult.data;
    const userLookup = await fetchTwitchUserForToken(fetchFn, clientId, data.access_token);
    if (!userLookup.ok) {
      return { ok: false, error: userLookup.error || 'user_lookup_failed' };
    }
    persistOAuthSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      clientId,
      username: userLookup.user.login,
      userId: userLookup.user.id,
    });
    startTwitchChatConnection({
      username: userLookup.user.login,
      oauth: data.access_token,
      clientId,
    });
    send('twitch-oauth-success', { username: userLookup.user.login });
    return { ok: true, username: userLookup.user.login, method: 'device' };
  }

  async function runImplicitFlow() {
    const clientId = getTwitchOAuthClientId();
    if (!clientId) {
      return { ok: false, error: 'missing_client_id' };
    }
    cancelActiveFlow();
    const redirectUri = getTwitchOAuthRedirectUri();
    const portMatch = redirectUri.match(/localhost:(\d+)/);
    const port = portMatch ? Number(portMatch[1]) : 17563;

    send('twitch-oauth-progress', { phase: 'implicit', message: 'Opening Twitch login in your browser…' });

    const tokenPromise = new Promise((resolve, reject) => {
      implicitServer = http.createServer((req, res) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://localhost:${port}`);
          if (reqUrl.pathname === '/oauth/callback') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>VirtualDeck</title></head><body>
<script>
(function () {
  var hash = window.location.hash || '';
  if (!hash || hash.length < 2) {
    document.body.innerHTML = '<p>Waiting for Twitch…</p>';
    return;
  }
  fetch('/oauth/callback/complete' + hash.replace('#', '?'))
    .then(function () {
      document.body.innerHTML = '<h1 style="color:#9146FF;font-family:sans-serif;text-align:center;margin-top:40px;">Connected</h1><p style="text-align:center;font-family:sans-serif;">Return to VirtualDeck.</p>';
    })
    .catch(function () {
      document.body.innerHTML = '<p>Login failed. Close this window and try again.</p>';
    });
})();
</script></body></html>`);
            return;
          }
          if (reqUrl.pathname === '/oauth/callback/complete') {
            const parsed = parseImplicitCallbackUrl(`http://localhost${req.url.replace('/oauth/callback/complete', '/oauth/callback')}`);
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            if (parsed.ok) {
              res.end('ok');
              resolve(parsed);
              stopImplicitServer();
            } else {
              res.end('error');
              reject(new Error(parsed.error || 'implicit_failed'));
              stopImplicitServer();
            }
            return;
          }
          res.writeHead(404);
          res.end('Not found');
        } catch (err) {
          reject(err);
          stopImplicitServer();
        }
      });
      implicitServer.on('error', (err) => reject(err));
      implicitServer.listen(port, '127.0.0.1', () => {
        const url = buildImplicitAuthorizeUrl(clientId, redirectUri, TWITCH_OAUTH_SCOPES, true);
        shell.openExternal(url);
      });
      implicitCloseTimer = setTimeout(() => {
        stopImplicitServer();
        reject(new Error('implicit_timeout'));
      }, 5 * 60 * 1000);
    });

    const parsed = await tokenPromise;
    const validation = await validateTwitchAccessToken(fetchFn, parsed.accessToken);
    const userLookup = await fetchTwitchUserForToken(fetchFn, clientId, parsed.accessToken);
    if (!userLookup.ok) {
      return { ok: false, error: userLookup.error || 'user_lookup_failed' };
    }
    persistOAuthSession({
      accessToken: parsed.accessToken,
      refreshToken: null,
      expiresIn: validation.expiresIn,
      clientId,
      username: userLookup.user.login,
      userId: userLookup.user.id,
    });
    startTwitchChatConnection({
      username: userLookup.user.login,
      oauth: parsed.accessToken,
      clientId,
    });
    send('twitch-oauth-success', { username: userLookup.user.login });
    return { ok: true, username: userLookup.user.login, method: 'implicit' };
  }

  async function startOAuthFlow() {
    const deviceResult = await runDeviceFlow();
    if (deviceResult.ok) return deviceResult;
    if (deviceResult.error === 'aborted') return deviceResult;
    console.warn('[Twitch OAuth] Device flow failed, trying implicit fallback:', deviceResult.error);
    send('twitch-oauth-progress', {
      phase: 'fallback',
      message: 'Device login unavailable. Trying browser redirect…',
    });
    try {
      return await runImplicitFlow();
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  function registerIpc() {
    ipcMain.handle('twitch-oauth-get-status', async () => {
      const clientId = getTwitchOAuthClientId();
      const session = readStoredTokens();
      const hasToken = !!(session.accessToken || session.refreshToken);
      return {
        clientIdConfigured: !!clientId,
        hasSession: hasToken,
        login: session.username || null,
        connected: !!(deps.getTwitchConnected && deps.getTwitchConnected()),
      };
    });

    ipcMain.handle('twitch-oauth-start', async () => {
      try {
        return await startOAuthFlow();
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    });

    ipcMain.handle('twitch-oauth-cancel', async () => {
      cancelActiveFlow();
      return { ok: true };
    });

    ipcMain.handle('twitch-oauth-restore-session', async () => {
      try {
        return await connectFromStoredSession();
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    });
  }

  return {
    registerIpc,
    cancelActiveFlow,
    connectFromStoredSession,
    persistOAuthSession,
    readStoredTokens,
    clearOAuthSessionFields,
  };
}

module.exports = { createTwitchOAuthHost };
