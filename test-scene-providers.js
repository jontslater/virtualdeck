/**
 * Tests for lib/scene-providers.js (Meld / OBS / Streamlabs scene listing + switching),
 * the change_scene / get_scenes JARVIS tools and the macro scene picker helpers.
 * Uses local fake servers only — never talks to a real OBS / Streamlabs / Meld.
 */
const assert = require('assert');
const net = require('net');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { SceneProviders, obsAuthString } = require('./lib/scene-providers');
const { streamlabsTcpRequest } = require('./streamlabs-tcp');
const picker = require('./public/macro-scene-picker');

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log('  ok', name); } catch (err) { console.error('  FAIL', name, '\n', err); process.exitCode = 1; }
}

function deadPort() {
  return new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}

/** Fake obs-websocket v5 server. */
function startFakeObs({ password } = {}) {
  return new Promise((resolve) => {
    const state = { current: 'Starting', scenes: ['Starting', 'Gameplay', 'Just Chatting'], requests: [] };
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 }, () => resolve({ wss, state, url: `ws://127.0.0.1:${wss.address().port}` }));
    wss.on('connection', (ws) => {
      const salt = crypto.randomBytes(8).toString('base64');
      const challenge = crypto.randomBytes(8).toString('base64');
      ws.send(JSON.stringify({ op: 0, d: { rpcVersion: 1, ...(password ? { authentication: { salt, challenge } } : {}) } }));
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.op === 1) {
          if (password && msg.d.authentication !== obsAuthString(password, salt, challenge)) { ws.close(4009, 'auth failed'); return; }
          ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
        } else if (msg.op === 6) {
          state.requests.push(msg.d.requestType);
          const reply = (ok, responseData, comment) => ws.send(JSON.stringify({ op: 7, d: { requestType: msg.d.requestType, requestId: msg.d.requestId, requestStatus: { result: ok, code: ok ? 100 : 600, comment }, responseData } }));
          if (msg.d.requestType === 'GetSceneList') {
            // OBS lists scenes bottom-up (index 0 = bottom)
            reply(true, { currentProgramSceneName: state.current, scenes: state.scenes.slice().reverse().map((n, i) => ({ sceneName: n, sceneIndex: i, sceneUuid: 'uuid-' + n })) });
          } else if (msg.d.requestType === 'SetCurrentProgramScene') {
            if (!state.scenes.includes(msg.d.requestData.sceneName)) { reply(false, undefined, 'No source was found'); return; }
            state.current = msg.d.requestData.sceneName; reply(true);
          }
        }
      });
    });
  });
}

/** Fake Streamlabs Desktop JSON-RPC TCP server (incl. PROMISE subscription for makeSceneActive). */
function startFakeStreamlabs() {
  return new Promise((resolve) => {
    const state = { active: 's1', scenes: [{ id: 's1', name: 'Intro' }, { id: 's2', name: 'Main Cam' }] };
    const server = net.createServer((sock) => {
      let buf = '';
      sock.on('data', (c) => {
        buf += c.toString();
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const m = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1);
          if (m.params.resource !== 'ScenesService') { sock.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { message: 'bad resource' } }) + '\n'); continue; }
          if (m.method === 'getScenes') sock.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: state.scenes }) + '\n');
          else if (m.method === 'makeSceneActive') {
            const ok = state.scenes.some((s) => s.id === m.params.args[0]);
            if (ok) state.active = m.params.args[0];
            sock.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { _type: 'SUBSCRIPTION', emitter: 'PROMISE', resourceId: 'p1' } }) + '\n');
            sock.write(JSON.stringify({ jsonrpc: '2.0', result: { _type: 'EVENT', emitter: 'PROMISE', resourceId: 'p1', data: ok } }) + '\n');
          }
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port }));
  });
}

function fakeMeld(scenes, { running = true } = {}) {
  const calls = [];
  const bridge = async (op, payload) => {
    calls.push({ op, ...payload });
    if (!running) return { ok: false, error: 'Meld Studio is not running or has no session.' };
    if (op === 'list') return { ok: true, scenes };
    if (op === 'show') return scenes.some((s) => s.id === payload.sceneId) ? { ok: true } : { ok: false, error: 'bad id' };
    return { ok: false };
  };
  return { bridge, calls };
}

