/* global window, document */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ws = null;
  let reconnectTimeout = null;
  let currentConfig = {};
  let state = { current: 0, goal: 64, percentage: 0, streak: 0, units: 'oz' };
  let animating = false;
  let rafId = null;
  let wavePhase = 0;
  let displayProgress = 0;
  let targetProgress = 0;
  let lastBroadcastJson = '';

  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  function connectWebSocket() {
    try {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'hydrationUpdate') updateHydration(data.data, data.data);
          if (data.type === 'hydrationPlaySound') playSound(data.data);
        } catch (err) {
          console.error('Hydration WS parse error', err);
        }
      };
      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };
    } catch (e) {
      reconnectTimeout = setTimeout(connectWebSocket, 3000);
    }
  }

  function playSound(data) {
    if (!data || !data.path) return;
    const vol = typeof data.volume === 'number' ? data.volume : 0.7;
    const src = data.path.startsWith('http') ? data.path : `${location.origin}/media/${encodeURIComponent(data.path)}`;
    const audio = new Audio(src);
    audio.volume = Math.min(1, Math.max(0, vol));
    audio.play().catch(() => {});
  }

  function parseHex(color) {
    if (!color || typeof color !== 'string') return null;
    let hex = color.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length >= 6) hex = hex.slice(0, 6);
    if (hex.length !== 6) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  function shadeColor(color, pct) {
    const p = parseHex(color);
    if (!p) return color;
    const clamp = (n) => Math.max(0, Math.min(255, n));
    const h = (n) => (n < 16 ? '0' : '') + n.toString(16);
    return `#${h(clamp(p.r + pct))}${h(clamp(p.g + pct))}${h(clamp(p.b + pct))}`;
  }

  function formatAmount(n, units) {
    return `${Math.round(n * 10) / 10} ${units}`;
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    animating = false;
  }

  function startLoop(drawFn) {
    if (prefersReducedMotion) {
      drawFn(true);
      return;
    }
    if (animating) return;
    animating = true;
    const tick = () => {
      const delta = targetProgress - displayProgress;
      if (Math.abs(delta) < 0.001) displayProgress = targetProgress;
      else displayProgress += delta * 0.15;
      const needsWave = !prefersReducedMotion && displayProgress > 0.01 && displayProgress < 0.995;
      drawFn(needsWave);
      if (needsWave || Math.abs(targetProgress - displayProgress) > 0.001) {
        rafId = requestAnimationFrame(tick);
      } else {
        stopLoop();
      }
    };
    rafId = requestAnimationFrame(tick);
  }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.width;
    const h = rect.height || canvas.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function applyLayout() {
    const container = document.getElementById('hydration-container');
    if (!container) return;
    container.style.left = `${currentConfig.positionX ?? 50}%`;
    container.style.top = `${currentConfig.positionY ?? 50}%`;
    const showPlate = currentConfig.showPlate !== false && currentConfig.displayStyle !== 'minimal';
    const plate = document.getElementById('hydration-plate');
    if (plate) {
      plate.classList.toggle('hidden', !showPlate);
      plate.style.background = currentConfig.plateColor || currentConfig.backgroundColor || 'rgba(12,16,24,0.85)';
      plate.style.borderRadius = `${currentConfig.borderRadius ?? 16}px`;
      if (currentConfig.borderWidth > 0) {
        plate.style.border = `${currentConfig.borderWidth}px solid ${currentConfig.borderColor || '#fff'}`;
      } else {
        plate.style.border = 'none';
      }
    }
    const size = currentConfig.gaugeSize || 200;
    document.querySelectorAll('[data-gauge-canvas]').forEach((c) => {
      const aspect = c.dataset.gaugeCanvas;
      if (aspect === 'circle') {
        c.style.width = `${size}px`;
        c.style.height = `${size}px`;
      } else if (aspect === 'vert') {
        c.style.width = `${size * 0.35}px`;
        c.style.height = `${size}px`;
      } else if (aspect === 'horiz') {
        c.style.width = `${size * 1.4}px`;
        c.style.height = `${size * 0.35}px`;
      }
    });
    const textEls = document.querySelectorAll('.hydration-text');
    const stroke = '0 0 4px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.75)';
    textEls.forEach((el) => {
      el.style.color = currentConfig.textColor || '#ffffff';
      el.style.textShadow = stroke;
    });
    const chips = document.querySelectorAll('.hydration-chip');
    chips.forEach((chip) => {
      chip.style.color = currentConfig.textColor || '#fff';
      chip.style.borderColor = currentConfig.accentColor || currentConfig.fillColor || '#4fc3f7';
      chip.style.background = 'rgba(0,0,0,0.45)';
    });
    showGauge(currentConfig.gaugeStyle || 'circular');
  }

  function showGauge(style) {
    document.querySelectorAll('[data-gauge]').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.gauge !== style);
    });
  }

  function triggerEffects(data) {
    if (prefersReducedMotion || currentConfig.enableEffects === false) return;
    const layer = document.getElementById('effects-layer');
    if (!layer) return;
    if (data.celebration && currentConfig.goalConfetti !== false) {
      for (let i = 0; i < 24; i++) {
        const p = document.createElement('span');
        p.className = 'confetti-piece';
        p.style.left = `${50 + (Math.random() - 0.5) * 40}%`;
        p.style.background = i % 2 ? currentConfig.accentColor : currentConfig.fillColor;
        p.style.animationDelay = `${Math.random() * 0.4}s`;
        layer.appendChild(p);
        setTimeout(() => p.remove(), 2200);
      }
    } else if (data.leveledUp) {
      layer.classList.add('flash');
      setTimeout(() => layer.classList.remove('flash'), 450);
    }
  }

  function updateText() {
    const u = state.units || 'oz';
    const main = document.getElementById('hydration-amount-main');
    const sub = document.getElementById('hydration-amount-goal');
    const pct = document.getElementById('hydration-pct-chip');
    const streak = document.getElementById('hydration-streak-chip');
    if (main) main.textContent = formatAmount(state.current, u);
    if (sub) sub.textContent = `of ${formatAmount(state.goal, u)}`;
    const p = state.goal > 0 ? Math.min(999, (state.current / state.goal) * 100) : 0;
    if (pct) pct.textContent = `${Math.round(p)}%`;
    if (streak) {
      streak.textContent = state.streak > 0 ? `🔥 ${state.streak}` : '🔥 0';
      streak.classList.toggle('hidden', !state.streak && currentConfig.dailyStreak === 0);
    }
    const minimalPct = document.getElementById('minimal-pct');
    if (minimalPct) minimalPct.textContent = `${Math.round(p)}%`;
    const statsBlock = document.getElementById('hydration-stats-block');
    if (statsBlock) {
      statsBlock.classList.toggle('hidden', currentConfig.gaugeStyle === 'minimal');
    }
  }

  function drawCircular(animateWave) {
    const canvas = document.getElementById('canvas-circular');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const fill = currentConfig.fillColor || currentConfig.waterColor || '#4fc3f7';
    const r = Math.min(w, h) / 2 - 4;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = shadeColor(fill, -30);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, w, h);
  const level = h * (1 - displayProgress);
    const grad = ctx.createLinearGradient(0, level, 0, h);
    grad.addColorStop(0, fill);
    grad.addColorStop(1, shadeColor(fill, -25));
    ctx.beginPath();
    if (animateWave) {
      for (let x = 0; x <= w; x++) {
        const y = 6 * Math.sin((x / 40) * Math.PI * 2 + wavePhase) + level;
        ctx.lineTo(x, y);
      }
    } else {
      ctx.moveTo(0, level);
      ctx.lineTo(w, level);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    if (animateWave) wavePhase += 0.06;
  }

  function drawBar(vertical) {
    const id = vertical ? 'canvas-vertical' : 'canvas-horizontal';
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const fill = currentConfig.fillColor || '#4fc3f7';
    ctx.clearRect(0, 0, w, h);
    const radius = 12;
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.save();
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.clip();
    if (vertical) {
      const fh = h * displayProgress;
      const g = ctx.createLinearGradient(0, h - fh, 0, h);
      g.addColorStop(0, shadeColor(fill, 10));
      g.addColorStop(1, fill);
      ctx.fillStyle = g;
      ctx.fillRect(0, h - fh, w, fh);
    } else {
      const fw = w * displayProgress;
      const g = ctx.createLinearGradient(0, 0, fw, 0);
      g.addColorStop(0, shadeColor(fill, -10));
      g.addColorStop(1, fill);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, fw, h);
    }
    ctx.restore();
  }

  function drawBottle(animateWave) {
    const canvas = document.getElementById('canvas-bottle');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const fill = currentConfig.fillColor || '#4fc3f7';
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = currentConfig.textColor || '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.05);
    ctx.lineTo(w * 0.65, h * 0.05);
    ctx.lineTo(w * 0.58, h * 0.22);
    ctx.lineTo(w * 0.72, h * 0.95);
    ctx.quadraticCurveTo(w * 0.5, h * 1.02, w * 0.28, h * 0.95);
    ctx.lineTo(w * 0.42, h * 0.22);
    ctx.closePath();
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const level = h * (1 - displayProgress * 0.88) - h * 0.08;
    ctx.fillStyle = fill;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    if (animateWave) {
      for (let x = 0; x <= w; x++) {
        const y = 4 * Math.sin((x / 30) * Math.PI * 2 + wavePhase) + level;
        ctx.lineTo(x, y);
      }
    } else {
      ctx.moveTo(0, level);
      ctx.lineTo(w, level);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (animateWave) wavePhase += 0.05;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function render() {
    const style = currentConfig.gaugeStyle || 'circular';
    const pct = state.goal > 0 ? Math.min(1, state.current / state.goal) : 0;
    targetProgress = pct;
    updateText();
    if (style === 'circular') startLoop(drawCircular);
    else if (style === 'bottle') startLoop(drawBottle);
    else if (style === 'vertical') startLoop(() => drawBar(true));
    else if (style === 'horizontal') startLoop(() => drawBar(false));
    else if (style === 'minimal') {
      displayProgress = targetProgress;
      const ring = document.getElementById('minimal-ring');
      if (ring) ring.style.setProperty('--progress', `${Math.round(pct * 100)}%`);
    }
  }

  function updateHydration(data, configPatch) {
    const json = JSON.stringify(data);
    const sameProgress = json === lastBroadcastJson;
    lastBroadcastJson = json;
    if (data.config) currentConfig = { ...currentConfig, ...data.config };
    else if (configPatch && configPatch.config) currentConfig = { ...currentConfig, ...configPatch.config };
    state = {
      current: data.current ?? state.current,
      goal: data.goal ?? currentConfig.streamGoal ?? 64,
      percentage: data.percentage ?? state.percentage,
      streak: data.streak ?? data.config?.dailyStreak ?? 0,
      units: data.units || data.config?.units || 'oz',
    };
    applyLayout();
    render();
    if (!sameProgress && (data.leveledUp || data.celebration)) triggerEffects(data);
  }

  window.__hydrationDemoUpdate = (data) => updateHydration(data, data);
  window.__hydrationDemoFx = (opts) => triggerEffects(opts || { leveledUp: true });
  window.__hydrationDemoSparkle = () => {
    const layer = document.getElementById('effects-layer');
    if (!layer) return;
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('span');
      s.className = 'fx-sparkle';
      s.style.left = `${30 + Math.random() * 40}%`;
      s.style.top = `${25 + Math.random() * 30}%`;
      layer.appendChild(s);
    }
  };

  connectWebSocket();
  applyLayout();
})();