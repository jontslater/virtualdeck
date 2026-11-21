const { normalizeRedemptionKeyword } = require('./hydration-config');

/**
 * @param {object} event EventSub redemption event payload
 * @param {object} config migrated hydration config
 */
function isHydrationRewardRedemption(event, config) {
  if (!config || config.trackingEnabled === false) return false;
  const reward = (event && event.reward) || {};
  const eventTitle = reward.title || reward.name || event.reward_title || '';
  const eventId = reward.id || event.reward_id;

  if (config.rewardId) {
    if (!eventId) return false;
    return String(eventId) === String(config.rewardId);
  }

  const keyword = normalizeRedemptionKeyword(config.redemptionKeyword || 'hydrate');
  if (!keyword) return false;

  const titleNorm = normalizeRedemptionKeyword(eventTitle);
  if (titleNorm && (titleNorm === keyword || titleNorm.includes(keyword))) {
    return true;
  }

  const userInput = event.user_input ? normalizeRedemptionKeyword(event.user_input) : '';
  if (userInput && (userInput === keyword || userInput.includes(keyword))) {
    return true;
  }

  return false;
}

module.exports = {
  isHydrationRewardRedemption,
};