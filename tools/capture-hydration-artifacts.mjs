import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = '/opt/cursor/artifacts';

const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const panelCss = fs.readFileSync(path.join(root, 'public/hydration-panel.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

const panelStart = indexHtml.indexOf('id="hydration-panel-modal"');
const panelEnd = indexHtml.indexOf('<!-- Raid Favorites Modal -->');
const panelMarkup = indexHtml.slice(indexHtml.lastIndexOf('<div', panelStart), panelEnd);

const christmas = JSON.parse(fs.readFileSync(path.join(root, 'skins/christmas.json'), 'utf8'));
const minimalWhite = JSON.parse(fs.readFileSync(path.join(root, 'skins/minimal-white.json'), 'utf8'));

function skinVars(skin) {
  return Object.entries(skin.variables || {})
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n');
}

function panelShell(skinVarsCss, extraStyle = '') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
:root { ${skinVarsCss}
  --border-color: var(--border-primary, #333);
  --accent: var(--accent-primary);
}
body { margin: 0; background: var(--bg-primary); font-family: Segoe UI, sans-serif; }
${css}
${panelCss}
#hydration-panel-modal { display: flex !important; position: fixed; inset: 0; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); z-index: 99; }
#hydration-panel-modal.hidden { display: flex !important; }
.modal-content { max-height: 92vh; }
details summary { cursor: pointer; margin-bottom: 10px; }
details summary::-webkit-details-marker { display: none; }
${extraStyle}
</style></head><body>${panelMarkup}</body></html>`;
}

function startStaticServer() {
  const overlayDir = path.join(root, 'overlays/hydrationOverlay');
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      if (url === '/hydration' || url === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end(fs.readFileSync(path.join(overlayDir, 'index.html')));
      } else if (url === '/hydration-overlay.js') {
        res.setHeader('Content-Type', 'application/javascript');
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

function demoPayload(style, progress, goal, extra = {}) {
  return {
    current: progress,
    goal,
    percentage: (progress / goal) * 100,
    streak: progress >= goal ? 3 : progress > 0 ? 1 : 0,
    units: 'oz',
    leveledUp: false,
    celebration: progress >= goal,
    config: {
      gaugeStyle: style,
      streamGoal: goal,
      currentProgress: progress,
      incrementAmount: 8,
      fillColor: extra.fillColor || '#4fc3f7',
      waterColor: extra.fillColor || '#4fc3f7',
      accentColor: extra.accentColor || '#29b6f6',
      textColor: extra.textColor || '#ffffff',
      plateColor: extra.plateColor || 'rgba(12,16,24,0.85)',
      backgroundColor: extra.plateColor || 'rgba(12,16,24,0.85)',
      showPlate: extra.showPlate !== false,
      gaugeSize: 280,
      effectsIntensity: extra.effectsIntensity || 'medium',
      positionX: 50,
      positionY: 50,
      goalConfetti: true,
      enableEffects: true,
      dailyStreak: progress >= goal ? 3 : 0,
      ...extra,
    },
  };
}

const SECTIONS = [
  { id: 'hydration-sec-gauge', file: 'hydration_panel_section_gauge_style.png' },
  { id: 'hydration-sec-colors', file: 'hydration_panel_section_colors.png' },
  { id: 'hydration-sec-effects', file: 'hydration_panel_section_effects.png' },
  { id: 'hydration-sec-sound', file: 'hydration_panel_section_sound.png' },
  { id: 'hydration-sec-trigger', file: 'hydration_panel_section_trigger.png' },
  { id: 'hydration-sec-goal', file: 'hydration_panel_section_goal_reset.png' },
  { id: 'hydration-sec-url', file: 'hydration_panel_section_overlay_url.png' },
];

const GAUGES = ['circular', 'bottle', 'vertical', 'horizontal', 'minimal'];
const STATES = [
  { name: 'empty', progress: 0 },
  { name: 'half', progress: 32 },
  { name: 'goal_met', progress: 64 },
];
const BACKGROUNDS = {
  dark: 'linear-gradient(135deg,#0d1a0d 0%,#1a2838 50%,#0a0a0a 100%)',
  bright: 'linear-gradient(135deg,#87ceeb 0%,#f0f8ff 40%,#ffeaa7 100%)',
};

fs.mkdirSync(outDir, { recursive: true });

const { srv, base } = await startStaticServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

// Populate reward dropdown for trigger screenshot
const demoRewards = `<option value="">— Keyword fallback —</option>
<option value="rw1" data-reward-id="rw1" data-reward-title="Hydrate">Hydrate (100 pts)</option>
<option value="rw2" data-reward-id="rw2" data-reward-title="Water Break">Water Break (50 pts)</option>`;

const panelPreviewPayload = demoPayload('circular', 32, 64, { streak: 2, dailyStreak: 2 });

async function wirePanelPreview() {
  await page.evaluate((previewUrl) => {
  const frame = document.getElementById('hydration-preview-frame');
    if (frame) frame.src = previewUrl;
  }, `${base}/hydration?preview=1`);
  await page.waitForTimeout(400);
  const frame = page.frames().find((f) => f.url().includes('/hydration'));
  if (frame) {
    await frame.evaluate((payload) => {
      window.__hydrationDemoUpdate(payload);
    }, panelPreviewPayload);
    await page.waitForTimeout(350);
  }
}

for (const sec of SECTIONS) {
  const hideOthers = SECTIONS.map((s) =>
    s.id === sec.id ? '' : `#${s.id}{opacity:0.35;max-height:52px;overflow:hidden;}`,
  ).join('');
  const triggerExtra =
    sec.id === 'hydration-sec-trigger'
      ? `#hydration-reward-select{min-height:36px} #hydration-reward-select::before{} `
      : '';
  await page.setContent(
    panelShell(skinVars(minimalWhite), `${hideOthers} ${triggerExtra}`),
    { waitUntil: 'load' },
  );
  if (sec.id === 'hydration-sec-trigger') {
    await page.evaluate((opts) => {
      const sel = document.getElementById('hydration-reward-select');
      if (sel) sel.innerHTML = opts;
    }, demoRewards);
    await page.selectOption('#hydration-reward-select', 'rw1');
    const hint = await page.$('#hydration-reward-scope-hint');
    if (hint) {
      await page.evaluate((el) => {
        el.textContent = '2 custom rewards loaded.';
      }, hint);
    }
  }
  if (sec.id === 'hydration-sec-url') {
    await page.evaluate(() => {
      const u = document.getElementById('hydration-overlay-url');
      if (u) u.textContent = 'http://localhost:8080/hydration';
    });
  }
  await wirePanelPreview();
  await page.locator(`#${sec.id}`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, sec.file) });
}

