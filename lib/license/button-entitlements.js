const { FREE_BUTTON_CAP } = require('./constants');

/**
 * Order buttons the same way the renderer deck does (saved order + trailing buttons).
 * @param {{ buttons?: object[], uiSettings?: { soundButtonOrder?: { id: string }[] } }} profile
 * @returns {object[]}
 */
function orderButtonsForDeck(profile) {
  const buttons = Array.isArray(profile?.buttons) ? profile.buttons : [];
  const savedOrder = profile?.uiSettings?.soundButtonOrder;
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) {
    return buttons.slice();
  }

  const configById = new Map(buttons.filter((b) => b && b.id).map((b) => [b.id, b]));
  const ordered = [];
  const usedIds = new Set();

  for (const entry of savedOrder) {
    const id = entry && entry.id;
    if (id && configById.has(id)) {
      ordered.push(configById.get(id));
      usedIds.add(id);
    }
  }
  for (const b of buttons) {
    if (!b || !b.id) continue;
    if (!usedIds.has(b.id)) ordered.push(b);
  }
  return ordered.length > 0 ? ordered : buttons.slice();
}

/**
 * @param {{ buttons?: object[], uiSettings?: object }} profile
 * @param {boolean} unlimitedButtons
 */
function computeButtonEntitlements(profile, unlimitedButtons) {
  const ordered = orderButtonsForDeck(profile);
  const activeIds = new Set();
  const lockedIds = new Set();

  if (unlimitedButtons) {
    for (const b of ordered) {
      if (b && b.id) activeIds.add(b.id);
    }
    return {
      ordered,
      activeIds,
      lockedIds,
      canAddButton: true,
      buttonCount: ordered.length,
      maxActiveButtons: null,
    };
  }

  ordered.forEach((b, index) => {
    if (!b || !b.id) return;
    if (index < FREE_BUTTON_CAP) activeIds.add(b.id);
    else lockedIds.add(b.id);
  });

  return {
    ordered,
    activeIds,
    lockedIds,
    canAddButton: ordered.length < FREE_BUTTON_CAP,
    buttonCount: ordered.length,
    maxActiveButtons: FREE_BUTTON_CAP,
  };
}

function findButtonByLabel(profile, label) {
  if (!label) return null;
  const buttons = profile?.buttons || [];
  return buttons.find(
    (b) =>
      b &&
      (b.id === label ||
        b.label === label ||
        b.name === label ||
        b.sceneName === label),
  );
}

module.exports = {
  orderButtonsForDeck,
  computeButtonEntitlements,
  findButtonByLabel,
  FREE_BUTTON_CAP,
};
