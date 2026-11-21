#!/usr/bin/env node
/**
 * Capture PR screenshots from running VirtualDeck (Electron + overlay :8080).
 * Start app first:
 *   xvfb-run -a npx electron . --remote-debugging-port=9333 --no-sandbox
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const WebSocket = require('ws');
const {
  migrateWatchStreakConfig,
  resolveActiveTier,
  formatAlertText,
  buildWatchStreakOverlayPayload,
} = require('../lib/watch-streak-alerts');

const outDir = '/opt/cursor/artifacts';
const debugPort = Number(process.env.VD_DEBUG_PORT || 9333);
const overlayPort = Number(process.env.VD_OVERLAY_PORT || 8080);

fs.mkdirSync(outDir, { recursive: true });

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

function buildPayload(streakCount) {
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
  const tier = resolveActiveTier(cfg, streakCount);
  const text = formatAlertText(tier.textTemplate, share);
  return buildWatchStreakOverlayPayload(tier, share, text);
}

function peakMs(payload) {
  const m = { glow: 700, pulse: 900, shine: 800, flare: 1000, burst: 1100, epic: 1550, confetti: 1650 };
  return m[payload.effect] || 1000;
}

function sendOverlayAlert(port, payload) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?overlay=watchStreak`);
    ws.on('open', () => {
      ws.send(JSON.stringify(payload));
      setTimeout(() => {
        ws.close();
        resolve();
      }, 80);
    });
    ws.on('error', reject);
  });
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

async function captureOverlays(browser, port) {
  for (const t of [3, 10, 50, 100, 200]) {
    const payload = buildPayload(t);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/watch-streak?obs=1&freeze=1`, { waitUntil: 'domcontentloaded' });
    await fireAlertOnPage(page, payload);
    await page.waitForTimeout(peakMs(payload) + 350);
    await page.screenshot({ path: path.join(outDir, `watch-streak-overlay-tier-${t}.png`) });
    await page.close();
  }

  const gifPage = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  });
  const payload200 = buildPayload(200);
  await gifPage.goto(`http://127.0.0.1:${port}/watch-streak?obs=1`, { waitUntil: 'domcontentloaded' });
  await fireAlertOnPage(gifPage, payload200);
  await gifPage.waitForTimeout(4500);
  const vpath = await gifPage.video().path();
  await gifPage.close();
  if (vpath) {
    fs.copyFileSync(vpath, path.join(outDir, 'watch-streak-alert-200.webm'));
    const gifOut = path.join(outDir, 'watch-streak-alert-200.gif');
    try {
      const { execSync } = require('child_process');
      execSync(
        `ffmpeg -y -i "${path.join(outDir, 'watch-streak-alert-200.webm')}" -vf "fps=12,scale=1280:-1" -loop 0 "${gifOut}"`,
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
  await page.setViewportSize({ width: 1360, height: 1400 });

  await page.evaluate(async () => {
    const fr = document.getElementById('first-run-twitch-popup');
    if (fr) fr.classList.add('hidden');
    document.getElementById('welcome-popup-dismiss')?.click();
    const modalEl = document.querySelector('.watch-streak-modal');
    if (modalEl) {
      modalEl.style.maxHeight = 'none';
      modalEl.style.overflow = 'visible';
    }
    if (window.openWatchStreakModal) window.openWatchStreakModal();
    else {
      document.getElementById('watch-streak-settings-modal')?.classList.remove('hidden');
      if (window.loadWatchStreakSettingsUi) await window.loadWatchStreakSettingsUi();
    }
    const cb = document.getElementById('watch-streak-enabled');
    if (cb) cb.checked = true;
    const list = document.getElementById('watch-streak-leaders-list');
    if (list) {
      list.innerHTML = `<table class="watch-streak-leaders-table">
        <thead><tr><th>Viewer</th><th>Highest shared</th><th>Last shared</th></tr></thead>
        <tbody>
          <tr><td>LoyalFan</td><td>50</td><td>50 <small>2026-11-20</small></td></tr>
          <tr><td>Regular</td><td>10</td><td>10 <small>2026-11-19</small></td></tr>
        </tbody></table>`;
    }
    if (window.electronAPI?.getWatchStreakOverlayUrl) {
      const res = await window.electronAPI.getWatchStreakOverlayUrl();
      const urlEl = document.getElementById('watch-streak-overlay-url');
      if (urlEl && res?.url) urlEl.textContent = res.url;
    }
  });
  await page.evaluate(() => {
    const simple = document.getElementById('watch-streak-simple-mode');
    if (simple) simple.checked = false;
    if (typeof renderWatchStreakTiers === 'function') renderWatchStreakTiers();
  });
  await page.waitForTimeout(800);

  const modal = page.locator('#watch-streak-settings-modal .watch-streak-modal');
  const scrollHeight = await modal.evaluate((el) => el.scrollHeight);
  await page.setViewportSize({ width: 1360, height: Math.min(3400, scrollHeight + 120) });
  await modal.evaluate((el) => el.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await modal.screenshot({ path: path.join(outDir, 'watch-streak-settings-full.png') });
  await page.locator('.watch-streak-section').nth(0).screenshot({
    path: path.join(outDir, 'watch-streak-section-browser-source.png'),
  });
  await page.locator('#watch-streak-per-tier-panel').screenshot({
    path: path.join(outDir, 'watch-streak-section-tiers.png'),
  });
  await page.locator('.watch-streak-tier-row').first().screenshot({
    path: path.join(outDir, 'watch-streak-section-tier-controls.png'),
  });
  await page.locator('#watch-streak-leaders-list').screenshot({
    path: path.join(outDir, 'watch-streak-top-streakers.png'),
  });
  await page.evaluate(() => {
    const el = document.getElementById('watch-streak-simple-mode');
    if (el) el.checked = false;
    if (typeof renderWatchStreakTiers === 'function') renderWatchStreakTiers();
  });
  await page.locator('.watch-streak-tier-row').first().screenshot({
    path: path.join(outDir, 'watch-streak-test-flow.png'),
  });

  await page.evaluate(() => {
    const el = document.getElementById('watch-streak-simple-mode');
    if (el) el.checked = true;
    if (typeof renderWatchStreakTiers === 'function') renderWatchStreakTiers();
  });
  await page.waitForTimeout(350);
  await page.locator('#watch-streak-simple-tier-panel').screenshot({
    path: path.join(outDir, 'watch-streak-section-simple-mode.png'),
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
  try {
    await waitForOverlay(overlayPort);
  } catch (e) {
    console.error(`Overlay server not reachable on :${overlayPort}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  try {
    await captureOverlays(browser, overlayPort);
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