/**
 * Recommended Twitch OAuth scopes for VirtualDeck (including raids).
 */
const TWITCH_OAUTH_SCOPES = [
  'chat:read',
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
];

const TWITCH_RAID_SCOPE = 'channel:manage:raids';

function scopesIncludeRaid(scopes) {
  if (!scopes) return false;
  const list = Array.isArray(scopes) ? scopes : String(scopes).split(/\s+/);
  return list.includes(TWITCH_RAID_SCOPE);
}

module.exports = {
  TWITCH_OAUTH_SCOPES,
  TWITCH_RAID_SCOPE,
  scopesIncludeRaid,
};
