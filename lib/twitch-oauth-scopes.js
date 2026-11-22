/**
 * Recommended Twitch OAuth scopes for VirtualDeck (including raids).
 */
const TWITCH_OAUTH_SCOPES = [
  'chat:read',
  'user:read:chat',
  'chat:edit',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'moderator:read:followers',
  'channel:manage:redemptions',
  'bits:read',
  'channel:read:hype_train',
  'moderator:read:chatters',
  'clips:edit',
  'channel:manage:raids',
  'channel:edit:commercial',
];

const TWITCH_RAID_SCOPE = 'channel:manage:raids';
const TWITCH_COMMERCIAL_SCOPE = 'channel:edit:commercial';
const TWITCH_WATCH_STREAK_CHAT_SCOPE = 'user:read:chat';

function scopesIncludeRaid(scopes) {
  if (!scopes) return false;
  const list = Array.isArray(scopes) ? scopes : String(scopes).split(/\s+/);
  return list.includes(TWITCH_RAID_SCOPE);
}

function scopesIncludeWatchStreakChat(scopes) {
  if (!scopes) return false;
  const list = Array.isArray(scopes) ? scopes : String(scopes).split(/\s+/);
  return list.includes(TWITCH_WATCH_STREAK_CHAT_SCOPE);
}

function scopesIncludeCommercial(scopes) {
  if (!scopes) return false;
  const list = Array.isArray(scopes) ? scopes : String(scopes).split(/\s+/);
  return list.includes(TWITCH_COMMERCIAL_SCOPE);
}

module.exports = {
  TWITCH_OAUTH_SCOPES,
  TWITCH_RAID_SCOPE,
  TWITCH_COMMERCIAL_SCOPE,
  TWITCH_WATCH_STREAK_CHAT_SCOPE,
  scopesIncludeRaid,
  scopesIncludeCommercial,
  scopesIncludeWatchStreakChat,
};
