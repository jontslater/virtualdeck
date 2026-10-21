/**
 * JARVIS tools permitted as macro steps (and voice-controlled tools).
 */
const JARVIS_MACRO_ALLOWLIST = new Set([
  'change_scene',
  'refresh_browser_sources',
  'play_sound',
  'send_twitch_message',
  'discord_send_message',
  'discord_announce_live',
  'discord_post_clip',
  'trigger_button',
  'launch_app',
  'get_scenes',
  'get_stream_status',
  'list_live_raid_favorites',
  'start_raid',
]);

function isJarvisMacroToolAllowed(toolName) {
  return JARVIS_MACRO_ALLOWLIST.has(toolName);
}

module.exports = {
  JARVIS_MACRO_ALLOWLIST,
  isJarvisMacroToolAllowed,
};
