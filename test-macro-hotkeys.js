#!/usr/bin/env node
// Macro global hotkeys + Test button: parsing, conflicts, registration, execution path and step feedback.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./public/macro-hotkeys');
const { MacroHotkeyRegistrar } = require('./lib/macro-hotkey-registrar');
const MacroManager = require('./lib/macro-manager');

// --- parse / normalize ---
assert.deepStrictEqual(H.parseAccelerator('ctrl+shift+1'), { valid: true, accelerator: 'Ctrl+Shift+1', errors: [] });
assert.strictEqual(H.parseAccelerator('Shift+Control+g').accelerator, 'Ctrl+Shift+G');
assert.strictEqual(H.parseAccelerator('CommandOrControl+Alt+F5').accelerator, 'Ctrl+Alt+F5');
assert.strictEqual(H.parseAccelerator('F13').valid, true);
assert.strictEqual(H.parseAccelerator('A').valid, false, 'bare letter needs a modifier');
assert.strictEqual(H.parseAccelerator('Ctrl+Shift').valid, false, 'modifiers only');
assert.strictEqual(H.parseAccelerator('Ctrl+A+B').valid, false, 'two keys');
assert.strictEqual(H.parseAccelerator('Ctrl+Banana').valid, false);
assert.strictEqual(H.parseAccelerator('F12').valid, false, 'F12 reserved (DevTools)');
assert.strictEqual(H.parseAccelerator('').valid, false);

// --- conflicts / duplicates ---
const macros = [
  { id: 'a', name: 'Going Live', triggers: { hotkey: 'Ctrl+Shift+L' } },
  { id: 'b', name: 'BRB', triggers: { hotkey: null } },
];
assert.deepStrictEqual(H.findHotkeyConflicts({ hotkey: 'shift+ctrl+l', macroId: 'b', macros }), ['Already used by macro "Going Live"']);
assert.deepStrictEqual(H.findHotkeyConflicts({ hotkey: 'Ctrl+Shift+L', macroId: 'a', macros }), [], 'own hotkey is not a conflict');
assert.deepStrictEqual(
  H.findHotkeyConflicts({ hotkey: 'Ctrl+Alt+1', macroId: 'b', macros, buttonHotkeys: [{ label: 'Airhorn', hotkey: 'Control+Alt+1' }] }),
  ['Already used by button "Airhorn"']);

// --- key capture ---
assert.deepStrictEqual(H.acceleratorFromKeyEvent({ ctrlKey: true, shiftKey: true, code: 'Digit1' }), { accelerator: 'Ctrl+Shift+1', complete: true });
assert.deepStrictEqual(H.acceleratorFromKeyEvent({ ctrlKey: true, code: 'ControlLeft' }), { accelerator: 'Ctrl', complete: false });
assert.strictEqual(H.acceleratorFromKeyEvent({ altKey: true, code: 'Numpad7' }).accelerator, 'Alt+num7');
assert.strictEqual(H.acceleratorFromKeyEvent({ code: 'F15' }).accelerator, 'F15');

// --- registrar: registers enabled macros, skips disabled, reports conflicts, only unregisters its own ---
function fakeShortcut(taken = []) {
  const reg = new Map(taken.map((t) => [t, () => {}]));
  return {
    reg,
    register(a, cb) { if (reg.has(a)) return false; reg.set(a, cb); return true; },
    unregister(a) { reg.delete(a); },
    isRegistered(a) { return reg.has(a); },
  };
}
const gs = fakeShortcut(['Ctrl+Alt+9']); // button hotkey already registered
const fired = [];
const r = new MacroHotkeyRegistrar({ globalShortcut: gs, onTrigger: (id) => fired.push(id), log: { warn() {} } });
const res = r.sync([
  { id: 'm1', enabled: true, triggers: { hotkey: 'ctrl+shift+1' } },
  { id: 'm2', enabled: false, triggers: { hotkey: 'Ctrl+Shift+2' } },
  { id: 'm3', enabled: true, triggers: { hotkey: 'Ctrl+Alt+9' } },
  { id: 'm4', enabled: true, triggers: { hotkey: 'Shift+Ctrl+1' } },
]);
assert.deepStrictEqual(res.registered, [{ id: 'm1', hotkey: 'Ctrl+Shift+1' }]);
assert.deepStrictEqual(res.failed.map((f) => f.id), ['m3', 'm4']);
gs.reg.get('Ctrl+Shift+1')();
assert.deepStrictEqual(fired, ['m1'], 'hotkey runs the macro');
r.sync([{ id: 'm1', enabled: true, triggers: { hotkey: 'Ctrl+Shift+5' } }]);
assert.ok(!gs.reg.has('Ctrl+Shift+1'), 'old macro hotkey unregistered on change');
assert.ok(gs.reg.has('Ctrl+Shift+5'));
assert.ok(gs.reg.has('Ctrl+Alt+9'), 'button hotkey left alone');
r.sync([]);
assert.ok(!gs.reg.has('Ctrl+Shift+5'), 'unregistered when macro removed');

