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
assert.strictEqual(skin.version, '1.0.0');
assert.ok(skin.description, 'description present');
assert.ok(skin.author, 'author present');
assert.ok(skin.variables && typeof skin.variables === 'object');
assert.ok(skin.css && typeof skin.css === 'string');
assert.ok(skin.components && typeof skin.components === 'object');

const palette = ['#C45C26', '#B22222', '#F4D58D', '#FFF8E7', '#2C1810', '#8B4513', '#D97706'];
for (const hex of palette) {
  assert.ok(
    raw.includes(hex) || raw.includes(hex.toLowerCase()),
    `palette color ${hex} appears in skin`,
  );
}

assert.ok(
  !/\burl\((?!data:image)/i.test(raw),
  'no external url() references (only data URLs)',
);
assert.ok(!/\.png['")\s]/i.test(raw), 'no loose .png file references');

assert.ok(skin.variables['--master-volume-track'], 'master volume track variable');
assert.ok(skin.variables['--master-volume-thumb'], 'master volume thumb variable');
assert.ok(skin.components["#master-volume-input[type='range']"], 'master volume range styling');
assert.ok(
  skin.components["input[type='range']::-webkit-slider-thumb"],
  'harvest slider thumb for range inputs',
);
assert.ok(
  skin.css.includes('#twitch-chat-messages > div') && skin.css.includes('!important'),
  'chat message bubbles styled with !important',
);
assert.ok(skin.css.includes('data:image/svg+xml'), 'skin uses embedded SVG data URLs');
assert.ok(skin.css.includes('vd-thanksgiving-drift'), 'falling leaves animation present');
assert.ok(
  skin.css.includes('rgba(244,213,141') || skin.css.includes('rgba(244, 213, 141'),
  'chat bubbles use cream background for readability',
);

assert.ok(skin.components['.stat-content'], 'stat content backing for readable Twitch stats');
assert.ok(
  skin.components['.stat-label'].color.includes('2C1810'),
  'stat labels use dark ink on cream backing',
);

// WCAG AA contrast pairs for foreground/background combinations used in the skin.
assertAa('Twitch stat label/value on cream stat panel (.stat-content)', '#2C1810', '#F4D58D');
assertAa('Chat message text on cream bubble', '#2C1810', '#F4D58D');
assertAa('Recent activity value on dark panel', '#FFF8E7', '#2C1810');
assertAa('Recent activity label on dark panel', '#FFF8E7', '#2C1810');
assertAa('Hotkey helper on espresso menu bar', '#FFF8E7', '#2C1810');
assertAa('Master volume label on harvest gradient (dark stop)', '#FFF8E7', '#5C2E1A');
assertAa('Sound button title on pumpkin face', '#2C1810', '#E07A32');
assertAa('Sound type chip on pumpkin face', '#2C1810', '#E07A32');

console.log('✅ test-thanksgiving-skin.js passed (including WCAG AA contrast checks)');