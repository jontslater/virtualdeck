#!/usr/bin/env node
/**
 * Tests for macro trigger_button deck catalog + normalization.
 */

const assert = require('assert');
const {
  buildDeckButtonCatalog,
  normalizeTriggerButtonArguments,
  normalizeMacroTriggerButtonSteps,
  resolveTriggerButtonByLabel,
  filterCatalogBySearch,
  applyTriggerButtonPick,
} = require('./lib/macro-button-picker');
const { registry } = require('./jarvis-tools');
const MacroManager = require('./lib/macro-manager');
const os = require('os');
const path = require('path');
const fs = require('fs');

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✅ ${name}`);
    })
    .catch((err) => {
      console.error(`❌ ${name}:`, err.message || err);
      process.exitCode = 1;
    });
}

const catalog = buildDeckButtonCatalog([
  {
    profileId: 'default',
    profileName: 'Main Deck',
    buttons: [
      { id: 'b_1', label: 'Sound A' },
      { id: 'b_2', name: 'BRB' },
    ],
  },
  {
    profileId: 'profile_2',
    profileName: 'Alt Deck',
    buttons: [{ id: 'b_3', label: 'BRB' }],
  },
]);

(async () => {
  console.log('🧪 Macro button picker tests\n');

  await test('buildDeckButtonCatalog disambiguates duplicate labels with profile name', () => {
    const brb = catalog.filter((c) => c.label === 'BRB');
    assert.strictEqual(brb.length, 2);
    assert.ok(brb.every((c) => c.displayLabel.includes('(')));
    const unique = catalog.find((c) => c.buttonId === 'b_1');
    assert.strictEqual(unique.displayLabel, 'Sound A');
  });

  await test('normalizeTriggerButtonArguments upgrades label-only to buttonId', () => {
    const norm = normalizeTriggerButtonArguments({ label: 'Sound A' }, catalog, 'default');
    assert.strictEqual(norm.upgraded, true);
    assert.strictEqual(norm.arguments.buttonId, 'b_1');
    assert.strictEqual(norm.arguments.label, 'Sound A');
  });

  await test('normalizeTriggerButtonArguments prefers active profile on ambiguous names', () => {
    const norm = normalizeTriggerButtonArguments({ label: 'BRB' }, catalog, 'profile_2');
    assert.strictEqual(norm.arguments.buttonId, 'b_3');
  });

  await test('normalizeTriggerButtonArguments warns when button id is missing', () => {
    const norm = normalizeTriggerButtonArguments(
      { buttonId: 'gone', label: 'Old Sound' },
      catalog,
      'default',
    );
    assert.strictEqual(norm.missing, true);
    assert.ok(norm.warnings[0].includes('deleted'));
  });

  await test('normalizeMacroTriggerButtonSteps upgrades legacy macro steps', () => {
    const { steps, warnings } = normalizeMacroTriggerButtonSteps(
      [{ tool: 'trigger_button', arguments: { label: 'Sound A' } }],
      catalog,
      'default',
    );
    assert.strictEqual(steps[0].arguments.buttonId, 'b_1');
    assert.strictEqual(warnings.length, 0);
  });

  await test('filterCatalogBySearch matches label and profile name', () => {
    const hits = filterCatalogBySearch(catalog, 'alt');
    assert.ok(hits.some((h) => h.profileName === 'Alt Deck'));
  });

  await test('applyTriggerButtonPick stores buttonId and canonical label', () => {
    const args = applyTriggerButtonPick({}, 'b_2', catalog);
    assert.strictEqual(args.buttonId, 'b_2');
    assert.strictEqual(args.label, 'BRB');
  });

  await test('applyTriggerButtonPick clears args when selection empty', () => {
    const args = applyTriggerButtonPick({ buttonId: 'b_1', label: 'Sound A' }, '', catalog);
    assert.strictEqual(args.buttonId, undefined);
    assert.strictEqual(args.label, undefined);
  });

  await test('trigger_button JARVIS tool triggers by buttonId via triggerDeckButtonFn', async () => {
    let captured = null;
    const prev = registry.context.triggerDeckButtonFn;
    registry.setContext({
      ...registry.context,
      currentActiveProfile: 'default',
      loadProfile: () => ({ buttons: [{ id: 'b_1', label: 'BRB' }] }),
      triggerDeckButtonFn: (ref) => {
        captured = ref;
        return true;
      },
    });
    const r = await registry.invoke('trigger_button', { buttonId: 'b_1', label: 'BRB' });
    registry.setContext({ ...registry.context, triggerDeckButtonFn: prev });
    assert.strictEqual(r.success, true);
    assert.strictEqual(captured.buttonId, 'b_1');
  });

  await test('MacroManager rejects trigger_button step without button reference', () => {
    const dir = path.join(os.tmpdir(), 'vd-macro-btn-' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
    const mm = new MacroManager(dir);
    const v = mm.validate({
      name: 'T',
      steps: [{ tool: 'trigger_button', arguments: {} }],
    });
    assert.strictEqual(v.valid, false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('resolveTriggerButtonByLabel reports ambiguous matches', () => {
    const r = resolveTriggerButtonByLabel('BRB', catalog, null);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'ambiguous');
  });

  console.log(`\n${passed} macro button picker tests passed${process.exitCode ? ' (with failures)' : ''}`);
})();
