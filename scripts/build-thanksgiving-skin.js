#!/usr/bin/env node
/**
 * Builds skins/thanksgiving.json — flat cartoon harvest style (original SVG/CSS only).
 * Style inspired by warm cream / rust / mustard palettes; no traced third-party art.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'skins', 'thanksgiving.json');

const CREAM = '#F3E6D3';
const PANEL = '#FFF8EB';
const CHOCOLATE = '#3B2314';
const RUST = '#B7412E';
const ORANGE = '#D4622A';
const MUSTARD = '#D4A12A';
const BROWN = '#5C3A22';

function svgDataUrl(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

function roundedLeaf(cx, cy, fill, rot = 0) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path fill="${fill}" d="M0 -10c8 4 12 12 12 20-6 2-12 2-18 0 0-8 4-16 6-20z"/></g>`;
}

const background = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${CREAM}"/>
  ${roundedLeaf(120, 80, RUST, -20)}
  ${roundedLeaf(680, 120, MUSTARD, 15)}
  ${roundedLeaf(200, 480, ORANGE, 30)}
  ${roundedLeaf(620, 420, RUST, -35)}
  ${roundedLeaf(400, 200, MUSTARD, 10)}
</svg>`);

const statItem = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120">
  <rect x="4" y="4" width="472" height="112" rx="20" fill="${PANEL}" stroke="${CHOCOLATE}" stroke-width="3"/>
  <rect x="4" y="4" width="472" height="28" rx="20" fill="${MUSTARD}"/>
  <rect x="4" y="20" width="472" height="12" fill="${MUSTARD}"/>
  <circle cx="36" cy="20" r="6" fill="${RUST}"/>
  <circle cx="444" cy="20" r="6" fill="${RUST}"/>
</svg>`);

const soundCard = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="106" height="118" viewBox="0 0 106 118">
  <rect x="10" y="18" width="86" height="88" rx="22" fill="${CHOCOLATE}"/>
  <rect x="14" y="22" width="78" height="80" rx="20" fill="${ORANGE}"/>
  <rect x="20" y="32" width="66" height="62" rx="16" fill="#E07A3C"/>
  <rect x="44" y="6" width="18" height="16" rx="4" fill="${BROWN}"/>
</svg>`);

const sliderThumb = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <circle cx="11" cy="11" r="9" fill="${MUSTARD}" stroke="${CHOCOLATE}" stroke-width="1.5"/>
</svg>`);

const chatHeader = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="48" viewBox="0 0 600 48">
  <rect width="600" height="48" rx="14" fill="${RUST}"/>
  <rect x="12" y="10" width="120" height="8" rx="4" fill="${MUSTARD}" opacity="0.9"/>
</svg>`);

const chatBgTile = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="${PANEL}"/>
  ${roundedLeaf(24, 24, ORANGE, -15)}
  ${roundedLeaf(72, 60, RUST, 25)}
  ${roundedLeaf(48, 80, MUSTARD, -40)}
</svg>`);

const scrollbarThumb = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="48" viewBox="0 0 10 48">
  <rect width="10" height="48" rx="5" fill="${MUSTARD}" stroke="${CHOCOLATE}" stroke-width="1"/>
</svg>`);

const fallLeaf = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path fill="${RUST}" d="M16 2c7 9 9 16 9 22-5 2-9 2-14 0 0-6 2-13 5-22z"/>
</svg>`);

const turkeyCorner = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="340" viewBox="0 0 300 340">
  <g transform="translate(150 300)">
    <ellipse cx="0" cy="-30" rx="52" ry="36" fill="${BROWN}"/>
    <g transform="translate(0 -95)">
      <path fill="${ORANGE}" d="M-70 0c-18-55 0-85 35-95 8 20 8 45 0 70z"/>
      <path fill="${RUST}" d="M-35 0c-12-58 8-88 38-98 6 22 6 48-2 72z"/>
      <path fill="${CHOCOLATE}" d="M0 0c-10-60 15-92 42-102 4 24 2 50-8 74z"/>
      <path fill="${ORANGE}" d="M35 0c12-55 32-85 38-95-8 20-10 45-2 68z"/>
      <path fill="${RUST}" d="M70 0c18-52 38-82 35-95-18 18-28 42-32 68z"/>
    </g>
    <ellipse cx="0" cy="-118" rx="28" ry="26" fill="#F0B088"/>
    <circle cx="-10" cy="-122" r="6" fill="#FFFFFF" stroke="${CHOCOLATE}" stroke-width="1"/>
    <circle cx="10" cy="-122" r="6" fill="#FFFFFF" stroke="${CHOCOLATE}" stroke-width="1"/>
    <circle cx="-10" cy="-122" r="2.5" fill="${CHOCOLATE}"/>
    <circle cx="10" cy="-122" r="2.5" fill="${CHOCOLATE}"/>
    <polygon points="-6,-108 6,-108 0,-100" fill="${MUSTARD}"/>
    <ellipse cx="14" cy="-108" rx="6" ry="4" fill="${RUST}"/>
    <rect x="-36" y="-150" width="72" height="12" rx="4" fill="${CHOCOLATE}"/>
    <rect x="-22" y="-162" width="44" height="14" rx="3" fill="${CHOCOLATE}"/>
    <rect x="-8" y="-158" width="16" height="8" fill="${MUSTARD}"/>
  </g>
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
  turkeyCorner,
};

const driftCss = [
  '@keyframes vd-thanksgiving-drift{',
  '0%{background-position:8% -6%,70% -10%,40% -8%}',
  '100%{background-position:12% 105%,74% 108%,44% 106%}',
  '}',
  'body::before{',
  'content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.18;',
  `background-image:url(${img.fallLeaf}),url(${img.fallLeaf}),url(${img.fallLeaf});`,
  'background-repeat:no-repeat;background-size:28px 28px,24px 24px,22px 22px;',
  'animation:vd-thanksgiving-drift 26s linear infinite;',
  '}',
  'body::after{',
  'content:"";position:fixed;left:-48px;bottom:-24px;width:260px;height:300px;pointer-events:none;z-index:1;',
  `background:url(${img.turkeyCorner}) no-repeat left bottom/contain;`,
  'opacity:0.94;',
  '}',
  '.container,.app-menu-left,.overlay-container,.app-title-bar{position:relative;z-index:2;}',
].join('');

const skin = {
  name: 'Thanksgiving (Cartoon)',
  description:
    'Flat cartoon harvest theme: soft cream backdrop, rust and mustard accents, pumpkin buttons, corner turkey mascot, and WCAG-friendly dark text.',
  version: '1.1.0',
  author: 'VirtualDeck Team',
  variables: {
    '--bg-primary': CREAM,
    '--bg-secondary': ORANGE,
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
    `#twitch-chat-container{background:${PANEL} url(${img.chatBgTile}) repeat !important;border:3px solid ${CHOCOLATE} !important;border-radius:18px !important;overflow:hidden}`,
    `#twitch-chat-container .chat-header{background:${RUST} url(${img.chatHeader}) left top/cover no-repeat !important;min-height:48px;border:none !important}`,
    `#twitch-chat-container .chat-title{color:${MUSTARD} !important;font-family:"Segoe Script","Palatino Linotype",cursive !important;font-size:22px !important;font-weight:700 !important;text-shadow:0 1px 0 ${CHOCOLATE}`,
    `#twitch-chat-container .toggle-chat-btn{background:${PANEL} !important;color:${CHOCOLATE} !important;border:2px solid ${CHOCOLATE} !important;border-radius:8px}`,
    `#twitch-chat-container .toggle-chat-btn .material-icons{color:${CHOCOLATE} !important;font-size:20px}`,
    `.status-indicator.connected{background:${MUSTARD} !important;border:2px solid ${CHOCOLATE}`,
    `#twitch-chat-messages > div{background:${PANEL} !important;color:${CHOCOLATE} !important;border:2px solid ${CHOCOLATE} !important;border-radius:14px !important;margin:8px 6px !important;padding:8px 10px !important}`,
    `#twitch-chat-messages > div strong{color:${RUST} !important;border-bottom:2px solid ${RUST}`,
    `#twitch-chat-messages .activity-message{color:${BROWN} !important}`,
    `.chat-messages::-webkit-scrollbar{width:10px}`,
    `.chat-messages::-webkit-scrollbar-track{background:${CREAM};border-radius:6px}`,
    `.chat-messages::-webkit-scrollbar-thumb{background:url(${img.scrollbarThumb}) repeat-y center/100% auto;border-radius:6px}`,
    `.master-volume-label{color:${CHOCOLATE} !important}`,
    `#twitch-stats-container .stat-label,#twitch-stats-container .stat-value{color:${CHOCOLATE} !important}`,
  ].join(' '),
  components: {
    '.app-menu-logo': { display: 'none' },
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
      background: `url(${img.statItem}) no-repeat top center / contain, ${PANEL} !important`,
      'background-repeat': 'no-repeat, no-repeat',
      'background-position': 'top center, center',
      'background-size': 'contain, cover',
    },
    '.stat-content': {
      background: `${PANEL} !important`,
      'border-radius': '12px !important',
      padding: '10px 12px 8px !important',
      border: `2px solid ${CHOCOLATE} !important`,
      'box-shadow': '0 2px 0 rgba(59,35,20,0.12) !important',
      'min-width': '72px !important',
    },
    '.stat-label': {
      color: `${RUST} !important`,
      'font-weight': '700 !important',
      'text-transform': 'uppercase',
      'letter-spacing': '0.04em',
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
    },
    '.master-volume-control': {
      overflow: 'visible !important',
      'align-items': 'center !important',
    },
    '#master-volume-input.master-volume-slider': {
      height: '8px !important',
      overflow: 'visible !important',
    },
    '.queue-control-widget': {
      background: `${PANEL} !important`,
      border: `2px solid ${MUSTARD} !important`,
      'border-radius': '12px !important',
    },
    '.queue-widget-title': {
      color: `${RUST} !important`,
      'font-family': '"Segoe Script","Palatino Linotype",cursive !important',
    },
    '.queue-widget-status': { color: `${CHOCOLATE} !important` },
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
      background: `${ORANGE} !important`,
      color: `${PANEL} !important`,
      'font-weight': 'bold !important',
    },
    '.drag-status': { color: `${CHOCOLATE} !important` },
    '.add-card': {
      background: `${MUSTARD} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
      color: `${CHOCOLATE} !important`,
    },
    '.sound-card': {
      background: `url(${img.soundCard}) no-repeat center / contain !important`,
      border: 'none !important',
      overflow: 'hidden !important',
    },
    '.sound-card:hover': { filter: 'brightness(1.04)', border: 'none !important' },
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
      background: `${PANEL} !important`,
      'border-radius': '6px !important',
      padding: '2px 6px !important',
      border: `1px solid ${CHOCOLATE}`,
    },
    '.sound-name': {
      color: `${CHOCOLATE} !important`,
      background: `${PANEL} !important`,
      'border-radius': '8px !important',
      padding: '4px 6px !important',
      'max-width': '92px !important',
      display: 'inline-block !important',
      overflow: 'hidden !important',
      'text-overflow': 'ellipsis !important',
      'white-space': 'nowrap !important',
      border: `1px solid ${CHOCOLATE}`,
    },
    '.sound-hotkey': {
      color: `${CHOCOLATE} !important`,
      background: `${MUSTARD} !important`,
    },
    '#twitch-stats-container': { background: 'none !important', border: 'none !important' },
    '.chat-messages': { background: 'transparent !important', color: `${CHOCOLATE} !important` },
    '.status-indicator.disconnected': {
      background: `${RUST} !important`,
      border: `2px solid ${CHOCOLATE} !important`,
    },
    body: {
      background: `${CREAM} url(${img.background}) center/cover no-repeat !important`,
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