/**
 * JARVIS tools permitted as macro steps (and voice-controlled tools).
 */
const JARVIS_MACRO_ALLOWLIST = new Set([
  'change_scene',
  'refresh_browser_sources',
  'play_sound',
  'speak_tts',
  'send_twitch_message',
  'post_socials',
  'twitch_start_commercial',
  'discord_send_message',
  'discord_announce_live',
  'discord_post_clip',
  'twitch_create_clip',
  'meld_record_clip',
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
