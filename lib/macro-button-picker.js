/**
 * Deck button catalog + trigger_button macro step resolution (id + label).
 */

function buttonLabel(btn) {
  if (!btn) return '';
  return String(btn.name || btn.label || btn.sceneName || 'Unnamed').trim();
}

/**
 * @param {Array<{ profileId: string, profileName: string, buttons: object[] }>} profiles
 */
function buildDeckButtonCatalog(profiles) {
  const entries = [];
  for (const p of profiles || []) {
    const profileId = p.profileId || p.id || '';
    const profileName = p.profileName || p.name || profileId || 'Profile';
    for (const btn of p.buttons || []) {
      if (!btn || !btn.id) continue;
      entries.push({
        buttonId: btn.id,
        label: buttonLabel(btn),
        profileId,
        profileName,
      });
    }
  }

  const countByLabel = new Map();
  for (const e of entries) {
    const k = e.label.toLowerCase();
    countByLabel.set(k, (countByLabel.get(k) || 0) + 1);
  }

  return entries.map((e) => ({
    ...e,
    displayLabel:
      (countByLabel.get(e.label.toLowerCase()) || 0) > 1
        ? `${e.label} (${e.profileName})`
        : e.label,
  }));
}

function findCatalogEntry(catalog, buttonId, label) {
  if (!Array.isArray(catalog)) return null;
  if (buttonId) {
    const byId = catalog.find((c) => c.buttonId === buttonId);
    if (byId) return byId;
  }
  if (label) {
    const key = String(label).trim().toLowerCase();
    const matches = catalog.filter((c) => c.label.toLowerCase() === key);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function resolveTriggerButtonByLabel(label, catalog, preferredProfileId) {
  const key = String(label || '').trim().toLowerCase();
  if (!key) {
    return { ok: false, reason: 'empty-label' };
  }
  const matches = (catalog || []).filter((c) => c.label.toLowerCase() === key);
  if (matches.length === 0) {
    return { ok: false, reason: 'missing', label };
  }
  if (matches.length === 1) {
    return { ok: true, entry: matches[0], upgraded: true };
  }
  if (preferredProfileId) {
    const inProfile = matches.filter((m) => m.profileId === preferredProfileId);
    if (inProfile.length === 1) {
      return { ok: true, entry: inProfile[0], upgraded: true };
    }
    if (inProfile.length > 1) {
      return { ok: false, reason: 'ambiguous', label, matches: inProfile };
    }
  }
  return { ok: false, reason: 'ambiguous', label, matches };
}

/**
 * Normalize one trigger_button step's arguments (upgrade label-only → buttonId).
 */
function normalizeTriggerButtonArguments(args, catalog, preferredProfileId) {
  const warnings = [];
  const next = { ...(args || {}) };
  let missing = false;
  let ambiguous = false;

  if (next.buttonId) {
    const hit = catalog.find((c) => c.buttonId === next.buttonId);
    if (!hit) {
      missing = true;
      const name = next.label ? `"${next.label}"` : next.buttonId;
      warnings.push(`Referenced deck button ${name} was deleted or is no longer on the deck.`);
    } else {
      next.label = hit.label;
      next.buttonId = hit.buttonId;
    }
    return { arguments: next, warnings, missing, ambiguous, upgraded: false };
  }

  if (next.label) {
    const resolved = resolveTriggerButtonByLabel(next.label, catalog, preferredProfileId);
    if (!resolved.ok) {
      if (resolved.reason === 'missing') {
        missing = true;
        warnings.push(`Button "${next.label}" was not found on the deck.`);
      } else if (resolved.reason === 'ambiguous') {
        ambiguous = true;
        warnings.push(
          `Button name "${next.label}" matches multiple deck buttons — choose the correct one in the list.`,
        );
      }
      return { arguments: next, warnings, missing, ambiguous, upgraded: false };
    }
    next.buttonId = resolved.entry.buttonId;
    next.label = resolved.entry.label;
    return { arguments: next, warnings, missing, ambiguous, upgraded: !!resolved.upgraded };
  }

  warnings.push('Choose a deck button for this step.');
  missing = true;
  return { arguments: next, warnings, missing, ambiguous, upgraded: false };
}

function normalizeMacroTriggerButtonSteps(steps, catalog, preferredProfileId) {
  const warnings = [];
  let anyUpgraded = false;
  const out = (steps || []).map((step, index) => {
    if (!step || step.tool !== 'trigger_button') return step;
    const norm = normalizeTriggerButtonArguments(
      step.arguments,
      catalog,
      preferredProfileId,
    );
    norm.warnings.forEach((w) => warnings.push(`Step ${index + 1}: ${w}`));
    if (norm.upgraded) anyUpgraded = true;
    return { ...step, arguments: norm.arguments };
  });
  return { steps: out, warnings, anyUpgraded };
}

function filterCatalogBySearch(catalog, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return catalog.slice();
  return catalog.filter(
    (e) =>
      e.displayLabel.toLowerCase().includes(q) ||
      e.label.toLowerCase().includes(q) ||
      e.profileName.toLowerCase().includes(q) ||
      e.buttonId.toLowerCase().includes(q),
  );
}

module.exports = {
  buttonLabel,
  buildDeckButtonCatalog,
  findCatalogEntry,
  resolveTriggerButtonByLabel,
  normalizeTriggerButtonArguments,
  normalizeMacroTriggerButtonSteps,
  filterCatalogBySearch,
};
