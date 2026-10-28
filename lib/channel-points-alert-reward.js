const { normalizeRewardTitle } = require('./daily-checkin-reward');

/**
 * @param {object} alert Saved twitch alert
 * @param {object} event EventSub redemption event payload
 */
function channelPointsConfigFromAlert(alert) {
  if (!alert) return {};
  if (alert.channelPointsConfig && typeof alert.channelPointsConfig === 'object') {
    return alert.channelPointsConfig;
  }
  return {
    rewardId: alert.rewardId || '',
    rewardName: alert.rewardName || '',
  };
}

/**
 * Whether a channel-points alert should fire for this redemption.
 * When rewardId is saved on the alert, only exact ID matches count (no title fallback).
 *
 * @param {object} alert
 * @param {object} event
 */
function alertMatchesChannelPointsRedemption(alert, event) {
  if (!alert || alert.type !== 'channel-points') return false;
  const config = channelPointsConfigFromAlert(alert);
  const reward = (event && event.reward) || {};
  const eventTitle = reward.title || reward.name || event.reward_title || '';
  const rewardId = config.rewardId ? String(config.rewardId) : '';
  if (rewardId) {
    if (!reward.id) return false;
    return String(reward.id) === rewardId;
  }
  const configured = config.rewardName || '';
  if (!configured) return false;
  const a = normalizeRewardTitle(eventTitle);
  const b = normalizeRewardTitle(configured);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

module.exports = {
  channelPointsConfigFromAlert,
  alertMatchesChannelPointsRedemption,
};
