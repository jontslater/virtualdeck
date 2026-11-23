#!/usr/bin/env node
/**
 * Builds skins/thanksgiving.json from hand-authored SVG artwork (no AI imagery).
 * Run: node scripts/build-thanksgiving-skin.js
 *
 * Assets: original SVG/CSS by VirtualDeck — safe to ship in the app bundle.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'skins', 'thanksgiving.json');

function svgDataUrl(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

const background = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5C2E1A"/>
      <stop offset="45%" stop-color="#C45C26"/>
      <stop offset="100%" stop-color="#2C1810"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#F4D58D" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#2C1810" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1536" height="1024" fill="url(#sky)"/>
  <rect width="1536" height="1024" fill="url(#glow)"/>
  <g opacity="0.2" fill="#8B4513">
    <ellipse cx="200" cy="900" rx="280" ry="80"/>
    <ellipse cx="1300" cy="920" rx="320" ry="90"/>
  </g>
  <g opacity="0.55">
    <path fill="#D97706" d="M120 180c8-22 32-22 40 0l-20 56c-6 16-26 16-32 0z M136 160c0-12 10-18 18-10 8 8 2 18-10 18-8 0-8-8-8-8z"/>
    <path fill="#B22222" d="M400 120c10-18 28-14 34 6 6 20-12 34-30 26s-12-24-4-32z"/>
    <path fill="#F4D58D" d="M900 200c6-16 26-16 32 0l-14 40c-4 12-18 12-22 0z"/>
    <circle fill="#C45C26" cx="1250" cy="280" r="28"/>
    <rect fill="#5C3D2E" x="1244" y="250" width="12" height="18" rx="3"/>
  </g>
</svg>`);

const statItem = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="146" viewBox="0 0 520 146">
  <rect x="4" y="8" width="512" height="130" rx="22" fill="#F4D58D" stroke="#2C1810" stroke-width="6"/>
  <rect x="4" y="8" width="512" height="36" rx="22" fill="#C45C26"/>
  <rect x="4" y="30" width="512" height="14" fill="#C45C26"/>
  <circle cx="48" cy="28" r="10" fill="#D97706" stroke="#2C1810" stroke-width="3"/>
  <circle cx="472" cy="28" r="10" fill="#D97706" stroke="#2C1810" stroke-width="3"/>
  <path fill="#B22222" opacity="0.25" d="M260 50c-40 0-72 24-72 54h144c0-30-32-54-72-54z"/>
</svg>`);

const soundCard = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="106" height="122" viewBox="0 0 106 122">
  <rect x="6" y="10" width="94" height="102" rx="18" fill="#C45C26" stroke="#2C1810" stroke-width="5"/>
  <rect x="12" y="16" width="82" height="88" rx="14" fill="#E07A32"/>
  <ellipse cx="53" cy="108" rx="36" ry="8" fill="#2C1810" opacity="0.2"/>
  <path fill="#5C3D2E" d="M47 6h12v14h-12z"/>
  <path fill="#F4D58D" opacity="0.9" d="M22 32c0-8 6-14 14-14h34c8 0 14 6 14 14v8H22z"/>
  <path fill="#8B4513" d="M28 78l-8-6 6-10 10 4-8 12zm50 0l8-6-6-10-10 4 8 12z"/>
</svg>`);

const sliderThumb = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="50" height="21" viewBox="0 0 50 21">
  <path fill="#D97706" stroke="#2C1810" stroke-width="2" d="M8 3c6-4 14-4 20 0 8 6 14 14 14 14s-6 2-14 2H8c-8 0-14-2-14-2s6-8 14-14z"/>
  <path fill="#B22222" d="M25 3c-2 6-2 10 0 14 2-4 2-8 0-14z"/>
</svg>`);

const chatHeader = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="44" viewBox="0 0 600 44">
  <rect width="600" height="44" rx="10" fill="#8B4513"/>
  <rect y="6" width="600" height="32" fill="#C45C26"/>
  <text x="300" y="28" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" font-weight="800" fill="#FFF8E7">Harvest Chat</text>
  <g transform="translate(24 8)">
    <ellipse cx="14" cy="22" rx="12" ry="10" fill="#5C3D2E"/>
    <circle cx="14" cy="12" r="6" fill="#C45C26"/>
    <path fill="#B22222" d="M6 18c-4 2-6 6-4 10 2 4 8 4 12 0 4 4 10 4 12 0 2-4 0-8-4-10-2-2-6-2-8 0z"/>
  </g>
  <g transform="translate(540 10)">
    <circle cx="16" cy="18" r="12" fill="#D97706" stroke="#2C1810" stroke-width="2"/>
    <rect x="13" y="4" width="6" height="8" fill="#5C3D2E"/>
  </g>
</svg>`);

const chatBgTile = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#3D2314"/>
  <path fill="#C45C26" opacity="0.12" d="M30 20c4-10 14-10 18 0l-6 16c-2 6-10 6-12 0z"/>
  <path fill="#D97706" opacity="0.1" d="M80 70c4-10 14-10 18 0l-6 16c-2 6-10 6-12 0z"/>
  <path fill="#F4D58D" opacity="0.08" d="M20 85c6-14 22-14 28 0l-8 22c-3 8-14 8-17 0z"/>
</svg>`);

const scrollbarThumb = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="60" viewBox="0 0 10 60">
  <rect width="10" height="60" rx="5" fill="#D97706" stroke="#2C1810" stroke-width="1"/>
</svg>`);

const fallLeaf = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <path fill="#D97706" d="M14 2c6 8 8 14 8 20-4 2-8 2-12 0 0-6 2-12 4-20z"/>
  <path fill="#B22222" opacity="0.6" d="M14 6v16"/>
</svg>`);

const img = {
  background,
  statItem,
  soundCard,
  sliderThumb,
  chatHeader,
  chatBgTile,
  scrollbarThumb,
  fallLeaf,
};

const driftCss = [
  '@keyframes vd-thanksgiving-drift{',
  '0%{background-position:12% -8%,48% -12%,78% -6%,30% -10%}',
  '100%{background-position:18% 108%,52% 112%,82% 106%,36% 110%}',
  '}',
  'body::before{',
  'content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.28;',
  `background-image:url(${img.fallLeaf}),url(${img.fallLeaf}),url(${img.fallLeaf}),url(${img.fallLeaf});`,
  'background-repeat:no-repeat;background-size:26px 26px,22px 22px,24px 24px,20px 20px;',
  'animation:vd-thanksgiving-drift 22s linear infinite;',
  '}',
  '.container,.app-menu-left,.overlay-container{position:relative;z-index:2;}',
].join('');

const skin = {
  name: 'Thanksgiving (Cartoon)',
  description:
    'Cozy autumn Thanksgiving theme with warm harvest colors, drifting leaves, pumpkin sound buttons, turkey accents, and readable cream chat bubbles.',
  version: '1.0.0',
  author: 'VirtualDeck Team',
  variables: {
    '--bg-primary': '#2C1810',
    '--bg-secondary': '#C45C26',
    '--bg-tertiary': '#3D2314',
    '--bg-quaternary': '#8B4513',
    '--bg-quinary': '#F4D58D',
    '--text-primary': '#FFF8E7',
    '--text-secondary': '#FFF8E7',
    '--text-tertiary': '#F4D58D',
    '--text-quaternary': '#2C1810',
    '--text-quinary': '#D97706',
    '--border-primary': '#2C1810',
    '--border-secondary': '#8B4513',
    '--border-tertiary': '#B22222',
    '--border-quaternary': '#F4D58D',
    '--accent-primary': '#B22222',
    '--accent-secondary': '#D97706',
    '--accent-tertiary': '#F4D58D',
    '--accent-quaternary': '#FFF8E7',
    '--hover-bg': '#3D2314',
    '--active-bg': '#2C1810',
    '--focus-bg': '#C45C26',
    '--shadow-color': 'rgba(44, 24, 16, 0.5)',
    '--shadow-hover': 'rgba(196, 92, 38, 0.35)',
    '--success-color': '#8B4513',
    '--warning-color': '#D97706',
    '--error-color': '#B22222',
    '--info-color': '#F4D58D',
    '--master-volume-track': '#5C3D2E',
    '--master-volume-thumb': '#C45C26',
  },
  css: [
    driftCss,
    `#twitch-chat-container{background:#3D2314 url(${img.chatBgTile}) repeat !important;border:4px solid #2C1810 !important;border-radius:16px !important;overflow:hidden}`,
    `#twitch-chat-container .chat-header{background:url(${img.chatHeader}) left top/cover no-repeat !important;min-height:44px;border:none !important}`,
    `#twitch-chat-container .chat-title{color:#FFF8E7 !important;font-weight:800;text-shadow:0 2px 0 #2C1810}`,
    `#twitch-chat-container .toggle-chat-btn{background:#F4D58D !important;color:#2C1810 !important;border:3px solid #2C1810 !important;border-radius:8px}`,
    `#twitch-chat-container .toggle-chat-btn .material-icons{color:#2C1810 !important;font-size:20px}`,
    `.status-indicator.connected{background:#8B4513 !important;border:2px solid #2C1810}`,
    `#twitch-chat-messages > div{background:rgba(244,213,141,.96) !important;color:#2C1810 !important;border:3px solid #2C1810 !important;border-radius:14px !important;margin:8px 6px !important;padding:8px 10px !important;font-family:inherit !important}`,
    `#twitch-chat-messages > div strong{color:#2C1810 !important;border-bottom:3px solid currentColor}`,
    `#twitch-chat-messages .activity-message{color:#2C1810 !important}`,
    `#twitch-chat-messages .badge-text{border-radius:6px !important}`,
    `.chat-messages::-webkit-scrollbar{width:12px}`,
    `.chat-messages::-webkit-scrollbar-track{background:#2C1810;border-radius:6px}`,
    `.chat-messages::-webkit-scrollbar-thumb{background:url(${img.scrollbarThumb}) repeat-y center/100% auto;border-radius:6px;border:1px solid #2C1810}`,
    `.master-volume-label{color:#FFF8E7 !important;text-shadow:0 0 1px #2C1810,0 1px 2px #2C1810}`,
    `#twitch-stats-container .stat-label,#twitch-stats-container .stat-value{color:#2C1810 !important}`,
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
      color: '#FFF8E7 !important',
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
    '.stat-content': {
      background: 'rgba(244, 213, 141, 0.96) !important',
      'border-radius': '10px !important',
      padding: '8px 12px !important',
      border: '2px solid #2C1810 !important',
      'box-shadow': '0 2px 0 rgba(44, 24, 16, 0.25) !important',
      'min-width': '72px !important',
    },
    '.stat-label': {
      color: '#2C1810 !important',
      'font-weight': '700 !important',
      'text-shadow': 'none',
    },
    '.stat-value': {
      color: '#2C1810 !important',
      'font-weight': '800 !important',
      'text-shadow': 'none',
    },
    '.stat-toggle-button': {
      background: 'var(--bg-secondary) !important',
      border: '2px solid #2C1810 !important',
      color: 'var(--text-primary) !important',
    },
    '#recent-activity-container, #recent-activity-container > div': {
      background: 'rgba(44, 24, 16, 0.78) !important',
    },
    '.recent-label': {
      color: 'var(--text-primary) !important',
    },
    '.recent-value': {
      color: '#FFF8E7 !important',
    },
    '.sound-controls': {
      background: 'rgba(44, 24, 16, 0.62) !important',
      border: 'none !important',
    },
    '.queue-control-widget': {
      background: 'rgba(44, 24, 16, 0.72) !important',
      border: '2px solid #F4D58D !important',
      'border-radius': '10px !important',
    },
    '.queue-widget-title,.queue-widget-status': {
      color: '#FFF8E7 !important',
    },
    '.queue-widget-btn': {
      background: 'var(--bg-secondary) !important',
      color: '#FFF8E7 !important',
      border: '2px solid #2C1810 !important',
    },
    '.page-btn': {
      background: 'var(--bg-secondary) !important',
      color: '#FFF8E7 !important',
      border: '2px solid #2C1810 !important',
    },
    '.pagination-indicator': {
      color: '#F4D58D !important',
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
      border: '2px solid #2C1810 !important',
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
      color: '#2C1810 !important',
      background: 'rgba(244, 213, 141, 0.88) !important',
      'border-radius': '6px !important',
      padding: '2px 6px !important',
    },
    '.sound-name': {
      color: '#2C1810 !important',
      background: 'rgba(244, 213, 141, 0.92) !important',
      'border-radius': '8px !important',
      padding: '4px 6px !important',
      'text-shadow': 'none',
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
      border: '2px solid #2C1810 !important',
    },
    body: {
      background: `url(${img.background}) center/cover no-repeat #2C1810 !important`,
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