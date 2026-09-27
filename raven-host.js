/**
 * Starts/stops the bundled Raven voice AI (bridge + controller) next to VirtualDeck.
 * No Live2D / VTube Studio — TTS + Copilot + chat brain only.
 * 
 * SECURITY NOTE (P0):
 * - API keys (OpenAI, ElevenLabs) are stored in userData/raven.env (user-local)
 * - NEVER bundle pre-filled API keys in the installer or bundled env.defaults
 * - Users MUST provide their own API keys (BYOK - Bring Your Own Key)
 * - The empty template below prompts users to fill in their own keys
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app, shell, dialog } = require('electron');

let ravenProc = null;

function prefsPath() {
  return path.join(app.getPath('userData'), 'raven-host.json');
}

function loadPrefs() {
  try {
    return JSON.parse(fs.readFileSync(prefsPath(), 'utf8'));
  } catch {
    return { autoStart: true };
  }
}

function savePrefs(prefs) {
  fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2), 'utf8');
}

function ravenRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'raven');
  }
  const extra = path.join(__dirname, 'extra', 'raven');
  if (fs.existsSync(path.join(extra, 'sidecar.js'))) return extra;
  if (process.env.RAVEN_APP_ROOT) return process.env.RAVEN_APP_ROOT;
  return path.join('E:', 'AIChatBot');
}

function envFile() {
  return path.join(app.getPath('userData'), 'raven.env');
}

function bundledEnvPath() {
  const root = ravenRoot();
  const candidates = [
    path.join(root, 'env.defaults'),
    path.join(root, 'app', 'env.example'),
    path.join(root, 'env.example'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function parseEnv(text) {
  const map = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let val = line.slice(eq + 1).trim();
    const hash = val.indexOf(' #');
    if (hash >= 0) val = val.slice(0, hash).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[line.slice(0, eq).trim()] = val;
  }
  return map;
}

function writeEnvFromTemplate(dest, templateText, overlay) {
  const seen = new Set();
  const lines = [];
  for (const raw of String(templateText || '').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#') || raw.indexOf('=') < 1) {
      lines.push(raw);
      continue;
    }
    const eq = raw.indexOf('=');
    const key = raw.slice(0, eq).trim();
    seen.add(key);
    const val = Object.prototype.hasOwnProperty.call(overlay, key) ? overlay[key] : raw.slice(eq + 1);
    lines.push(`${key}=${val}`);
  }
  for (const [key, val] of Object.entries(overlay)) {
    if (!seen.has(key)) lines.push(`${key}=${val}`);
  }
  fs.writeFileSync(dest, lines.join('\n').replace(/\n+$/, '') + '\n', 'utf8');
}

function ensureEnv() {
  const dest = envFile();
  const bundled = bundledEnvPath();
  if (!fs.existsSync(dest)) {
    if (bundled) {
      fs.copyFileSync(bundled, dest);
    } else {
      fs.writeFileSync(
        dest,
        [
          'RAVEN_VOICE_ONLY=1',
          'VTUBE_STUDIO_ENABLED=false',
          'COPILOT_AVATAR=0',
          'LLM_PROVIDER=openai',
          'LLM_API_KEY=',
          'TTS_PROVIDER=elevenlabs',
          'TTS_API_KEY=',
          'TTS_VOICE_ID=',
        ].join('\n') + '\n',
        'utf8',
      );
    }
    return dest;
  }
  if (!bundled) return dest;
  const user = parseEnv(fs.readFileSync(dest, 'utf8'));
  const pack = parseEnv(fs.readFileSync(bundled, 'utf8'));
  const merged = { ...pack };
  let changed = false;
  for (const [key, val] of Object.entries(pack)) {
    if (!String(user[key] || '').trim() && String(val || '').trim()) {
      merged[key] = val;
      changed = true;
    } else if (Object.prototype.hasOwnProperty.call(user, key)) {
      merged[key] = user[key];
    }
  }
  for (const [key, val] of Object.entries(user)) {
    if (!Object.prototype.hasOwnProperty.call(merged, key)) merged[key] = val;
  }
  if (changed) {
    writeEnvFromTemplate(dest, fs.readFileSync(bundled, 'utf8'), merged);
    console.log('[Raven] filled empty API settings from bundled defaults');
  }
  return dest;
}

function isRunning() {
  return Boolean(ravenProc && !ravenProc.killed);
}

function startRaven() {
  if (isRunning()) {
    console.log('[Raven] already running');
    return;
  }
  const root = ravenRoot();
  const sidecar = path.join(root, 'sidecar.js');
  const fallbackSidecar = path.join(root, 'scripts', 'raven-sidecar.js');
  const script = fs.existsSync(sidecar) ? sidecar : fallbackSidecar;
  if (!fs.existsSync(script)) {
    console.warn('[Raven] sidecar not found at', sidecar, 'or', fallbackSidecar);
    dialog.showErrorBox(
      'Raven AI not bundled',
      'This VirtualDeck build does not include Raven. Run scripts/stage-raven-runtime.ps1 then npm run build:win.',
    );
    return;
  }

  const envPath = ensureEnv();
  const bundledNode = path.join(root, 'node', 'node.exe');
  const nodeExe = fs.existsSync(bundledNode) ? bundledNode : 'node';
  const ffmpegDir = path.join(root, 'ffmpeg');
  const env = {
    ...process.env,
    RAVEN_ENV_FILE: envPath,
    RAVEN_VOICE_ONLY: '1',
    VTUBE_STUDIO_ENABLED: 'false',
    COPILOT_AVATAR: '0',
    VIRTUALDECK_USER_DATA_PATH: app.getPath('userData'),
    VIRTUALDECK_WS_URL: process.env.VIRTUALDECK_WS_URL || 'ws://localhost:8081',
    VIRTUALDECK_HTTP_URL: process.env.VIRTUALDECK_HTTP_URL || 'http://localhost:3000',
  };
  if (fs.existsSync(ffmpegDir)) {
    env.PATH = ffmpegDir + path.delimiter + (env.PATH || '');
    const ffmpeg = path.join(ffmpegDir, 'ffmpeg.exe');
    const ffplay = path.join(ffmpegDir, 'ffplay.exe');
    if (fs.existsSync(ffmpeg)) env.FFMPEG_PATH = ffmpeg;
    if (fs.existsSync(ffplay)) env.TTS_FFPLAY_PATH = ffplay;
  }
  env.VIRTUALDECK_WS_PORT = env.VIRTUALDECK_WS_PORT || '8081';
  env.VIRTUALDECK_WS_URL = env.VIRTUALDECK_WS_URL || 'ws://localhost:8081';
  env.VIRTUALDECK_HTTP_URL = env.VIRTUALDECK_HTTP_URL || 'http://localhost:3000';
  env.DIRECTOR_INITIAL_MODE = env.DIRECTOR_INITIAL_MODE || 'COPILOT';

  console.log('[Raven] starting', nodeExe, script);
  const logFile = path.join(app.getPath('userData'), 'raven.log');
  let logStream = null;
  try {
    logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n--- Raven start ${new Date().toISOString()} ---\n`);
  } catch (err) {
    console.warn('[Raven] could not open raven.log', err && err.message);
  }
  ravenProc = spawn(nodeExe, [script], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const onLog = (buf, isErr) => {
    const msg = String(buf).trim();
    if (!msg) return;
    if (isErr) console.warn('[Raven]', msg);
    else console.log('[Raven]', msg);
    try {
      if (logStream) logStream.write(msg + '\n');
    } catch {
      // ignore
    }
  };
  ravenProc.stdout.on('data', (buf) => onLog(buf, false));
  ravenProc.stderr.on('data', (buf) => onLog(buf, true));
  ravenProc.on('exit', (code) => {
    console.log('[Raven] exited', code);
    ravenProc = null;
  });
}

function stopRaven() {
  if (!ravenProc) return;
  const pid = ravenProc.pid;
  try {
    if (process.platform === 'win32' && pid) {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      ravenProc.kill();
    }
  } catch (err) {
    console.warn('[Raven] stop failed', err && err.message);
  }
  ravenProc = null;
}

function openEnvFile() {
  const dest = ensureEnv();
  shell.openPath(dest);
}

function maybeAutoStart() {
  if (!app.isPackaged) return;
  const prefs = loadPrefs();
  if (prefs.autoStart === false) return;
  setTimeout(() => startRaven(), 400);
}

function menuTemplateItems() {
  const prefs = loadPrefs();
  return [
    {
      label: 'Start Raven AI',
      click: () => startRaven(),
    },
    {
      label: 'Stop Raven AI',
      click: () => stopRaven(),
    },
    {
      type: 'checkbox',
      label: 'Start Raven with VirtualDeck',
      checked: prefs.autoStart !== false,
      click: (item) => {
        const next = loadPrefs();
        next.autoStart = !!item.checked;
        savePrefs(next);
      },
    },
    {
      label: 'Open Raven settings (raven.env)...',
      click: () => openEnvFile(),
    },
  ];
}

module.exports = {
  startRaven,
  stopRaven,
  isRunning,
  maybeAutoStart,
  menuTemplateItems,
  ensureEnv,
};
