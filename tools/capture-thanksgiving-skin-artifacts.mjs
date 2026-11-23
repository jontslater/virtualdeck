#!/usr/bin/env node
/**
 * Captures Thanksgiving skin on real VirtualDeck markup + styles.css (Playwright).
 */
import fs from 'fs';
import http from 'node:http';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const outDir = '/opt/cursor/artifacts';

const stylesCss = fs.readFileSync(path.join(publicDir, 'styles.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const skin = JSON.parse(fs.readFileSync(path.join(root, 'skins', 'thanksgiving.json'), 'utf8'));

function sliceHtml(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) return '';
  return html.slice(start, end);
}

function buildSkinCss(skinData) {
  let cssContent = '';
  if (skinData.variables) {
    cssContent += ':root {\n';
    for (const [key, value] of Object.entries(skinData.variables)) {
      const varName = key.startsWith('--') ? key : `--${key}`;
      cssContent += `  ${varName}: ${value};\n`;
    }
    cssContent += '}\n';
  }
  if (skinData.css) cssContent += `${skinData.css}\n`;
  if (skinData.components) {
    for (const [selector, rules] of Object.entries(skinData.components)) {
      cssContent += `${selector} {\n`;
      for (const [property, value] of Object.entries(rules)) {
        cssContent += `  ${property}: ${value};\n`;
      }
      cssContent += '}\n';
    }
  }
  return cssContent;
}

const skinCss = buildSkinCss(skin);

const menuBar = (
  sliceHtml(indexHtml, '<nav id="app-menu-left"', '</nav>') + '</nav>'
)
  .replace('src="logo.png"', 'src="/logo.png"')
  .replace('alt="VirtualDeck"', 'alt=""');
const statsBlock = sliceHtml(
  indexHtml,
  '<div id="twitch-stats-container">',
  '<!-- Recent Activity Display -->',
);
const chatBlock = sliceHtml(
  indexHtml,
  '<div id="twitch-chat-container">',
  '<!-- Pagination controls moved below',
);
const queueBlock = sliceHtml(
  indexHtml,
  '<div id="queue-control-widget"',
  '<!-- Profile Management Panel -->',
);
const soundControlsLocked = sliceHtml(
  indexHtml,
  '<div id="sound-controls"',
  '<!-- AI Dashboard Controls',
);

const soundControlsUnlocked = soundControlsLocked
  .replace('🔒 Lock', '🔓 Unlock')
  .replace('Sound buttons are locked', 'Sound buttons are unlocked')
  .replace('class="drag-toggle-btn"', 'class="drag-toggle-btn unlocked"');

const captureAssist = `
#button-type-modal, .modal, #profile-panel, #ai-dashboard-controls { display: none !important; }
#app-menu-left { display: flex !important; align-items: center !important; flex-wrap: nowrap !important; gap: 4px !important; }
.app-menu-logo { max-height: 46px !important; max-width: 150px !important; width: auto !important; object-fit: contain !important; object-position: left center !important; flex-shrink: 0 !important; filter: none !important; background: #3B2314 !important; border-radius: 10px !important; padding: 3px 8px !important; }
`;

const materialIconsHead = `
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
`;

function pageHtml(body, extraCss = '') {
  return `<!DOCTYPE html>
<html lang="en" data-theme="thanksgiving">
<head>
<meta charset="utf-8" />
<base href="/" />
${materialIconsHead}
<style>
${stylesCss}
${skinCss}
body { min-height: 100vh; margin: 0; font-family: Roboto, 'Segoe UI', sans-serif; }
.sound-card.sample { pointer-events: none; }
.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 22px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'liga';
  -webkit-font-feature-settings: 'liga';
}
${captureAssist}
${extraCss}
</style>
</head>
<body data-theme="thanksgiving">
${menuBar}
<div class="container">
${body}
</div>
</body>
</html>`;
}

const filledStats = statsBlock
  .replace('id="viewer-count">-', 'id="viewer-count">128')
  .replace('id="follower-count">-', 'id="follower-count">4.2K')
  .replace('id="subscriber-count">-', 'id="subscriber-count">312')
  .replace('id="sub-points">-', 'id="sub-points">48');

function soundGrid({ longLabel = false } = {}) {
  const label = longLabel ? 'Extra Crispy Turkey Leftovers' : 'Turkey Day';
  return `
<div id="sound-grid">
  <button type="button" class="sound-card sample"><span class="sound-name">${label}</span></button>
  <button type="button" class="sound-card sample"><span class="sound-name">Gobble</span></button>
  <button type="button" class="sound-card sample"><span class="sound-name">Pie Time</span></button>
  <button type="button" class="sound-card sample"><span class="sound-name">Cheers</span></button>
</div>`;
}

const chatWithMessages = chatBlock.replace(
  '<div id="twitch-chat-messages" class="chat-messages"></div>',
  `<div id="twitch-chat-messages" class="chat-messages">
    <div class="chat-message"><strong>AutumnFan:</strong> cozy harvest stream</div>
    <div class="chat-message"><strong>PumpkinPete:</strong> happy thanksgiving!</div>
    <div class="activity-message">PumpkinPete subscribed at Tier 1</div>
  </div>`,
);

const pagination = `
<div id="pagination-controls" class="pagination-controls bottom-pagination">
  <button class="page-btn" type="button"><span class="material-icons">arrow_back</span></button>
  <span class="pagination-indicator">1 / 3</span>
  <button class="page-btn" type="button"><span class="material-icons">arrow_forward</span></button>
</div>`;

function deckBody({ longLabel = false, unlocked = false } = {}) {
  const controls = unlocked ? soundControlsUnlocked : soundControlsLocked;
  return `
${filledStats}
<div id="recent-activity-container" class="hidden"></div>
${controls}
<div class="main-content">
  ${soundGrid({ longLabel })}
  ${chatWithMessages}
</div>
${queueBlock}
${pagination}`;
}

const statsHtml = pageHtml(`
${filledStats}
<div id="recent-activity-container" class="hidden"></div>
`, `#twitch-stats-container { margin: 24px auto; max-width: 920px; }`);

const deckHtml = pageHtml(deckBody());

const deckUnlockedLongHtml = pageHtml(deckBody({ longLabel: true, unlocked: true }));

const chatHtml = pageHtml(chatWithMessages, `
#twitch-chat-container { max-width: 400px; margin: 24px auto; }
`);

const queueHtml = pageHtml(
  queueBlock,
  `
body { min-height: 220px; }
.container { min-height: 220px; position: relative; }
#queue-control-widget { position: fixed; right: 24px; bottom: 24px; }
`,
);

const htmlDir = path.join(outDir, 'thanksgiving-capture-html');
fs.mkdirSync(htmlDir, { recursive: true });

const pages = {
  deck: deckHtml,
  unlocked: deckUnlockedLongHtml,
  stats: statsHtml,
  chat: chatHtml,
  queue: queueHtml,
};

for (const [name, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(htmlDir, `${name}.html`), html);
}

const iconFont = path.join(root, 'tools/fonts/MaterialIcons-Regular.woff2');
if (!fs.existsSync(iconFont)) {
  fs.mkdirSync(path.dirname(iconFont), { recursive: true });
  execFileSync('curl', [
    '-fsSL',
    '-o',
    iconFont,
    'https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2',
  ]);
}

const mime = {
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.css': 'text/css',
};

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  if (route === '/MaterialIcons-Regular.woff2') {
    res.setHeader('Content-Type', 'font/woff2');
    res.end(fs.readFileSync(iconFont));
    return;
  }
  const publicFile = path.join(publicDir, path.basename(route));
  if (route.startsWith('/') && route !== '/' && fs.existsSync(publicFile) && fs.statSync(publicFile).isFile()) {
    const ext = path.extname(publicFile);
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.end(fs.readFileSync(publicFile));
    return;
  }
  const file = path.basename(route);
  const htmlPath = path.join(htmlDir, file.endsWith('.html') ? file : 'deck.html');
  if (!fs.existsSync(htmlPath)) {
    res.statusCode = 404;
    res.end('missing');
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(htmlPath));
});

