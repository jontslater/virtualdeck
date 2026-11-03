/**
 * Master volume helpers (0–100% global scale multiplied with per-button volume).
 * Used by the renderer and test-master-volume.js.
 */

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function normalizeButtonVolume(raw) {
  if (raw === undefined || raw === null || raw === '') return 1;
  let n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n)) return 1;
  if (n > 1) n = n / 100;
  return Math.min(1, Math.max(0, n));
}

function getEffectiveMultiplier(state) {
  const muted = !!(state && state.muted);
  if (muted) return 0;
  const percent = state && state.percent !== undefined ? state.percent : 100;
  return clampPercent(percent) / 100;
}

function scaleNormalizedVolume(normalizedVolume, state) {
  return normalizeButtonVolume(normalizedVolume) * getEffectiveMultiplier(state);
}

function effectiveVolume(buttonVolume, state) {
  return scaleNormalizedVolume(buttonVolume, state);
}

function formatMasterVolumeLabel(percent, muted) {
  if (muted) return 'Muted';
  return `${clampPercent(percent)}%`;
}

module.exports = {
  clampPercent,
  normalizeButtonVolume,
  getEffectiveMultiplier,
  scaleNormalizedVolume,
  effectiveVolume,
  formatMasterVolumeLabel,
};
