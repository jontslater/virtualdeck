'use strict';

const { matchMacroByUtterance } = require('./macro-voice');
const { readHostWakeNamesFromUserData } = require('./wake-names');

function wakeNamesFromUserData(userDataPath) {
  const w = readHostWakeNamesFromUserData(userDataPath);
  const names = Array.isArray(w.names) ? w.names.slice() : [];
  if (w.primary) {
    const key = String(w.primary).toLowerCase();
    if (!names.some((n) => String(n).toLowerCase() === key)) {
      names.unshift(w.primary);
    }
  }
  return names;
}

/**
 * Shape expected by Raven / AITuber virtualdeck-bridge macro whitelist.
 */
function formatMacrosForRaven(macroList) {
  return (macroList || [])
    .filter((m) => m && m.enabled !== false)
    .map((m) => ({
      id: m.id,
      name: m.name,
      phrase: (m.triggers && m.triggers.phrase) || null,
      enabled: m.enabled !== false,
    }));
}

function matchVoiceMacroFromList(macroList, utterance, userDataPath) {
  const wakeNames = wakeNamesFromUserData(userDataPath);
  return matchMacroByUtterance(macroList, utterance, { wakeNames });
}

module.exports = {
  wakeNamesFromUserData,
  formatMacrosForRaven,
  matchVoiceMacroFromList,
};
