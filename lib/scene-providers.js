/**
 * Scene providers for macros / JARVIS change_scene: list and switch scenes in the connected
 * streaming app. Meld Studio (via the renderer's meldClient), OBS (obs-websocket v5) and
 * Streamlabs Desktop (local TCP JSON-RPC, ScenesService).
 */
const crypto = require('crypto');

const APPS = ['meld', 'obs', 'streamlabs'];
const APP_LABELS = { meld: 'Meld Studio', obs: 'OBS Studio', streamlabs: 'Streamlabs Desktop' };
const DEFAULT_OBS_URL = 'ws://127.0.0.1:4455';

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`${label} timed out`)), ms); }),
  ]);
}

function obsAuthString(password, salt, challenge) {
  const secret = crypto.createHash('sha256').update(String(password) + salt).digest('base64');
  return crypto.createHash('sha256').update(secret + challenge).digest('base64');
}

/** Minimal obs-websocket v5 client: connect, identify (with auth), send requests. */
function obsRequest({ url = DEFAULT_OBS_URL, password = '', WebSocketImpl, requests, timeoutMs = 3000 }) {
  const WS = WebSocketImpl || require('ws');
  return withTimeout(new Promise((resolve, reject) => {
    let ws;
    try { ws = new WS(url); } catch (err) { reject(err); return; }
    const results = [];
    let idx = 0;
    const fail = (err) => { try { ws.close(); } catch (_) {} reject(err); };
    const sendNext = () => {
      if (idx >= requests.length) { try { ws.close(); } catch (_) {} resolve(results); return; }
      const r = requests[idx];
      ws.send(JSON.stringify({ op: 6, d: { requestType: r.requestType, requestId: `vd-${idx}`, requestData: r.requestData || {} } }));
    };
    ws.on('error', (err) => fail(new Error(err && err.code === 'ECONNREFUSED' ? 'OBS WebSocket not reachable' : (err.message || String(err)))));
    ws.on('close', (code) => { if (idx < requests.length) reject(new Error(code === 4009 ? 'OBS WebSocket password is wrong' : `OBS WebSocket closed (${code})`)); });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.op === 0) {
        const d = { rpcVersion: 1 };
        const auth = msg.d && msg.d.authentication;
        if (auth) {
          if (!password) { fail(new Error('OBS WebSocket requires a password (set it in the OBS connection settings)')); return; }
          d.authentication = obsAuthString(password, auth.salt, auth.challenge);
        }
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (msg.op === 2) {
        sendNext();
      } else if (msg.op === 7 && msg.d && msg.d.requestId === `vd-${idx}`) {
        const st = msg.d.requestStatus || {};
        if (!st.result) { fail(new Error(st.comment || `OBS request ${requests[idx].requestType} failed (${st.code})`)); return; }
        results.push(msg.d.responseData || {});
        idx += 1;
        sendNext();
      }
    });
  }), timeoutMs + 500, 'OBS WebSocket');
}

class SceneProviders {
  /**
   * deps.meldBridge: async (op, payload) => ({ ok, scenes?, error? }) — round trip to renderer meldClient
   * deps.getObsConfig: () => ({ url, password })
   * deps.streamlabsRequest: streamlabsTcpRequest-compatible fn
   */
  constructor({ meldBridge, getObsConfig, streamlabsRequest, WebSocketImpl, timeoutMs = 2500 } = {}) {
    this.meldBridge = meldBridge;
    this.getObsConfig = getObsConfig || (() => ({}));
    this.streamlabsRequest = streamlabsRequest;
    this.WebSocketImpl = WebSocketImpl;
    this.timeoutMs = timeoutMs;
  }

