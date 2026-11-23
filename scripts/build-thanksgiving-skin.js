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
  const compact = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;base64,${Buffer.from(compact).toString('base64')}`;
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
  <rect x="6" y="10" width="468" height="100" rx="18" fill="${PANEL}" stroke="${CHOCOLATE}" stroke-width="4"/>
  <rect x="6" y="10" width="468" height="22" rx="18" fill="${MUSTARD}" opacity="0.35"/>
  <circle cx="28" cy="21" r="5" fill="${RUST}"/>
  <circle cx="452" cy="21" r="5" fill="${RUST}"/>
</svg>`);

const soundCard = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="106" height="122" viewBox="0 0 106 122">
  <ellipse cx="53" cy="70" rx="42" ry="44" fill="${CHOCOLATE}"/>
  <ellipse cx="53" cy="68" rx="38" ry="40" fill="${ORANGE}"/>
  <ellipse cx="53" cy="70" rx="30" ry="34" fill="#E8864A"/>
  <path fill="none" stroke="${BROWN}" stroke-width="1.4" stroke-linecap="round" d="M53 34v68M34 48c14 10 14 32 0 42M72 48c-14 10-14 32 0 42"/>
  <rect x="44" y="5" width="18" height="15" rx="4" fill="${BROWN}" stroke="${CHOCOLATE}" stroke-width="1.5"/>
  <path fill="${MUSTARD}" d="M53 18c-9 0-16 4-16 9s7 9 16 9 16-4 16-9-7-9-16-9z"/>
</svg>`);

const sliderThumb = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <circle cx="11" cy="11" r="9" fill="${MUSTARD}" stroke="${CHOCOLATE}" stroke-width="1.5"/>
</svg>`);

const chatHeaderLeaf = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <path fill="${MUSTARD}" opacity="0.85" d="M10 1c4.5 6 5.5 10 5.5 13.5-3 1-5.5 1-8.5 0C7 11 7.5 7 10 1z"/>
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
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="400" viewBox="0 0 360 400">
  <g transform="translate(180 380)">
    <ellipse cx="0" cy="-28" rx="58" ry="40" fill="${BROWN}" stroke="${CHOCOLATE}" stroke-width="2"/>
    <g transform="translate(0 -98)">
      <path fill="${ORANGE}" stroke="${CHOCOLATE}" stroke-width="1.5" d="M-82 4c-16-62 2-94 40-104 6 22 4 52-6 78-8 16-22 24-34 26z"/>
      <path fill="${RUST}" stroke="${CHOCOLATE}" stroke-width="1.2" d="M-40 2c-10-66 12-98 44-108 4 24 2 54-10 80-8 14-22 22-34 28z"/>
      <path fill="${CHOCOLATE}" d="M0 0c-8-66 18-100 48-110 6 26 4 56-10 82-10 16-24 24-38 28z"/>
      <path fill="${ORANGE}" stroke="${CHOCOLATE}" stroke-width="1.2" d="M40 2c10-64 32-96 44-108-6 22-8 52 2 76 8 16 22 24 34 32z"/>
      <path fill="${RUST}" stroke="${CHOCOLATE}" stroke-width="1.5" d="M82 4c16-60 38-92 36-104-20 18-30 44-34 72-4 18-18 26-32 32z"/>
      <path fill="none" stroke="${MUSTARD}" stroke-width="2" d="M-55-40c12 18 12 36 0 54M-18-52c10 20 10 40 0 60M18-52c-10 20-10 40 0 60M55-40c-12 18-12 36 0 54"/>
    </g>
    <ellipse cx="0" cy="-124" rx="32" ry="30" fill="#F0B088" stroke="${CHOCOLATE}" stroke-width="1.5"/>
    <circle cx="-12" cy="-128" r="7" fill="#FFFFFF" stroke="${CHOCOLATE}" stroke-width="1.2"/>
    <circle cx="12" cy="-128" r="7" fill="#FFFFFF" stroke="${CHOCOLATE}" stroke-width="1.2"/>
    <circle cx="-12" cy="-128" r="3" fill="${CHOCOLATE}"/>
    <circle cx="12" cy="-128" r="3" fill="${CHOCOLATE}"/>
    <polygon points="-7,-112 7,-112 0,-102" fill="${MUSTARD}" stroke="${CHOCOLATE}" stroke-width="0.8"/>
    <ellipse cx="16" cy="-112" rx="7" ry="5" fill="${RUST}"/>
    <rect x="-40" y="-158" width="80" height="14" rx="4" fill="${CHOCOLATE}"/>
    <rect x="-26" y="-172" width="52" height="16" rx="4" fill="${CHOCOLATE}"/>
    <rect x="-10" y="-168" width="20" height="10" rx="2" fill="${MUSTARD}"/>
  </g>
</svg>`);

const img = {
  background,
  statItem,
  soundCard,
  sliderThumb,
  chatHeaderLeaf,
  chatBgTile,
  scrollbarThumb,
  fallLeaf,
  turkeyCorner,
};

const driftCss = [
  '@keyframes vd-thanksgiving-drift{',
  '0%{background-position:6% 4%,92% 8%,4% 88%,96% 82%,50% 96%}',
  '100%{background-position:10% 8%,88% 12%,8% 92%,92% 86%,48% 100%}',
  '}',
  'body::before{',
  'content:"";position:fixed;inset:0;pointer-events:none;z-index:2;opacity:0.58;',
  `background:url(${img.fallLeaf}) no-repeat,url(${img.fallLeaf}) no-repeat,url(${img.fallLeaf}) no-repeat,url(${img.fallLeaf}) no-repeat,url(${img.fallLeaf}) no-repeat;`,
  'background-repeat:no-repeat;background-size:36px 36px,30px 30px,28px 28px,32px 32px,26px 26px;',
  'animation:vd-thanksgiving-drift 32s ease-in-out infinite alternate;',
  '}',
  'body::after{',
  'content:"";position:fixed;right:230px;left:auto;bottom:52px;width:min(360px,36vw);height:min(400px,44vh);pointer-events:none;z-index:4;',
  `background:url(${img.turkeyCorner}) no-repeat center bottom/contain;`,
  'opacity:1;',
  '}',
  '.sound-card,.drag-toggle-btn,.page-btn,.queue-widget-btn,#twitch-chat-container,input[type="range"],.master-volume-control,.toggle-chat-btn{position:relative;z-index:6;}',
].join('');

const skin = {
  name: 'Thanksgiving (Cartoon)',
  description:
    'Flat cartoon harvest theme: soft cream backdrop, rust and mustard accents, pumpkin buttons, corner turkey mascot, and WCAG-friendly dark text.',
  version: '1.2.0',
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
    `#twitch-chat-container .chat-title-section::before{content:"";display:inline-block;width:18px;height:18px;margin-right:8px;vertical-align:middle;background:url(${img.chatHeaderLeaf}) center/contain no-repeat}`,
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
      filter: 'drop-shadow(0 1px 0 rgba(59,35,20,0.2))',
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
      background: `url(${img.statItem}) no-repeat top center / contain, ${PANEL} !important`,
      'background-repeat': 'no-repeat, no-repeat',
      'background-position': 'top center, center',
      'background-size': 'contain, cover',
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
      background: `url(${img.soundCard}) no-repeat center bottom / contain !important`,
      'background-color': 'transparent !important',
      border: 'none !important',
      overflow: 'hidden !important',
      'min-height': 'var(--card-size) !important',
      'box-shadow': `0 3px 0 ${CHOCOLATE} !important`,
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