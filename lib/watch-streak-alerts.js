/**
 * Twitch watch-streak milestone alerts — tier matching, EventSub parsing, persistence.
 *
 * Default milestone counts follow Twitch's shareable watch-streak cadence (first milestone at 3 streams;
 * community/tools report 3, 5, 10, and continuing milestones). Twitch does not publish every threshold.
 */

const WATCH_STREAK_CONFIG_VERSION = 3;

const WATCH_STREAK_MEDIA_LAYOUTS = ['above', 'beside', 'mediaOnly'];
const WATCH_STREAK_ANIMATIONS = ['fade', 'slide', 'pop'];

function inferWatchStreakMediaType(filePath) {
  if (!filePath) return '';
  const ext = String(filePath).split('.').pop().toLowerCase();
  if (ext === 'gif') return 'gif';
  if (['webm', 'mp4', 'mov', 'm4v'].includes(ext)) return 'video';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'image';
  return '';
}

/** Shareable milestones commonly reported + room for high streaks (see PR sources). */
const TWITCH_REPORTED_WATCH_STREAK_MILESTONES = [3, 5, 10, 15, 20, 25, 50, 100, 200];

const TWITCH_CHAT_NOTIFICATION_TYPE = 'channel.chat.notification';
const TWITCH_WATCH_STREAK_NOTICE = 'watch_streak';
const TWITCH_WATCH_STREAK_CHAT_SCOPE = 'user:read:chat';

/** Per-milestone visual preset (distinct color + scale; higher tiers are larger and flashier). */
function tierEscalation(count) {
  const n = Number(count) || 0;
  const presets = {
    3: {
      scale: 0.78,
      durationMs: 4200,
      effect: 'glow',
      fontSize: 34,
      labelSize: 18,
      subSize: 22,
      padding: '18px 32px',
      maxWidth: 640,
      accentColor: '#ce93d8',
      backgroundColor: 'linear-gradient(135deg, rgba(74, 20, 140, 0.95), rgba(49, 27, 82, 0.92))',
      borderColor: 'rgba(206, 147, 216, 0.55)',
    },
    5: {
      scale: 0.84,
      durationMs: 4600,
      effect: 'pulse',
      fontSize: 38,
      labelSize: 19,
      subSize: 24,
      padding: '20px 40px',
      maxWidth: 700,
      accentColor: '#ffb74d',
      backgroundColor: 'linear-gradient(135deg, rgba(191, 84, 0, 0.94), rgba(130, 50, 0, 0.9))',
      borderColor: 'rgba(255, 183, 77, 0.6)',
    },
    10: {
      scale: 0.96,
      durationMs: 5200,
      effect: 'shine',
      fontSize: 46,
      labelSize: 20,
      subSize: 26,
      padding: '22px 48px',
      maxWidth: 820,
      accentColor: '#b9f6ca',
      backgroundColor: 'linear-gradient(135deg, rgba(27, 94, 32, 0.96), rgba(15, 61, 20, 0.94))',
      borderColor: 'rgba(185, 246, 202, 0.55)',
    },
    25: {
      scale: 1.08,
      durationMs: 6200,
      effect: 'flare',
      fontSize: 52,
      labelSize: 22,
      subSize: 28,
      padding: '26px 56px',
      maxWidth: 920,
      accentColor: '#81d4fa',
      backgroundColor: 'linear-gradient(135deg, rgba(1, 87, 155, 0.96), rgba(13, 71, 161, 0.94))',
      borderColor: 'rgba(129, 212, 250, 0.65)',
    },
    50: {
      scale: 1.22,
      durationMs: 7200,
      effect: 'burst',
      fontSize: 58,
      labelSize: 24,
      subSize: 30,
      padding: '30px 64px',
      maxWidth: 1040,
      accentColor: '#ffab40',
      backgroundColor: 'linear-gradient(135deg, rgba(49, 27, 146, 0.97), rgba(106, 27, 154, 0.95))',
      borderColor: 'rgba(255, 171, 64, 0.7)',
    },
    100: {
      scale: 1.38,
      durationMs: 8500,
      effect: 'epic',
      fontSize: 68,
      labelSize: 26,
      subSize: 32,
      padding: '34px 72px',
      maxWidth: 1180,
      accentColor: '#ffe082',
      backgroundColor: 'linear-gradient(135deg, rgba(255, 143, 0, 0.97), rgba(183, 28, 28, 0.94))',
      borderColor: 'rgba(255, 224, 130, 0.85)',
    },
    200: {
      scale: 1.55,
      durationMs: 10000,
      effect: 'confetti',
      fontSize: 78,
      labelSize: 28,
      subSize: 34,
      padding: '38px 84px',
      maxWidth: 1280,
      accentColor: '#ffffff',
      backgroundColor: 'linear-gradient(135deg, rgba(255, 215, 64, 0.98), rgba(233, 30, 99, 0.95), rgba(106, 27, 154, 0.96))',
      borderColor: 'rgba(255, 255, 255, 0.9)',
    },
  };
  if (presets[n]) return { ...presets[n] };
  const keys = Object.keys(presets)
    .map(Number)
    .sort((a, b) => a - b);
  let chosen = presets[3];
  for (const k of keys) {
    if (k <= n) chosen = presets[k];
    else break;
  }
  return { ...chosen };
}