await page.setContent(panelShell(skinVars(minimalWhite)), { waitUntil: 'load' });
await wirePanelPreview();
await page.screenshot({ path: path.join(outDir, 'hydration_panel_full.png'), fullPage: true });

const overlayPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });

for (const bgName of Object.keys(BACKGROUNDS)) {
  for (const gauge of GAUGES) {
    for (const st of STATES) {
      await overlayPage.goto(`${base}/hydration`, { waitUntil: 'networkidle' });
      await overlayPage.evaluate(
        ({ bg, payload }) => {
          document.body.style.background = bg;
          window.__hydrationDemoUpdate(payload);
        },
        { bg: BACKGROUNDS[bgName], payload: demoPayload(gauge, st.progress, 64) },
      );
      await overlayPage.waitForTimeout(400);
      const file = `hydration_gauge_${gauge}_${st.name}_bg_${bgName}.png`;
      await overlayPage.screenshot({ path: path.join(outDir, file) });
    }
  }
}

await overlayPage.goto(`${base}/hydration`, { waitUntil: 'networkidle' });
await overlayPage.evaluate(
  ({ bg, payload }) => {
    document.body.style.background = bg;
    window.__hydrationDemoUpdate(payload);
  },
  {
    bg: BACKGROUNDS.dark,
    payload: demoPayload('circular', 40, 64, {
      fillColor: '#ff6b9d',
      accentColor: '#ffc107',
      textColor: '#ffffff',
      plateColor: 'rgba(40,0,60,0.88)',
    }),
  },
);
await overlayPage.screenshot({ path: path.join(outDir, 'hydration_custom_colors.png') });

