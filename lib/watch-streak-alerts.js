/**
 * Twitch watch-streak milestone alerts — tier matching, EventSub parsing, persistence.
 *
 * Default milestone counts follow Twitch's shareable watch-streak cadence (first milestone at 3 streams;
 * community/tools report 3, 5, 10, and continuing milestones). Twitch does not publish every threshold.
 */

const WATCH_STREAK_CONFIG_VERSION = 1;

/** Shareable milestones commonly reported + room for high streaks (see PR sources). */
const TWITCH_REPORTED_WATCH_STREAK_MILESTONES = [3, 5, 10, 15, 20, 25, 50, 100, 200];

const TWITCH_CHAT_NOTIFICATION_TYPE = 'channel.chat.notification';
const TWITCH_WATCH_STREAK_NOTICE = 'watch_streak';
const TWITCH_WATCH_STREAK_CHAT_SCOPE = 'user:read:chat';

function tierEscalation(count) {
  const n = Number(count) || 0;
  if (n >= 100) {
    return {
      scale: 1.45,
      durationMs: 9000,
      effect: 'epic',
      fontSize: 72,
      accentColor: '#ffd54f',
      backgroundColor: 'rgba(76, 29, 149, 0.94)',
    };
  }
  if (n >= 50) {
    return {
      scale: 1.28,
      durationMs: 7500,
      effect: 'burst',
      fontSize: 64,
      accentColor: '#ffb74d',
      backgroundColor: 'rgba(49, 46, 129, 0.92)',
    };
  }
  if (n >= 25) {
    return {
      scale: 1.15,
      durationMs: 6500,
      effect: 'flare',
      fontSize: 56,
      accentColor: '#4fc3f7',
      backgroundColor: 'rgba(21, 101, 192, 0.9)',
    };
  }
  if (n >= 10) {
    return {
      scale: 1.0,
      durationMs: 5500,
      effect: 'shine',
      fontSize: 48,
      accentColor: '#a5d6a7',
      backgroundColor: 'rgba(27, 94, 32, 0.9)',
    };
  }
  if (n >= 5) {
    return {
      scale: 0.92,
      durationMs: 4800,
      effect: 'pulse',
      fontSize: 42,
      accentColor: '#ffcc80',
      backgroundColor: 'rgba(230, 81, 0, 0.88)',
    };
  }
  return {
    scale: 0.85,
    durationMs: 4200,
    effect: 'glow',
    fontSize: 38,
    accentColor: '#e1bee7',
    backgroundColor: 'rgba(74, 20, 140, 0.9)',
  };
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
    .map((t) => ({
      ...buildDefaultTier(t.threshold || 3),
      ...t,
      threshold: Math.max(1, parseInt(t.threshold, 10) || 1),
      soundVolume: clampVolume(t.soundVolume),
    }))
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
    durationMs: tier.durationMs || esc.durationMs,
    accentColor: tier.accentColor || esc.accentColor,
    backgroundColor: tier.backgroundColor || esc.backgroundColor,
    textColor: tier.textColor || '#ffffff',
    soundFile: tier.soundFile || '',
    soundVolume: clampVolume(tier.soundVolume),
    test: !!share.test,
  };
}

module.exports = {
  WATCH_STREAK_CONFIG_VERSION,
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