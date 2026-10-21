/**
 * Browser helpers for Twitch channel point reward dropdowns (renderer).
 */
(function (global) {
  function populateRewardSelect(selectElement, rewards, options) {
    if (!selectElement) return;
    const valueField = options && options.valueField === 'title' ? 'title' : 'id';
    const placeholder = (options && options.placeholder) || '-- Select reward --';
    selectElement.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = placeholder;
    selectElement.appendChild(blank);
    (rewards || []).forEach((reward) => {
      const option = document.createElement('option');
      const id = reward.id != null ? String(reward.id) : '';
      const title = reward.title != null ? String(reward.title) : '';
      option.value = valueField === 'title' ? title : id;
      option.dataset.rewardId = id;
      option.dataset.rewardTitle = title;
      if (reward.cost != null) option.dataset.rewardCost = String(reward.cost);
      option.textContent = reward.cost != null ? `${title} (${reward.cost} pts)` : title;
      selectElement.appendChild(option);
    });
  }

  function selectedRewardFromSelect(selectElement) {
    if (!selectElement || !selectElement.selectedOptions.length) {
      return { rewardId: '', rewardName: '' };
    }
    const opt = selectElement.selectedOptions[0];
    return {
      rewardId: opt.dataset.rewardId || '',
      rewardName: opt.dataset.rewardTitle || opt.textContent || '',
    };
  }

  async function loadRewardsIntoSelect(selectElement, options) {
    if (!global.electronAPI || !global.electronAPI.getChannelRewards) {
      throw new Error('Twitch API not available');
    }
    const rewards = await global.electronAPI.getChannelRewards();
    populateRewardSelect(selectElement, rewards || [], options);
    return rewards || [];
  }

  global.vdChannelRewards = {
    populateRewardSelect,
    selectedRewardFromSelect,
    loadRewardsIntoSelect,
  };
})(window);
