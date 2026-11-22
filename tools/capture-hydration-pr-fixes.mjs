#!/usr/bin/env node
/**
 * Screenshots for hydration PR fixes: panel layout, URL field, rewards, overlay browser source.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { createHydrationService } = require('../lib/hydration-service');
const { DEFAULT_HYDRATION_CONFIG } = require('../lib/hydration-config');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = '/opt/cursor/artifacts';
const configPath = path.join('/tmp', `vd-hydration-cap-${process.pid}.json`);

fs.mkdirSync(outDir, { recursive: true });

const overlayDir = path.join(root, 'overlays/hydrationOverlay');
const service = createHydrationService(configPath);
service.saveHydrationConfig({ ...DEFAULT_HYDRATION_CONFIG, currentProgress: 24 });

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = (req.url || '/').split('?')[0];
      if (url === '/hydration' || url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(overlayDir, 'index.html')));
      } else if (url === '/hydration-overlay.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(fs.readFileSync(path.join(overlayDir, 'hydration-overlay.js')));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      resolve({ srv, base: `http://127.0.0.1:${port}` });
    });
  });
}

function panelHarnessHtml(baseUrl) {
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const start = index.indexOf('id="hydration-panel-modal"');
  const end = index.indexOf('<!-- Raid Favorites Modal -->', start);
  const panel = index.slice(start - 60, end);
  const styles = `
<link rel="stylesheet" href="file://${path.join(root, 'public/styles.css')}" />
<link rel="stylesheet" href="file://${path.join(root, 'public/hydration-panel.css')}" />
<style>
  body { margin: 0; background: #1a1a2e; font-family: system-ui, sans-serif; }
  #hydration-panel-modal { display: flex !important; }
  #sound-grid { display: grid; grid-template-columns: repeat(4,1fr); gap:8px; padding:20px; max-width:900px; margin:0 auto 20px; }
  .fake-deck-btn { height: 48px; background: #333; border-radius: 8px; }
</style>`;
  return `<!DOCTYPE html><html><head>${styles}</head><body>
<div id="sound-grid">${Array.from({ length: 8 }, () => '<div class="fake-deck-btn"></div>').join('')}</div>
${panel}
<script src="file://${path.join(root, 'public/channel-rewards-ui.js')}"></script>
<script>
window.electronAPI = {
  getHydrationUrl: async () => '${baseUrl}/hydration',
  getChannelRewards: async () => ({
    ok: true,
    rewards: [
      { id: 'rw-hydrate', title: 'Hydrate!', cost: 100 },
      { id: 'rw-water', title: 'Water break', cost: 50 },
    ],
    error: null,
  }),
  pickAudioFileForSounds: async () => ({ success: true, filePath: 'sounds/hydration-ding.mp3' }),
  getHydrationConfig: async () => (${JSON.stringify({ ...DEFAULT_HYDRATION_CONFIG, currentProgress: 24, rewardId: 'rw-hydrate' })}),
  disableHotkeys: () => {},
  enableHotkeys: () => {},
  onHydrationStateChanged: () => {},
};
</script>
<script src="file://${path.join(root, 'public/hydration-panel.js')}"></script>
<script>
document.addEventListener('DOMContentLoaded', () => {
  window.vdHydrationPanel.openPanel();
  setTimeout(() => {
    const log = document.getElementById('hydration-sound-path');
    if (log) log.value = 'sounds/hydration-ding.mp3';
  }, 400);
});
</script>
</body></html>`;
}

async function main() {
  const { srv, base } = await startServer();
  const hydrationUrl = `${base}/hydration`;
  const res = await fetch(hydrationUrl);
  if (!res.ok) throw new Error(`GET /hydration failed: ${res.status}`);
  const html = await res.text();
  if (!html.includes('hydration-container')) throw new Error('hydration page missing container');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${hydrationUrl}?preview=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.postMessage(
      {
        type: 'hydrationPreview',
        payload: {
          current: 24,
          goal: 64,
          percentage: 37.5,
          streak: 2,
          units: 'oz',
          config: { gaugeStyle: 'circular', gaugeSize: 280, showPlate: true, currentProgress: 24 },
        },
      },
      '*',
    );
  });
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(outDir, 'hydration_browser_source_1920x1080.png'),
    omitBackground: true,
  });

  const narrow = await browser.newPage({ viewport: { width: 720, height: 900 } });
  const harnessPath = path.join('/tmp', 'hydration-panel-harness.html');
  fs.writeFileSync(harnessPath, panelHarnessHtml(base));
  await narrow.goto(`file://${harnessPath}`, { waitUntil: 'networkidle' });
  await narrow.waitForTimeout(1200);
  await narrow.screenshot({ path: path.join(outDir, 'hydration_panel_narrow_after.png'), fullPage: true });

  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await wide.goto(`file://${harnessPath}`, { waitUntil: 'networkidle' });
  await wide.waitForTimeout(1200);
  await wide.screenshot({ path: path.join(outDir, 'hydration_panel_wide_after.png'), fullPage: false });

  const urlEl = await wide.$('#hydration-overlay-url');
  if (urlEl) {
    await urlEl.screenshot({ path: path.join(outDir, 'hydration_overlay_url_field.png') });
  }

  const rewards = await wide.$('#hydration-reward-select');
  if (rewards) {
    await rewards.screenshot({ path: path.join(outDir, 'hydration_rewards_dropdown.png') });
  }

  const browseRow = await wide.$('.hydration-sound-path-row');
  if (browseRow) {
    await browseRow.screenshot({ path: path.join(outDir, 'hydration_sound_browse_row.png') });
  }

  await browser.close();
  srv.close();
  try {
    fs.unlinkSync(configPath);
  } catch {
    /* ignore */
  }

  console.log(
    JSON.stringify(
      {
        hydrationUrl,
        artifacts: [
          'hydration_browser_source_1920x1080.png',
          'hydration_panel_wide_after.png',
          'hydration_panel_narrow_after.png',
          'hydration_overlay_url_field.png',
          'hydration_rewards_dropdown.png',
          'hydration_sound_browse_row.png',
        ].map((f) => path.join(outDir, f)),
      },
      null,
      2,
    ),
  );
}

await main();