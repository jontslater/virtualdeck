const { scopesIncludeCommercial } = require('./twitch-oauth-scopes');

class TwitchCommercialClient {
  constructor(deps) {
    this.fetchFn = deps.fetchFn || global.fetch;
    this.getClientId = deps.getClientId;
    this.getAccessToken = deps.getAccessToken;
    this.getBroadcasterId = deps.getBroadcasterId;
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
      'Content-Type': 'application/json',
    };
  }

  async validateToken() {
    const token = String(this.getAccessToken() || '').replace(/^oauth:/i, '').trim();
    if (!token) {
      return { ok: false, hasCommercialScope: false, scopeStatus: 'not_connected', error: 'not_connected' };
    }
    let resp;
    try {
      resp = await this.fetchFn('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
    } catch (err) {
      return { ok: false, hasCommercialScope: false, scopeStatus: 'unknown', error: err.message || String(err) };
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        ok: false,
        hasCommercialScope: false,
        scopeStatus: resp.status === 401 ? 'invalid_token' : 'unknown',
        error: data.message || String(resp.status),
      };
    }
    const scopes = Array.isArray(data.scopes)
      ? data.scopes
      : String(data.scopes || '').split(/\s+/).filter(Boolean);
    return {
      ok: true,
      hasCommercialScope: scopesIncludeCommercial(scopes),
      scopeStatus: scopesIncludeCommercial(scopes) ? 'ok' : 'missing_scope',
      scopes,
      login: data.login,
      userId: data.user_id,
    };
  }

  /**
   * @param {{ length?: number }} opts length 30–180 seconds
   */
  async startCommercial(opts = {}) {
    const scopeInfo = await this.validateToken();
    if (!scopeInfo.ok || !scopeInfo.hasCommercialScope) {
      return {
        ok: false,
        needsReconnect: true,
        error: 'Reconnect Twitch to run ads (channel:edit:commercial scope required).',
      };
    }

    const broadcasterId = await this.getBroadcasterId();
    if (!broadcasterId) {
      return { ok: false, error: 'Broadcaster ID not available' };
    }

    let length = Number(opts.length);
    if (!Number.isFinite(length)) length = 60;
    length = Math.min(180, Math.max(30, Math.round(length)));

    const resp = await this.fetchFn('https://api.twitch.tv/helix/channels/commercial', {
      method: 'POST',
      headers: this._authHeaders(),
      body: JSON.stringify({ broadcaster_id: broadcasterId, length }),
    });
    const body = await resp.json().catch(() => ({}));
    const commercial = body.data && body.data[0];

    if (!resp.ok) {
      const msg = String(body.message || body.error || resp.statusText || '');
      const retryAfter =
        commercial && commercial.retry_after != null
          ? Number(commercial.retry_after)
          : body.retry_after != null
            ? Number(body.retry_after)
            : null;

      const needsReconnect = resp.status === 401 || resp.status === 403 || /scope/i.test(msg);
      if (needsReconnect) {
        return {
          ok: false,
          needsReconnect: true,
          error: 'Reconnect Twitch to run ads (channel:edit:commercial scope required).',
        };
      }

      const notLive = resp.status === 404 || /not streaming|not live|offline/i.test(msg);
      if (notLive) {
        return { ok: false, reason: 'not_live', error: 'Cannot run an ad — you are not live on Twitch.' };
      }

      const cooldown = resp.status === 429 || /too many|cooldown|retry/i.test(msg) || retryAfter != null;
      if (cooldown) {
        const secs = retryAfter != null && Number.isFinite(retryAfter) ? retryAfter : null;
        const error =
          secs != null
            ? `Ad on cooldown — try again in ${secs} second(s).`
            : msg || 'Ad on cooldown — try again later.';
        return { ok: false, reason: 'cooldown', retry_after: secs, error };
      }

      return { ok: false, error: msg || `Commercial failed (${resp.status})` };
    }

    return {
      ok: true,
      length: commercial?.length ?? length,
      retry_after: commercial?.retry_after != null ? Number(commercial.retry_after) : undefined,
      message: commercial?.message,
    };
  }
}

module.exports = {
  TwitchCommercialClient,
};
