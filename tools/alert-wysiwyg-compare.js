// Headless WYSIWYG check: renders the alert editor preview (real public/index.html)
// and the overlay browser source (generated baseOverlay) with the SAME alert, measures
// text size relative to the 1920x1080 canvas and saves screenshots + a side-by-side.
//
// Usage (isolated profile!):
//   electron.exe --user-data-dir=<temp> tools/alert-wysiwyg-compare.js <repoRoot> <outDir> <label> [fontPx]
// Never touches the real VirtualDeck profile; no network, no websocket server.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// Positional args come after this script's path (switches like --user-data-dir may precede it).
const argv = (() => {
  const i = process.argv.findIndex((a) => { try { return path.resolve(a) === path.resolve(__filename); } catch (e) { return false; } });
  return process.argv.slice(i >= 0 ? i + 1 : 2).filter((a) => !a.startsWith('--'));
})();
const repoRoot = path.resolve(argv[0] || path.join(__dirname, '..'));
const outDir = path.resolve(argv[1] || path.join(repoRoot, 'wysiwyg-shots'));
const label = argv[2] || 'run';
const fontPx = parseInt(argv[3] || '72', 10);
process.on('uncaughtException', (e) => { try { fs.appendFileSync(path.join(outDir, 'fatal-' + label + '.txt'), String(e && e.stack || e)); } catch (_) {} app.exit(3); });
const TEXT = 'Thanks for the follow TestUser123!';
const ALERT = {
  text: 'Thanks for the follow {username}!',
  duration: 5,
  textStyling: { position: 'topCenter', fontFamily: "'Impact', sans-serif", fontSize: fontPx + 'px', fontWeight: '700', color: '#ffcc00', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', textStroke: '2px #000' },
  animation: { type: 'none', duration: '1s', delay: '0s', iteration: '1', easing: 'ease' }
};

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const logFile = path.join(outDir, `log-${label}.txt`);
fs.writeFileSync(logFile, '');
const log = (m) => { try { fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} };
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + what)), ms))]);
const load = (bw, file, what) => withTimeout(bw.loadFile(file).catch((e) => log('load warn ' + what + ': ' + e.message)), 15000, 'load ' + what).catch((e) => log(e.message));
setTimeout(() => { log('global timeout'); app.exit(2); }, 75000);

function overlayPayload() {
  const rendererPath = path.join(repoRoot, 'public', 'alert-text-render.js');
  if (fs.existsSync(rendererPath)) {
    const T = require(rendererPath);
    const b = T.alertToSlot(ALERT, TEXT);
    return { type: 'buttonTrigger', options: { clearPrevious: true }, slots: { [b.position]: b.slot }, centerMedia: [], fullscreenMedia: [] };
  }
  // Pre-fix payload builder (verbatim field mapping from old script.js)
  const t = ALERT.textStyling;
  return { type: 'buttonTrigger', options: { clearPrevious: true }, centerMedia: [], fullscreenMedia: [], slots: { [t.position]: { text: TEXT,
    style: { fontFamily: t.fontFamily, fontSize: t.fontSize, color: t.color, fontWeight: t.fontWeight, textShadow: t.textShadow, webkitTextStroke: t.textStroke, textAlign: 'center', zIndex: '1' }, animation: null } } };
}

function generateOverlayFile() {
  let html = fs.readFileSync(path.join(repoRoot, 'overlays', 'baseOverlay', 'index.html'), 'utf8');
  html = html.replace(/\{\{OVERLAY_NAME\}\}/g, 'wysiwyg-test').replace(/\{\{BACKGROUND_MODE\}\}/g, 'transparent')
    .replace(/\{\{CHROMA_COLOR\}\}/g, '#00ff00').replace(/\{\{LAYOUT_CLASS\}\}/g, 'layout-center');
  const rp = path.join(repoRoot, 'public', 'alert-text-render.js');
  if (fs.existsSync(rp)) html = html.replace('/*__VD_ALERT_TEXT_RENDER__*/', () => fs.readFileSync(rp, 'utf8').replace(/<\/script/gi, '<\\/script'));
  // dark background so the transparent overlay is visible in screenshots
  html = html.replace('</head>', '<style>html{background:#202020 !important}</style></head>');
  const f = path.join(app.getPath('userData'), 'overlay-' + label + '.html');
  fs.writeFileSync(f, html);
  return f;
}