function defaultTemplateForCount(count) {
  const n = Number(count) || 0;
  if (n >= 100) return '{user} is unstoppable — {count} streams on this watch streak!';
  if (n >= 50) return 'Legendary loyalty! {user} shared a {count}-stream watch streak!';
  if (n >= 25) return '{user} keeps coming back — {count} streams in a row!';
  if (n >= 10) return '{user} hit a {count}-stream watch streak!';
  if (n >= 5) return '{user} sparked a {count}-stream watch streak!';
  return '{user} started a watch streak — {count} streams!';
}

function buildDefaultTier(count) {
  const esc = tierEscalation(count);
  return {
    id: `tier_${count}`,
    threshold: count,
    textTemplate: defaultTemplateForCount(count),
    soundFile: '',
    soundVolume: 80,
    accentColor: esc.accentColor,
    backgroundColor: esc.backgroundColor,
    textColor: '#ffffff',
    effect: esc.effect,
    scale: esc.scale,
    durationMs: esc.durationMs,
    chatMessage:
      count >= 50
        ? 'Incredible streak, {user}! {count} streams!'
        : 'Thanks for the loyalty, {user}! ({count} streams)',
    mediaFile: '',
    mediaType: '',
    mediaLayout: 'above',
    enterAnimation: 'fade',
    exitAnimation: 'fade',
    alertDurationMs: 0,
  };
}

function buildDefaultTiers(counts = TWITCH_REPORTED_WATCH_STREAK_MILESTONES) {
  return counts.map((c) => buildDefaultTier(c));
}

function getDefaultSimpleTier() {
  return {
    ...buildDefaultTier(10),
    id: 'simple_unified',
    threshold: 0,
    textTemplate: '{user} shared a {count}-stream watch streak!',
    effect: 'shine',
    scale: 1,
    durationMs: 5500,
  };
}

function getDefaultConfig() {
  return {
    version: WATCH_STREAK_CONFIG_VERSION,
    enabled: false,
    sameAlertForEveryStreak: false,
    tiers: buildDefaultTiers(),
    simpleTier: getDefaultSimpleTier(),
  };
}

function migrateWatchStreakConfig(raw) {
  const base = getDefaultConfig();
  if (!raw || typeof raw !== 'object') return base;
  const cfg = { ...base, ...raw };
  if (!Array.isArray(cfg.tiers) || cfg.tiers.length === 0) {
    cfg.tiers = buildDefaultTiers();
  }
  cfg.tiers = cfg.tiers
    .map((t) => {
      const threshold = Math.max(1, parseInt(t.threshold, 10) || 1);
      const defaults = buildDefaultTier(threshold);
      const merged = { ...defaults, ...t, threshold };
      if (raw.version == null || raw.version < 2) {
        merged.scale = defaults.scale;
        merged.durationMs = defaults.durationMs;
        merged.effect = defaults.effect;
        merged.accentColor = defaults.accentColor;
        merged.backgroundColor = defaults.backgroundColor;
      }
      if (raw.version == null || raw.version < 3) {
        merged.mediaFile = merged.mediaFile || '';
        merged.mediaType = inferWatchStreakMediaType(merged.mediaFile) || merged.mediaType || '';
        merged.mediaLayout = WATCH_STREAK_MEDIA_LAYOUTS.includes(merged.mediaLayout)
          ? merged.mediaLayout
          : defaults.mediaLayout;
        merged.enterAnimation = WATCH_STREAK_ANIMATIONS.includes(merged.enterAnimation)
          ? merged.enterAnimation
          : defaults.enterAnimation;
        merged.exitAnimation = WATCH_STREAK_ANIMATIONS.includes(merged.exitAnimation)
          ? merged.exitAnimation
          : defaults.exitAnimation;
        merged.alertDurationMs = Math.max(0, parseInt(merged.alertDurationMs, 10) || 0);
      }
      if (merged.mediaFile && !merged.mediaType) {
        merged.mediaType = inferWatchStreakMediaType(merged.mediaFile);
      }
      merged.soundVolume = clampVolume(merged.soundVolume);
      return merged;
    })
    .sort((a, b) => a.threshold - b.threshold);
  if (!cfg.simpleTier || typeof cfg.simpleTier !== 'object') {
    cfg.simpleTier = getDefaultSimpleTier();
  } else {
    cfg.simpleTier = {
      ...getDefaultSimpleTier(),
      ...cfg.simpleTier,
      soundVolume: clampVolume(cfg.simpleTier.soundVolume),
    };
  }
  cfg.version = WATCH_STREAK_CONFIG_VERSION;
  cfg.enabled = !!cfg.enabled;
  cfg.sameAlertForEveryStreak = !!cfg.sameAlertForEveryStreak;
  return cfg;
}