  async listFrom(app) {
    if (app === 'meld') {
      if (!this.meldBridge) throw new Error('Meld client not available');
      const r = await withTimeout(this.meldBridge('list'), this.timeoutMs, 'Meld Studio');
      if (!r || !r.ok) throw new Error((r && r.error) || 'Meld Studio is not running');
      return (r.scenes || []).map((s) => ({ id: String(s.id), name: String(s.name || s.id) }));
    }
    if (app === 'obs') {
      const cfg = this.getObsConfig() || {};
      const [res] = await obsRequest({ url: cfg.url || DEFAULT_OBS_URL, password: cfg.password || '', WebSocketImpl: this.WebSocketImpl, timeoutMs: this.timeoutMs, requests: [{ requestType: 'GetSceneList' }] });
      // OBS returns scenes bottom-up; show them in the order of the OBS scene list.
      return (res.scenes || []).slice().reverse().map((s) => ({ id: s.sceneUuid || s.sceneName, name: s.sceneName }));
    }
    if (app === 'streamlabs') {
      if (!this.streamlabsRequest) throw new Error('Streamlabs client not available');
      const scenes = await withTimeout(this.streamlabsRequest({ method: 'getScenes', resource: 'ScenesService', args: [], timeoutMs: this.timeoutMs }), this.timeoutMs + 500, 'Streamlabs Desktop');
      return (Array.isArray(scenes) ? scenes : []).map((s) => ({ id: String(s.id), name: String(s.name || s.id) }));
    }
    throw new Error(`Unknown streaming app '${app}'`);
  }

  /**
   * List scenes. With app set, only that app; otherwise query all in parallel and use the first
   * connected one in priority order (Meld, OBS, Streamlabs). Never throws.
   */
  async listScenes({ app } = {}) {
    const targets = app && APPS.includes(app) ? [app] : APPS;
    const settled = await Promise.allSettled(targets.map((a) => this.listFrom(a)));
    const connected = [];
    const errors = {};
    let chosen = null;
    settled.forEach((s, i) => {
      const a = targets[i];
      if (s.status === 'fulfilled') {
        connected.push(a);
        if (!chosen) chosen = { app: a, scenes: s.value };
      } else {
        errors[a] = s.reason && s.reason.message ? s.reason.message : String(s.reason);
      }
    });
    if (!chosen) {
      return { success: false, app: null, appLabel: null, scenes: [], connected, errors,
        error: app ? `${APP_LABELS[app] || app} is not connected: ${errors[app]}` : 'No streaming app connected (Meld Studio, OBS or Streamlabs Desktop)' };
    }
    return { success: true, app: chosen.app, appLabel: APP_LABELS[chosen.app], scenes: chosen.scenes, connected, errors };
  }

  static resolveScene(scenes, wanted) {
    const w = String(wanted || '').trim();
    if (!w) return null;
    return scenes.find((s) => s.name === w) || scenes.find((s) => s.id === w)
      || scenes.find((s) => s.name.toLowerCase() === w.toLowerCase()) || null;
  }

  /** Validate sceneName against the live list, then switch. Returns { success, error?, app, scene }. */
  async switchScene({ sceneName, app } = {}) {
    if (!sceneName || !String(sceneName).trim()) return { success: false, error: 'sceneName is required' };
    const list = await this.listScenes({ app });
    if (!list.success) return { success: false, error: list.error, app: list.app };
    const scene = SceneProviders.resolveScene(list.scenes, sceneName);
    if (!scene) {
      const names = list.scenes.map((s) => s.name);
      const shown = names.slice(0, 12).join(', ') + (names.length > 12 ? `, … (${names.length} total)` : '');
      return { success: false, app: list.app,
        error: `Scene "${sceneName}" not found in ${list.appLabel}. Available: ${shown || '(no scenes)'}` };
    }
    try {
      if (list.app === 'meld') {
        const r = await withTimeout(this.meldBridge('show', { sceneId: scene.id }), this.timeoutMs, 'Meld Studio');
        if (!r || !r.ok) throw new Error((r && r.error) || 'Meld did not switch scenes');
      } else if (list.app === 'obs') {
        const cfg = this.getObsConfig() || {};
        await obsRequest({ url: cfg.url || DEFAULT_OBS_URL, password: cfg.password || '', WebSocketImpl: this.WebSocketImpl, timeoutMs: this.timeoutMs,
          requests: [{ requestType: 'SetCurrentProgramScene', requestData: { sceneName: scene.name } }] });
      } else if (list.app === 'streamlabs') {
        const ok = await this.streamlabsRequest({ method: 'makeSceneActive', resource: 'ScenesService', args: [scene.id], timeoutMs: this.timeoutMs });
        if (ok === false) throw new Error('Streamlabs refused to switch scenes');
      }
    } catch (err) {
      return { success: false, app: list.app, error: `${APP_LABELS[list.app]}: ${err.message || String(err)}` };
    }
    return { success: true, app: list.app, appLabel: APP_LABELS[list.app], scene: scene.name };
  }
}

module.exports = { SceneProviders, obsRequest, obsAuthString, APPS, APP_LABELS, DEFAULT_OBS_URL };
