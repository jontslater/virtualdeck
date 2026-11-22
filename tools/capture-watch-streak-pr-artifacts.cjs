#!/usr/bin/env node
/**
 * Capture PR screenshots from running VirtualDeck (Electron + overlay :8080).
 * Start app first:
 *   xvfb-run -a npx electron . --remote-debugging-port=9333 --no-sandbox
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { chromium } = require('playwright');
const {
  migrateWatchStreakConfig,
  resolveActiveTier,
  formatAlertText,
  buildWatchStreakOverlayPayload,
} = require('../lib/watch-streak-alerts');

const outDir = '/opt/cursor/artifacts';
const debugPort = Number(process.env.VD_DEBUG_PORT || 9333);
const overlayPort = Number(process.env.VD_OVERLAY_PORT || 8080);
const DEMO_GIF = path.join(__dirname, '../TwitchConnected/tc.gif');

fs.mkdirSync(outDir, { recursive: true });

function userDataDir() {
  return process.env.VD_USER_DATA || path.join(os.homedir(), '.config', 'virtualdeck');
}

function seedDemoWatchStreakData() {
  const userData = userDataDir();
  fs.mkdirSync(userData, { recursive: true });
  const rel = 'media/watch-streak-tier_50/image_demo.gif';
  const abs = path.join(userData, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(DEMO_GIF)) fs.copyFileSync(DEMO_GIF, abs);

  const cfg = migrateWatchStreakConfig({ enabled: true });
  const tier50 = cfg.tiers.find((t) => t.threshold === 50);
  if (tier50) {
    tier50.mediaFile = rel.replace(/\\/g, '/');
    tier50.mediaType = 'gif';
    tier50.mediaLayout = 'above';
    tier50.enterAnimation = 'pop';
    tier50.exitAnimation = 'fade';
    tier50.alertDurationMs = 5500;
  }
  fs.writeFileSync(path.join(userData, 'watch-streak-config.json'), JSON.stringify(cfg, null, 2));

  const leaders = {
    version: 1,
    updatedAt: new Date().toISOString(),
    viewers: {
      loyal: {
        userId: '1',
        login: 'LoyalFan',
        displayName: 'LoyalFan',
        highestSharedStreak: 50,
        lastSharedStreak: 50,
        lastSharedAt: '2026-11-20T18:00:00.000Z',
      },
      reg: {
        userId: '2',
        login: 'Regular',
        displayName: 'Regular',
        highestSharedStreak: 10,
        lastSharedStreak: 10,
        lastSharedAt: '2026-11-19T12:00:00.000Z',
      },
      newbie: {
        userId: '3',
        login: 'NewStreaker',
        displayName: 'NewStreaker',
        highestSharedStreak: 3,
        lastSharedStreak: 3,
        lastSharedAt: '2026-11-21T10:00:00.000Z',
      },
    },
  };
  fs.writeFileSync(path.join(userData, 'watch-streak-leaders.json'), JSON.stringify(leaders, null, 2));
  return rel.replace(/\\/g, '/');
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function buildPayload(streakCount, mediaRel) {
  const cfg = migrateWatchStreakConfig({ enabled: true });
  const share = {
    streakCount,
    channelPointsAwarded: 350,
    userId: 'demo',
    login: 'DemoViewer',
    displayName: 'DemoViewer',
    username: 'DemoViewer',
    test: true,
  };
  const tier = { ...resolveActiveTier(cfg, streakCount) };
  if (mediaRel && streakCount === 50) {
    tier.mediaFile = mediaRel;
    tier.mediaType = 'gif';
    tier.mediaLayout = 'above';
    tier.enterAnimation = 'pop';
  }
  const text = formatAlertText(tier.textTemplate, share);
  return buildWatchStreakOverlayPayload(tier, share, text);
}

function peakMs(payload) {
  const m = { glow: 700, pulse: 900, shine: 800, flare: 1000, burst: 1100, epic: 1550, confetti: 1650 };
  return Math.max(m[payload.effect] || 1000, payload.enterAnimation === 'pop' ? 950 : 0);
}

async function waitOverlayReady(page) {
  await page.waitForFunction(
    () => typeof window.__wsShowAlert === 'function' && window.__wsConnected === true,
    undefined,
    { timeout: 20000 },
  );
}

async function fireAlertOnPage(page, payload) {
  await waitOverlayReady(page);
  await page.evaluate((p) => window.__wsShowAlert(p), payload);
}

async function captureOverlays(browser, port, mediaRel) {
  for (const t of [3, 10, 50, 100, 200]) {
    const payload = buildPayload(t, t === 50 ? mediaRel : null);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/watch-streak?obs=1&freeze=1`, { waitUntil: 'domcontentloaded' });
    await fireAlertOnPage(page, payload);
    await page.waitForTimeout(peakMs(payload) + 450);
    const name =
      t === 50 && mediaRel ? 'watch-streak-overlay-custom-gif.png' : `watch-streak-overlay-tier-${t}.png`;
    await page.screenshot({ path: path.join(outDir, name) });
    await page.close();
  }

  const payload50 = buildPayload(50, mediaRel);
  const gifPage = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  });
  await gifPage.goto(`http://127.0.0.1:${port}/watch-streak?obs=1`, { waitUntil: 'domcontentloaded' });
  await fireAlertOnPage(gifPage, payload50);
  await gifPage.waitForTimeout(5500);
  const vpath = await gifPage.video().path();
  await gifPage.close();
  if (vpath) {
    fs.copyFileSync(vpath, path.join(outDir, 'watch-streak-custom-media-alert.webm'));
    const gifOut = path.join(outDir, 'watch-streak-custom-media-alert.gif');
    try {
      const { execSync } = require('child_process');
      execSync(
        `ffmpeg -y -i "${path.join(outDir, 'watch-streak-custom-media-alert.webm')}" -vf "fps=12,scale=1280:-1" -loop 0 "${gifOut}"`,
        { stdio: 'ignore' },
      );
    } catch (e) {
      console.warn('ffmpeg gif conversion skipped:', e.message);
    }
  }
}

async function captureElectronUi() {
  const version = await httpGet(`http://127.0.0.1:${debugPort}/json/version`);
  const browser = await chromium.connectOverCDP(version.webSocketDebuggerUrl);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];
  if (!page) throw new Error('No Electron renderer page found');

  await page.setViewportSize({ width: 1280, height: 900 });

  await page.evaluate(async () => {
    try {
      localStorage.setItem('vd_hide_twitch_banner', '1');
      localStorage.setItem('vd-hide-welcome-twitch-popup', '1');
    } catch (e) {
      /* ignore */
    }
    document.getElementById('vd-twitch-conn-banner')?.remove();
    document.getElementById('first-run-twitch-popup')?.classList.add('hidden');
    document.getElementById('welcome-popup-dismiss')?.click();
    if (window.openWatchStreakAlertWidget) await window.openWatchStreakAlertWidget();
    else if (window.openWatchStreakModal) await window.openWatchStreakModal();
    const cb = document.getElementById('watch-streak-enabled');
    if (cb) cb.checked = true;
    document.getElementById('watch-streak-simple-mode').checked = false;
    window.watchStreakSetExpandedIndex?.(-1);
    await window.hydrateWatchStreakPreviews?.();
  });
  await page.waitForSelector('#alert-widget:not(.hidden)', { timeout: 15000 });
  await page.waitForSelector('#watch-streak-alert-settings', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(600);

  const widget = page.locator('#alert-widget .alert-widget-content');
  await page.evaluate(() => {
    const sel = document.getElementById('alert-type');
    if (!sel) return;
    sel.value = 'watch-streak';
    sel.size = Math.min(sel.options.length, 14);
    sel.style.height = 'auto';
    sel.style.minHeight = `${sel.size * 28}px`;
    sel.style.background = 'var(--bg-primary)';
    sel.style.color = 'var(--text-primary)';
    sel.style.border = '1px solid var(--border-primary)';
    sel.style.borderRadius = '6px';
    sel.style.padding = '4px';
  });
  await page.locator('.alert-type-selector').screenshot({
    path: path.join(outDir, 'watch-streak-alert-widget-type-dropdown.png'),
    force: true,
  });
  await widget.screenshot({ path: path.join(outDir, 'watch-streak-settings-collapsed.png'), force: true });

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.watch-streak-tier-row'));
    const idx = rows.findIndex((r) => r.querySelector('.ws-tier-test')?.dataset?.threshold === '50');
    window.watchStreakSetExpandedIndex?.(idx >= 0 ? idx : 6);
  });
  await page.waitForTimeout(600);
  await page.locator('.watch-streak-tier-row.is-expanded').screenshot({
    path: path.join(outDir, 'watch-streak-settings-tier-expanded.png'),
  });
  await widget.screenshot({ path: path.join(outDir, 'watch-streak-settings-panel.png') });
  await page.locator('#watch-streak-alert-settings').screenshot({
    path: path.join(outDir, 'watch-streak-alert-widget-settings.png'),
    force: true,
  });

  await page.locator('#watch-streak-per-tier-panel').screenshot({
    path: path.join(outDir, 'watch-streak-section-tiers.png'),
  });
  await page.locator('#watch-streak-leaders-list').screenshot({
    path: path.join(outDir, 'watch-streak-top-streakers.png'),
  });
  await page.locator('#alert-overlay-selector, .alert-overlay-selector').first().screenshot({
    path: path.join(outDir, 'watch-streak-alert-target-overlay.png'),
  });

  await browser.close();
}

function waitForOverlay(port) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/watch-streak`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else reject(new Error(`HTTP ${res.statusCode}`));
      })
      .on('error', reject);
  });
}

async function main() {
  const mediaRel = seedDemoWatchStreakData();
  console.log('Seeded demo watch-streak config with media:', mediaRel);

  try {
    await waitForOverlay(overlayPort);
  } catch (e) {
    console.error(`Overlay server not reachable on :${overlayPort}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  try {
    await captureOverlays(browser, overlayPort, mediaRel);
  } finally {
    await browser.close();
  }

  try {
    await captureElectronUi();
  } catch (err) {
    console.warn('Electron UI capture partial failure:', err.message);
  }
  console.log('Artifacts written to', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});