const port = await new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  server.on('error', reject);
});

async function renderPage(page, name) {
  await page.goto(`http://127.0.0.1:${port}/${name}.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const icons = [...document.querySelectorAll('.material-icons')];
    if (icons.length === 0) return true;
    return icons.every((icon) => icon.getBoundingClientRect().width <= 40);
  }, null, { timeout: 8000 }).catch(() => {});
  const logo = await page.$('.app-menu-logo');
  if (logo) {
    await logo.evaluate((img) => img.naturalWidth > 0).catch(() => {});
  }
  await page.waitForFunction(() => {
    const img = document.querySelector('.app-menu-logo');
    return !img || (img.complete && img.naturalWidth > 0);
  }, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await renderPage(page, 'deck');
await page.screenshot({ path: path.join(outDir, 'thanksgiving-deck-main.png') });

await renderPage(page, 'unlocked');
await page.screenshot({ path: path.join(outDir, 'thanksgiving-deck-unlocked-long-label.png') });

await renderPage(page, 'stats');
await page.locator('#twitch-stats-container').screenshot({
  path: path.join(outDir, 'thanksgiving-stats-bar-closeup.png'),
});

await renderPage(page, 'chat');
await page.locator('#twitch-chat-container').screenshot({
  path: path.join(outDir, 'thanksgiving-chat-panel.png'),
});

const queuePage = await browser.newPage({ viewport: { width: 360, height: 240 } });
await renderPage(queuePage, 'queue');
await queuePage.locator('#queue-control-widget').screenshot({
  path: path.join(outDir, 'thanksgiving-alert-queue-widget.png'),
});

await browser.close();
server.close();
console.log('Thanksgiving skin captures written to', outDir);