function win(w, h) {
  return new BrowserWindow({ width: w, height: h, useContentSize: true, show: false, enableLargerThanScreen: true,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
}

async function renderOverlay(w, h) {
  const bw = win(w, h);
  bw.setContentSize(w, h);
  await load(bw, generateOverlayFile(), 'overlay');
  await wait(300);
  await bw.webContents.executeJavaScript(`renderPayload(${JSON.stringify(overlayPayload())}); true`);
  await wait(700);
  const m = await bw.webContents.executeJavaScript(`(() => {
    const el = document.querySelector('.overlay-content .text-element');
    const rg = document.createRange(); rg.selectNodeContents(el);
    const r = rg.getBoundingClientRect(); // glyph box (not the full-width slot)
    return { viewW: innerWidth, viewH: innerHeight, textW: r.width, textH: r.height, textTop: r.top, textLeft: r.left,
      fontSize: getComputedStyle(el).fontSize, stageTransform: getComputedStyle(document.querySelector('.overlay-content')).transform };
  })()`);
  log('overlay measured ' + JSON.stringify(m));
  const img = await withTimeout(bw.webContents.capturePage(), 15000, 'capture overlay');
  const file = path.join(outDir, `overlay-${label}-${w}x${h}.png`);
  fs.writeFileSync(file, img.toPNG());
  bw.destroy();
  // canvas = the area the 1920x1080 overlay occupies inside the source
  return Object.assign(m, { file, ratioH: m.textH / m.viewH, ratioW: m.textW / m.viewW, topRatio: m.textTop / m.viewH });
}

// Inert electronAPI stub for the editor page: every call resolves to null, on*() listeners are no-ops.
// No IPC, no main-process handlers - nothing can reach a real profile, OBS, Twitch or audio.
function stubPreload() {
  const f = path.join(app.getPath('userData'), 'vd-stub-preload.js');
  fs.writeFileSync(f, `
    const noop = () => {};
    window.electronAPI = new Proxy({}, { get(t, k) {
      if (typeof k !== 'string' || k === 'then') return undefined;
      if (/^on[A-Z]/.test(k)) return () => noop;
      return () => Promise.resolve(null);
    } });
    window.alert = noop; window.confirm = () => false; window.prompt = () => null;
  `);
  return f;
}

async function renderPreview() {
  const bw = new BrowserWindow({ width: 1500, height: 1000, useContentSize: true, show: false,
    webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, sandbox: false, preload: stubPreload(), backgroundThrottling: false } });
  bw.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) log('renderer[' + level + '] ' + String(message).slice(0, 300) + ' @' + String(sourceId).split(/[\\/]/).pop() + ':' + line);
  });
  await load(bw, path.join(repoRoot, 'public', 'index.html'), 'index');
  log('index loaded');
  await wait(1500);
  const m = await bw.webContents.executeJavaScript(`(async () => {
    try { showAlertWidget(); } catch (e) { const w = document.getElementById('alert-widget'); if (w) w.classList.remove('hidden'); }
    const set = (id, v, ev) => { const e = document.getElementById(id); if (!e) return false; e.value = v; e.dispatchEvent(new Event(ev || 'change', { bubbles: true })); return true; };
    const A = ${JSON.stringify(ALERT)};
    set('alert-type', 'follower');
    set('alert-text', A.text, 'input');
    set('alert-text-position', A.textStyling.position);
    set('alert-font-family', A.textStyling.fontFamily);
    set('alert-font-weight', A.textStyling.fontWeight);
    set('alert-text-color', A.textStyling.color);
    set('alert-text-shadow', A.textStyling.textShadow);
    set('alert-text-stroke', A.textStyling.textStroke);
    set('alert-animation', 'none');
    const slider = document.getElementById('alert-font-size');
    slider.value = ${fontPx};
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 800));
    const area = document.getElementById('alert-preview-area');
    // Fresh temp profile shows first-run modals/toasts; hide anything that would cover the preview.
    const widget = document.getElementById('alert-widget');
    document.querySelectorAll('body *').forEach((el) => {
      if (el.contains(area) || (widget && widget.contains(el))) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || ((cs.position === 'absolute') && parseInt(cs.zIndex || '0', 10) > 0)) el.style.setProperty('display', 'none', 'important');
    });
    area.scrollIntoView({ block: 'start' });
    await new Promise(r => setTimeout(r, 300));
    const box = area.querySelector('.vd-alert-preview-viewport') || area.querySelector('.alert-preview-content');
    const text = area.querySelector('.vd-alert-text') || area.querySelector('.alert-preview-content p');
    const rg = document.createRange(); rg.selectNodeContents(text);
    const b = box.getBoundingClientRect(), t = rg.getBoundingClientRect();
    return { sliderValue: slider.value, sliderMax: slider.max, boxW: b.width, boxH: b.height, boxX: b.left, boxY: b.top,
      textW: t.width, textH: t.height, textTop: t.top - b.top, fontSize: getComputedStyle(text).fontSize, wysiwyg: !!area.querySelector('.vd-alert-preview-viewport') };
  })()`);
  const rect = { x: Math.max(0, Math.floor(m.boxX)), y: Math.max(0, Math.floor(m.boxY)), width: Math.ceil(m.boxW), height: Math.ceil(m.boxH) };
  log('preview measured ' + JSON.stringify(m));
  // late first-run modals (timers): hide again right before capture
  const hidden = await bw.webContents.executeJavaScript(`(() => {
    const area = document.getElementById('alert-preview-area');
    document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} });
    const names = [];
    for (let pass = 0; pass < 6; pass++) {
      const r = area.getBoundingClientRect();
      let changed = false;
      for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const fy of [0.1, 0.5, 0.9]) {
        const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
        if (!hit || area.contains(hit)) continue;
        // climb to the highest ancestor that does not contain the preview area
        let el = hit;
        while (el.parentElement && !el.parentElement.contains(area)) el = el.parentElement;
        if (el.contains(area) || el === document.body) continue;
        names.push(el.tagName + '#' + el.id + '.' + String(el.className).slice(0, 40));
        el.style.setProperty('display', 'none', 'important');
        changed = true;
      }
      if (!changed) break;
    }
    return names;
  })()`);
  log('hid covering elements: ' + JSON.stringify(hidden));
  await wait(200);
  const img = await withTimeout(bw.webContents.capturePage(rect), 15000, 'capture preview');
  const file = path.join(outDir, `preview-${label}.png`);
  fs.writeFileSync(file, img.toPNG());
  bw.destroy();
  // Preview canvas: WYSIWYG = the 16:9 viewport; legacy = the whole preview box
  return Object.assign(m, { file, ratioH: m.textH / m.boxH, ratioW: m.textW / m.boxW, topRatio: m.textTop / m.boxH });
}

