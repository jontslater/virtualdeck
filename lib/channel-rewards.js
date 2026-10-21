/**
 * Populate a <select> with Twitch channel point custom rewards (Helix).
 * @param {HTMLSelectElement} selectElement
 * @param {Array<{id:string,title:string,cost?:number}>} rewards
 * @param {{ valueField?: 'id'|'title', placeholder?: string }} [options]
 */
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

function findRewardOptionById(selectElement, rewardId) {
  if (!selectElement || !rewardId) return null;
  return Array.from(selectElement.options).find((o) => o.dataset.rewardId === String(rewardId));
}

function findRewardOptionByTitle(selectElement, title) {
  if (!selectElement || !title) return null;
  const t = String(title).trim().toLowerCase();
  return Array.from(selectElement.options).find(
    (o) => o.dataset.rewardTitle && o.dataset.rewardTitle.trim().toLowerCase() === t,
  );
}

module.exports = {
  populateRewardSelect,
  findRewardOptionById,
  findRewardOptionByTitle,
};
