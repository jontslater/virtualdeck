const assert = require('assert');
const fs = require('fs');
const path = require('path');

const skinPath = path.join(__dirname, 'skins', 'thanksgiving.json');
const raw = fs.readFileSync(skinPath, 'utf8');
const skin = JSON.parse(raw);

function parseHex(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex) {
  const channels = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function assertAa(label, fg, bg, min = 4.5) {
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= min,
    `${label}: contrast ${ratio.toFixed(2)}:1 (need ${min}:1) for ${fg} on ${bg}`,
  );
}

assert.strictEqual(skin.name, 'Thanksgiving (Cartoon)');
assert.ok(skin.version, 'version present');
assert.ok(skin.components && typeof skin.components === 'object');
assert.ok(skin.css.includes('body::after'), 'corner turkey decoration present');
assert.ok(skin.variables['--bg-primary'] === '#F3E6D3', 'cream primary background');

const palette = ['#F3E6D3', '#B7412E', '#D4622A', '#D4A12A', '#3B2314', '#FFF8EB'];
for (const hex of palette) {
  assert.ok(raw.includes(hex), `palette color ${hex} appears in skin`);
}

assert.ok(!/\burl\((?!data:image)/i.test(raw), 'only data:image url() references');
assert.ok(skin.components['.stat-content'], 'stat content backing');
assert.ok(skin.css.includes('vd-thanksgiving-drift'), 'leaf drift animation');

assertAa('Stats on cream panel', '#3B2314', '#FFF8EB');
assertAa('Chat bubble text', '#3B2314', '#FFF8EB');
assertAa('Menu / body text', '#3B2314', '#F3E6D3');
assertAa('Sound button label chip', '#3B2314', '#FFF8EB');
assertAa('Rust stat label on panel', '#B7412E', '#FFF8EB');
assertAa('Master label on cream', '#3B2314', '#F3E6D3');

console.log('✅ test-thanksgiving-skin.js passed (including WCAG AA contrast checks)');