(async () => {
  console.log('scene providers');
  const obs = await startFakeObs({ password: 'hunter2' });
  const sl = await startFakeStreamlabs();
  const dead = await deadPort();
  const slReq = (opts) => streamlabsTcpRequest({ host: '127.0.0.1', port: sl.port, ...opts });
  const deadSl = (opts) => streamlabsTcpRequest({ host: '127.0.0.1', port: dead, ...opts });
  const deadObs = () => ({ url: `ws://127.0.0.1:${dead}` });
  const meldOff = fakeMeld([], { running: false });

  await test('OBS: lists scenes (top-down order) with password auth', async () => {
    const p = new SceneProviders({ meldBridge: meldOff.bridge, getObsConfig: () => ({ url: obs.url, password: 'hunter2' }), streamlabsRequest: deadSl, timeoutMs: 1500 });
    const r = await p.listScenes();
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.app, 'obs');
    assert.strictEqual(r.appLabel, 'OBS Studio');
    assert.deepStrictEqual(r.scenes.map((s) => s.name), ['Starting', 'Gameplay', 'Just Chatting']);
    assert.ok(r.errors.meld && r.errors.streamlabs);
  });

  await test('OBS: wrong / missing password gives a clear error', async () => {
    const wrong = new SceneProviders({ getObsConfig: () => ({ url: obs.url, password: 'nope' }), timeoutMs: 1500 });
    const r1 = await wrong.listScenes({ app: 'obs' });
    assert.strictEqual(r1.success, false);
    assert.match(r1.error, /OBS Studio is not connected: OBS WebSocket password is wrong/);
    const none = new SceneProviders({ getObsConfig: () => ({ url: obs.url }), timeoutMs: 1500 });
    const r2 = await none.listScenes({ app: 'obs' });
    assert.match(r2.error, /requires a password/);
  });

  await test('OBS: switch validates name, is case-insensitive and calls SetCurrentProgramScene', async () => {
    const p = new SceneProviders({ getObsConfig: () => ({ url: obs.url, password: 'hunter2' }), timeoutMs: 1500 });
    const r = await p.switchScene({ sceneName: 'gameplay', app: 'obs' });
    assert.deepStrictEqual(r, { success: true, app: 'obs', appLabel: 'OBS Studio', scene: 'Gameplay' });
    assert.strictEqual(obs.state.current, 'Gameplay');
  });

  await test('OBS: unknown scene -> helpful error listing available scenes, no switch request', async () => {
    const before = obs.state.requests.filter((x) => x === 'SetCurrentProgramScene').length;
    const p = new SceneProviders({ getObsConfig: () => ({ url: obs.url, password: 'hunter2' }), timeoutMs: 1500 });
    const r = await p.switchScene({ sceneName: 'BRB', app: 'obs' });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.error, 'Scene "BRB" not found in OBS Studio. Available: Starting, Gameplay, Just Chatting');
    assert.strictEqual(obs.state.requests.filter((x) => x === 'SetCurrentProgramScene').length, before);
  });

  await test('Streamlabs: lists and switches via ScenesService.makeSceneActive(id)', async () => {
    const p = new SceneProviders({ meldBridge: meldOff.bridge, getObsConfig: deadObs, streamlabsRequest: slReq, timeoutMs: 1500 });
    const l = await p.listScenes();
    assert.strictEqual(l.app, 'streamlabs');
    assert.deepStrictEqual(l.scenes, [{ id: 's1', name: 'Intro' }, { id: 's2', name: 'Main Cam' }]);
    const r = await p.switchScene({ sceneName: 'Main Cam' });
    assert.strictEqual(r.success, true);
    assert.strictEqual(sl.state.active, 's2');
  });

  await test('Meld: lists via renderer bridge and switches by resolved scene id', async () => {
    const m = fakeMeld([{ id: 'abc', name: 'Live' }, { id: 'def', name: 'Ending' }]);
    const p = new SceneProviders({ meldBridge: m.bridge, getObsConfig: deadObs, streamlabsRequest: deadSl, timeoutMs: 1500 });
    const r = await p.switchScene({ sceneName: 'Ending' });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.app, 'meld');
    assert.deepStrictEqual(m.calls.find((c) => c.op === 'show'), { op: 'show', sceneId: 'def' });
  });

  await test('Auto-detect priority: Meld > OBS > Streamlabs, reports other connected apps', async () => {
    const m = fakeMeld([{ id: 'abc', name: 'Live' }]);
    const p = new SceneProviders({ meldBridge: m.bridge, getObsConfig: () => ({ url: obs.url, password: 'hunter2' }), streamlabsRequest: slReq, timeoutMs: 1500 });
    const r = await p.listScenes();
    assert.strictEqual(r.app, 'meld');
    assert.deepStrictEqual(r.connected, ['meld', 'obs', 'streamlabs']);
    const forced = await p.listScenes({ app: 'streamlabs' });
    assert.strictEqual(forced.app, 'streamlabs');
  });

  await test('Nothing connected -> clear error from list and switch', async () => {
    const p = new SceneProviders({ meldBridge: meldOff.bridge, getObsConfig: deadObs, streamlabsRequest: deadSl, timeoutMs: 1000 });
    const l = await p.listScenes();
    assert.strictEqual(l.success, false);
    assert.strictEqual(l.error, 'No streaming app connected (Meld Studio, OBS or Streamlabs Desktop)');
    assert.deepStrictEqual(Object.keys(l.errors).sort(), ['meld', 'obs', 'streamlabs']);
    const s = await p.switchScene({ sceneName: 'Live' });
    assert.strictEqual(s.success, false);
    assert.match(s.error, /No streaming app connected/);
    const e = await p.switchScene({ sceneName: '  ' });
    assert.strictEqual(e.error, 'sceneName is required');
  });

  await test('Slow app is bounded by timeout', async () => {
    const hang = () => new Promise(() => {});
    const p = new SceneProviders({ meldBridge: hang, getObsConfig: deadObs, streamlabsRequest: deadSl, timeoutMs: 300 });
    const t0 = Date.now();
    const r = await p.listScenes({ app: 'meld' });
    assert.strictEqual(r.success, false);
    assert.match(r.error, /timed out/);
    assert.ok(Date.now() - t0 < 2000);
  });

  console.log('JARVIS tools');
  const { registry } = require('./jarvis-tools');
  const { isJarvisMacroToolAllowed } = require('./lib/jarvis-macro-allowlist');

  await test('change_scene stays allowlisted and keeps sceneName as the required arg', async () => {
    assert.ok(isJarvisMacroToolAllowed('change_scene'));
    const t = registry.tools.get('change_scene');
    assert.deepStrictEqual(t.parameters.required, ['sceneName']);
    assert.ok(t.parameters.properties.app);
  });

  await test('change_scene via registry: success, not-found error and app pinning', async () => {
    const p = new SceneProviders({ meldBridge: meldOff.bridge, getObsConfig: () => ({ url: obs.url, password: 'hunter2' }), streamlabsRequest: slReq, timeoutMs: 1500 });
    registry.setContext({ sceneProvider: p });
    const ok = await registry.invoke('change_scene', { sceneName: 'Just Chatting' });
    assert.strictEqual(ok.success, true);
    assert.strictEqual(ok.result.success, true);
    assert.strictEqual(ok.result.app, 'obs');
    assert.strictEqual(obs.state.current, 'Just Chatting');
    const bad = await registry.invoke('change_scene', { sceneName: 'Nope' });
    assert.strictEqual(bad.result.success, false);
    assert.match(bad.result.error, /Scene "Nope" not found in OBS Studio\. Available: /);
    const pinned = await registry.invoke('change_scene', { sceneName: 'Intro', app: 'streamlabs' });
    assert.strictEqual(pinned.result.success, true);
    assert.strictEqual(sl.state.active, 's1');
    const gs = await registry.invoke('get_scenes', {});
    assert.strictEqual(gs.result.app, 'obs');
    assert.strictEqual(gs.result.scenes.length, 3);
  });

  await test('run_macro surfaces change_scene failure as a failed step (Test results)', async () => {
    const steps = [{ tool: 'change_scene', arguments: { sceneName: 'Nope' } }];
    const macroManager = { get: (id) => (id === 'm1' ? { id: 'm1', name: 'Scene test', enabled: true, steps } : null), findByPhrase: () => null };
    const p = new SceneProviders({ meldBridge: meldOff.bridge, getObsConfig: () => ({ url: obs.url, password: 'hunter2' }), streamlabsRequest: deadSl, timeoutMs: 1500 });
    registry.setContext({ sceneProvider: p, macroManager });
    const r = await registry.invoke('run_macro', { id: 'm1' });
    const inner = r.result || r;
    assert.strictEqual(inner.success, false, JSON.stringify(inner));
    assert.match(JSON.stringify(inner), /Scene \\"Nope\\" not found in OBS Studio/);
  });

  console.log('scene picker helpers');
  await test('buildSceneOptions keeps a saved scene that is missing from the live list', async () => {
    const list = { success: true, app: 'obs', appLabel: 'OBS Studio', scenes: [{ id: 'a', name: 'Gameplay' }] };
    const o = picker.buildSceneOptions(list, 'Old Scene');
    assert.deepStrictEqual(o.map((x) => x.value), ['', 'Gameplay', 'Old Scene', picker.MANUAL]);
    assert.ok(o[2].missing && o[2].selected);
    assert.match(o[2].label, /not in OBS Studio list/);
    const o2 = picker.buildSceneOptions(list, 'Gameplay');
    assert.ok(o2[1].selected);
    assert.strictEqual(o2.length, 3);
  });

  await test('describeStatus names the source app or explains the manual fallback', async () => {
    assert.strictEqual(picker.describeStatus({ success: true, app: 'obs', appLabel: 'OBS Studio', scenes: [1, 2], connected: ['obs', 'streamlabs'] }).text, 'Loaded 2 scenes from OBS Studio (also connected: streamlabs)');
    const s = picker.describeStatus({ success: false, error: 'No streaming app connected (Meld Studio, OBS or Streamlabs Desktop)' });
    assert.strictEqual(s.kind, 'error');
    assert.match(s.text, /type the scene name below/);
  });

  obs.wss.close();
  sl.server.close();
  console.log(`\n${passed} scene-provider tests passed${process.exitCode ? ' (with failures)' : ''}`);
  setTimeout(() => process.exit(process.exitCode || 0), 50);
})();