function clampVolume(v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return 80;
  return Math.min(100, Math.max(0, n));
}

/**
 * Highest configured tier at or below streakCount (sorted ascending thresholds).
 */
function matchTier(tiers, streakCount) {
  const count = Number(streakCount);
  if (!Number.isFinite(count) || count < 1 || !Array.isArray(tiers)) return null;
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  let matched = null;
  for (const tier of sorted) {
    if (tier.threshold <= count) matched = tier;
    else break;
  }
  return matched;
}

function resolveActiveTier(config, streakCount) {
  if (!config) return null;
  if (config.sameAlertForEveryStreak) {
    return { ...(config.simpleTier || getDefaultSimpleTier()), matchedThreshold: streakCount };
  }
  const tier = matchTier(config.tiers, streakCount);
  if (!tier) return null;
  return { ...tier, matchedThreshold: tier.threshold };
}

function parseWatchStreakEventSub(event) {
  if (!event || typeof event !== 'object') return null;
  const noticeType = event.notice_type || event.noticeType;
  if (noticeType !== TWITCH_WATCH_STREAK_NOTICE) return null;
  const ws = event.watch_streak || event.watchStreak;
  if (!ws || typeof ws !== 'object') return null;
  const streakCount = Number(ws.streak_count != null ? ws.streak_count : ws.streakCount);
  if (!Number.isFinite(streakCount) || streakCount < 1) return null;
  const channelPoints =
    ws.channel_points_awarded != null
      ? Number(ws.channel_points_awarded)
      : event.channel_points_awarded != null
        ? Number(event.channel_points_awarded)
        : 0;
  const login = event.chatter_user_login || event.chatter_login || '';
  const display =
    event.chatter_user_name || event.chatter_name || login || 'Viewer';
  const userId = event.chatter_user_id || event.chatter_id || '';
  const messageText =
    (event.message && event.message.text) ||
    event.system_message ||
    '';
  return {
    type: TWITCH_WATCH_STREAK_NOTICE,
    streakCount,
    channelPointsAwarded: Number.isFinite(channelPoints) ? channelPoints : 0,
    userId,
    login,
    displayName: display,
    username: login || display,
    message: messageText,
    raw: event,
  };
}

function formatAlertText(template, vars) {
  const tpl = String(template || '');
  const map = {
    user: vars.displayName || vars.username || 'Someone',
    username: vars.username || vars.login || '',
    login: vars.login || vars.username || '',
    count: String(vars.streakCount != null ? vars.streakCount : ''),
    streak: String(vars.streakCount != null ? vars.streakCount : ''),
    points: String(vars.channelPointsAwarded != null ? vars.channelPointsAwarded : ''),
  };
  return tpl.replace(/\{(\w+)\}/g, (_m, key) => (map[key] != null ? map[key] : `{${key}}`));
}

function getDefaultLeadersStore() {
  return {
    version: 1,
    viewers: {},
    updatedAt: null,
  };
}

function migrateLeadersStore(raw) {
  const base = getDefaultLeadersStore();
  if (!raw || typeof raw !== 'object') return base;
  const viewers = raw.viewers && typeof raw.viewers === 'object' ? raw.viewers : {};
  return {
    version: 1,
    viewers,
    updatedAt: raw.updatedAt || null,
  };
}

/**
 * @returns {{ store: object, entry: object }}
 */
