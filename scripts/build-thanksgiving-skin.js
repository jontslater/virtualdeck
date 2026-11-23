#!/usr/bin/env node
/**
 * Builds skins/thanksgiving.json — harvest theme mirroring skins/HalloweenByTati/halloween.json structure.
 * Photo assets live in skins/thanksgiving-assets/ (see ATTRIBUTION.md).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'skins', 'thanksgiving-assets');
const OUT = path.join(ROOT, 'skins', 'thanksgiving.json');

const CREAM = '#F3E6D3';
const PANEL = '#FFF8EB';
const CHOCOLATE = '#3B2314';
const RUST = '#B7412E';
const ORANGE = '#D4622A';
const MUSTARD = '#D4A12A';
const BROWN = '#5C3A22';

const FILES = {
  statsBackdrop: 'thanksgiving-stats-backdrop-1536x280.png',
  banner: 'thanksgiving-banner-1280x520.png',
};

function pngDataUrl(fileName) {
  const buf = fs.readFileSync(path.join(ASSETS, fileName));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function svgDataUrl(svg) {
  const compact = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;base64,${Buffer.from(compact).toString('base64')}`;
}

function roundedFanFeather(deg, len, [c1, c2, c3]) {
  return `<g transform="rotate(${deg})">
    <ellipse cx="0" cy="-${len * 0.55}" rx="19" ry="${len * 0.52}" fill="${c1}"/>
    <ellipse cx="0" cy="-${len * 0.42}" rx="15" ry="${len * 0.1}" fill="${c2}"/>
    <ellipse cx="0" cy="-${len * 0.3}" rx="13" ry="${len * 0.09}" fill="${c3}"/>
    <ellipse cx="0" cy="-${len * 0.18}" rx="11" ry="${len * 0.08}" fill="${c2}" opacity="0.85"/>
  </g>`;
}

const turkeyFeathers = [-72, -48, -28, -8, 12, 32, 52]
  .map((deg, i) => {
    const palette = [
      [ORANGE, RUST, MUSTARD],
      [RUST, ORANGE, BROWN],
      [MUSTARD, ORANGE, RUST],
      [ORANGE, MUSTARD, RUST],
      [RUST, MUSTARD, ORANGE],
      [ORANGE, RUST, MUSTARD],
      [MUSTARD, RUST, ORANGE],
    ][i];
    return roundedFanFeather(deg, 78 + (i % 2) * 6, palette);
  })
  .join('');

const turkeyCorner = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="280" viewBox="0 0 320 280">
  <g transform="translate(160 248)">
    <g transform="translate(0 -50)">${turkeyFeathers}</g>
    <path fill="${CHOCOLATE}" d="M-52 8 C-58 -18 -22 -40 0 -44 C22 -40 58 -18 52 8 C34 30 0 34 C-34 30 -52 8 Z"/>
    <circle cx="0" cy="-54" r="28" fill="#F0B088"/>
    <circle cx="-11" cy="-60" r="7" fill="#FFF" stroke="${CHOCOLATE}" stroke-width="1.2"/>
    <circle cx="11" cy="-60" r="7" fill="#FFF" stroke="${CHOCOLATE}" stroke-width="1.2"/>
    <circle cx="-11" cy="-60" r="2.8" fill="${CHOCOLATE}"/>
    <circle cx="11" cy="-60" r="2.8" fill="${CHOCOLATE}"/>
    <polygon points="-6,-42 6,-42 0,-34" fill="${MUSTARD}"/>
    <ellipse cx="12" cy="-44" rx="7" ry="4.5" fill="${RUST}"/>
    <ellipse cx="0" cy="-36" rx="8" ry="6" fill="#E8A07A"/>
    <rect x="-34" y="-88" width="68" height="12" rx="4" fill="${CHOCOLATE}"/>
    <rect x="-22" y="-100" width="44" height="14" rx="3" fill="${CHOCOLATE}"/>
    <rect x="-9" y="-96" width="18" height="9" rx="2" fill="${MUSTARD}"/>
  </g>
</svg>`);

const sliderThumb = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <circle cx="11" cy="11" r="9" fill="${MUSTARD}" stroke="${CHOCOLATE}" stroke-width="1.5"/>
</svg>`);

const chatBgTile = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="${PANEL}"/>
</svg>`);

const scrollbarThumb = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="48" viewBox="0 0 10 48">
  <rect width="10" height="48" rx="5" fill="${MUSTARD}" stroke="${CHOCOLATE}" stroke-width="1"/>
</svg>`);

function mapleLeafPath(fill, stroke = CHOCOLATE) {
  return `<path fill="${fill}" stroke="${stroke}" stroke-width="1.15" opacity="0.95" d="M0-16 C5-11 12-2 14 7 C9 5 3 9 0 16 C-3 9 -9 5 -14 7 C-12 -2 -5 -11 0-16 Z"/>`;
}

const leafGarland = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="96" viewBox="0 0 1280 96">
  ${Array.from({ length: 19 }, (_, i) => {
    const x = 34 + i * 64;
    const y = 46 + (i % 3) * 4;
    const rot = -42 + (i % 6) * 14;
    const colors = [RUST, ORANGE, MUSTARD, BROWN];
    const fill = colors[i % colors.length];
    const scale = 1.05 + (i % 4) * 0.12;
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">${mapleLeafPath(fill)}</g>`;
  }).join('')}
  <g transform="translate(28 78) rotate(-28) scale(0.95)">${mapleLeafPath(RUST)}</g>
  <g transform="translate(1248 80) rotate(36) scale(0.92)">${mapleLeafPath(ORANGE)}</g>
</svg>`);

const img = {};
for (const [key, file] of Object.entries(FILES)) {
  img[key] = pngDataUrl(file);
}
img.turkeyCorner = turkeyCorner;
img.sliderThumb = sliderThumb;
img.chatBgTile = chatBgTile;
img.scrollbarThumb = scrollbarThumb;

const driftCss = [
  'body::after{',
  'content:"";position:fixed;right:212px;left:auto;bottom:112px;width:min(248px,26vw);height:min(220px,30vh);pointer-events:none;z-index:3;',
  `background:url(${img.turkeyCorner}) no-repeat center bottom/contain;`,
  'opacity:1;',
  '}',
  '.main-content::before{',
  'content:"";position:absolute;top:0;left:0;right:0;height:92px;pointer-events:none;z-index:2;',
  `background:url(${leafGarland}) top center/1280px 92px no-repeat;`,
  '}',
  '.sound-card,.drag-toggle-btn,.page-btn,.queue-widget-btn,#twitch-chat-container,input[type="range"],.master-volume-control,.toggle-chat-btn{position:relative;z-index:6;}',
].join('');

const skin = {
  name: 'Thanksgiving (Cartoon)',
  description:
    'Harvest Thanksgiving theme modeled on the Halloween custom skin layout: photo banner with leaf overlay, fall stats backdrop, solid sound buttons with visible hotkeys, script headings, and corner turkey mascot.',
  version: '1.3.1',
  author: 'VirtualDeck Team',
  variables: {
    '--bg-primary': CREAM,
    '--bg-secondary': PANEL,
    '--bg-tertiary': PANEL,
    '--bg-quaternary': MUSTARD,
    '--bg-quinary': RUST,
    '--text-primary': CHOCOLATE,
    '--text-secondary': BROWN,
    '--text-tertiary': RUST,
    '--text-quaternary': CHOCOLATE,
    '--text-quinary': MUSTARD,
    '--border-primary': CHOCOLATE,
    '--border-secondary': BROWN,
    '--border-tertiary': RUST,
    '--border-quaternary': MUSTARD,
    '--accent-primary': RUST,
    '--accent-secondary': ORANGE,
    '--accent-tertiary': MUSTARD,
    '--accent-quaternary': PANEL,
    '--hover-bg': '#E8D4B8',
    '--active-bg': '#DFC9A8',
    '--focus-bg': ORANGE,
    '--shadow-color': 'rgba(59, 35, 20, 0.18)',
    '--shadow-hover': 'rgba(183, 65, 46, 0.25)',
    '--success-color': BROWN,
    '--warning-color': MUSTARD,
    '--error-color': RUST,
    '--info-color': ORANGE,
    '--master-volume-track': '#C9A87C',
    '--master-volume-thumb': ORANGE,
  },
  css: [
    driftCss,
    `.app-menu-left{background:${CREAM} !important;border-bottom:2px solid ${CHOCOLATE} !important}`,
    `.menu-button{color:${CHOCOLATE} !important}`,
    `#twitch-chat-container{background:${PANEL} url(${img.chatBgTile}) repeat !important;border:3px solid ${CHOCOLATE} !important;border-radius:18px !important;box-shadow:0 4px 0 rgba(59,35,20,0.15) !important;overflow:hidden}`,
    `#twitch-chat-container .chat-header{background:${RUST} !important;min-height:48px;border:none !important;border-bottom:2px solid ${CHOCOLATE} !important}`,
    `#twitch-chat-container .chat-title{color:${PANEL} !important;font-family:"Segoe Script","Palatino Linotype",cursive !important;font-size:24px !important;font-weight:700 !important;text-shadow:0 1px 0 ${CHOCOLATE}}`,
    `#twitch-chat-container .toggle-chat-btn{background:${PANEL} !important;color:${CHOCOLATE} !important;border:2px solid ${CHOCOLATE} !important;border-radius:8px}`,
    `#twitch-chat-container .toggle-chat-btn .material-icons{color:${CHOCOLATE} !important;font-size:20px}`,
    `.status-indicator,.status-indicator.connected,.status-indicator.disconnected{background:${MUSTARD} !important;border:2px solid ${CHOCOLATE} !important}`,
    `#twitch-chat-messages > div{color:${CHOCOLATE} !important;background:transparent !important;border:none !important;margin:6px 0 !important;padding:2px 4px !important}`,
    `#twitch-chat-messages > div strong{color:${RUST} !important;font-weight:700 !important}`,
    `#twitch-chat-messages .activity-message,#twitch-chat-messages div.activity-message,.chat-messages .activity-message{color:${CHOCOLATE} !important;background:${PANEL} !important;border:2px solid ${RUST} !important;border-radius:10px !important;padding:6px 8px !important;font-weight:700 !important}`,
    `.chat-messages::-webkit-scrollbar{width:10px}`,
    `.chat-messages::-webkit-scrollbar-track{background:${CREAM};border-radius:6px}`,
    `.chat-messages::-webkit-scrollbar-thumb{background:url(${img.scrollbarThumb}) repeat-y center/100% auto;border-radius:6px}`,
    `.master-volume-label{color:${CHOCOLATE} !important}`,
    `#twitch-stats-container .stat-label,#twitch-stats-container .stat-value{color:${CHOCOLATE} !important}`,
  ].join(' '),
  components: {
    '.app-menu-logo': {
      'max-height': '46px !important',
      'max-width': '150px !important',
      width: 'auto !important',
      'object-fit': 'contain !important',
      'object-position': 'left center !important',
      background: `${CHOCOLATE} !important`,
      'border-radius': '10px !important',
      padding: '3px 8px !important',
      filter: 'none !important',
    },
    '#app-menu-left': {
      display: 'flex !important',
      'align-items': 'center !important',
      gap: '4px !important',
    },
    '.menu-button:hover': {
      background: `${MUSTARD} !important`,
      color: `${CHOCOLATE} !important`,
      'border-radius': '5px',
    },
    '.menu-button[aria-expanded="true"]': {
      background: `${MUSTARD} !important`,
      color: `${CHOCOLATE} !important`,
      'border-radius': '5px',
    },
    '.hotkey-info': {
      background: `${CREAM} !important`,
      color: `${CHOCOLATE} !important`,
    },
    '.hotkey-help': { color: `${CHOCOLATE} !important` },
    '.stat-item': {
      border: 'none !important',
      background: 'none !important',
    },
    '.stat-content': {
      background: `${PANEL} !important`,
      'border-radius': '14px !important',
      padding: '10px 12px 8px !important',
      border: `3px solid ${CHOCOLATE} !important`,
      'box-shadow': `0 3px 0 ${CHOCOLATE}, 0 8px 14px rgba(59,35,20,0.12) !important`,
      'min-width': '72px !important',
    },
    '.stat-label': {
      color: `${CHOCOLATE} !important`,
      'font-weight': '800 !important',
      'text-transform': 'uppercase',
      'letter-spacing': '0.05em',
    },
    '.stat-value': {
      color: `${CHOCOLATE} !important`,
      'font-weight': '800 !important',
    },
    '.stat-toggle-button': {
      background: `${ORANGE} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
      color: `${PANEL} !important`,
    },
    '#recent-activity-container, #recent-activity-container > div': {
      background: `${PANEL} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
      'border-radius': '10px !important',
    },
    '.recent-label': { color: `${RUST} !important` },
    '.recent-value': { color: `${CHOCOLATE} !important` },
    '.sound-controls': {
      background: `${PANEL} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
      'border-radius': '12px !important',
      overflow: 'visible !important',
      'padding-top': '10px !important',
      'padding-bottom': '10px !important',
      width: '100% !important',
      'max-width': '100% !important',
      'box-sizing': 'border-box !important',
    },
    '.master-volume-control': {
      overflow: 'visible !important',
      'align-items': 'center !important',
    },
    '#master-volume-input.master-volume-slider': {
      height: '8px !important',
      overflow: 'visible !important',
    },
    '.main-content': {
      position: 'relative !important',
      background: `linear-gradient(rgba(59,35,20,0.32), rgba(243,230,211,0.52)), url(${img.banner}) center/cover no-repeat !important`,
      'border-radius': '18px !important',
      border: `3px solid ${CHOCOLATE} !important`,
      'box-shadow': `0 4px 0 ${MUSTARD}, 0 10px 18px rgba(59,35,20,0.12) !important`,
      padding: '20px 16px 16px !important',
      'min-height': '340px !important',
      overflow: 'visible !important',
    },
    '#sound-grid': {
      'justify-content': 'flex-start !important',
      'justify-items': 'start !important',
      'align-content': 'start !important',
      'z-index': '3 !important',
      width: '100% !important',
      'max-width': '100% !important',
    },
    '.queue-control-widget': {
      position: 'fixed !important',
      background: `${PANEL} !important`,
      border: `3px solid ${CHOCOLATE} !important`,
      'border-radius': '14px !important',
      'box-shadow': `0 4px 0 ${MUSTARD}, 0 10px 18px rgba(59,35,20,0.14) !important`,
      overflow: 'visible !important',
      padding: '12px 12px 14px !important',
    },
    '.queue-widget-header': {
      overflow: 'visible !important',
      'min-height': '28px !important',
      'padding-top': '2px !important',
    },
    '.queue-widget-title': {
      color: `${RUST} !important`,
      'font-family': '"Segoe Script","Palatino Linotype",cursive !important',
    },
    '.queue-widget-status': {
      background: `${MUSTARD} !important`,
      color: `${CHOCOLATE} !important`,
    },
    '.queue-widget-btn': {
      background: `${ORANGE} !important`,
      color: `${PANEL} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
    },
    '.page-btn': {
      background: `${ORANGE} !important`,
      color: `${PANEL} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
    },
    '.pagination-indicator': { color: `${RUST} !important` },
    '.drag-toggle-btn': {
      border: `2px solid ${CHOCOLATE} !important`,
      background: `${MUSTARD} !important`,
      color: `${CHOCOLATE} !important`,
      'font-weight': '800 !important',
    },
    '.drag-toggle-btn.unlocked': {
      background: `${ORANGE} !important`,
      color: `${PANEL} !important`,
    },
    '.drag-status': {
      color: `${CHOCOLATE} !important`,
      'font-weight': '700 !important',
    },
    '.add-card': {
      background: `${MUSTARD} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
      color: `${CHOCOLATE} !important`,
    },
    '.sound-card': {
      background: 'var(--bg-secondary) !important',
      border: `2px solid ${CHOCOLATE} !important`,
      'border-radius': '12px !important',
      'box-shadow': `0 3px 0 ${CHOCOLATE} !important`,
      display: 'flex !important',
      'flex-direction': 'column !important',
      'align-items': 'center !important',
      'justify-content': 'center !important',
      padding: '8px 6px !important',
      'min-height': 'var(--card-size) !important',
      'box-sizing': 'border-box !important',
    },
    '.sound-card:hover': {
      background: 'var(--hover-bg) !important',
      filter: 'brightness(1.02)',
    },
    '.delete-x-button': {
      background: `${RUST} !important`,
      color: `${PANEL} !important`,
    },
    '.edit-button': {
      background: `${MUSTARD} !important`,
      color: `${CHOCOLATE} !important`,
    },
    '.sound-type': {
      color: `${CHOCOLATE} !important`,
    },
    '.sound-name': {
      color: `${CHOCOLATE} !important`,
      'font-weight': '700 !important',
      'text-align': 'center !important',
      background: 'transparent !important',
      border: 'none !important',
      'max-width': '100% !important',
      padding: '0 4px !important',
      'line-height': '1.25 !important',
    },
    '.sound-hotkey': {
      color: `${CHOCOLATE} !important`,
      background: `${MUSTARD} !important`,
      border: `1px solid ${CHOCOLATE} !important`,
      'font-size': '10px !important',
      'font-weight': '800 !important',
      padding: '3px 8px !important',
      'border-radius': '6px !important',
      display: 'inline-block !important',
      visibility: 'visible !important',
      opacity: '1 !important',
      'margin-top': '4px !important',
    },
    '#twitch-stats-container': {
      background: `linear-gradient(rgba(243,230,211,0.22), rgba(243,230,211,0.38)), url(${img.statsBackdrop}) center/cover no-repeat !important`,
      border: `2px solid ${CHOCOLATE} !important`,
      'border-radius': '16px !important',
      padding: '10px 12px 12px !important',
      width: '100% !important',
      'max-width': '100% !important',
      'box-sizing': 'border-box !important',
    },
    '.stats-grid': { width: '100% !important' },
    '.chat-messages': {
      background: `${PANEL} !important`,
      color: `${CHOCOLATE} !important`,
    },
    '.activity-message,.chat-messages .activity-message,#twitch-chat-messages .activity-message': {
      color: `${CHOCOLATE} !important`,
      background: `${CREAM} !important`,
      border: `2px solid ${RUST} !important`,
      'border-radius': '10px !important',
      padding: '6px 8px !important',
      'font-weight': '700 !important',
      display: 'block !important',
    },
    '.status-indicator.disconnected': {
      background: `${RUST} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
    },
    body: {
      background: `${CREAM} !important`,
      color: `${CHOCOLATE} !important`,
    },
    '.selection-option': {
      background: `${PANEL} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
    },
    '.modal-content': {
      background: `${PANEL} !important`,
      color: `${CHOCOLATE} !important`,
      border: `2px solid ${MUSTARD} !important`,
    },
    '.option-description': { color: `${BROWN} !important` },
    '.option-title': { color: `${RUST} !important` },
    '#volume-value': { color: `${RUST} !important` },
    '#volume-input[type=\'range\']': {
      '-webkit-appearance': 'none !important',
      appearance: 'none !important',
      background: 'var(--master-volume-track) !important',
      'border-radius': '5px !important',
    },
    '#master-volume-input[type=\'range\']': {
      '-webkit-appearance': 'none !important',
      appearance: 'none !important',
      background: 'var(--master-volume-track) !important',
      'border-radius': '5px !important',
    },
    'input[type=\'range\']::-webkit-slider-thumb': {
      appearance: 'none !important',
      width: '22px !important',
      height: '22px !important',
      background: `url(${img.sliderThumb}) no-repeat center / contain`,
      border: 'none !important',
      'box-shadow': '0 1px 2px rgba(59,35,20,0.25) !important',
    },
    'input[type=\'range\']::-moz-range-thumb': {
      appearance: 'none !important',
      width: '22px !important',
      height: '22px !important',
      background: `url(${img.sliderThumb}) no-repeat center / contain`,
      border: 'none !important',
    },
    '#master-volume-input[type=\'range\']::-webkit-slider-thumb': {
      width: '14px !important',
      height: '14px !important',
      'margin-top': '-3px !important',
      background: `${ORANGE} !important`,
      'background-image': 'none !important',
      'border-radius': '50% !important',
      border: `2px solid ${CHOCOLATE} !important`,
    },
    '#master-volume-input[type=\'range\']::-moz-range-thumb': {
      width: '14px !important',
      height: '14px !important',
      background: `${ORANGE} !important`,
      'background-image': 'none !important',
      'border-radius': '50% !important',
      border: `2px solid ${CHOCOLATE} !important`,
    },
  },
};

fs.writeFileSync(OUT, JSON.stringify(skin, null, 2));
console.log('Wrote', OUT);