async function sideBySide(previewFile, overlayFile, result) {
  const bw = win(2000, 720);
  const toUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const html = `<html><body style="margin:0;overflow:hidden;background:#111;color:#eee;font:16px Segoe UI,Arial">
    <div style="display:flex;gap:20px;padding:20px">
      <div style="width:950px"><div style="margin-bottom:8px">EDITOR PREVIEW (${label}) - text height ${(result.preview.ratioH * 100).toFixed(2)}% of canvas, width ${(result.preview.ratioW * 100).toFixed(1)}%</div>
        <img src="${toUrl(previewFile)}" style="width:950px;outline:1px solid #555"></div>
      <div style="width:950px"><div style="margin-bottom:8px">OVERLAY BROWSER SOURCE 1920x1080 - text height ${(result.overlay.ratioH * 100).toFixed(2)}% of canvas, width ${(result.overlay.ratioW * 100).toFixed(1)}%</div>
        <img src="${toUrl(overlayFile)}" style="width:950px;outline:1px solid #555"></div>
    </div><div style="padding:0 20px">Same alert: Impact ${fontPx}px, #ffcc00, 2px stroke, topCenter. Height ratio preview/overlay = ${(result.preview.ratioH / result.overlay.ratioH).toFixed(3)}</div></body></html>`;
  const f = path.join(app.getPath('userData'), 'sbs.html');
  fs.writeFileSync(f, html);
  await load(bw, f, 'sbs');
  await wait(500);
  const img = await withTimeout(bw.webContents.capturePage(), 15000, 'capture sbs');
  const file = path.join(outDir, `side-by-side-${label}.png`);
  fs.writeFileSync(file, img.toPNG());
  bw.destroy();
  return file;
}

log('start');
app.on('window-all-closed', () => {}); // keep running between windows
app.whenReady().then(async () => {
  log('ready');
  // Fully offline: only file:/data:/devtools URLs load. The editor page's init GETs to
  // localhost (a running VirtualDeck/Raven) are cancelled, so nothing real is contacted.
  const { session } = require('electron');
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const ok = /^(file|data|blob|devtools|chrome-extension):/i.test(details.url);
    if (!ok) log('blocked ' + details.method + ' ' + details.url.slice(0, 120));
    cb({ cancel: !ok });
  });
  const result = { label, repoRoot, fontPx };
  try {
    result.preview = await renderPreview();
    result.overlay = await renderOverlay(1920, 1080);
    result.overlay720 = await renderOverlay(1280, 720);
    result.heightRatioPreviewVsOverlay = result.preview.ratioH / result.overlay.ratioH;
    result.widthRatioPreviewVsOverlay = result.preview.ratioW / result.overlay.ratioW;
    result.overlay720VsOverlay1080 = result.overlay720.ratioH / result.overlay.ratioH;
    result.sideBySide = await sideBySide(result.preview.file, result.overlay.file, result);
  } catch (e) {
    result.error = String(e && e.stack || e);
  }
  fs.writeFileSync(path.join(outDir, `result-${label}.json`), JSON.stringify(result, null, 2));
  app.exit(0);
});
