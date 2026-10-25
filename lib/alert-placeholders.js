/** @typedef {Record<string, unknown>} AlertUserData */

const { formatSocialsLine, normalizeSocials } = require('./socials');

const PLACEHOLDER_NAMES = [
  'username',
  'display_name',
  'displayName',
  'tier',
  'viewers',
  'bits',
  'months',
  'message',
  'reward',
  'moderator',
  'reason',
  'total_checkins',
  'streak',
  'recipient',
  'count',
  'socials',
];

function messageTextFromEvent(ev) {
  if (!ev || !ev.message) return '';
  if (typeof ev.message === 'string') return ev.message;
  if (typeof ev.message.text === 'string') return ev.message.text;
  return '';
}

/**
 * @param {AlertUserData | null | undefined} userData
 */
function replacePlaceholders(text, userData) {
  if (!userData || text == null) return text;
  let processedText = String(text);
  processedText = processedText.replace(/\{username\}/g, String(userData.username || userData.user_name || userData.user || 'Unknown'));
  processedText = processedText.replace(
    /\{display_name\}/g,
    String(userData.display_name || userData.user_name || userData.user || 'Unknown'),
  );
  processedText = processedText.replace(
    /\{displayName\}/g,
    String(userData.displayName || userData.display_name || userData.user_name || userData.user || 'Unknown'),
  );
  processedText = processedText.replace(/\{tier\}/g, String(userData.tier || userData.sub_plan || ''));
  processedText = processedText.replace(
    /\{viewers\}/g,
    String(userData.viewers || userData.view_count || userData.viewer_count || ''),
  );
  processedText = processedText.replace(
    /\{bits\}/g,
    String(userData.bits || userData.bits_used || userData.bits_amount || userData.amount || ''),
  );
  processedText = processedText.replace(/\{months\}/g, String(userData.cumulative_months || userData.months || ''));
  processedText = processedText.replace(/\{message\}/g, String(userData.message || userData.user_input || ''));
  processedText = processedText.replace(/\{reward\}/g, String(userData.reward || userData.reward_title || ''));
  processedText = processedText.replace(/\{moderator\}/g, String(userData.moderator || ''));
  processedText = processedText.replace(/\{reason\}/g, String(userData.reason || ''));
  processedText = processedText.replace(/\{total_checkins\}/g, String(userData.total_checkins || '0'));
  processedText = processedText.replace(/\{streak\}/g, String(userData.streak || '0'));
  processedText = processedText.replace(/\{recipient\}/g, String(userData.recipient != null ? userData.recipient : ''));
  processedText = processedText.replace(/\{count\}/g, String(userData.count != null ? userData.count : ''));
  const socialsText =
    userData.socials != null && String(userData.socials).trim()
      ? String(userData.socials)
      : formatSocialsLine(normalizeSocials(userData.socialsConfig));
  processedText = processedText.replace(/\{socials\}/g, socialsText);
  return processedText;
}

/**
 * @param {AlertUserData | null | undefined} userData
 * @param {unknown} socialsConfig
 */
function appendSocialsToUserData(userData, socialsConfig) {
  const base = userData && typeof userData === 'object' ? { ...userData } : {};
  base.socials = formatSocialsLine(normalizeSocials(socialsConfig));
  return base;
}

/**
 * Apply gift-specific recipient/count and gifter vs recipient usernames.
 * @param {AlertUserData} userData
 * @param {Record<string, unknown>} event
 * @param {string} twitchEventType
 */
function applyGiftFields(userData, event, twitchEventType) {
  const ev = event || {};
  let recipient = '';
  let count = '';

  if (twitchEventType === 'channel.subscription.gift') {
    const total = ev.total != null ? Number(ev.total) : 1;
    count = String(total);
    if (total > 1) {
      recipient = 'the community';
    } else {
      recipient = String(
        ev.recipient_display_name ||
          ev.recipient_user_name ||
          ev.recipient_user_login ||
          ev.recipient ||
          '',
      );
    }
    userData.username = ev.user_name || ev.user_login || userData.username;
    userData.display_name = ev.display_name || ev.user_name || userData.display_name;
    userData.user_name = userData.username;
  } else if (twitchEventType === 'channel.subscribe' && ev.is_gift === true) {
    count = '1';
    recipient = String(ev.display_name || ev.user_name || ev.user_login || '');
    const gifterLogin = ev.gifter_user_login || ev.gifter_login;
    const gifterName = ev.gifter_user_name || ev.gifter_name;
    if (gifterName || gifterLogin) {
      userData.username = gifterLogin || gifterName || userData.username;
      userData.display_name = ev.gifter_display_name || gifterName || userData.display_name;
      userData.user_name = userData.username;
    }
  }

  userData.recipient = recipient;
  userData.count = count;
  return userData;
}

