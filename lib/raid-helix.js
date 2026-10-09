const { sanitizeTwitchProfileImageUrl } = require('./twitch-profile-image');
const { scopesIncludeRaid } = require('./twitch-oauth-scopes');
const { normalizeTwitchLogin, isValidTwitchLogin } = require('./twitch-login');

const LIVE_CHECK_CACHE_MS = 60 * 1000;
const HELIX_BATCH_SIZE = 100;

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

class RaidHelixClient {
  constructor(deps) {
    this.fetchFn = deps.fetchFn || global.fetch;
    this.getClientId = deps.getClientId;
    this.getAccessToken = deps.getAccessToken;
    this.getBroadcasterId = deps.getBroadcasterId;
    this._liveCache = { at: 0, key: '', payload: null };
  }

  _authHeaders() {
    const clientId = this.getClientId();
    const token = String(this.getAccessToken() || '').replace(/^oauth:/i, '').trim();
    if (!clientId || !token) {
      throw new Error('Twitch is not connected');
    }
    return {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
    };
  }

  async validateToken() {
    const token = String(this.getAccessToken() || '').replace(/^oauth:/i, '').trim();
    if (!token) {
      return { ok: false, hasRaidScope: false, error: 'not_connected' };
    }
    const resp = await this.fetchFn('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, hasRaidScope: false, error: data.message || String(resp.status) };
    }
    const scopes = Array.isArray(data.scopes)
      ? data.scopes
      : String(data.scopes || '').split(/\s+/).filter(Boolean);
    return {
      ok: true,
      hasRaidScope: scopesIncludeRaid(scopes),
      scopes,
      login: data.login,
      userId: data.user_id,
    };
  }

  async fetchUsersByLogin(logins) {
    const valid = logins.filter((l) => isValidTwitchLogin(normalizeTwitchLogin(l)));
    if (valid.length === 0) return [];

    const results = [];
    for (const batch of chunkArray(valid, HELIX_BATCH_SIZE)) {
      const qs = batch.map((l) => `login=${encodeURIComponent(normalizeTwitchLogin(l))}`).join('&');
      const resp = await this.fetchFn(`https://api.twitch.tv/helix/users?${qs}`, {
        headers: this._authHeaders(),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.message || `Helix users failed (${resp.status})`);
      }
      if (Array.isArray(body.data)) {
        results.push(...body.data);
      }
    }
    return results;
  }

  async fetchStreamsByLogin(logins) {
    const valid = logins.filter((l) => isValidTwitchLogin(normalizeTwitchLogin(l)));
    if (valid.length === 0) return [];

    const results = [];
    for (const batch of chunkArray(valid, HELIX_BATCH_SIZE)) {
      const qs = batch.map((l) => `user_login=${encodeURIComponent(normalizeTwitchLogin(l))}`).join('&');
      const resp = await this.fetchFn(`https://api.twitch.tv/helix/streams?${qs}`, {
        headers: this._authHeaders(),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.message || `Helix streams failed (${resp.status})`);
      }
      if (Array.isArray(body.data)) {
        results.push(...body.data);
      }
    }
    return results;
  }