function recordStreakShare(store, share) {
  const leaders = migrateLeadersStore(store);
  const key = share.userId || share.login;
  if (!key) return { store: leaders, entry: null };
  const now = new Date().toISOString();
  const prev = leaders.viewers[key] || {
    userId: share.userId || '',
    login: share.login || '',
    displayName: share.displayName || share.login || '',
    highestSharedStreak: 0,
    lastSharedStreak: 0,
    lastSharedAt: null,
  };
  const streak = Number(share.streakCount) || 0;
  const entry = {
    ...prev,
    userId: share.userId || prev.userId,
    login: share.login || prev.login,
    displayName: share.displayName || prev.displayName,
    lastSharedStreak: streak,
    lastSharedAt: now,
    highestSharedStreak: Math.max(prev.highestSharedStreak || 0, streak),
  };
  leaders.viewers[key] = entry;
  leaders.updatedAt = now;
  return { store: leaders, entry };
}

function listTopStreakers(store, limit = 50) {
  const leaders = migrateLeadersStore(store);
  return Object.values(leaders.viewers)
    .sort((a, b) => {
      if ((b.highestSharedStreak || 0) !== (a.highestSharedStreak || 0)) {
        return (b.highestSharedStreak || 0) - (a.highestSharedStreak || 0);
      }
      return String(b.lastSharedAt || '').localeCompare(String(a.lastSharedAt || ''));
    })
    .slice(0, limit);
}

function scopesIncludeWatchStreakChat(scopes) {
  if (!scopes) return false;
  const list = Array.isArray(scopes) ? scopes : String(scopes).split(/\s+/);
  return list.includes(TWITCH_WATCH_STREAK_CHAT_SCOPE);
}

function buildWatchStreakOverlayPayload(tier, share, renderedText) {
  const esc = tierEscalation(share.streakCount);
  const hasMedia = !!(tier.mediaFile && String(tier.mediaFile).trim());
  const baseDuration = tier.durationMs || esc.durationMs;
  const alertDurationMs =
    tier.alertDurationMs && tier.alertDurationMs > 0 ? tier.alertDurationMs : baseDuration;
  return {
    type: 'watchStreakAlert',
    streakCount: share.streakCount,
    threshold: tier.matchedThreshold != null ? tier.matchedThreshold : tier.threshold,
    username: share.login || share.username,
    displayName: share.displayName,
    text: renderedText,
    channelPointsAwarded: share.channelPointsAwarded,
    effect: tier.effect || esc.effect,
    scale: tier.scale != null ? tier.scale : esc.scale,
    durationMs: alertDurationMs,
    fontSize: esc.fontSize,
    labelSize: esc.labelSize,
    subSize: esc.subSize,
    padding: esc.padding,
    maxWidth: esc.maxWidth,
    borderColor: esc.borderColor,
    accentColor: tier.accentColor || esc.accentColor,
    backgroundColor: tier.backgroundColor || esc.backgroundColor,
    textColor: tier.textColor || '#ffffff',
    soundFile: tier.soundFile || '',
    soundVolume: clampVolume(tier.soundVolume),
    mediaFile: hasMedia ? String(tier.mediaFile).trim() : '',
    mediaType: hasMedia ? tier.mediaType || inferWatchStreakMediaType(tier.mediaFile) : '',
    mediaLayout: WATCH_STREAK_MEDIA_LAYOUTS.includes(tier.mediaLayout) ? tier.mediaLayout : 'above',
    enterAnimation: WATCH_STREAK_ANIMATIONS.includes(tier.enterAnimation) ? tier.enterAnimation : 'fade',
    exitAnimation: WATCH_STREAK_ANIMATIONS.includes(tier.exitAnimation) ? tier.exitAnimation : 'fade',
    useBuiltInCard: !hasMedia,
    test: !!share.test,
  };
}

module.exports = {
  WATCH_STREAK_CONFIG_VERSION,
  WATCH_STREAK_MEDIA_LAYOUTS,
  WATCH_STREAK_ANIMATIONS,
  inferWatchStreakMediaType,
  TWITCH_REPORTED_WATCH_STREAK_MILESTONES,
  TWITCH_CHAT_NOTIFICATION_TYPE,
  TWITCH_WATCH_STREAK_NOTICE,
  TWITCH_WATCH_STREAK_CHAT_SCOPE,
  tierEscalation,
  buildDefaultTier,
  buildDefaultTiers,
  getDefaultSimpleTier,
  getDefaultConfig,
  migrateWatchStreakConfig,
  matchTier,
  resolveActiveTier,
  parseWatchStreakEventSub,
  formatAlertText,
  getDefaultLeadersStore,
  migrateLeadersStore,
  recordStreakShare,
  listTopStreakers,
  scopesIncludeWatchStreakChat,
  buildWatchStreakOverlayPayload,
};