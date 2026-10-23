'use strict';
/**
 * Pure helpers for supervising the Raven sidecar: restart backoff, port-conflict
 * detection and log-tail extraction. Kept free of Electron so it is unit-testable.
 */
const net = require('net');
const fs = require('fs');

/** Ports the Raven controller binds (see AITuber apps/controller). */
const RAVEN_PORTS = [3001, 3003, 3004, 3020];
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 5 * 60 * 1000;
const STABLE_RUN_MS = 60 * 1000;

/** Delay before restart attempt n (1-based): 2s, 5s, 15s. */
function backoffMs(attempt) {
  const table = [2000, 5000, 15000];
  return table[Math.min(Math.max(attempt, 1), table.length) - 1];
}

/**
 * Decide what to do when Raven exits.
 * state: { restarts: number[] (timestamps), stopRequested: boolean, startedAt: number }
 * Returns { action: 'none'|'restart'|'give_up', delayMs?, attempt?, restarts }
 */
function decideOnExit(state, code, now = Date.now()) {
  const restarts = (state.restarts || []).filter((t) => now - t < RESTART_WINDOW_MS);
  if (state.stopRequested) return { action: 'none', restarts };
  if (code === 0) return { action: 'none', restarts };
  // A long healthy run resets the budget.
  const ranFor = state.startedAt ? now - state.startedAt : 0;
  const effective = ranFor >= STABLE_RUN_MS ? [] : restarts;
  if (effective.length >= MAX_RESTARTS) return { action: 'give_up', restarts: effective };
  const attempt = effective.length + 1;
  return { action: 'restart', attempt, delayMs: backoffMs(attempt), restarts: [...effective, now] };
}

/** Resolve true if something is already listening on 127.0.0.1:port. */
function isPortInUse(port, host = '127.0.0.1', timeoutMs = 600) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { /* ignore */ }
      resolve(v);
    };
    sock.setTimeout(timeoutMs, () => finish(false));
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
  });
}

async function findBusyPorts(ports = RAVEN_PORTS) {
  const busy = [];
  for (const p of ports) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortInUse(p)) busy.push(p);
  }
  return busy;
}

/** True when log text shows a port bind failure. */
function logShowsPortConflict(text) {
  return /EADDRINUSE|address already in use/i.test(String(text || ''));
}

/** Last n non-empty lines of a file (secrets redacted). */
function tailLog(file, n = 15) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return ''; }
  return redact(text.split(/\r?\n/).filter((l) => l.trim()).slice(-n).join('\n'));
}

function redact(text) {
  return String(text || '')
    .replace(/sk-[A-Za-z0-9_\-]{8,}/g, 'sk-***')
    .replace(/(api[_-]?key["'=:\s]+)[^\s"',]+/gi, '$1***');
}

module.exports = {
  RAVEN_PORTS,
  MAX_RESTARTS,
  backoffMs,
  decideOnExit,
  isPortInUse,
  findBusyPorts,
  logShowsPortConflict,
  tailLog,
  redact,
};
