// Tests for the shared alert text renderer (WYSIWYG alert preview == overlay).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('./public/alert-text-render.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); process.exitCode = 1; }
}
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');

console.log('alert WYSIWYG tests');

test('font size parsing: px strings, numbers, other units -> canvas px', () => {
  assert.strictEqual(T.parseFontSizePx('72px'), 72);
  assert.strictEqual(T.parseFontSizePx('24'), 24);
  assert.strictEqual(T.parseFontSizePx(24), 24);          // button slots store numbers
  assert.strictEqual(T.parseFontSizePx(' 48PX '), 48);
  assert.strictEqual(T.parseFontSizePx('2em'), 32);
  assert.strictEqual(T.parseFontSizePx('3rem'), 48);
  assert.strictEqual(T.parseFontSizePx('5vh'), 54);       // 5% of 1080
  assert.strictEqual(T.parseFontSizePx('5vw'), 96);       // 5% of 1920
  assert.strictEqual(T.parseFontSizePx('18pt'), 24);
  assert.strictEqual(T.parseFontSizePx('garbage', 30), 30);
  assert.strictEqual(T.parseFontSizePx(undefined, 30), 30);
  assert.strictEqual(T.parseFontSizePx('-5px', 30), 30);
  assert.strictEqual(T.parseFontSizePx('2px'), T.MIN_FONT_PX);
  assert.strictEqual(T.parseFontSizePx('5000px'), T.MAX_FONT_PX);
  assert.strictEqual(T.normalizeFontSize(24), '24px');
});

test('legacy saved alert keeps its px size (live output unchanged), gains styleVersion', () => {
  const legacy = { position: 'center', fontFamily: "'Impact', sans-serif", fontSize: '72px', fontWeight: '700', color: '#ff0000', textShadow: 'none', textStroke: '2px #000' };
  const m = T.migrateAlertTextStyling(legacy);
  assert.strictEqual(m.fontSize, '72px');
  assert.strictEqual(m.styleVersion, 2);
  assert.strictEqual(m.fontFamily, "'Impact', sans-serif");
  assert.strictEqual(legacy.styleVersion, undefined, 'input not mutated');
  assert.strictEqual(T.migrateAlertTextStyling({ fontSize: 40 }).fontSize, '40px');
  assert.strictEqual(T.migrateAlertTextStyling({}).fontSize, '24px'); // old payload default
  assert.strictEqual(T.migrateAlertTextStyling({ position: 'bogus' }).position, 'topCenter');
  assert.strictEqual(T.migrateAlertTextStyling(null).position, 'topCenter');
});

test('alertToSlot carries EVERY style field + animation into the payload', () => {
  const alert = {
    textStyling: { position: 'bottomLeft', fontFamily: "'Georgia', serif", fontSize: '150px', fontWeight: '900', color: '#12ab34', textShadow: '0 0 10px rgba(255,255,255,0.8)', textStroke: '3px #000' },
    animation: { type: 'bounceIn', duration: '2s', delay: '0.5s', iteration: 'infinite', easing: 'ease-in-out' }
  };
  const b = T.alertToSlot(alert, 'Hi TestUser');
  assert.strictEqual(b.position, 'bottomLeft');
  assert.strictEqual(b.slot.text, 'Hi TestUser');
  assert.deepStrictEqual(
    { f: b.slot.style.fontFamily, s: b.slot.style.fontSize, w: b.slot.style.fontWeight, c: b.slot.style.color, sh: b.slot.style.textShadow, st: b.slot.style.webkitTextStroke },
    { f: "'Georgia', serif", s: '150px', w: '900', c: '#12ab34', sh: '0 0 10px rgba(255,255,255,0.8)', st: '3px #000' });
  assert.deepStrictEqual(b.slot.animation, { name: 'bounceIn', duration: '2s', delay: '0.5s', iterationCount: 'infinite', timingFunction: 'ease-in-out' });
  assert.strictEqual(T.alertToSlot({ animation: { type: 'none' } }, 'x').slot.animation, null);
  assert.strictEqual(T.alertToSlot({ textStyling: { textStroke: 'none' } }, 'x').slot.style.webkitTextStroke, '');
});

test('slot payload survives JSON (websocket) round trip', () => {
  const b = T.alertToSlot({ textStyling: { fontSize: '120px', color: '#abcdef' } }, 'x');
  const back = JSON.parse(JSON.stringify({ slots: { [b.position]: b.slot } }));
  assert.deepStrictEqual(back.slots[b.position], b.slot);
});

test('buildTextSlotCss applies size/font/color/weight/shadow/stroke in canvas px', () => {
  const css = T.buildTextSlotCss('center', { fontFamily: 'Verdana', fontSize: '150px', color: '#123456', fontWeight: '900', textShadow: '2px 2px 4px #000', webkitTextStroke: '3px #fff' });
  for (const want of ['font-size: 150px;', 'font-family: Verdana;', 'color: #123456;', 'font-weight: 900;', 'text-shadow: 2px 2px 4px #000;', '-webkit-text-stroke: 3px #fff;', 'top: 540px;', 'width: 1920px;', 'transform: translateY(-50%);'])
    assert.ok(css.includes(want), 'missing ' + want + ' in ' + css);
  assert.ok(!/\d(vw|vh)\b/.test(css), 'no viewport units: ' + css);
});

