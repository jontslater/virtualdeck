import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = '/opt/cursor/artifacts';

const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const modalHtml = (() => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const start = html.indexOf('id="feedback-modal"');
  const end = html.indexOf('<!-- First Run Twitch Setup Popup -->');
  return html.slice(html.lastIndexOf('<div', start), end);
})();

const shell = (body, title) => `<!DOCTYPE html>
<html data-theme="dark">
<head>
<meta charset="utf-8" />
<style>
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f3460;
  --text-primary: #eaeaea;
  --text-secondary: #a8b2c1;
  --accent: #e94560;
  --accent-primary: #e94560;
}
body { margin: 0; background: #12121c; font-family:Segoe UI, sans-serif; }
${css}
#feedback-modal { display: flex !important; }
#feedback-prompt-actions { display: flex !important; }
.app-menu-mock {
  padding: 24px;
  color: var(--text-primary);
}
.menu-dropdown-item {
  display: block;
  width: 280px;
  text-align: left;
  padding: 10px 14px;
  margin: 4px 0;
  background: var(--bg-tertiary);
  border: none;
  color: var(--text-primary);
  border-radius: 6px;
  font-size: 14px;
}
.menu-dropdown-item.highlight { outline: 2px solid var(--accent); }
h1 { font-size: 16px; font-weight: 600; margin: 0 0 12px; color: #eaeaea; }
</style>
</head>
<body>${body}</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });

await page.setContent(shell(modalHtml, 'modal'), { waitUntil: 'load' });
await page.screenshot({ path: path.join(outDir, 'feedback-modal-prompt.png'), fullPage: false });

const menuPage = shell(
  `<div class="app-menu-mock"><h1>Help menu</h1>
  <button class="menu-dropdown-item">Chat Commands</button>
  <button class="menu-dropdown-item highlight">Send feedback / Request a feature…</button>
  <button class="menu-dropdown-item">About</button></div>`,
  'menu',
);
await page.setContent(menuPage, { waitUntil: 'load' });
await page.screenshot({ path: path.join(outDir, 'feedback-help-menu.png'), fullPage: false });

await browser.close();
console.log('Wrote screenshots to', outDir);
