/**
 * Before/after screenshots: hydration panel open must not shift the deck (body is flex).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = '/opt/cursor/artifacts';

const styles = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const panelCss = fs.readFileSync(path.join(root, 'public/hydration-panel.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

const panelStart = indexHtml.indexOf('id="hydration-panel-modal"');
const panelEnd = indexHtml.indexOf('<!-- Raid Favorites Modal -->');
const panelMarkup = indexHtml.slice(indexHtml.lastIndexOf('<div', panelStart), panelEnd);

function shell(extraCss = '', panelOpen = true) {
  const panelClass = panelOpen ? '' : 'hidden';
  const markup = panelMarkup.replace(
    'id="hydration-panel-modal" class="hidden"',
    `id="hydration-panel-modal" class="${panelClass}"`,
  );
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f3460;
  --text-primary: #eee;
  --text-secondary: #bbb;
  --text-tertiary: #888;
  --border-primary: #444;
  --border-color: #333;
  --accent-primary: #4fc3f7;
}
body {
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  background: var(--bg-primary);
  font-family: Segoe UI, sans-serif;
  color: var(--text-primary);
}
.deck-shell {
  width: min(1200px, 100vw);
  padding: 16px;
  box-sizing: border-box;
}
.deck-bar {
  height: 48px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-weight: 600;
}
.sound-grid-mock {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.sound-card-mock {
  aspect-ratio: 1;
  background: linear-gradient(145deg, #2a2a4a, #1e1e38);
  border: 1px solid #444;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #aaa;
}
.deck-marker {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 11px;
  color: #f66;
  background: rgba(0,0,0,0.5);
  padding: 2px 6px;
  border-radius: 4px;
}
${styles}
${panelCss}
/* broken: panel participates in flex layout */
.broken-layout #hydration-panel-modal:not(.hidden) {
  position: static !important;
  inset: auto !important;
  background: transparent !important;
  backdrop-filter: none !important;
  padding: 0 !important;
  z-index: auto !important;
  display: block !important;
  flex: 1 1 auto;
  min-width: 0;
}
#hydration-panel-modal:not(.hidden) { display: flex !important; }
.modal-header { position: relative; }
details summary { cursor: pointer; }
${extraCss}
</style></head><body>
<div class="deck-shell" style="position:relative">
  <div class="deck-marker">Deck top-left anchor</div>
  <div class="deck-bar">VirtualDeck — sound grid (mock)</div>
  <div class="sound-grid-mock">
    ${Array.from({ length: 8 }, (_, i) => `<div class="sound-card-mock">Btn ${i + 1}</div>`).join('')}
  </div>
</div>
${markup}
</body></html>`;
}

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(viewport, suffix, broken) {
  const page = await browser.newPage({ viewport });
  const html = shell(broken ? 'body.broken-layout' : '', true);
  await page.setContent(html.replace('<body>', `<body class="${broken ? 'broken-layout' : ''}">`), {
    waitUntil: 'load',
  });
  const deckBox = await page.locator('.deck-shell').boundingBox();
  const panelBox = await page.locator('#hydration-panel-modal .modal-content').boundingBox();
  const pathOut = path.join(outDir, `hydration_panel_${suffix}.png`);
  await page.screenshot({ path: pathOut, fullPage: false });
  await page.close();
  return { pathOut, deckBox, panelBox };
}

const normalBefore = await shot({ width: 1280, height: 800 }, 'before_normal_window', true);
const narrowBefore = await shot({ width: 720, height: 800 }, 'before_narrow_window', true);
const normalAfter = await shot({ width: 1280, height: 800 }, 'after_normal_window', false);
const narrowAfter = await shot({ width: 720, height: 800 }, 'after_narrow_window', false);

await browser.close();

function describe(label, { deckBox, panelBox }) {
  const deckX = deckBox?.x ?? NaN;
  const panelOverlaps = panelBox && deckBox && panelBox.x < deckBox.x + deckBox.width / 2;
  console.log(
    `${label}: deck.x=${deckX.toFixed(1)} panel fixed overlay=${panelBox && panelBox.width > 400 ? 'yes' : 'no'} deck shifted=${deckX > 40 ? 'LIKELY' : 'no'}`,
  );
}

describe('before normal', normalBefore);
describe('before narrow', narrowBefore);
describe('after normal', normalAfter);
describe('after narrow', narrowAfter);

const report = {
  artifacts: [
    normalBefore.pathOut,
    narrowBefore.pathOut,
    normalAfter.pathOut,
    narrowAfter.pathOut,
  ],
};
fs.writeFileSync(path.join(outDir, 'hydration_panel_layout_fix_report.json'), JSON.stringify(report, null, 2));
console.log('Screenshots saved under', outDir);