test('button slots: numeric fontSize, bold/italic honoured (was invalid CSS -> 64px fallback)', () => {
  const r = T.resolveSlotStyle({ fontFamily: 'Inter', fontSize: 24, color: '#FF0000', bold: false, italic: true });
  assert.strictEqual(r.fontSize, '24px');
  assert.strictEqual(r.fontWeight, 'normal');
  assert.strictEqual(r.fontStyle, 'italic');
  assert.strictEqual(T.resolveSlotStyle({ bold: true }).fontWeight, 'bold');
  assert.strictEqual(T.resolveSlotStyle({}).fontSize, '64px'); // overlay default unchanged
});

test('positions match the old 10vh/10vw/50vh layout on a 1920x1080 source', () => {
  assert.ok(T.positionStyles('topCenter').css.includes('top: 108px'));
  assert.ok(T.positionStyles('topLeft').css.includes('left: 192px'));
  assert.ok(T.positionStyles('bottomRight').css.includes('bottom: 108px') && T.positionStyles('bottomRight').css.includes('right: 192px'));
  assert.strictEqual(T.positionStyles('midLeft').transform, 'translateY(-50%)');
  assert.deepStrictEqual(T.positionStyles('nope'), T.positionStyles('center'));
});

test('animations use prefixed keyframes shared by overlay and preview', () => {
  assert.strictEqual(T.animationCss({ name: 'fadeIn', duration: '1s' }), 'vdat-fadeIn 1s ease 0s 1 forwards');
  assert.strictEqual(T.animationCss('pulse'), 'vdat-pulse 1s ease 0s 1 forwards');
  assert.strictEqual(T.animationCss({ name: 'none' }), '');
  assert.ok(T.KEYFRAMES_CSS.includes('@keyframes vdat-tada'));
});

test('stage scale fits 1920x1080 into any viewport', () => {
  assert.strictEqual(T.stageScale(1920, 1080), 1);
  assert.strictEqual(T.stageScale(480, 270), 0.25);
  assert.strictEqual(T.stageScale(1280, 1080), 1280 / 1920);
  assert.strictEqual(T.stageScale(480, 0), 0.25);
  const el = { style: {} };
  assert.strictEqual(T.fitStage(el, 960, 540), 0.5);
  assert.strictEqual(el.style.transform, 'scale(0.5)');
  assert.strictEqual(el.style.width, '1920px');
});

test('editor slider value: clamps legacy/huge values, tolerates numbers', () => {
  assert.strictEqual(T.editorSliderValue('72px'), 72);
  assert.strictEqual(T.editorSliderValue(40), 40);
  assert.strictEqual(T.editorSliderValue('390px'), T.EDITOR_MAX_FONT_PX);
});

test('overlay template inlines the shared renderer and uses it (no vw/vh text layout)', () => {
  const html = read('overlays/baseOverlay/index.html');
  assert.ok(html.includes('/*__VD_ALERT_TEXT_RENDER__*/'));
  assert.ok(html.includes('window.VDAlertText.createTextSlotElement(document, position, slotData)'));
  assert.ok(html.includes('function fitOverlayStage()'));
  assert.ok(!/\d(vw|vh)[;'"\s]/.test(html.replace(/width: 100vw;\s*height: 100vh;/, '')), 'only body uses viewport units');
  const main = read('main.js');
  assert.ok(main.includes("path.join(__dirname, 'public', 'alert-text-render.js')"));
  assert.ok(main.includes("html.replace('/*__VD_ALERT_TEXT_RENDER__*/', () =>"));
});

test('generated overlay script defines VDAlertText when executed', () => {
  const html = read('overlays/baseOverlay/index.html');
  const js = read('public/alert-text-render.js');
  const out = html.replace('/*__VD_ALERT_TEXT_RENDER__*/', () => js.replace(/<\/script/gi, '<\\/script'));
  const first = out.match(/<script>([\s\S]*?)<\/script>/)[1];
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(first.replace(/typeof window !== 'undefined' \? window/, 'typeof window !== "undefined" ? window'), sandbox);
  assert.ok(sandbox.window.VDAlertText && typeof sandbox.window.VDAlertText.createTextSlotElement === 'function');
});

test('renderer: editor preview + live payload both use the shared builder', () => {
  const idx = read('public/index.html');
  assert.ok(idx.indexOf('alert-text-render.js') > 0 && idx.indexOf('alert-text-render.js') < idx.indexOf('src="script.js"'));
  assert.ok(/id="alert-font-size" min="12" max="300"/.test(idx));
  const s = read('public/script.js');
  assert.ok(s.includes('window.VDAlertText.alertToSlot(alertData, processedText)'), 'payload');
  assert.ok(s.includes('window.VDAlertText.alertToSlot(previewAlert, processedText)'), 'preview');
  assert.ok(s.includes('window.VDAlertText.createTextSlotElement(document, builtSlot.position, builtSlot.slot)'));
  assert.ok(s.includes('window.VDAlertText.fitStage(stage'));
  assert.ok(!s.includes("fontSize: alertData.textStyling?.fontSize || '24px'"), 'old payload builder removed');
  assert.ok(!s.includes("alertToEdit.textStyling.fontSize.replace('px', '')"), 'old edit parse removed');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
