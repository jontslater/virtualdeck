#!/usr/bin/env node
/**
 * Builds skins/christmas.json from PNG sources in skins/christmas-assets/.
 * Run after updating source artwork: node scripts/build-christmas-skin.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'skins', 'christmas-assets');
const OUT = path.join(ROOT, 'skins', 'christmas.json');

const FILES = {
  background: 'christmas-background-1536x1024.png',
  statItem: 'christmas-stat-item-520x146.png',
  soundCard: 'christmas-sound-card-106x122.png',
  sliderThumb: 'christmas-slider-thumb-50x21.png',
  chatHeader: 'christmas-chat-header-600x44.png',
  chatBgTile: 'christmas-chat-bg-tile-120x120.png',
  scrollbarThumb: 'christmas-scrollbar-thumb-10x60.png',
};

function pngDataUrl(fileName) {
  const buf = fs.readFileSync(path.join(ASSETS, fileName));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const img = {};
for (const [key, file] of Object.entries(FILES)) {
  img[key] = pngDataUrl(file);
}

const skin = {
  name: 'Christmas (Cartoon)',
  description:
    'Cartoon Christmas theme with snow, candy-cane accents, festive stat cards and sound buttons, plus styled Twitch chat.',
  version: '1.0.0',
  author: 'VirtualDeck Team',
  variables: {
    '--bg-primary': '#14183C',
    '--bg-secondary': '#E62832',
    '--bg-tertiary': '#1C2250',
    '--bg-quaternary': '#28AA50',
    '--bg-quinary': '#FFCD28',
    '--text-primary': '#FFFFFF',
    '--text-secondary': '#FFFFFF',
    '--text-tertiary': '#FFCD28',
    '--text-quaternary': '#FFFFFF',
    '--text-quinary': '#FFCD28',
    '--border-primary': '#14183C',
    '--border-secondary': '#28AA50',
    '--border-tertiary': '#E62832',
    '--border-quaternary': '#FFCD28',
    '--accent-primary': '#E62832',
    '--accent-secondary': '#28AA50',
    '--accent-tertiary': '#FFCD28',
    '--accent-quaternary': '#FFFFFF',
    '--hover-bg': '#1C2250',
    '--active-bg': '#14183C',
    '--focus-bg': '#28AA50',
    '--shadow-color': 'rgba(20, 24, 60, 0.45)',
    '--shadow-hover': 'rgba(230, 40, 50, 0.35)',
    '--success-color': '#28AA50',
    '--warning-color': '#FFCD28',
    '--error-color': '#E62832',
    '--info-color': '#FFFFFF',
    '--master-volume-track': '#5C3D2E',
    '--master-volume-thumb': '#E62832',
  },
  css: [
    `#twitch-chat-container{background:#14183C url(${img.chatBgTile}) repeat !important;border:4px solid #14183C !important;border-radius:16px !important;overflow:hidden}`,
    `#twitch-chat-container .chat-header{background:url(${img.chatHeader}) left top/cover no-repeat !important;min-height:44px;border:none !important}`,
    `#twitch-chat-container .chat-title{color:#fff !important;font-weight:800;text-shadow:0 2px 0 #14183C}`,
    `#twitch-chat-container .toggle-chat-btn{background:#fff !important;color:#14183C !important;border:3px solid #14183C !important;border-radius:8px}`,
    `.status-indicator.connected{background:#28AA50 !important;border:2px solid #14183C}`,
    `#twitch-chat-messages > div{background:rgba(255,255,255,.94) !important;color:#14183C !important;border:3px solid #14183C !important;border-radius:14px !important;margin:8px 6px !important;padding:8px 10px !important;font-family:inherit !important}`,
    `#twitch-chat-messages > div strong{color:#14183C !important;border-bottom:3px solid currentColor}`,
    `#twitch-chat-messages .activity-message{color:#14183C !important}`,
    `#twitch-chat-messages .badge-text{border-radius:6px !important}`,
    `.chat-messages::-webkit-scrollbar{width:12px}`,
    `.chat-messages::-webkit-scrollbar-track{background:#0E1028;border-radius:6px}`,
    `.chat-messages::-webkit-scrollbar-thumb{background:url(${img.scrollbarThumb}) repeat-y center/100% auto;border-radius:6px;border:1px solid #14183C}`,
    `.master-volume-label{color:#fff !important;text-shadow:0 1px 0 #14183C}`,
  ].join(' '),
  components: {
    '.app-menu-logo': { display: 'none' },
    '.menu-button:hover': {
      background: 'var(--bg-quaternary) !important',
      color: 'var(--text-primary) !important',
      'border-radius': '5px',
      transition: 'background-color 120ms ease, color 120ms ease',
    },
    '.menu-button[aria-expanded="true"]': {
      background: 'var(--bg-quaternary) !important',
      color: 'var(--text-primary) !important',
      'border-radius': '5px',
      transition: 'background-color 120ms ease, color 120ms ease',
    },
    '.hotkey-info': {
      background: 'var(--bg-primary) !important',
      border: 'none !important',
      color: 'var(--text-tertiary) !important',
    },
    '.hotkey-help': {
      color: 'var(--text-primary) !important',
    },
    '.stat-item': {
      border: 'none !important',
      background: `url(${img.statItem}) no-repeat top center / contain, var(--bg-quaternary) !important`,
      'background-repeat': 'no-repeat, no-repeat',
      'background-position': 'top center, center',
      'background-size': 'contain, cover',
    },
    '.stat-label': {
      color: 'var(--text-primary) !important',
      'text-shadow': '0 1px 0 #14183C',
    },
    '.stat-value': {
      color: 'var(--text-primary) !important',
      'text-shadow': '0 1px 0 #14183C',
    },
    '.stat-toggle-button': {
      background: 'var(--bg-secondary) !important',
      border: '2px solid #14183C !important',
      color: 'var(--text-primary) !important',
    },
    '#recent-activity-container, #recent-activity-container > div': {
      background: 'rgba(20, 24, 60, 0.75) !important',
    },
    '.recent-label': {
      color: 'var(--text-primary) !important',
    },
    '.recent-value': {
      color: 'var(--text-tertiary) !important',
    },
    '.sound-controls': {
      background: 'rgba(20, 24, 60, 0.6) !important',
      border: 'none !important',
    },
    '.drag-toggle-btn': {
      border: '2px solid var(--text-primary) !important',
      background: 'var(--bg-secondary) !important',
      'font-weight': 'bold !important',
      color: 'var(--text-primary) !important',
    },
    '.drag-status': {
      color: 'var(--text-primary) !important',
    },
    '.add-card': {
      background: 'var(--bg-quaternary) !important',
      border: '2px solid #14183C !important',
      color: 'var(--text-primary) !important',
    },
    '.sound-card': {
      background: `url(${img.soundCard}) no-repeat center / contain !important`,
      border: 'none !important',
    },
    '.sound-card:hover': {
      filter: 'brightness(1.08)',
      border: 'none !important',
    },
    '.delete-x-button': {
      background: 'var(--accent-primary) !important',
      color: 'var(--text-primary) !important',
    },
    '.edit-button': {
      background: 'var(--bg-quinary) !important',
      color: 'var(--bg-primary) !important',
    },
    '.sound-type': {
      color: 'var(--text-primary) !important',
    },
    '.sound-name': {
      color: 'var(--text-primary) !important',
      'text-shadow': '0 1px 0 #14183C',
    },
    '.sound-hotkey': {
      color: 'var(--bg-primary) !important',
      background: 'var(--bg-quinary) !important',
    },
    '#twitch-stats-container': {
      background: 'none !important',
      border: 'none !important',
    },
    '.chat-messages': {
      background: 'transparent !important',
      color: 'var(--text-primary) !important',
    },
    '.status-indicator.disconnected': {
      background: 'var(--accent-primary) !important',
      border: '2px solid #14183C !important',
    },
    body: {
      background: `url(${img.background}) center/cover no-repeat #14183C !important`,
    },
    '.selection-option': {
      background: 'var(--bg-tertiary) !important',
    },
    '.modal-content': {
      background: 'var(--bg-tertiary) !important',
      color: 'var(--text-primary) !important',
      border: '2px solid var(--border-quaternary) !important',
    },
    '.option-description': {
      color: 'var(--text-secondary) !important',
    },
    '.option-title': {
      color: 'var(--text-tertiary) !important',
    },
    '#volume-value': {
      color: 'var(--text-tertiary) !important',
    },
    '#volume-input[type=\'range\']': {
      '-webkit-appearance': 'none !important',
      appearance: 'none !important',
      background: 'var(--master-volume-track, var(--bg-tertiary)) !important',
      'border-radius': '5px !important',
      'accent-color': 'var(--master-volume-thumb, var(--text-quinary)) !important',
    },
    '#master-volume-input[type=\'range\']': {
      '-webkit-appearance': 'none !important',
      appearance: 'none !important',
      background: 'var(--master-volume-track, var(--bg-tertiary)) !important',
      'border-radius': '5px !important',
      'accent-color': 'var(--master-volume-thumb, var(--text-quinary)) !important',
    },
    'input[type=\'range\']::-webkit-slider-thumb': {
      appearance: 'none !important',
      width: '50px !important',
      height: '21px !important',
      background: `url(${img.sliderThumb}) no-repeat center / contain`,
      border: 'none !important',
    },
    'input[type=\'range\']::-moz-range-thumb': {
      appearance: 'none !important',
      width: '50px !important',
      height: '21px !important',
      background: `url(${img.sliderThumb}) no-repeat center / contain`,
      border: 'none !important',
    },
  },
};

fs.writeFileSync(OUT, JSON.stringify(skin, null, 2));
console.log('Wrote', OUT);
