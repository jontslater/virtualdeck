/**
 * Hydration tracker config defaults, migration, reset logic, and helpers.
 */

const DEFAULT_HYDRATION_CONFIG = Object.freeze({
  streamGoal: 64,
  incrementAmount: 8,
  sipAmount: 4,
  currentProgress: 0,
  redemptionKeyword: 'hydrate',
  rewardId: '',
  gaugeStyle: 'circular',
  displayStyle: 'plate',
  waterColor: '#4fc3f7',
  fillColor: '#4fc3f7',
  accentColor: '#29b6f6',
  backgroundColor: 'rgba(12, 16, 24, 0.82)',
  plateColor: 'rgba(12, 16, 24, 0.82)',
  textColor: '#ffffff',
  gaugeSize: 280,
  positionX: 50,
  positionY: 50,
  borderWidth: 0,
  borderColor: '#ffffff',
  borderRadius: 16,
  showPlate: true,
  units: 'oz',
  matchTheme: false,
  resetMode: 'go-live',
  resetOnLive: true,
  dailyStreak: 0,
  lastGoalMetDate: null,
  lastMidnightResetDate: null,
  lastStreamLiveState: null,
  progressHistory: [],
  effectsIntensity: 'medium',
  enableEffects: true,
  effectSet: ['sparkles', 'splash', 'numberPop'],
  goalConfetti: true,
  soundEnabled: false,
  soundPath: '',
  soundVolume: 0.7,
  goalSoundPath: '',
  goalSoundVolume: 0.7,
  reminderMinutes: 0,
  lastReminderAt: 0,
  logHotkey: '',
  deckActionEnabled: true,
  trackingEnabled: true,
});