/**
 * @param {Record<string, unknown>} event
 */
function buildChannelPointsUserData(event) {
  const ev = event || {};
  const rewardObj = (ev.reward && typeof ev.reward === 'object' ? ev.reward : {}) || {};
  const rewardTitle = rewardObj.title || rewardObj.name || ev.reward_title || '';
  return {
    ...ev,
    username: ev.user_login || ev.user_name || 'Unknown',
    display_name: ev.display_name || ev.user_name || ev.user_login || 'Unknown',
    user_name: ev.user_name || ev.user_login,
    user_id: ev.user_id,
    message: ev.user_input || ev.input || '',
    user_input: ev.user_input || ev.input || '',
    reward: rewardTitle,
  };
}

/**
 * @param {{ type?: string, event?: Record<string, unknown> }} eventData
 */
function buildUserDataFromTwitchEvent(eventData) {
  const ev = (eventData && eventData.event) || {};
  const rewardObj = ev.reward && typeof ev.reward === 'object' ? ev.reward : null;
  const rewardTitle =
    (rewardObj && (rewardObj.title || rewardObj.name)) || ev.reward_title || (typeof ev.reward === 'string' ? ev.reward : '') || '';
  const userData = {
    ...ev,
    username: ev.user_name || ev.user || ev.from_name || ev.user_login || 'Unknown',
    display_name: ev.display_name || ev.user_name || ev.user || 'Unknown',
    tier: ev.tier || ev.sub_plan || '',
    viewers: ev.viewers || ev.view_count || ev.viewer_count || '',
    bits: ev.bits || ev.bits_used || ev.bits_amount || ev.amount || '',
    months: ev.cumulative_months || ev.months || '',
    message: messageTextFromEvent(ev) || ev.user_input || '',
    reward: rewardTitle,
  };

  if (
    eventData &&
    (eventData.type === 'channel.subscription.gift' ||
      (eventData.type === 'channel.subscribe' && ev.is_gift === true))
  ) {
    applyGiftFields(userData, ev, eventData.type);
  }

  return userData;
}

/**
 * Raw TTS template on a saved alert (supports legacy field names).
 * @param {Record<string, unknown>} alertData
 */
function alertTtsTemplate(alertData) {
  if (!alertData) return '';
  if (alertData.ttsText != null && String(alertData.ttsText).trim()) return String(alertData.ttsText);
  if (alertData.tts != null && typeof alertData.tts === 'object' && alertData.tts.text) {
    return String(alertData.tts.text);
  }
  if (alertData.ravenTtsText != null && String(alertData.ravenTtsText).trim()) return String(alertData.ravenTtsText);
  return '';
}

function isRavenTtsEnabled(alertData) {
  if (!alertData) return false;
  if (alertData.ravenTtsEnabled === true) return true;
  if (alertData.tts && typeof alertData.tts === 'object' && alertData.tts.enabled) return true;
  return Boolean(String(alertTtsTemplate(alertData)).trim());
}

/**
 * Text for optional alert "Speak with Raven TTS". Playback is routed by the host
 * (dashboard `play-ai-tts` + dedicated `aiAudio` browser source only — not the alert overlay).
 *
 * @param {Record<string, unknown>} alertData
 * @param {AlertUserData | null | undefined} userData
 */
function resolveAlertSpeakText(alertData, userData) {
  let template = alertTtsTemplate(alertData);
  if (!template.trim() && isRavenTtsEnabled(alertData) && alertData.text) {
    template = String(alertData.text);
  }
  if (!template.trim()) return '';
  return replacePlaceholders(template, userData);
}

module.exports = {
  PLACEHOLDER_NAMES,
  replacePlaceholders,
  appendSocialsToUserData,
  applyGiftFields,
  buildChannelPointsUserData,
  buildUserDataFromTwitchEvent,
  alertTtsTemplate,
  isRavenTtsEnabled,
  resolveAlertSpeakText,
};
