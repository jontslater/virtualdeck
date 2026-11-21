import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = '/opt/cursor/artifacts';

const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const releaseWithImage = JSON.parse(
  fs.readFileSync(path.join(root, 'whats-new/1.2.8.json'), 'utf8'),
);
const releaseNoImage = {
  version: '1.2.8',
  intro: 'Preview without feature images.',
  features: releaseWithImage.features.map((f) => ({ ...f, image: undefined })),
};

function modalShell(inner) {
  return `<!DOCTYPE html>
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
body { margin: 0; background: #12121c; font-family: Segoe UI, sans-serif; }
${css}
#whats-new-modal { display: flex !important; }
.preference-button { cursor: default; }
</style>
</head>
<body>${inner}</body>
</html>`;
}

function fileToDataUri(relative) {
  const imgPath = path.join(root, 'public', String(relative).replace(/^public\//, ''));
  if (!fs.existsSync(imgPath)) return '';
  const body = fs.readFileSync(imgPath);
  const isSvg = imgPath.endsWith('.svg');
  const mime = isSvg ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,${body.toString('base64')}`;
}

function renderFeatures(features) {
  return features
    .map((feat) => {
      const src = feat.image ? fileToDataUri(feat.image) : '';
      const mediaTag = feat.image
        ? `<div class="whats-new-feature-media"><img src="${src}" alt="${feat.title || ''}" /></div>`
        : '';
      return `<article class="whats-new-feature" role="listitem">
        ${mediaTag}
        <div class="whats-new-feature-body">
          <h3>${feat.title || ''}</h3>
          <p>${feat.body || ''}</p>
          ${feat.tryAction ? '<button type="button" class="preference-button whats-new-try-btn">Try it</button>' : ''}
        </div>
      </article>`;
    })
    .join('');
}

function buildModalHtml(release) {
  const featuresHtml = renderFeatures(release.features || []);
  return `<div id="whats-new-modal" role="dialog" aria-modal="true">
  <div class="modal-content preferences-modal-content whats-new-modal-content">
    <div class="modal-header">
      <h2>What's new in ${release.version}</h2>
      <button type="button" class="modal-close" aria-label="Close">✕</button>
    </div>
    <div class="whats-new-modal-body">
      <p class="whats-new-intro">${release.intro || ''}</p>
      <div class="whats-new-feature-list" role="list">${featuresHtml}</div>
      <div class="whats-new-actions">
        <button type="button" class="preference-button">See all updates</button>
        <button type="button" class="preference-button primary">Got it</button>
      </div>
    </div>
  </div>
</div>`;
}

function menuShell() {
  return `<h1 style="font-size:16px;color:#eaeaea;margin:24px 0 12px;">Help menu</h1>
  <button class="menu-dropdown-item">Send feedback / Request a feature…</button>
  <button class="menu-dropdown-item" style="outline:2px solid var(--accent-primary);background:var(--bg-tertiary);color:var(--text-primary);padding:10px 14px;border:none;border-radius:6px;width:280px;text-align:left;margin:4px 0;">What's new…</button>
  <button class="menu-dropdown-item">Chat Commands</button>`;
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });

await page.route('**/*', async (route) => {
  const url = route.request().url();
  if (url.includes('/whats-new/assets/')) {
    const name = decodeURIComponent(url.split('/whats-new/assets/')[1] || '');
    const file = path.join(root, 'public/whats-new/assets', name);
    if (fs.existsSync(file)) {
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: fs.readFileSync(file),
      });
      return;
    }
  }
  await route.continue();
});

await page.setContent(modalShell(buildModalHtml(releaseWithImage)), { waitUntil: 'load' });
await page.screenshot({ path: path.join(outDir, 'whats-new-modal-with-image.png') });

await page.setContent(modalShell(buildModalHtml(releaseNoImage)), { waitUntil: 'load' });
await page.screenshot({ path: path.join(outDir, 'whats-new-modal-no-image.png') });

await page.setContent(
  modalShell(`<motion-wrapper style="display:block;padding:24px;">${menuShell()}</motion-wrapper>`),
  { waitUntil: 'load' },
);
await page.screenshot({ path: path.join(outDir, 'whats-new-help-menu.png') });

await browser.close();
console.log('Wrote whats-new screenshots to', outDir);