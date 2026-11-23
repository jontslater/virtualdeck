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
const outDir = '/opt/cursor/artifacts';

const stylesCss = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
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

const menuBar = sliceHtml(indexHtml, '<nav id="app-menu-left"', '</nav>') + '</nav>';
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

const hideChrome = `
#button-type-modal, .modal, #profile-panel, #ai-dashboard-controls { display: none !important; }
.main-content { display: grid !important; grid-template-columns: 1fr 360px; gap: 16px; align-items: start; }
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
${materialIconsHead}
<style>
${stylesCss}
${skinCss}
body { min-height: 100vh; margin: 0; font-family: Roboto, 'Segoe UI', sans-serif; }
.container { display: block; padding: 12px; max-width: 1280px; margin: 0 auto; }
#recent-activity-container.hidden { display: block !important; margin-top: 12px; }
#twitch-chat-container { display: flex !important; flex-direction: column; min-height: 320px; }
.sound-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
.sound-card.sample { width: 106px; min-height: 122px; border: none; cursor: default; }
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
${hideChrome}
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

function soundGrid({ longLabel = false, unlocked = false } = {}) {
  const label = longLabel ? 'Extra Crispy Turkey Leftovers' : 'Turkey Day';
  return `
<div class="sound-grid">
  <button type="button" class="sound-card sample"><span class="sound-name">${label}</span></button>
  <button type="button" class="sound-card sample"><span class="sound-name">Gobble</span></button>
  <button type="button" class="sound-card sample"><span class="sound-name">Pie Time</span></button>
  <button type="button" class="sound-card sample"><span class="sound-name">Cheers</span></button>
</div>`;
}

const chatWithMessages = chatBlock.replace(
  '<div id="twitch-chat-messages" class="chat-messages"></div>',
  `<div id="twitch-chat-messages" class="chat-messages">
    <div><strong>AutumnFan:</strong> cozy harvest stream</div>
    <div><strong>PumpkinPete:</strong> happy thanksgiving!</div>
    <div class="activity-message">PumpkinPete subscribed at Tier 1</div>
  </div>`,
);

const pagination = `
<div id="pagination-controls" class="pagination-controls bottom-pagination">
  <button class="page-btn" type="button"><span class="material-icons">arrow_back</span></button>
  <span class="pagination-indicator">1 / 3</span>
  <button class="page-btn" type="button"><span class="material-icons">arrow_forward</span></button>
</div>`;

const statsHtml = pageHtml(`
${filledStats}
<div id="recent-activity-container" class="">
  <div class="recent-activity-simple">
    <div class="recent-item-simple"><div class="recent-label">Latest Follower:</div><div class="recent-value">AutumnFan</div></div>
    <div class="recent-item-simple"><div class="recent-label">Latest Subscriber:</div><div class="recent-value">PumpkinPete</div></div>
  </div>
</div>
`, `#twitch-stats-container { margin: 24px auto; max-width: 920px; }`);

const deckHtml = pageHtml(`
${filledStats}
${soundControlsLocked}
<div class="main-content">
  ${soundGrid()}
  ${chatWithMessages}
</div>
${queueBlock}
${pagination}
`);

const deckUnlockedLongHtml = pageHtml(`
${filledStats}
${soundControlsUnlocked}
<div class="main-content">
  ${soundGrid({ longLabel: true, unlocked: true })}
  ${chatWithMessages}
</div>
${queueBlock}
${pagination}
`);

const chatHtml = pageHtml(chatWithMessages, `#twitch-chat-container { max-width: 400px; margin: 24px auto; }`);

const htmlDir = path.join(outDir, 'thanksgiving-capture-html');
fs.mkdirSync(htmlDir, { recursive: true });

const pages = {
  deck: deckHtml,
  unlocked: deckUnlockedLongHtml,
  stats: statsHtml,
  chat: chatHtml,
  queue: pageHtml(queueBlock + '</div>'),
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

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  if (route === '/MaterialIcons-Regular.woff2') {
    res.setHeader('Content-Type', 'font/woff2');
    res.end(fs.readFileSync(iconFont));
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
  await page.waitForTimeout(350);
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

await renderPage(page, 'queue');
await page.locator('#queue-control-widget').screenshot({
  path: path.join(outDir, 'thanksgiving-alert-queue-widget.png'),
});

await browser.close();
server.close();
console.log('Thanksgiving skin captures written to', outDir);