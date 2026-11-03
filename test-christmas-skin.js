const assert = require('assert');
const fs = require('fs');
const path = require('path');

const skinPath = path.join(__dirname, 'skins', 'christmas.json');
const raw = fs.readFileSync(skinPath, 'utf8');
const skin = JSON.parse(raw);

assert.strictEqual(skin.name, 'Christmas (Cartoon)');
assert.strictEqual(skin.version, '1.0.0');
assert.ok(skin.description, 'description present');
assert.ok(skin.author, 'author present');
assert.ok(skin.variables && typeof skin.variables === 'object');
assert.ok(skin.css && typeof skin.css === 'string');
assert.ok(skin.components && typeof skin.components === 'object');

const palette = ['#E62832', '#28AA50', '#FFCD28', '#FFFFFF', '#14183C'];
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
  'candy-cane slider thumb for range inputs',
);
assert.ok(
  skin.css.includes('#twitch-chat-messages > div') && skin.css.includes('!important'),
  'chat message bubbles styled with !important',
);
assert.ok(skin.css.includes('data:image/png;base64,'), 'chat css uses embedded images');

console.log('✅ test-christmas-skin.js passed');
