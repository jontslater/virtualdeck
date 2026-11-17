#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { planThemeApply } = require('./lib/theme-apply-plan');

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');

assert.ok(
  script.includes('async applyImportedSkin(importResult)'),
  'ThemeManager defines applyImportedSkin',
);
assert.ok(
  script.includes('async applyThemeImmediate(themeName'),
  'ThemeManager defines applyThemeImmediate with force option',
);
assert.ok(
  script.includes('refreshOpenUiForTheme()'),
  'ThemeManager refreshes open UI after theme apply',
);

assert.ok(
  script.includes('await tm.applyImportedSkin(result)'),
  'in-app Tools > Import Theme calls applyImportedSkin on theme manager',
);
assert.ok(
  !script.includes('themeManager.setTheme(result.id)'),
  'import flow must not call setTheme on uninitialized themeManager local',
);

assert.ok(
  script.includes('themeManager = window.themeManager'),
  'themeManager local alias is wired after ThemeManager init',
);

const plan = planThemeApply('christmas-cartoon', [], { force: true });
assert.strictEqual(plan.apply, true);
assert.strictEqual(plan.reason, 'forced-after-import');

const blocked = planThemeApply('christmas-cartoon', []);
assert.strictEqual(blocked.apply, false);
assert.strictEqual(blocked.reason, 'unknown-skin');

const listed = planThemeApply('christmas-cartoon', ['christmas-cartoon']);
assert.strictEqual(listed.apply, true);
assert.strictEqual(listed.reason, 'listed-skin');

console.log('✅ test-theme-import-apply.js passed');
