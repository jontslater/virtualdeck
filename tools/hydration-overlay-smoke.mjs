#!/usr/bin/env node
/**
 * End-to-end smoke for hydration overlay (same HTTP + WS pattern as main.js overlay server).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';

const require = createRequire(import.meta.url);
const { createHydrationService } = require('../lib/hydration-service');
const { DEFAULT_HYDRATION_CONFIG } = require('../lib/hydration-config');
const { isHydrationRewardRedemption } = require('../lib/hydration-redemption');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const overlayDir = path.join(root, 'overlays/hydrationOverlay');
const configPath = path.join('/tmp', `vd-hydration-smoke-${process.pid}.json`);

const overlayClients = new Set();
const service = createHydrationService(configPath);

function startOverlayServer() {
  const port = 0;
  const srv = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/hydration' || url === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end(fs.readFileSync(path.join(overlayDir, 'index.html')));
    } else if (url === '/hydration-overlay.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(fs.readFileSync(path.join(overlayDir, 'hydration-overlay.js')));
    } else if (url === '/media/smoke-silent.mp3') {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.end(Buffer.from([0xff, 0xfb, 0x90, 0x00]));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  return new Promise((resolve) => {
    srv.listen(port, '127.0.0.1', () => {
      const bound = srv.address().port;
      const wss = new WebSocketServer({ server: srv });
      wss.on('connection', (ws) => {
        overlayClients.add(ws);
        const cfg = service.loadHydrationConfig();
        ws.send(JSON.stringify(service.makeBroadcastPayload(cfg)));
        ws.on('close', () => overlayClients.delete(ws));
      });
      resolve({ srv, port: bound, wss });
    });
  });
}

function resetConfig(extra = {}) {
  service.saveHydrationConfig({
    ...DEFAULT_HYDRATION_CONFIG,
    currentProgress: 0,
    streamGoal: 64,
    incrementAmount: 8,
    gaugeStyle: 'circular',
    redemptionKeyword: 'hydrate',
    rewardId: 'rw-hydrate-test',
    trackingEnabled: true,
    enableEffects: true,
    effectsIntensity: 'medium',
    goalConfetti: true,
    soundEnabled: true,
    soundPath: 'smoke-silent.mp3',
    goalSoundPath: 'smoke-silent.mp3',
    soundVolume: 0.5,
    goalSoundVolume: 0.5,
    ...extra,
  });
}

async function waitForProgress(page, oz, timeoutMs = 5000) {
  await page.waitForFunction(
    (target) => {
      const el = document.getElementById('hydration-amount-main');
      return el && el.textContent && el.textContent.includes(String(target));
    },
    oz,
    { timeout: timeoutMs },
  );
}

async function waterHasFill(page) {
  return page.evaluate(() => {
    const c = document.getElementById('canvas-circular');
    if (!c) return false;
    const ctx = c.getContext('2d');
    const b = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.85), 1, 1).data;
    return b[2] > 120;
  });
}

async function readWsFrames(page) {
  return page.evaluate(() => window.__wsFrames || []);
}

async function run() {
  fs.writeFileSync(configPath, '{}');
  resetConfig();
  const { srv, port } = await startOverlayServer();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.addInitScript(() => {
    window.__wsFrames = [];
    window.__soundPlayed = 0;
    const Orig = window.WebSocket;
    window.WebSocket = function WebSocketWrap(url, protocols) {
      const ws = new Orig(url, protocols);
      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          window.__wsFrames.push(data);
          if (data.type === 'hydrationPlaySound') window.__soundPlayed += 1;
        } catch {
          /* ignore */
        }
      });
      return ws;
    };
    window.WebSocket.prototype = Orig.prototype;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function patchedPlay() {
      window.__soundPlayed += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.play._smoke = true;
  });

  const results = [];

  try {
    await page.goto(`${base}/hydration`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await waitForProgress(page, 0);

    // Keyword fallback redemption (only when rewardId is unset)
    service.saveHydrationConfig({
      ...service.loadHydrationConfig(),
      rewardId: '',
      currentProgress: 0,
    });
    const kwEvent = { reward: { id: 'other', title: 'Water break — hydrate now' }, user_input: '' };
    const cfgKw = service.loadHydrationConfig();
    if (!isHydrationRewardRedemption(kwEvent, cfgKw)) throw new Error('keyword redeem matcher failed');
    service.tryHandleRedemption(overlayClients, kwEvent);
    await waitForProgress(page, 8);
    await page.waitForTimeout(250);
    const fxAfterKw = await page.evaluate(() => document.querySelector('.fx-number-pop') !== null);
    results.push({
      step: 'keyword_redemption',
      ok: true,
      water: await waterHasFill(page),
      effects: fxAfterKw,
    });

    // Reward id redemption (id match; keyword ignored when rewardId is set)
    service.saveHydrationConfig({
      ...service.loadHydrationConfig(),
      rewardId: 'rw-hydrate-test',
    });
    const idEvent = { reward: { id: 'rw-hydrate-test', title: 'Custom hydrate' } };
    if (!isHydrationRewardRedemption(idEvent, service.loadHydrationConfig())) {
      throw new Error('reward id redeem matcher failed');
    }
    service.tryHandleRedemption(overlayClients, idEvent);
    await waitForProgress(page, 16);
    results.push({ step: 'reward_id_redemption', ok: true });

    // Deck button (manual increment)
    service.incrementHydration(overlayClients, undefined, 'deck');
    await waitForProgress(page, 24);
    const framesAfterDeck = await readWsFrames(page);
    const hadLogSound =
      framesAfterDeck.some((f) => f.type === 'hydrationPlaySound') || (await page.evaluate(() => window.__soundPlayed)) > 0;
    await page.waitForTimeout(250);
    const hadFx = await page.evaluate(() => document.querySelector('.fx-number-pop') !== null);
    results.push({ step: 'deck_log_hydration', ok: true, sound: hadLogSound, effects: hadFx });

    // Manual reset
    service.resetHydration(overlayClients);
    await waitForProgress(page, 0);
    results.push({ step: 'manual_reset', ok: true, waterLow: !(await waterHasFill(page)) });

    // Goal met
    resetConfig({ currentProgress: 56 });
    service.broadcastHydrationUpdate(overlayClients, service.loadHydrationConfig());
    await waitForProgress(page, 56);
    service.incrementHydration(overlayClients, 8, 'goal-test');
    await waitForProgress(page, 64);
    await page.waitForTimeout(900);
    const celebration = (await readWsFrames(page)).some(
      (f) => f.type === 'hydrationUpdate' && f.data && f.data.celebration,
    );
    const goalWater = await waterHasFill(page);
    results.push({ step: 'goal_met', ok: celebration && goalWater, celebration, goalWater });

    const failed = results.filter((r) => !r.ok || r.ok === false);
    if (failed.length) {
      console.error('SMOKE FAILED', JSON.stringify({ results, failed }, null, 2));
      process.exitCode = 1;
    } else {
      console.log('SMOKE PASS', JSON.stringify(results, null, 2));
    }
  } finally {
    await browser.close();
    srv.close();
    try {
      fs.unlinkSync(configPath);
    } catch {
      /* ignore */
    }
  }
}

await run();