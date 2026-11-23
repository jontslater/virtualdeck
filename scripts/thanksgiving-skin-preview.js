#!/usr/bin/env node
/** Renders a static dashboard mock with the Thanksgiving skin for PR screenshots. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const skin = JSON.parse(fs.readFileSync(path.join(ROOT, 'skins', 'thanksgiving.json'), 'utf8'));
const outDir = '/opt/cursor/artifacts';
const htmlPath = path.join(outDir, 'thanksgiving-dashboard-preview.html');
const pngPath = path.join(outDir, 'thanksgiving-dashboard-preview.png');
const statsHtmlPath = path.join(outDir, 'thanksgiving-stats-bar-closeup.html');
const statsPngPath = path.join(outDir, 'thanksgiving-stats-bar-closeup.png');

const varBlock = Object.entries(skin.variables)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n');

const componentCss = Object.entries(skin.components || {})
  .map(([sel, rules]) => `${sel}{${Object.entries(rules).map(([p, v]) => `${p}:${v}`).join(';')}}`)
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>VirtualDeck Thanksgiving Preview</title>
<style>
:root {
${varBlock}
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Roboto, Segoe UI, sans-serif;
  color: var(--text-primary);
  min-height: 900px;
  position: relative;
}
.menu-bar {
  display: flex; gap: 12px; padding: 10px 16px;
  background: rgba(44,24,16,.85); border-bottom: 3px solid var(--border-quaternary);
}
.menu-button { background: transparent; border: none; color: var(--text-primary); font-weight: 600; padding: 6px 10px; border-radius: 5px; }
.main { display: grid; grid-template-columns: 1fr 340px; gap: 16px; padding: 16px; min-height: 820px; }
.left { display: flex; flex-direction: column; gap: 12px; }
.stat-row { display: flex; gap: 12px; flex-wrap: wrap; }
.stat-item { flex: 1; min-width: 140px; min-height: 90px; padding: 28px 12px 12px; text-align: center; border-radius: 12px; }
.stat-content { display: inline-block; text-align: center; }
.stat-label { font-size: 12px; font-weight: 700; }
.stat-value { font-size: 22px; font-weight: 800; }
.sound-controls { padding: 12px; border-radius: 12px; }
.grid { display: flex; flex-wrap: wrap; gap: 10px; }
.sound-card { width: 106px; height: 122px; display: flex; align-items: center; justify-content: center; text-align: center; }
.sound-name { font-size: 13px; font-weight: 700; padding: 0 6px; }
#twitch-chat-container { border-radius: 16px; overflow: hidden; height: 360px; display: flex; flex-direction: column; }
.chat-header { height: 44px; display: flex; align-items: center; justify-content: center; }
.chat-title { font-weight: 800; }
.chat-messages { flex: 1; padding: 8px; overflow: auto; }
#twitch-chat-messages > div { margin: 8px 6px; padding: 8px 10px; border-radius: 14px; }
.master-volume { display:flex; align-items:center; gap:10px; padding: 8px 16px; }
.master-volume-label { font-weight: 700; }
input[type=range] { width: 200px; height: 8px; }
${skin.css}
${componentCss}
</style>
</head>
<body>
  <nav class="menu-bar">
    <button class="menu-button">File</button>
    <button class="menu-button">Edit</button>
    <button class="menu-button">View</button>
    <button class="menu-button">Tools</button>
    <span style="margin-left:auto;color:var(--text-tertiary)">Thanksgiving (Cartoon)</span>
  </nav>
  <div class="main">
    <div class="left">
      <div id="twitch-stats-container" class="stat-row stats-grid">
        <div class="stat-item"><div class="stat-content"><div class="stat-label">Viewers</div><div class="stat-value">128</div></div></div>
        <div class="stat-item"><div class="stat-content"><div class="stat-label">Followers</div><div class="stat-value">4.2K</div></div></div>
        <div class="stat-item"><div class="stat-content"><div class="stat-label">Subs</div><div class="stat-value">312</div></div></div>
        <div class="stat-item"><div class="stat-content"><div class="stat-label">Live Views</div><div class="stat-value">1.8K</div></div></div>
      </div>
      <div class="sound-controls">
        <div class="grid">
          <div class="sound-card"><div class="sound-name">Turkey Day</div></div>
          <div class="sound-card"><div class="sound-name">Gobble</div></div>
          <div class="sound-card"><div class="sound-name">Cheers</div></div>
          <div class="sound-card"><div class="sound-name">Pie Time</div></div>
        </div>
      </div>
    </div>
    <aside id="twitch-chat-container">
      <div class="chat-header"><span class="chat-title">Harvest Chat</span></div>
      <div class="chat-messages" id="twitch-chat-messages">
        <div><strong>AutumnFan:</strong> cozy stream vibes</div>
        <div><strong>PumpkinPete:</strong> happy thanksgiving!</div>
      </div>
    </aside>
  </div>
  <div class="master-volume">
    <span class="master-volume-label">Master Volume</span>
    <input id="master-volume-input" type="range" min="0" max="100" value="70"/>
  </div>
</body>
</html>`;

const statsCloseup = html
  .replace(/<nav[\s\S]*?<\/nav>\s*/, '')
  .replace(/<aside id="twitch-chat-container">[\s\S]*?<\/aside>/, '')
  .replace(
    /<div class="sound-controls">[\s\S]*?<\/div>\s*<\/div>\s*/,
    '',
  )
  .replace('<div class="master-volume">', '<div class="master-volume" style="display:none">')
  .replace('min-height: 900px', 'min-height: 220px')
  .replace('min-height: 820px', 'min-height: 180px')
  .replace('grid-template-columns: 1fr 340px', 'grid-template-columns: 1fr');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(statsHtmlPath, statsCloseup);

function capture(file, shot, size) {
  const userDataDir = path.join('/tmp', 'vd-thanksgiving-chrome-profile');
  try {
    execFileSync(
      'google-chrome',
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${userDataDir}`,
        `--window-size=${size}`,
        `--screenshot=${shot}`,
        `file://${file}`,
      ],
      { stdio: 'inherit' },
    );
    console.log('Wrote', shot);
  } catch (err) {
    console.warn('Screenshot capture skipped:', err.message);
  }
}

capture(htmlPath, pngPath, '1280,900');
capture(statsHtmlPath, statsPngPath, '1100,240');