function normalizeRedemptionKeyword(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

function coerceNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coercePosition(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseHexColor(color) {
  if (!color || typeof color !== 'string') return null;
  const c = color.trim();
  if (c.startsWith('rgba') || c.startsWith('rgb')) return null;
  let hex = c.replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

function shadeColor(color, percent) {
  const parsed = parseHexColor(color);
  if (!parsed) return color;
  let { r, g, b } = parsed;
  r = Math.max(0, Math.min(255, r + percent));
  g = Math.max(0, Math.min(255, g + percent));
  b = Math.max(0, Math.min(255, b + percent));
  const toHex = (n) => (n < 16 ? '0' : '') + n.toString(16);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Migrate legacy hydration-config.json without dropping unknown fields.
 * @param {object} raw
 */
function migrateHydrationConfig(raw) {
  const base = { ...DEFAULT_HYDRATION_CONFIG, ...(raw && typeof raw === 'object' ? raw : {}) };

  if (!base.fillColor && base.waterColor) base.fillColor = base.waterColor;
  if (!base.waterColor && base.fillColor) base.waterColor = base.fillColor;
  if (!base.plateColor && base.backgroundColor && base.backgroundColor !== 'transparent') {
    base.plateColor = base.backgroundColor;
  }
  if (base.showPlate === undefined) {
    base.showPlate = base.backgroundColor && base.backgroundColor !== 'transparent';
  }

  base.streamGoal = coerceNumber(base.streamGoal, DEFAULT_HYDRATION_CONFIG.streamGoal);
  base.incrementAmount = coerceNumber(base.incrementAmount, DEFAULT_HYDRATION_CONFIG.incrementAmount);
  base.sipAmount = coerceNumber(base.sipAmount, Math.max(1, Math.round(base.incrementAmount / 2)));
  base.currentProgress = coerceNumber(base.currentProgress, 0);
  base.gaugeSize = coerceNumber(base.gaugeSize, DEFAULT_HYDRATION_CONFIG.gaugeSize);
  base.positionX = coercePosition(base.positionX, 50);
  base.positionY = coercePosition(base.positionY, 50);
  base.borderWidth = coerceNumber(base.borderWidth, 0);
  base.borderRadius = coerceNumber(base.borderRadius, 16);
  base.soundVolume = Math.min(1, Math.max(0, coerceNumber(base.soundVolume, 0.7)));
  base.goalSoundVolume = Math.min(1, Math.max(0, coerceNumber(base.goalSoundVolume, 0.7)));
  base.reminderMinutes = Math.max(0, coerceNumber(base.reminderMinutes, 0));
  base.dailyStreak = Math.max(0, coerceNumber(base.dailyStreak, 0));

  if (!base.units || !['oz', 'ml'].includes(base.units)) base.units = 'oz';

  const rawHadResetMode = raw && Object.prototype.hasOwnProperty.call(raw, 'resetMode');
  if (!rawHadResetMode) {
    if (raw && raw.resetOnLive === false) base.resetMode = 'manual';
    else if (raw && raw.resetOnLive === true) base.resetMode = 'go-live';
  }
  if (base.resetMode !== 'go-live' && base.resetMode !== 'midnight' && base.resetMode !== 'manual') {
    base.resetMode = base.resetOnLive === false ? 'manual' : 'go-live';
  }
  base.resetOnLive = base.resetMode === 'go-live';

  if (!Array.isArray(base.progressHistory)) base.progressHistory = [];
  if (!Array.isArray(base.effectSet)) base.effectSet = [...DEFAULT_HYDRATION_CONFIG.effectSet];

  if (!base.gaugeStyle) base.gaugeStyle = 'circular';
  const allowedGauges = new Set(['circular', 'bottle', 'vertical', 'horizontal', 'minimal']);
  if (!allowedGauges.has(base.gaugeStyle)) base.gaugeStyle = 'circular';

  return base;
}

function buildHydrationBroadcastData(config) {
  const goal = config.streamGoal > 0 ? config.streamGoal : 1;
  const percentage = (config.currentProgress / goal) * 100;
  return {
    current: config.currentProgress,
    goal: config.streamGoal,
    percentage,
    streak: config.dailyStreak || 0,
    units: config.units || 'oz',
    config,
    celebration: false,
    leveledUp: false,
    undoAvailable: Array.isArray(config.progressHistory) && config.progressHistory.length > 0,
  };
}

/**
 * @returns {{ config: object, goalMet: boolean, leveledUp: boolean, amount: number }}
 */
function applyHydrationDelta(config, amount, options = {}) {
  const amt = Math.max(0, coerceNumber(amount, config.incrementAmount));
  const prev = config.currentProgress;
  const next = prev + amt;
  const goal = config.streamGoal > 0 ? config.streamGoal : 1;
  const wasBelow = prev < goal;
  const nowAtOrAbove = next >= goal;

  if (!Array.isArray(config.progressHistory)) config.progressHistory = [];
  config.progressHistory.push({
    amount: amt,
    at: Date.now(),
    source: options.source || 'manual',
  });
  if (config.progressHistory.length > 50) {
    config.progressHistory = config.progressHistory.slice(-50);
  }

  config.currentProgress = next;
  const leveledUp = next > prev;
  const goalMet = wasBelow && nowAtOrAbove;

  if (goalMet) {
    const today = localDateString();
    const lastMet = config.lastGoalMetDate;
    if (lastMet) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = localDateString(yesterday);
      if (lastMet === yStr) {
        config.dailyStreak = Math.max(1, (config.dailyStreak || 0) + 1);
      } else if (lastMet === today) {
        /* same day re-met */
      } else {
        config.dailyStreak = 1;
      }
    } else {
      config.dailyStreak = 1;
    }
    config.lastGoalMetDate = today;
  }

  return { config, goalMet, leveledUp, amount: amt };
}

function undoLastHydrationDelta(config) {
  if (!Array.isArray(config.progressHistory) || config.progressHistory.length === 0) {
    return { config, undone: false };
  }
  const last = config.progressHistory.pop();
  config.currentProgress = Math.max(0, config.currentProgress - (last.amount || 0));
  return { config, undone: true, amount: last.amount || 0 };
}

/**
 * On first poll, seed state without resetting when already live.
 */
function resolveStreamLiveTransition(previousState, isLive) {
  if (previousState === null || previousState === undefined) {
    return { previous: isLive, shouldReset: false, initialized: true };
  }
  if (isLive && previousState === false) {
    return { previous: true, shouldReset: true, initialized: false };
  }
  return { previous: isLive, shouldReset: false, initialized: false };
}

function shouldResetForGoLive(config) {
  return config.resetMode === 'go-live' || config.resetOnLive === true;
}

function shouldResetAtMidnight(config, now = new Date()) {
  if (config.resetMode !== 'midnight') return false;
  const today = localDateString(now);
  if (config.lastMidnightResetDate === today) return false;
  return true;
}

function applyMidnightReset(config, now = new Date()) {
  config.currentProgress = 0;
  config.progressHistory = [];
  config.lastMidnightResetDate = localDateString(now);
  return config;
}

function resetHydrationProgress(config) {
  config.currentProgress = 0;
  config.progressHistory = [];
  return config;
}

module.exports = {
  DEFAULT_HYDRATION_CONFIG,
  migrateHydrationConfig,
  normalizeRedemptionKeyword,
  coercePosition,
  shadeColor,
  buildHydrationBroadcastData,
  applyHydrationDelta,
  undoLastHydrationDelta,
  resolveStreamLiveTransition,
  shouldResetForGoLive,
  shouldResetAtMidnight,
  applyMidnightReset,
  resetHydrationProgress,
  localDateString,
};