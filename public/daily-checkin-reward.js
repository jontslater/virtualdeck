(function (global) {
  function normalizeRewardTitle(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function isDailyCheckinRewardRedemption(event, config) {
    if (!config || config.enabled === false) return false;
    const reward = (event && event.reward) || {};
    const eventTitle = reward.title || reward.name || event.reward_title || '';
    if (config.rewardId && reward.id) {
      return String(reward.id) === String(config.rewardId);
    }
    const configured = config.rewardName || 'Daily Check-In';
    const a = normalizeRewardTitle(eventTitle);
    const b = normalizeRewardTitle(configured);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  }

  global.vdDailyCheckinReward = {
    normalizeRewardTitle,
    isDailyCheckinRewardRedemption,
  };
})(window);