  /**
   * @param {string[]} logins
   * @param {{ forceRefresh?: boolean }} opts
   */
  async getLiveStatusForLogins(logins, opts = {}) {
    const normalized = [...new Set(logins.map((l) => normalizeTwitchLogin(l)).filter(isValidTwitchLogin))];
    const cacheKey = normalized.join(',');
    const now = Date.now();
    if (
      !opts.forceRefresh
      && this._liveCache.payload
      && this._liveCache.key === cacheKey
      && now - this._liveCache.at < LIVE_CHECK_CACHE_MS
    ) {
      return { ...this._liveCache.payload, cached: true };
    }

    const [users, streams] = await Promise.all([
      this.fetchUsersByLogin(normalized),
      this.fetchStreamsByLogin(normalized),
    ]);

    const userByLogin = new Map(users.map((u) => [normalizeTwitchLogin(u.login), u]));
    const streamByLogin = new Map(streams.map((s) => [normalizeTwitchLogin(s.user_login), s]));

    const channels = normalized.map((login) => {
      const user = userByLogin.get(login);
      const stream = streamByLogin.get(login);
      const live = !!stream;
      return {
        login,
        displayName: user?.display_name || login,
        userId: user?.id || null,
        profileImageUrl: sanitizeTwitchProfileImageUrl(user?.profile_image_url),
        live,
        title: live ? stream.title || '' : '',
        gameName: live ? stream.game_name || '' : '',
        viewerCount: live ? stream.viewer_count || 0 : 0,
      };
    });

    channels.sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      if (a.live && b.live) return b.viewerCount - a.viewerCount;
      return a.login.localeCompare(b.login);
    });

    const payload = {
      channels,
      checkedAt: new Date().toISOString(),
      cached: false,
    };
    this._liveCache = { at: now, key: cacheKey, payload };
    return payload;
  }

  async resolveBroadcasterId(login) {
    const normalized = normalizeTwitchLogin(login);
    if (!isValidTwitchLogin(normalized)) {
      throw new Error('Invalid Twitch login');
    }
    const users = await this.fetchUsersByLogin([normalized]);
    const user = users[0];
    if (!user?.id) {
      throw new Error(`Unknown Twitch channel: ${normalized}`);
    }
    return user.id;
  }

  async startRaid({ toLogin, toBroadcasterId }) {
    const scopeInfo = await this.validateToken();
    if (!scopeInfo.ok || !scopeInfo.hasRaidScope) {
      return {
        ok: false,
        needsReconnect: true,
        error: 'Reconnect Twitch to enable raids (channel:manage:raids scope required).',
      };
    }

    const fromId = await this.getBroadcasterId();
    if (!fromId) {
      return { ok: false, error: 'Broadcaster ID not available' };
    }

    let targetId = toBroadcasterId;
    if (!targetId) {
      targetId = await this.resolveBroadcasterId(toLogin);
    }

    const url = `https://api.twitch.tv/helix/raids?from_broadcaster_id=${encodeURIComponent(fromId)}&to_broadcaster_id=${encodeURIComponent(targetId)}`;
    const resp = await this.fetchFn(url, {
      method: 'POST',
      headers: this._authHeaders(),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = String(body.message || resp.statusText || '');
      const needsReconnect = resp.status === 401 || resp.status === 403 || /scope/i.test(msg);
      return {
        ok: false,
        needsReconnect,
        error: needsReconnect
          ? 'Reconnect Twitch to enable raids (channel:manage:raids scope required).'
          : msg || `Raid failed (${resp.status})`,
      };
    }

    const raid = body.data && body.data[0];
    return {
      ok: true,
      raid,
      toBroadcasterId: targetId,
      toLogin: normalizeTwitchLogin(toLogin),
    };
  }

  async cancelRaid() {
    const scopeInfo = await this.validateToken();
    if (!scopeInfo.ok || !scopeInfo.hasRaidScope) {
      return {
        ok: false,
        needsReconnect: true,
        error: 'Reconnect Twitch to enable raids (channel:manage:raids scope required).',
      };
    }

    const broadcasterId = await this.getBroadcasterId();
    if (!broadcasterId) {
      return { ok: false, error: 'Broadcaster ID not available' };
    }

    const url = `https://api.twitch.tv/helix/raids?broadcaster_id=${encodeURIComponent(broadcasterId)}`;
    const resp = await this.fetchFn(url, {
      method: 'DELETE',
      headers: this._authHeaders(),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      const msg = String(body.message || resp.statusText || '');
      return { ok: false, error: msg || `Cancel raid failed (${resp.status})` };
    }
    return { ok: true };
  }
}

module.exports = {
  RaidHelixClient,
  LIVE_CHECK_CACHE_MS,
  HELIX_BATCH_SIZE,
  chunkArray,
};
