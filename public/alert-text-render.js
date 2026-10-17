/*
 * VirtualDeck shared alert/overlay text renderer.
 *
 * Single source of truth for how a text slot looks on the 1920x1080 overlay
 * canvas. Used by:
 *   - overlays/baseOverlay/index.html (inlined by main.js generateOverlayHTML)
 *   - the alert editor preview in public/script.js (loaded via <script>)
 *   - unit tests (require())
 *
 * All sizes and positions are in CANVAS pixels (1920x1080). The overlay and the
 * preview each render a 1920x1080 "stage" and scale it with a CSS transform, so
 * the text takes up the same fraction of the canvas in both.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDAlertText = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var CANVAS_WIDTH = 1920;
  var CANVAS_HEIGHT = 1080;
  var STYLE_VERSION = 2;
  var MIN_FONT_PX = 8;
  var MAX_FONT_PX = 400;
  var EDITOR_MIN_FONT_PX = 12;
  var EDITOR_MAX_FONT_PX = 300;
  var KEYFRAME_PREFIX = 'vdat-';

  var POSITIONS = ['topLeft', 'topCenter', 'topRight', 'midLeft', 'center', 'midRight', 'bottomLeft', 'bottomCenter', 'bottomRight'];

  // Overlay defaults (used when a slot style omits a field).
  var SLOT_DEFAULTS = {
    fontFamily: 'Arial, sans-serif',
    fontSize: '64px',
    color: 'white',
    fontWeight: 'bold',
    textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
    webkitTextStroke: ''
  };

  // Alert editor defaults (match the form's initial values; used for saved alerts missing a field).
  var ALERT_DEFAULTS = {
    position: 'topCenter',
    fontFamily: 'Arial, sans-serif',
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
    textStroke: '1px #000'
  };

  // Keyframes (copied from the overlay, prefixed so they never collide with app CSS).
  var KEYFRAMES = {
    fadeIn: 'from { opacity: 0; } to { opacity: 1; }',
    slideInLeft: 'from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; }',
    slideInRight: 'from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; }',
    slideInUp: 'from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; }',
    slideInDown: 'from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; }',
    zoomIn: 'from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; }',
    bounceIn: '0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 70% { transform: scale(0.9); } 100% { transform: scale(1); }',
    pulse: '0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); }',
    shake: '0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); } 20%, 40%, 60%, 80% { transform: translateX(10px); }',
    rotateIn: 'from { transform: rotate(-200deg); opacity: 0; } to { transform: rotate(0deg); opacity: 1; }',
    flipInX: 'from { transform: perspective(400px) rotateX(90deg); opacity: 0; } to { transform: perspective(400px) rotateX(0deg); opacity: 1; }',
    flipInY: 'from { transform: perspective(400px) rotateY(90deg); opacity: 0; } to { transform: perspective(400px) rotateY(0deg); opacity: 1; }',
    wobble: '0% { transform: translateX(0%); } 15% { transform: translateX(-25%) rotate(-5deg); } 30% { transform: translateX(20%) rotate(3deg); } 45% { transform: translateX(-15%) rotate(-3deg); } 60% { transform: translateX(10%) rotate(2deg); } 75% { transform: translateX(-5%) rotate(-1deg); } 100% { transform: translateX(0%); }',
    rubberBand: '0% { transform: scale(1); } 30% { transform: scaleX(1.25) scaleY(0.75); } 40% { transform: scaleX(0.75) scaleY(1.25); } 50% { transform: scaleX(1.15) scaleY(0.85); } 65% { transform: scaleX(0.95) scaleY(1.05); } 75% { transform: scaleX(1.05) scaleY(0.95); } 100% { transform: scale(1); }',
    tada: '0% { transform: scale(1) rotate(0deg); } 10%, 20% { transform: scale(0.9) rotate(-3deg); } 30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); } 40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); } 100% { transform: scale(1) rotate(0deg); }'
  };

  var KEYFRAMES_CSS = Object.keys(KEYFRAMES).map(function (name) {
    return '@keyframes ' + KEYFRAME_PREFIX + name + ' { ' + KEYFRAMES[name] + ' }';
  }).join('\n');

  // Media (alert image/video) fills the stage, letterboxed - same as overlay.
  var MEDIA_FILL_CSS = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; ' +
    'filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.8)); border-radius: 8px; z-index: 1;';

  function round2(n) { return Math.round(n * 100) / 100; }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  /**
   * Convert any stored font size into canvas pixels.
   * Accepts numbers (px), "24", "24px", "2em"/"2rem" (16px base), "5vw"/"5vh"
   * (of the 1920x1080 canvas), "18pt", "150%" (of 16px). Invalid -> fallback.
   */
  function parseFontSizePx(value, fallbackPx) {
    var fb = typeof fallbackPx === 'number' ? fallbackPx : 64;
    var n = NaN;
    if (typeof value === 'number') {
      n = value;
    } else if (typeof value === 'string') {
      var m = value.trim().toLowerCase().match(/^(-?\d*\.?\d+)\s*(px|em|rem|vw|vh|vmin|vmax|pt|%)?$/);
      if (m) {
        var v = parseFloat(m[1]);
        switch (m[2] || 'px') {
          case 'px': n = v; break;
          case 'em': case 'rem': n = v * 16; break;
          case 'vw': n = v * CANVAS_WIDTH / 100; break;
          case 'vh': n = v * CANVAS_HEIGHT / 100; break;
          case 'vmin': n = v * Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 100; break;
          case 'vmax': n = v * Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) / 100; break;
          case 'pt': n = v * 4 / 3; break;
          case '%': n = v * 16 / 100; break;
        }
      }
    }
    if (!isFinite(n) || n <= 0) n = fb;
    return round2(clamp(n, MIN_FONT_PX, MAX_FONT_PX));
  }

  function normalizeFontSize(value, fallbackPx) {
    return parseFontSizePx(value, fallbackPx) + 'px';
  }

  /** Position of a named slot, in canvas px (identical to the old 10vh/10vw/50vh layout on a 1920x1080 source). */
  function positionStyles(position) {
    var top = round2(CANVAS_HEIGHT * 0.10) + 'px';      // 108px
    var mid = round2(CANVAS_HEIGHT * 0.50) + 'px';      // 540px
    var side = round2(CANVAS_WIDTH * 0.10) + 'px';      // 192px
    var full = 'left: 0px; right: 0px; width: ' + CANVAS_WIDTH + 'px;';
    switch (position) {
      case 'topCenter': return { css: 'top: ' + top + '; ' + full, transform: '' };
      case 'topLeft': return { css: 'top: ' + top + '; left: ' + side + '; width: auto;', transform: '' };
      case 'topRight': return { css: 'top: ' + top + '; right: ' + side + '; width: auto;', transform: '' };
      case 'midLeft': return { css: 'top: ' + mid + '; left: ' + side + '; width: auto;', transform: 'translateY(-50%)' };
      case 'midRight': return { css: 'top: ' + mid + '; right: ' + side + '; width: auto;', transform: 'translateY(-50%)' };
      case 'bottomCenter': return { css: 'bottom: ' + top + '; ' + full, transform: '' };
      case 'bottomLeft': return { css: 'bottom: ' + top + '; left: ' + side + '; width: auto;', transform: '' };
      case 'bottomRight': return { css: 'bottom: ' + top + '; right: ' + side + '; width: auto;', transform: '' };
      case 'center':
      default: return { css: 'top: ' + mid + '; ' + full, transform: 'translateY(-50%)' };
    }
  }

  function normalizeStroke(stroke) {
    if (stroke == null) return '';
    var s = String(stroke).trim();
    if (!s || s === 'none') return '';
    return s;
  }

  /** Normalize animation config from either payload ({name,...}), saved alert ({type,...}) or a bare name. */
  function normalizeAnimation(anim) {
    if (!anim) return null;
    if (typeof anim === 'string') anim = { name: anim };
    var name = anim.name || anim.type;
    if (!name || name === 'none') return null;
    return {
      name: String(name),
      duration: anim.duration || '1s',
      delay: anim.delay || '0s',
      iterationCount: String(anim.iterationCount || anim.iteration || '1'),
      timingFunction: anim.timingFunction || anim.easing || 'ease'
    };
  }

  function animationCss(anim) {
    var a = normalizeAnimation(anim);
    if (!a) return '';
    var name = Object.prototype.hasOwnProperty.call(KEYFRAMES, a.name) ? KEYFRAME_PREFIX + a.name : a.name;
    return [name, a.duration, a.timingFunction, a.delay, a.iterationCount, 'forwards'].join(' ');
  }

  /** Resolve every text style field for a slot. Returns a plain object (testable). */
  function resolveSlotStyle(style) {
    var s = style || {};
    var fontWeight = s.fontWeight != null && s.fontWeight !== '' ? String(s.fontWeight)
      : (s.bold === false ? 'normal' : SLOT_DEFAULTS.fontWeight);
    if (s.bold === true && (s.fontWeight == null || s.fontWeight === '')) fontWeight = 'bold';
    return {
      fontFamily: s.fontFamily || SLOT_DEFAULTS.fontFamily,
      fontSize: normalizeFontSize(s.fontSize, parseFontSizePx(SLOT_DEFAULTS.fontSize)),
      fontWeight: fontWeight,
      fontStyle: s.fontStyle || (s.italic === true ? 'italic' : 'normal'),
      color: s.color || SLOT_DEFAULTS.color,
      textShadow: s.textShadow || SLOT_DEFAULTS.textShadow,
      webkitTextStroke: normalizeStroke(s.webkitTextStroke != null ? s.webkitTextStroke : s.textStroke),
      zIndex: String(s.zIndex || '100')
    };
  }

  /** Full inline cssText for a text slot element on the 1920x1080 stage. */
  function buildTextSlotCss(position, style) {
    var r = resolveSlotStyle(style);
    var pos = positionStyles(position);
    return [
      'position: absolute;',
      'color: ' + r.color + ';',
      'font-family: ' + r.fontFamily + ';',
      'font-size: ' + r.fontSize + ';',
      'font-weight: ' + r.fontWeight + ';',
      'font-style: ' + r.fontStyle + ';',
      'line-height: normal;',
      'letter-spacing: normal;',
      'text-shadow: ' + r.textShadow + ';',
      (r.webkitTextStroke ? '-webkit-text-stroke: ' + r.webkitTextStroke + ';' : '-webkit-text-stroke: 0px transparent;'),
      'text-align: center;',
      'white-space: nowrap;',
      'z-index: ' + r.zIndex + ';',
      'display: flex;',
      'align-items: center;',
      'justify-content: center;',
      'flex-direction: row;',
      'pointer-events: none;',
      'margin: 0;',
      'padding: 0;',
      'filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.8));',
      pos.css,
      (pos.transform ? 'transform: ' + pos.transform + ';' : '')
    ].join(' ');
  }

  function ensureKeyframes(doc) {
    if (!doc || !doc.head || doc.getElementById('vd-alert-text-keyframes')) return;
    var el = doc.createElement('style');
    el.id = 'vd-alert-text-keyframes';
    el.textContent = KEYFRAMES_CSS;
    doc.head.appendChild(el);
  }

  /** Create the DOM element for a text slot (same element in overlay and preview). */
  function createTextSlotElement(doc, position, slotData) {
    ensureKeyframes(doc);
    var el = doc.createElement('div');
    el.className = 'text-element vd-alert-text';
    el.setAttribute('data-vd-slot', position || 'center');
    el.textContent = slotData && slotData.text != null ? String(slotData.text) : '';
    el.style.cssText = buildTextSlotCss(position, slotData && slotData.style);
    var anim = animationCss(slotData && slotData.animation);
    if (anim) {
      el.style.animation = anim;
      el.style.animationFillMode = 'both';
    }
    return el;
  }

  /** Scale factor that fits the 1920x1080 stage into a viewport (letterboxed). */
  function stageScale(viewWidth, viewHeight) {
    var w = Number(viewWidth) || 0;
    var h = Number(viewHeight) || 0;
    if (w <= 0 && h <= 0) return 1;
    if (h <= 0) return w / CANVAS_WIDTH;
    if (w <= 0) return h / CANVAS_HEIGHT;
    return Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT);
  }

  /** Apply the stage transform to a 1920x1080 element so it fits its viewport. */
  function fitStage(stageEl, viewWidth, viewHeight) {
    if (!stageEl) return 1;
    var s = stageScale(viewWidth, viewHeight);
    stageEl.style.width = CANVAS_WIDTH + 'px';
    stageEl.style.height = CANVAS_HEIGHT + 'px';
    stageEl.style.transformOrigin = '0 0';
    stageEl.style.transform = s === 1 ? 'none' : 'scale(' + s + ')';
    return s;
  }

  /** Migrate a saved alert's textStyling to v2 (canvas px). Never mutates the input. */
  function migrateAlertTextStyling(textStyling) {
    var t = Object.assign({}, ALERT_DEFAULTS, textStyling || {});
    var fallback = parseFontSizePx(ALERT_DEFAULTS.fontSize);
    t.fontSize = normalizeFontSize(t.fontSize, fallback);
    if (POSITIONS.indexOf(t.position) === -1) t.position = ALERT_DEFAULTS.position;
    t.styleVersion = STYLE_VERSION;
    return t;
  }

  /** Build the overlay text slot for an alert. Used by the live payload AND the editor preview. */
  function alertToSlot(alertData, text) {
    var a = alertData || {};
    var t = migrateAlertTextStyling(a.textStyling);
    return {
      position: t.position,
      slot: {
        text: text,
        style: {
          fontFamily: t.fontFamily,
          fontSize: t.fontSize,
          color: t.color,
          fontWeight: String(t.fontWeight),
          textShadow: t.textShadow,
          webkitTextStroke: normalizeStroke(t.textStroke),
          textAlign: 'center',
          zIndex: '1',
          styleVersion: STYLE_VERSION
        },
        animation: normalizeAnimation(a.animation)
      }
    };
  }

  /** Clamp a canvas-px size into the editor slider range. */
  function editorSliderValue(fontSize) {
    return Math.round(clamp(parseFontSizePx(fontSize, parseFontSizePx(ALERT_DEFAULTS.fontSize)), EDITOR_MIN_FONT_PX, EDITOR_MAX_FONT_PX));
  }

  return {
    CANVAS_WIDTH: CANVAS_WIDTH,
    CANVAS_HEIGHT: CANVAS_HEIGHT,
    STYLE_VERSION: STYLE_VERSION,
    MIN_FONT_PX: MIN_FONT_PX,
    MAX_FONT_PX: MAX_FONT_PX,
    EDITOR_MIN_FONT_PX: EDITOR_MIN_FONT_PX,
    EDITOR_MAX_FONT_PX: EDITOR_MAX_FONT_PX,
    POSITIONS: POSITIONS,
    SLOT_DEFAULTS: SLOT_DEFAULTS,
    ALERT_DEFAULTS: ALERT_DEFAULTS,
    KEYFRAMES_CSS: KEYFRAMES_CSS,
    MEDIA_FILL_CSS: MEDIA_FILL_CSS,
    parseFontSizePx: parseFontSizePx,
    normalizeFontSize: normalizeFontSize,
    positionStyles: positionStyles,
    normalizeAnimation: normalizeAnimation,
    animationCss: animationCss,
    resolveSlotStyle: resolveSlotStyle,
    buildTextSlotCss: buildTextSlotCss,
    ensureKeyframes: ensureKeyframes,
    createTextSlotElement: createTextSlotElement,
    stageScale: stageScale,
    fitStage: fitStage,
    migrateAlertTextStyling: migrateAlertTextStyling,
    alertToSlot: alertToSlot,
    editorSliderValue: editorSliderValue
  };
});
