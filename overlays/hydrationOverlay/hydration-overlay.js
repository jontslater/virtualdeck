/* global window, document, performance, requestAnimationFrame, cancelAnimationFrame */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IDLE_MS = prefersReducedMotion ? 999999 : 1000 / 30;

  let ws = null;
  let reconnectTimeout = null;
  let currentConfig = {};
  let state = { current: 0, goal: 64, percentage: 0, streak: 0, units: 'oz' };
  let rafId = null;
  let lastFrameTs = 0;

  let displayProgress = 0;
  let targetProgress = 0;
  let progressAnimStart = 0;
  let progressAnimFrom = 0;
  let progressAnimating = false;
  let activeTweenGoal = NaN;

  let wavePhase1 = 0;
  let wavePhase2 = 0;
  let splashBoost = 0;
  let glowBoost = 0;
  let outlineFlash = 0;
  let shimmerPhase = 0;
  let lastBroadcastJson = '';

  /** @type {Array<{kind:string,x:number,y:number,vx:number,vy:number,life:number,maxLife:number,size:number,rot:number,color:string,twinkle:number}>} */
  let particles = [];

  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  function connectWebSocket() {
    try {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => ws.send(JSON.stringify({ type: 'ping' }));
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
    const amt = Number(pct);
    if (!Number.isFinite(amt)) return color;
    const clamp8 = (n) => Math.max(0, Math.min(255, Math.round(n)));
    const byte = (n) => clamp8(n).toString(16).padStart(2, '0');
    return `#${byte(p.r + amt)}${byte(p.g + amt)}${byte(p.b + amt)}`;
  }

  function formatAmount(n, units) {
    return `${Math.round(n * 10) / 10} ${units}`;
  }

  function effectIntensityScale() {
    const level = currentConfig.effectsIntensity || 'medium';
    if (level === 'low') return 0.6;
    if (level === 'high') return 1.55;
    return 1.2;
  }

  function fillColor() {
    return currentConfig.fillColor || currentConfig.waterColor || '#4fc3f7';
  }

  function startProgressTween(forceImmediate) {
    if (prefersReducedMotion) {
      displayProgress = targetProgress;
      progressAnimating = false;
      activeTweenGoal = targetProgress;
      return;
    }
    if (Math.abs(targetProgress - displayProgress) < 0.002) {
      displayProgress = targetProgress;
      progressAnimating = false;
      activeTweenGoal = targetProgress;
      return;
    }
    if (
      !forceImmediate &&
      progressAnimating &&
      Math.abs(activeTweenGoal - targetProgress) < 0.0001
    ) {
      return;
    }
    activeTweenGoal = targetProgress;
    progressAnimFrom = displayProgress;
    progressAnimStart = performance.now();
    progressAnimating = true;
    splashBoost = Math.max(splashBoost, 0.85);
  }

  function easeFill(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const eased = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    return t < 1 ? eased : 1;
  }

  function tickSimulation(dt) {
    splashBoost = Math.max(0, splashBoost - dt * 1.2);
    glowBoost = Math.max(0, glowBoost - dt * 1.1);
    outlineFlash = Math.max(0, outlineFlash - dt * 2.2);

    if (!prefersReducedMotion) {
      wavePhase1 += dt * 1.35;
      wavePhase2 -= dt * 0.92;
      shimmerPhase += dt * 2.5;
    }

    const now = performance.now();
    if (progressAnimating) {
      const t = Math.min(1, (now - progressAnimStart) / 1000);
      displayProgress = progressAnimFrom + (targetProgress - progressAnimFrom) * easeFill(t);
      if (t >= 1) {
        displayProgress = targetProgress;
        progressAnimating = false;
        splashBoost = Math.max(splashBoost, 0.35);
      }
    }

    const next = [];
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.twinkle += dt * 6;
      if (p.kind === 'confetti') p.rot += dt * 3;
      if (p.y < 0.06) p.y = 0.06;
      if (p.y > 0.98) p.y = 0.98;
      if (p.x < 0.05) p.x = 0.05;
      if (p.x > 0.95) p.x = 0.95;
      next.push(p);
    }
    particles = next;
  }

  function hasEffect(name) {
    const set = currentConfig.effectSet;
    if (!Array.isArray(set)) return true;
    return set.includes(name);
  }

  function spawnInWater(kind, countMul) {
    if (currentConfig.enableEffects === false) return;
    const scale = effectIntensityScale() * (countMul || 1);
    const palette = [
      fillColor(),
      currentConfig.accentColor || '#29b6f6',
      '#ffeb3b',
      '#ff5252',
      '#69f0ae',
      '#e040fb',
      '#ffffff',
    ];

    const n =
      kind === 'bubble'
        ? Math.round(16 * scale)
        : kind === 'sparkle'
          ? Math.round(22 * scale)
          : Math.round(32 * scale);

    const waterTop = Math.max(0.06, 1 - displayProgress + 0.04);

    for (let i = 0; i < n; i++) {
      const baseY = waterTop + Math.random() * Math.max(0.08, 0.96 - waterTop);
      particles.push({
        kind,
        x: 0.12 + Math.random() * 0.76,
        y: baseY,
        vx: (Math.random() - 0.5) * (kind === 'confetti' ? 0.35 : 0.08) * scale,
        vy:
          kind === 'bubble'
            ? -(0.45 + Math.random() * 0.55) * scale
            : kind === 'sparkle'
              ? -(0.25 + Math.random() * 0.35) * scale
              : -(0.15 + Math.random() * 0.25) * scale,
        life: 1.4 + Math.random() * 0.9,
        maxLife: 2.3,
        size:
          (kind === 'sparkle' ? 4.5 : kind === 'bubble' ? 6 : 4) * (0.85 + scale * 0.4) + Math.random() * 2.5,
        rot: Math.random() * Math.PI,
        color: palette[i % palette.length],
        twinkle: Math.random() * Math.PI,
      });
    }
  }

  function triggerEffects(data) {
    if (prefersReducedMotion || currentConfig.enableEffects === false) return;
    if (data.celebration && currentConfig.goalConfetti !== false) {
      glowBoost = Math.max(glowBoost, 1.35);
      outlineFlash = 1;
      spawnInWater('confetti', 2.2);
      if (hasEffect('sparkles')) spawnInWater('sparkle', 1.8);
      spawnInWater('bubble', 0.8);
      if (hasEffect('numberPop')) triggerNumberPop();
    } else if (data.leveledUp) {
      glowBoost = Math.max(glowBoost, 0.65);
      if (hasEffect('sparkles')) spawnInWater('sparkle', 1);
      spawnInWater('bubble', 0.9);
      if (hasEffect('splash')) splashBoost = Math.max(splashBoost, 1.1);
      if (hasEffect('numberPop')) triggerNumberPop();
    }
    scheduleLoop();
  }

  function triggerNumberPop() {
    const block = document.getElementById('hydration-stats-block');
    const minimal = document.getElementById('minimal-ring-wrap');
    if (block) {
      block.classList.remove('fx-number-pop');
      void block.offsetWidth;
      block.classList.add('fx-number-pop');
    }
    if (minimal) {
      minimal.classList.remove('fx-number-pop');
      void minimal.offsetWidth;
      minimal.classList.add('fx-number-pop');
    }
  }

  function waveAmplitude() {
    const base = prefersReducedMotion ? 0 : 4;
    return base + splashBoost * 14;
  }

  function surfaceY(x, w, level, amp) {
    const w1 = Math.sin((x / w) * Math.PI * 3 + wavePhase1) * amp;
    const w2 = Math.sin((x / w) * Math.PI * 5.2 + wavePhase2) * amp * 0.55;
    return level + w1 + w2;
  }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 200;
    const h = rect.height || canvas.clientHeight || 200;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawParticles(ctx, w, h, progress, mode) {
    const level =
      mode === 'horizontal'
        ? progress
        : mode === 'vertical'
          ? 1 - progress
          : 1 - progress;

    for (const p of particles) {
      const px = p.x * w;
      const py = p.y * h;
      let inside = false;
      if (mode === 'horizontal') {
        inside = px <= w * progress + 2 && py <= h;
      } else if (mode === 'vertical') {
        inside = py >= h * (1 - progress) - 2;
      } else {
        inside = py >= h * (1 - progress) - 4;
      }
      if (!inside) continue;

      const alpha = Math.min(1, (p.life / p.maxLife) * 1.1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.kind === 'sparkle') {
        const tw = 0.55 + 0.45 * Math.sin(p.twinkle);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14 * tw;
        drawStar(ctx, px, py, p.size * (1 + tw * 0.65), p.twinkle);
        ctx.globalAlpha = alpha * (0.85 + tw * 0.15);
        ctx.fillStyle = p.color;
        drawStar(ctx, px, py, p.size * 0.55 * tw, p.twinkle + 0.4);
      } else if (p.kind === 'bubble') {
        const g = ctx.createRadialGradient(px - p.size * 0.2, py - p.size * 0.2, 0, px, py, p.size);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(255,255,255,0.15)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.translate(px, py);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 1.4);
      }
      ctx.restore();
    }
  }

  function drawStar(ctx, x, y, r, phase) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = phase + (i * Math.PI) / 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      const a2 = a + Math.PI / 4;
      ctx.lineTo(x + Math.cos(a2) * r * 0.35, y + Math.sin(a2) * r * 0.35);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawWaterFillBottom(ctx, w, h, progress) {
    if (progress <= 0.001) return;
    const fill = fillColor();
    const amp = waveAmplitude();
    const level = h * (1 - progress);
    const brighten = 1 + glowBoost * 0.45;

    const g = ctx.createLinearGradient(0, level, 0, h);
    g.addColorStop(0, shadeColor(fill, 8 * brighten));
    g.addColorStop(1, shadeColor(fill, -22));

    ctx.beginPath();
    ctx.moveTo(0, h);
    if (prefersReducedMotion) {
      ctx.lineTo(0, level);
      ctx.lineTo(w, level);
    } else {
      for (let x = 0; x <= w; x++) {
        ctx.lineTo(x, surfaceY(x, w, level, amp));
      }
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();

    if (!prefersReducedMotion && progress > 0.02) {
      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const y = surfaceY(x, w, level, amp) - 1.5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + glowBoost * 0.25})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawParticles(ctx, w, h, progress, 'circular');
  }

  function drawCircular() {
    const canvas = document.getElementById('canvas-circular');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const fill = fillColor();
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
    drawWaterFillBottom(ctx, w, h, displayProgress);
    ctx.restore();
  }

  function drawBottle() {
    const canvas = document.getElementById('canvas-bottle');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const fill = fillColor();
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
    drawWaterFillBottom(ctx, w, h, displayProgress * 0.92);
    ctx.restore();
  }

  function roundRect(ctx, x, y, rw, rh, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + rw - rad, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + rad);
    ctx.lineTo(x + rw, y + rh - rad);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - rad, y + rh);
    ctx.lineTo(x + rad, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function drawVertical() {
    const canvas = document.getElementById('canvas-vertical');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const fill = fillColor();
    const radius = 12;
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.save();
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.clip();
    drawWaterFillBottom(ctx, w, h, displayProgress);
    ctx.restore();
    ctx.strokeStyle = shadeColor(fill, -20);
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, w - 2, h - 2, radius);
    ctx.stroke();
  }

  function drawHorizontal() {
    const canvas = document.getElementById('canvas-horizontal');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const fill = fillColor();
    const radius = 12;
    const fw = w * displayProgress;
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.save();
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.clip();
    if (fw > 0.5) {
      const g = ctx.createLinearGradient(0, 0, fw, 0);
      g.addColorStop(0, shadeColor(fill, -12));
      g.addColorStop(0.85, fill);
      g.addColorStop(1, shadeColor(fill, 12));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, fw, h);
      if (!prefersReducedMotion) {
        const bandW = 40;
        const sx = ((shimmerPhase * 80) % (fw + bandW)) - bandW;
        const sg = ctx.createLinearGradient(sx, 0, sx + bandW, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, `rgba(255,255,255,${0.22 + glowBoost * 0.2})`);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, fw, h);
      }
      drawParticles(ctx, w, h, displayProgress, 'horizontal');
    }
    ctx.restore();
    roundRect(ctx, 1, 1, w - 2, h - 2, radius);
    ctx.strokeStyle = shadeColor(fill, -25);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function updateMinimalRing(pct) {
    const arc = document.getElementById('minimal-progress-arc');
    const wrap = document.getElementById('minimal-ring-wrap');
    const track = document.getElementById('minimal-track-arc');
    if (!arc) return;
    const r = 84;
    const circ = 2 * Math.PI * r;
    const filled = circ * Math.min(1, Math.max(0, pct));
    arc.setAttribute('stroke-dasharray', `${filled} ${circ - filled}`);
    const c = fillColor();
    arc.setAttribute('stroke', c);
    const flash = outlineFlash;
    arc.setAttribute('stroke-width', String(12 + flash * 4));
    arc.style.filter = flash > 0 ? `drop-shadow(0 0 ${8 + flash * 12}px ${c})` : '';
    if (track) track.setAttribute('stroke', `rgba(255,255,255,${0.22 + flash * 0.2})`);
    const size = currentConfig.gaugeSize || 280;
    if (wrap) wrap.style.setProperty('--minimal-size', `${size}px`);
  }

  function drawMinimalFx() {
    const canvas = document.getElementById('minimal-fx-canvas');
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.42, 0, Math.PI * 2);
    ctx.clip();
    if (glowBoost > 0) {
      ctx.fillStyle = `rgba(79, 195, 247, ${0.08 * glowBoost})`;
      ctx.fillRect(0, 0, w, h);
    }
    const pct = state.goal > 0 ? Math.min(1, state.current / state.goal) : displayProgress;
    drawParticles(ctx, w, h, Math.max(pct, displayProgress), 'circular');
    if (!prefersReducedMotion && pct > 0.02) {
      const r = Math.min(w, h) * 0.38;
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * pct;
      const band = 0.55 + Math.sin(shimmerPhase) * 0.12;
      const shimStart = Math.max(start, end - band);
      ctx.strokeStyle = `rgba(255,255,255,${0.14 + glowBoost * 0.18})`;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, shimStart, end);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrame() {
    const style = currentConfig.gaugeStyle || 'circular';
    if (style === 'circular') drawCircular();
    else if (style === 'bottle') drawBottle();
    else if (style === 'vertical') drawVertical();
    else if (style === 'horizontal') drawHorizontal();
    else if (style === 'minimal') {
      const pct = state.goal > 0 ? Math.min(1, state.current / state.goal) : 0;
      updateMinimalRing(pct);
      drawMinimalFx();
    }
  }

  function needsAnimationLoop() {
    if (prefersReducedMotion) return progressAnimating || particles.length > 0;
    return true;
  }

  function loop(now) {
    rafId = null;
    const dt = lastFrameTs ? Math.min(0.05, (now - lastFrameTs) / 1000) : 1 / 30;
    const elapsed = now - lastFrameTs;
    const style = currentConfig.gaugeStyle || 'circular';
    const idleOnly =
      !progressAnimating &&
      particles.length === 0 &&
      splashBoost < 0.02 &&
      glowBoost < 0.02 &&
      style !== 'minimal';

    if (!prefersReducedMotion && idleOnly && elapsed < IDLE_MS) {
      scheduleLoop();
      return;
    }
    lastFrameTs = now;
    tickSimulation(dt);
    try {
      drawFrame();
    } catch (err) {
      console.error('Hydration draw error', err);
    }
    if (needsAnimationLoop() || displayProgress > 0) scheduleLoop();
  }

  function scheduleLoop() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(loop);
  }

  function applyLayout() {
    const container = document.getElementById('hydration-container');
    if (!container) return;
    container.style.left = `${currentConfig.positionX ?? 50}%`;
    container.style.top = `${currentConfig.positionY ?? 50}%`;
    const gaugeStyle = currentConfig.gaugeStyle || 'circular';
    const isMinimalGauge = gaugeStyle === 'minimal';
    const showPlate =
      !isMinimalGauge && currentConfig.showPlate !== false && currentConfig.displayStyle !== 'minimal';
    const plate = document.getElementById('hydration-plate');
    if (plate) {
      plate.classList.toggle('hidden', !showPlate && !isMinimalGauge);
      if (isMinimalGauge) {
        plate.style.background = 'transparent';
        plate.style.boxShadow = 'none';
        plate.style.padding = '0';
        plate.style.border = 'none';
      } else {
        plate.style.background =
          currentConfig.plateColor || currentConfig.backgroundColor || 'rgba(12,16,24,0.85)';
        plate.style.borderRadius = `${currentConfig.borderRadius ?? 16}px`;
        plate.style.border =
          currentConfig.borderWidth > 0
            ? `${currentConfig.borderWidth}px solid ${currentConfig.borderColor || '#fff'}`
            : 'none';
        plate.style.boxShadow = '0 8px 28px rgba(0,0,0,0.45)';
        plate.style.padding = '14px 20px 16px';
      }
    }
    const size = currentConfig.gaugeSize || 280;
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
    const stroke = '0 0 4px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.75)';
    document.querySelectorAll('.hydration-text').forEach((el) => {
      el.style.color = currentConfig.textColor || '#ffffff';
      el.style.textShadow = stroke;
    });
    document.querySelectorAll('.hydration-chip').forEach((chip) => {
      chip.style.color = currentConfig.textColor || '#fff';
      chip.style.borderColor = currentConfig.accentColor || fillColor();
      chip.style.background = 'rgba(0,0,0,0.45)';
    });
    showGauge(currentConfig.gaugeStyle || 'circular');
  }

  function showGauge(style) {
    document.querySelectorAll('[data-gauge]').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.gauge !== style);
    });
  }

  function updateText() {
    const u = state.units || 'oz';
    const main = document.getElementById('hydration-amount-main');
    const sub = document.getElementById('hydration-amount-goal');
    const pctEl = document.getElementById('hydration-pct-chip');
    const streak = document.getElementById('hydration-streak-chip');
    if (main) main.textContent = formatAmount(state.current, u);
    if (sub) sub.textContent = `of ${formatAmount(state.goal, u)}`;
    const p = state.goal > 0 ? Math.min(999, (state.current / state.goal) * 100) : 0;
    if (pctEl) pctEl.textContent = `${Math.round(p)}%`;
    if (streak) {
      streak.textContent = state.streak > 0 ? `🔥 ${state.streak}` : '🔥 0';
      streak.classList.toggle('hidden', !state.streak && !currentConfig.dailyStreak);
    }
    const minMain = document.getElementById('minimal-amount-main');
    const minSub = document.getElementById('minimal-amount-sub');
    if (minMain) minMain.textContent = formatAmount(state.current, u);
    if (minSub) minSub.textContent = `${Math.round(p)}% · of ${formatAmount(state.goal, u)}`;
    const statsBlock = document.getElementById('hydration-stats-block');
    if (statsBlock) statsBlock.classList.toggle('hidden', currentConfig.gaugeStyle === 'minimal');
    const chips = document.querySelector('.hydration-chips');
    if (chips) chips.classList.toggle('hidden', currentConfig.gaugeStyle === 'minimal');
  }

  function syncLiquidLevel(pct, animate) {
    const next = Math.min(1, Math.max(0, pct));
    if (Math.abs(targetProgress - next) > 0.0001) {
      targetProgress = next;
      if (animate) startProgressTween();
      else {
        displayProgress = next;
        progressAnimating = false;
      }
    } else if (!progressAnimating && Math.abs(displayProgress - next) > 0.0001) {
      displayProgress = next;
    }
  }

  function render() {
    const pct = state.goal > 0 ? Math.min(1, state.current / state.goal) : 0;
    const shouldAnimate = !prefersReducedMotion;
    syncLiquidLevel(pct, shouldAnimate);
    updateText();
    scheduleLoop();
  }

  function updateHydration(data, configPatch) {
    const prevTarget = targetProgress;
    const json = JSON.stringify(data);
    const sameBroadcast = json === lastBroadcastJson;
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
    if (!sameBroadcast && (data.leveledUp || data.celebration)) triggerEffects(data);
  }

  function isPreviewMode() {
    return /[?&]preview=1/.test(location.search);
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'hydrationPreview' && event.data.payload) {
      updateHydration(event.data.payload, event.data.payload);
    }
  });

  window.__hydrationDemoUpdate = (data) => updateHydration(data, data);
  window.__hydrationDemoFx = (opts) => triggerEffects(opts || { leveledUp: true });
  window.__hydrationDemoSparkle = () => {
    glowBoost = Math.max(glowBoost, 0.75);
    spawnInWater('sparkle', 1.35);
    scheduleLoop();
  };
  window.__hydrationDemoSplash = () => {
    splashBoost = 1.4;
    scheduleLoop();
  };
  window.__hydrationDemoBubbles = () => {
    spawnInWater('bubble', 1.1);
    scheduleLoop();
  };
  window.__hydrationDemoConfetti = () => {
    glowBoost = Math.max(glowBoost, 1.2);
    outlineFlash = 1;
    spawnInWater('confetti', 2);
    spawnInWater('sparkle', 0.8);
    scheduleLoop();
  };
  window.__hydrationDemoNumberPop = () => triggerNumberPop();
  window.__hydrationDemoFill = (from, to) => {
    displayProgress = from;
    targetProgress = to;
    startProgressTween(true);
    scheduleLoop();
  };
  window.__hydrationDemoSnapLevel = (pct) => {
    syncLiquidLevel(pct, false);
    drawFrame();
    scheduleLoop();
  };
  if (!isPreviewMode()) connectWebSocket();
  applyLayout();
  scheduleLoop();
})();