for (const [skinName, skin] of [
  ['christmas', christmas],
  ['minimal_white', minimalWhite],
]) {
  const accent = skin.variables['--accent-primary'];
  const text = skin.variables['--text-primary'];
  const plate = skin.variables['--bg-tertiary'] || skin.variables['--bg-secondary'];
  await overlayPage.goto(`${base}/hydration`, { waitUntil: 'networkidle' });
  await overlayPage.evaluate(
        ({ bg, accent, text, plate }) => {
          document.body.style.background = bg;
          const p = {
            current: 24,
            goal: 64,
            percentage: 37.5,
            streak: 2,
            units: 'oz',
            config: {
              gaugeStyle: 'circular',
              streamGoal: 64,
              currentProgress: 24,
              fillColor: accent,
              waterColor: accent,
              accentColor: accent,
              textColor: text,
              plateColor: plate,
              backgroundColor: plate,
              showPlate: true,
              gaugeSize: 280,
              positionX: 50,
              positionY: 50,
              matchTheme: true,
            },
          };
          window.__hydrationDemoUpdate(p);
        },
        { bg: BACKGROUNDS.dark, accent, text, plate },
      );
  await overlayPage.screenshot({ path: path.join(outDir, `hydration_theme_match_${skinName}.png`) });
}

const fxPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const effectShots = [
  { file: 'hydration_effect_sparkles.png', kind: 'sparkle', wait: 520 },
  { file: 'hydration_effect_splash_ripple.png', kind: 'splash', wait: 450 },
  { file: 'hydration_effect_bubbles.png', kind: 'bubbles', wait: 620 },
  { file: 'hydration_effect_number_pop.png', kind: 'numpop', wait: 280 },
  { file: 'hydration_effect_confetti_goal_met.png', kind: 'confetti', wait: 650 },
];

async function triggerEffectInPage(page, kind) {
  await page.evaluate(
    ({ kind, darkBg, brightBg }) => {
      const basePayload = (style, progress) => ({
        current: progress,
        goal: 64,
        percentage: (progress / 64) * 100,
        units: 'oz',
        config: {
          gaugeStyle: style,
          streamGoal: 64,
          currentProgress: progress,
          fillColor: '#4fc3f7',
          waterColor: '#4fc3f7',
          accentColor: '#29b6f6',
          gaugeSize: 280,
          positionX: 50,
          positionY: 48,
          showPlate: true,
          enableEffects: true,
          effectsIntensity: 'high',
          effectSet: ['sparkles', 'splash', 'numberPop'],
          goalConfetti: true,
        },
      });
      if (kind === 'sparkle') {
        document.body.style.background = darkBg;
        window.__hydrationDemoUpdate(basePayload('circular', 28));
        window.__hydrationDemoSparkle();
      } else if (kind === 'splash') {
        document.body.style.background = darkBg;
        window.__hydrationDemoUpdate(basePayload('circular', 30));
        window.__hydrationDemoSplash();
      } else if (kind === 'bubbles') {
        document.body.style.background = brightBg;
        window.__hydrationDemoUpdate(basePayload('bottle', 36));
        window.__hydrationDemoBubbles();
      } else if (kind === 'numpop') {
        document.body.style.background = darkBg;
        window.__hydrationDemoUpdate(basePayload('horizontal', 40));
        window.__hydrationDemoNumberPop();
      } else if (kind === 'confetti') {
        document.body.style.background = darkBg;
        window.__hydrationDemoUpdate(basePayload('circular', 64));
        window.__hydrationDemoConfetti();
        window.__hydrationDemoSparkle();
      } else if (kind === 'idle') {
        document.body.style.background = darkBg;
        window.__hydrationDemoUpdate(basePayload('circular', 40));
      } else if (kind === 'fill') {
        document.body.style.background = darkBg;
        window.__hydrationDemoUpdate(basePayload('circular', 16));
        window.__hydrationDemoFill(0.25, 0.7);
        window.__hydrationDemoSplash();
        window.__hydrationDemoSparkle();
      }
    },
    { kind, darkBg: BACKGROUNDS.dark, brightBg: BACKGROUNDS.bright },
  );
}