// --- persistence in macros.json + validation ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-macro-hk-'));
const mm = new MacroManager(tmp);
const good = { name: 'Hk', triggers: { phrase: null, button: null, hotkey: 'Ctrl+Shift+H' }, steps: [{ tool: 'change_scene', arguments: { sceneName: 'X' } }], enabled: true };
assert.ok(mm.validate(good).valid);
mm.set('hk', good);
const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, 'macros.json'), 'utf8'));
assert.strictEqual(onDisk.hk.triggers.hotkey, 'Ctrl+Shift+H', 'hotkey persisted in macros.json');
const bad = { ...good, triggers: { hotkey: 'Q' } };
assert.ok(mm.validate(bad).errors.some((e) => /Hotkey/.test(e)));

// --- run_macro (button / hotkey / Test path): real per-step success, stop on failure ---
(async () => {
  const { registry } = require('./jarvis-tools');
  const calls = [];
  const fakeTools = {
    change_scene: async () => ({ success: true, scene: 'X' }),
    start_raid: async () => ({ success: false, error: 'Target must be in favorites or raid history' }),
    send_twitch_message: async () => { calls.push('chat'); return { success: true }; },
  };
  const realInvoke = registry.invoke.bind(registry);
  registry.invoke = async (name, args) => {
    if (name === 'run_macro') return realInvoke(name, args);
    calls.push(name);
    if (!fakeTools[name]) return { success: false, error: 'unknown' };
    return { success: true, result: await fakeTools[name](args) };
  };
  registry.setContext({ macroManager: mm });
  mm.set('t1', { name: 'T1', triggers: {}, enabled: true, steps: [
    { tool: 'change_scene', arguments: { sceneName: 'X' } },
    { tool: 'start_raid', arguments: { login: 'x', confirmed: true } },
    { tool: 'send_twitch_message', arguments: { text: 'hi' } },
  ] });
  const wrapped = await realInvoke('run_macro', { id: 't1' });
  const out = wrapped.result;
  assert.strictEqual(out.success, false, 'inner tool failure is a macro failure');
  assert.deepStrictEqual(out.steps.map((s) => s.success), [true, false]);
  assert.ok(!calls.includes('chat'), 'stops after failing step');
  const rows = H.formatMacroRunSteps(out);
  assert.deepStrictEqual(rows.map((x) => x.ok), [true, false]);
  assert.match(rows[1].detail, /favorites/);

  // main.js wiring (static): one shared execution path with validation, hotkeys synced on change
  const main = fs.readFileSync('main.js', 'utf8');
  assert.ok(/async function executeMacroById\(id, source\)/.test(main));
  assert.ok(/ipcMain\.handle\('execute-macro'[\s\S]{0,200}executeMacroById\(id, 'ui'\)/.test(main));
  assert.ok(/onTrigger: \(id\) => runMacroFromHotkey\(id\)/.test(main));
  assert.ok((main.match(/syncMacroHotkeys\(\);/g) || []).length >= 3, 'sync on startup/register, save, delete');
  const ui = fs.readFileSync('public/macros-ui.js', 'utf8');
  assert.ok(ui.includes("executeMacro(") && ui.includes('formatMacroRunSteps'), 'Test uses executeMacro + step feedback');
  const html = fs.readFileSync('public/index.html', 'utf8');
  for (const id of ['macro-hotkey', 'macro-hotkey-clear', 'test-macro-btn', 'macro-test-results']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.indexOf('macro-hotkeys.js') < html.indexOf('macros-ui.js'));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\u2705 test-macro-hotkeys.js passed');
})().catch((e) => { console.error(e); process.exit(1); });
