/**
 * Voice -> saved macro: deterministic phrase matching (lib/macro-voice.js), run_voice_macro /
 * run_macro / list_macros JARVIS tools, and parity with the hotkey executor (main.js executeMacroById).
 * No real Discord / scene / Twitch calls: those tools are replaced with recorders.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { matchMacroByUtterance, normalizeUtterance, summarizeMacroRun } = require('./lib/macro-voice');
const MacroManager = require('./lib/macro-manager');
const { registry } = require('./jarvis-tools');
const { isJarvisMacroToolAllowed } = require('./lib/jarvis-macro-allowlist');

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log('  ok', name); } catch (err) { console.error('  FAIL', name, '\n', err); process.exitCode = 1; }
}

const MACROS = [
  { id: 'going-live', name: 'Going Live', enabled: true, triggers: { phrase: 'raven we are going live' } },
  { id: 'start-stream', name: 'Start Stream', enabled: true, triggers: { phrase: 'start stream' } },
  { id: 'brb', name: 'BRB', enabled: true, triggers: { phrase: 'be right back' } },
  { id: 'old', name: 'Old Intro', enabled: false, triggers: { phrase: 'old intro' } },
];
const WAKE = { wakeNames: ['Raven'] };
const pick = (u, ms = MACROS) => { const r = matchMacroByUtterance(ms, u, WAKE); return r.matched ? r.macro.id : (r.ambiguous ? 'AMBIGUOUS' : null); };

(async () => {
  console.log('matcher');
  await test('trigger phrase matches with or without the wake name, contractions, fillers and punctuation', async () => {
    assert.strictEqual(pick('we are going live'), 'going-live'); // Raven strips the wake word before forwarding
    assert.strictEqual(pick('Raven, we\u2019re going live!'), 'going-live');
    assert.strictEqual(pick('hey raven we are going live now'), 'going-live');
    assert.strictEqual(pick('start the stream'), 'start-stream');
    assert.strictEqual(pick('ok start up my stream please'), 'start-stream');
    assert.strictEqual(pick('BE RIGHT BACK.'), 'brb');
  });
  await test('negations, unrelated speech and disabled macros do not trigger', async () => {
    assert.strictEqual(pick("don't start stream yet"), null);
    assert.strictEqual(pick('do not start the stream'), null);
    assert.strictEqual(pick('what scene are we on'), null);
    assert.strictEqual(pick('old intro'), null);
    assert.strictEqual(pick(''), null);
  });
  await test('explicit "run the <name> macro" form', async () => {
    assert.strictEqual(pick('run the going live macro'), 'going-live');
    assert.strictEqual(pick('BRB macro'), 'brb');
    assert.strictEqual(pick('start stream macro'), 'start-stream');
    assert.strictEqual(pick('tell me about going live'), null); // name alone without run/macro is not a trigger
  });
  await test('scene switch phrases survive Whisper variants (switched/to/digits) and stay distinct', async () => {
    const ms = [
      { id: 's1', name: 'Scene 1', enabled: true, triggers: { phrase: 'Raven switch scene one' } },
      { id: 's2', name: 'scene 2', enabled: true, triggers: { phrase: 'raven switch scene two' } },
    ];
    assert.strictEqual(pick('Raven switch scene one.', ms), 's1');
    assert.strictEqual(pick('Hey Raven, switch scene one.', ms), 's1');
    assert.strictEqual(pick('switch scene 1', ms), 's1');
    assert.strictEqual(pick('Raven switched scene to.', ms), 's2');
    assert.strictEqual(pick('switch scene two', ms), 's2');
    assert.strictEqual(pick('switch to scene 2', ms), 's2');
    assert.strictEqual(pick('switch scene too', ms), 's2');
    assert.strictEqual(pick('switched scene to', ms), 's2');
    assert.strictEqual(pick('switch to scene', ms), null);
  });
  await test('longest phrase wins; true ties are reported as ambiguous instead of guessing', async () => {
    const ms = [
      { id: 'a', name: 'A', enabled: true, triggers: { phrase: 'go live' } },
      { id: 'b', name: 'B', enabled: true, triggers: { phrase: 'go live on twitch' } },
      { id: 'c', name: 'C', enabled: true, triggers: { phrase: 'go live' } },
    ];
    assert.strictEqual(pick('go live on twitch', ms), 'b');
    assert.strictEqual(pick('go live', ms), 'AMBIGUOUS');
  });
  await test('normalizeUtterance + summary text', async () => {
    assert.strictEqual(normalizeUtterance("Let's   GO, we're live!"), 'let us go we are live');
    assert.strictEqual(summarizeMacroRun({ success: true, macro: 'Going Live', steps: [{ success: true }, { success: true }], totalSteps: 2 }), 'Going Live finished: 2 of 2 steps OK.');
    assert.strictEqual(
      summarizeMacroRun({ success: false, macro: 'Going Live', totalSteps: 3, steps: [{ step: 1, success: true }, { step: 2, tool: 'discord_announce_live', description: 'Post to Discord', success: false, error: 'Discord webhook not configured' }] }),
      'Going Live failed at step 2 (Post to Discord): Discord webhook not configured. 1 later step was skipped.');
  });

  console.log('JARVIS tools');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-voice-macro-'));
  fs.writeFileSync(path.join(dir, 'raven.env'), 'HOST_WAKE_NAMES=Raven\n');
  fs.writeFileSync(path.join(dir, 'macros.json'), JSON.stringify({
    'going-live': {
      name: 'Going Live', description: 'Start stream', enabled: true,
      triggers: { phrase: 'raven we are going live', hotkey: 'CommandOrControl+Alt+L' },
      steps: [
        { tool: 'change_scene', arguments: { sceneName: 'Starting Soon' }, description: 'Switch to Starting Soon' },
        { tool: 'discord_announce_live', arguments: { message: 'Live now!' }, description: 'Post to Discord' },
      ],
    },
    brb: { name: 'BRB', enabled: true, triggers: { phrase: 'be right back' }, steps: [{ tool: 'change_scene', arguments: { sceneName: 'BRB' } }] },
  }, null, 2));
  const macroManager = new MacroManager(dir);

  // Recorders instead of real scene/Discord tools
  const origAnnounce = registry.tools.get('discord_announce_live');
  const calls = [];
  let discordResult = { success: true, posted: true };
  registry.register('change_scene', { description: 'x', parameters: { type: 'object', properties: {} } }, async (a) => { calls.push(['change_scene', a]); return { success: true, scene: a.sceneName }; });
  registry.register('discord_announce_live', { description: 'x', parameters: { type: 'object', properties: {} } }, async (a) => { calls.push(['discord_announce_live', a]); return discordResult; });

  // Stand-in for main.js executeMacroById: same shape, uses registry.runMacroSteps like main does
  const executorCalls = [];
  const executeMacroById = async (id, source) => {
    executorCalls.push([id, source]);
    const macro = macroManager.get(id);
    const inner = await registry.runMacroSteps({ id, ...macro });
    const failed = inner.steps.find((s) => !s.success);
    return { success: inner.success, macro: inner.macro, steps: inner.steps, totalSteps: macro.steps.length, error: inner.success ? undefined : (failed && failed.error), source };
  };
  registry.setContext({ macroManager, executeMacroById });

  await test('run_voice_macro runs the SAVED steps (saved scene + Discord post) via the hotkey executor', async () => {
    calls.length = 0; executorCalls.length = 0;
    const r = await registry.invoke('run_voice_macro', { utterance: 'we are going live' });
    assert.strictEqual(r.success, true);
    const res = r.result;
    assert.strictEqual(res.matched, true);
    assert.strictEqual(res.success, true, JSON.stringify(res));
    assert.strictEqual(res.id, 'going-live');
    assert.deepStrictEqual(executorCalls, [['going-live', 'voice']]);
    assert.deepStrictEqual(calls, [['change_scene', { sceneName: 'Starting Soon' }], ['discord_announce_live', { message: 'Live now!' }]]);
    assert.strictEqual(res.summary, 'Going Live finished: 2 of 2 steps OK.');
  });

  await test('voice and hotkey paths execute identical tool calls', async () => {
    calls.length = 0;
    await executeMacroById('going-live', 'hotkey');
    const hotkeyCalls = calls.splice(0);
    await registry.invoke('run_voice_macro', { utterance: 'Raven, we\'re going live' });
    assert.deepStrictEqual(calls, hotkeyCalls);
  });

  await test('failed step is returned per-step with a spoken summary Raven can say', async () => {
    discordResult = { success: false, error: 'Discord webhook not configured' };
    const r = (await registry.invoke('run_voice_macro', { utterance: 'we are going live' })).result;
    discordResult = { success: true };
    assert.strictEqual(r.matched, true);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.steps[1].success, false);
    assert.strictEqual(r.summary, 'Going Live failed at step 2 (Post to Discord): Discord webhook not configured.');
  });

  await test('non-matching utterance runs nothing and reports matched:false (Raven falls back to the LLM)', async () => {
    calls.length = 0; executorCalls.length = 0;
    const r = (await registry.invoke('run_voice_macro', { utterance: 'switch to gameplay' })).result;
    assert.strictEqual(r.matched, false);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(executorCalls.length, 0);
  });

  await test('run_macro resolves id, name or phrase and uses the same executor', async () => {
    for (const ref of ['going-live', 'Going Live', 'going live', 'raven we are going live', 'Start the stream']) {
      executorCalls.length = 0;
      const r = (await registry.invoke('run_macro', { id: ref })).result;
      if (ref === 'Start the stream') { assert.strictEqual(r.success, false); assert.match(r.error, /Saved macros: Going Live \(going-live\), BRB \(brb\)/); assert.strictEqual(executorCalls.length, 0); continue; }
      assert.strictEqual(r.success, true, ref);
      assert.deepStrictEqual(executorCalls, [['going-live', 'jarvis']], ref);
    }
  });

  await test('list_macros exposes id/name/phrase/steps for Raven', async () => {
    const r = (await registry.invoke('list_macros', {})).result;
    assert.strictEqual(r.success, true);
    const gl = r.macros.find((m) => m.id === 'going-live');
    assert.deepStrictEqual(gl, { id: 'going-live', name: 'Going Live', description: 'Start stream', phrase: 'raven we are going live', enabled: true, steps: ['change_scene', 'discord_announce_live'] });
  });

  await test('without the main executor (unit context) run_macro still runs steps', async () => {
    registry.setContext({ executeMacroById: undefined });
    calls.length = 0;
    const r = (await registry.invoke('run_macro', { id: 'brb' })).result;
    assert.strictEqual(r.success, true);
    assert.deepStrictEqual(calls, [['change_scene', { sceneName: 'BRB' }]]);
    registry.setContext({ executeMacroById });
  });

  await test('meta tools cannot be used as macro steps; run_macro steers the LLM away from raw steps', async () => {
    for (const t of ['run_macro', 'run_voice_macro', 'list_macros']) assert.strictEqual(isJarvisMacroToolAllowed(t), false, t);
    assert.match(registry.tools.get('run_macro').description, /never recreate a macro's steps/);
  });

  await test('main.js executeMacroById uses the shared step runner (no recursion via run_macro) and is exposed to JARVIS', async () => {
    const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
    assert.ok(main.includes('jarvisRegistry.runMacroSteps('));
    assert.ok(!main.includes("jarvisRegistry.invoke('run_macro'"));
    assert.ok(/jarvisRegistry\.setContext\(\{\s*executeMacroById:/.test(main));
  });

  await test('discord_announce_live reports a failed Discord post as a failure (was wrapped as success)', async () => {
    registry.tools.set('discord_announce_live', origAnnounce);
    registry.register('discord_send_message', { description: 'x', parameters: { type: 'object', properties: {} } }, async () => ({ success: false, error: 'Discord webhook not configured' }));
    const r = (await registry.invoke('run_voice_macro', { utterance: 'we are going live' })).result;
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.steps[1].success, false);
    assert.strictEqual(r.steps[1].error, 'Discord webhook not configured');
    registry.register('discord_send_message', { description: 'x', parameters: { type: 'object', properties: {} } }, async () => ({ success: true, messageId: '1' }));
    const ok = (await registry.invoke('run_voice_macro', { utterance: 'we are going live' })).result;
    assert.strictEqual(ok.success, true);
    assert.deepStrictEqual(ok.steps[1].result, { success: true, messageId: '1' });
  });

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${passed} voice-macro tests passed${process.exitCode ? ' (with failures)' : ''}`);
})();