async function recordWebm(browser, kind, fileBase, durationMs = 3200) {
  const videoDir = path.join(outDir, '_video_tmp');
  fs.mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 720, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 720, height: 720 } },
  });
  const vpage = await context.newPage();
  await vpage.goto(`${base}/hydration?preview=1`, { waitUntil: 'networkidle' });
  await triggerEffectInPage(vpage, kind);
  await vpage.waitForTimeout(durationMs);
  const webmPath = path.join(outDir, `${fileBase}.webm`);
  await vpage.close();
  const vid = vpage.video();
  if (vid) await vid.saveAs(webmPath);
  await context.close();
  try {
    fs.rmSync(videoDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return webmPath;
}

async function webmToGif(webmPath, gifPath, fps = 12) {
  const { execFileSync } = await import('child_process');
  const palette = webmPath.replace('.webm', '_palette.png');
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webmPath,
      '-vf',
      `fps=${fps},scale=480:-1:flags=lanczos,palettegen`,
      palette,
    ],
    { stdio: 'pipe' },
  );
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webmPath,
      '-i',
      palette,
      '-lavfi',
      `fps=${fps},scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse`,
      '-loop',
      '0',
      gifPath,
    ],
    { stdio: 'pipe' },
  );
  try {
    fs.unlinkSync(palette);
  } catch {
    /* ignore */
  }
}
for (const shot of effectShots) {
  await fxPage.goto(`${base}/hydration?preview=1`, { waitUntil: 'networkidle' });
  await triggerEffectInPage(fxPage, shot.kind);
  await fxPage.waitForTimeout(shot.wait);
  await fxPage.screenshot({ path: path.join(outDir, shot.file) });
}

const loopClips = [
  { kind: 'idle', base: 'hydration_idle_wave' },
  { kind: 'sparkle', base: 'hydration_loop_sparkles' },
  { kind: 'splash', base: 'hydration_loop_splash' },
  { kind: 'bubbles', base: 'hydration_loop_bubbles' },
  { kind: 'confetti', base: 'hydration_loop_confetti_goal' },
  { kind: 'fill', base: 'hydration_loop_fill_slosh' },
];
for (const clip of loopClips) {
  const dur = clip.kind === 'idle' ? 4000 : 3200;
  const webm = await recordWebm(browser, clip.kind, clip.base, dur);
  const gif = path.join(outDir, `${clip.base}.gif`);
  if (fs.existsSync(webm)) await webmToGif(webm, gif);
}

// Before state placeholder (legacy overlay style reference)
await overlayPage.goto(`${base}/hydration`, { waitUntil: 'networkidle' });
await overlayPage.evaluate(() => {
  document.body.style.background = '#222';
  window.__hydrationDemoUpdate({
    current: 0,
    goal: 64,
    percentage: 0,
    config: { gaugeStyle: 'circular', textColor: '#aaa', fillColor: '#4fc3f7', gaugeSize: 200, positionX: 50, positionY: 50, showPlate: false },
  });
});
await overlayPage.screenshot({ path: path.join(outDir, 'hydration_before_legacy_empty.png') });

const manifest = fs
  .readdirSync(outDir)
  .filter((f) => /hydration/.test(f) && /\.(png|gif|webm)$/.test(f));
fs.writeFileSync(path.join(outDir, 'hydration_artifacts_manifest.txt'), manifest.sort().join('\n'));

await browser.close();
srv.close();
console.log(`Wrote ${manifest.length} hydration artifacts to ${outDir}`);