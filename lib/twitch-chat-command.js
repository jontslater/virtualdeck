/**
 * Twitch deck-button chat command matching (Mix It Up–style secret words + classic !commands).
 */

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply backward-compatible defaults to a saved chatCommand object.
 * @param {object|null|undefined} chatCommand
 * @returns {object|null}
 */
function normalizeChatCommandConfig(chatCommand) {
  if (!chatCommand || typeof chatCommand !== 'object') return null;
  const keywordRaw = chatCommand.keyword != null ? String(chatCommand.keyword) : '';
  const perUserCooldownSeconds = Number(chatCommand.perUserCooldownSeconds);
  return {
    enabled: chatCommand.enabled !== false,
    keyword: keywordRaw.trim().toLowerCase(),
    redeemName: chatCommand.redeemName != null ? String(chatCommand.redeemName) : '',
    triggerMethod: chatCommand.triggerMethod || 'command',
    requirePrefix: chatCommand.requirePrefix !== false,
    matchAnywhere: chatCommand.matchAnywhere === true,
    allowOverlappingRuns: chatCommand.allowOverlappingRuns === true,
    perUserCooldownSeconds:
      Number.isFinite(perUserCooldownSeconds) && perUserCooldownSeconds > 0
        ? Math.floor(perUserCooldownSeconds)
        : 0,
  };
}

/**
 * @param {string} keywordField - comma-separated trigger words
 * @returns {string[]}
 */
function parseTriggerKeywords(keywordField) {
  if (!keywordField) return [];
  return String(keywordField)
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string} message
 * @param {string} word
 * @returns {boolean}
 */
function messageContainsWholeWord(message, word) {
  if (!word) return false;
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  return re.test(message);
}

/**
 * First chat token: optional leading ! stripped from first whitespace-separated word.
 * @param {string} message
 * @returns {string}
 */
function getFirstChatToken(message) {
  const trimmed = String(message || '').trim();
  if (!trimmed) return '';
  const first = trimmed.split(/\s+/)[0];
  return first.startsWith('!') ? first.substring(1).toLowerCase() : first.toLowerCase();
}

/**
 * @param {string} message
 * @param {object} chatCommand - raw or normalized config
 * @returns {boolean}
 */
function messageMatchesChatCommand(message, chatCommand) {
  const cfg = normalizeChatCommandConfig(chatCommand);
  if (!cfg || !cfg.enabled) return false;
  const keywords = parseTriggerKeywords(cfg.keyword);
  if (keywords.length === 0) return false;

  const msg = String(message || '');
  const trimmed = msg.trim();
  if (!trimmed) return false;

  if (cfg.matchAnywhere) {
    if (cfg.requirePrefix && !trimmed.startsWith('!')) return false;
    return keywords.some((kw) => messageContainsWholeWord(msg, kw));
  }

  if (cfg.requirePrefix && !trimmed.startsWith('!')) return false;

  const token = cfg.requirePrefix
    ? trimmed.split(/\s+/)[0].substring(1).toLowerCase()
    : getFirstChatToken(trimmed);

  return keywords.some((kw) => kw === token);
}

/**
 * @param {string} message
 * @param {object[]} buttons
 * @returns {{ btn: object, chatCommand: object }[]}
 */
function findChatCommandTriggers(message, buttons) {
  const list = Array.isArray(buttons) ? buttons : [];
  const matches = [];
  const trimmed = String(message || '').trim();
  const legacyCommandText =
    trimmed.startsWith('!') ? trimmed.split(/\s+/)[0].substring(1).toLowerCase() : '';

  for (const btn of list) {
    if (!btn) continue;

    if (btn.chatCommand && btn.chatCommand.enabled) {
      const cfg = normalizeChatCommandConfig(btn.chatCommand);
      if (!cfg || !cfg.keyword) continue;
      const triggerMethod = cfg.triggerMethod || 'command';
      if (triggerMethod !== 'command' && triggerMethod !== 'both') continue;
      if (messageMatchesChatCommand(message, cfg)) {
        matches.push({ btn, chatCommand: cfg });
      }
      continue;
    }

    if (!btn.chatCommand && btn.type === 'command' && btn.label && legacyCommandText) {
      if (String(btn.label).toLowerCase() === legacyCommandText) {
        matches.push({
          btn,
          chatCommand: normalizeChatCommandConfig({
            enabled: true,
            keyword: String(btn.label).toLowerCase(),
            requirePrefix: true,
            matchAnywhere: false,
          }),
        });
      }
    }
  }

  return matches;
}

function createChatCommandCooldownStore() {
  /** @type {Map<string, Map<string, number>>} */
  const byButton = new Map();

  return {
    isOnCooldown(buttonKey, username, cooldownSeconds) {
      const secs = Number(cooldownSeconds);
      if (!Number.isFinite(secs) || secs <= 0) return false;
      const bKey = String(buttonKey || '');
      const uKey = String(username || '').toLowerCase();
      if (!bKey || !uKey) return false;
      const userMap = byButton.get(bKey);
      if (!userMap) return false;
      const last = userMap.get(uKey);
      if (!last) return false;
      return Date.now() - last < secs * 1000;
    },
    record(buttonKey, username) {
      const bKey = String(buttonKey || '');
      const uKey = String(username || '').toLowerCase();
      if (!bKey || !uKey) return;
      let userMap = byButton.get(bKey);
      if (!userMap) {
        userMap = new Map();
        byButton.set(bKey, userMap);
      }
      userMap.set(uKey, Date.now());
    },
    reset() {
      byButton.clear();
    },
  };
}

/**
 * Build persisted chatCommand from editor field values.
 */
function buildChatCommandFromFields(fields) {
  const {
    enabled,
    keyword,
    redeemName,
    triggerMethod,
    requirePrefix,
    matchAnywhere,
    allowOverlappingRuns,
    perUserCooldownSeconds,
  } = fields || {};

  const keywordTrimmed = keyword != null ? String(keyword).trim() : '';
  const redeemTrimmed = redeemName != null ? String(redeemName).trim() : '';
  if (!enabled || (!keywordTrimmed && !redeemTrimmed)) return undefined;

  const cooldownRaw = Number(perUserCooldownSeconds);
  const cooldown =
    Number.isFinite(cooldownRaw) && cooldownRaw > 0 ? Math.floor(cooldownRaw) : 0;

  return normalizeChatCommandConfig({
    enabled: true,
    keyword: keywordTrimmed.toLowerCase(),
    redeemName: redeemTrimmed,
    triggerMethod: triggerMethod || 'command',
    requirePrefix: requirePrefix !== false,
    matchAnywhere: matchAnywhere === true,
    allowOverlappingRuns: allowOverlappingRuns === true,
    perUserCooldownSeconds: cooldown,
  });
}

module.exports = {
  normalizeChatCommandConfig,
  parseTriggerKeywords,
  messageContainsWholeWord,
  getFirstChatToken,
  messageMatchesChatCommand,
  findChatCommandTriggers,
  createChatCommandCooldownStore,
  buildChatCommandFromFields,
};
