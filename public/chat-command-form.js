/**
 * Renderer helpers for Twitch chat command editor fields (mirrors lib/twitch-chat-command.js defaults).
 */
(function (global) {
  function readChatCommandAdvancedOptions(prefix) {
    const p = prefix ? `${prefix}-` : '';
    const requirePrefixEl = document.getElementById(`${p}chat-command-require-prefix`);
    const matchAnywhereEl = document.getElementById(`${p}chat-command-match-anywhere`);
    const allowOverlapEl = document.getElementById(`${p}chat-command-allow-overlap`);
    const cooldownEl = document.getElementById(`${p}chat-command-user-cooldown`);

    const requirePrefix = requirePrefixEl ? requirePrefixEl.checked : true;
    const matchAnywhere = matchAnywhereEl ? matchAnywhereEl.checked : false;
    const allowOverlappingRuns = allowOverlapEl ? allowOverlapEl.checked : false;
    const rawCooldown = cooldownEl ? parseInt(cooldownEl.value, 10) : 0;
    const perUserCooldownSeconds =
      Number.isFinite(rawCooldown) && rawCooldown > 0 ? Math.floor(rawCooldown) : 0;

    return {
      requirePrefix,
      matchAnywhere,
      allowOverlappingRuns,
      perUserCooldownSeconds,
    };
  }

  function applyChatCommandAdvancedOptions(prefix, chatCommand) {
    const p = prefix ? `${prefix}-` : '';
    const cfg = chatCommand || {};
    const requirePrefixEl = document.getElementById(`${p}chat-command-require-prefix`);
    const matchAnywhereEl = document.getElementById(`${p}chat-command-match-anywhere`);
    const allowOverlapEl = document.getElementById(`${p}chat-command-allow-overlap`);
    const cooldownEl = document.getElementById(`${p}chat-command-user-cooldown`);

    if (requirePrefixEl) {
      requirePrefixEl.checked = cfg.requirePrefix !== false;
    }
    if (matchAnywhereEl) {
      matchAnywhereEl.checked = cfg.matchAnywhere === true;
    }
    if (allowOverlapEl) {
      allowOverlapEl.checked = cfg.allowOverlappingRuns === true;
    }
    if (cooldownEl) {
      const secs = Number(cfg.perUserCooldownSeconds);
      cooldownEl.value =
        Number.isFinite(secs) && secs > 0 ? String(Math.floor(secs)) : '0';
    }
  }

  function resetChatCommandAdvancedOptions(prefix) {
    applyChatCommandAdvancedOptions(prefix, {
      requirePrefix: true,
      matchAnywhere: false,
      allowOverlappingRuns: false,
      perUserCooldownSeconds: 0,
    });
  }

  function buildChatCommandPayload({
    enabled,
    keyword,
    redeemName,
    triggerMethod,
    prefix,
  }) {
    if (!enabled || (!keyword && !redeemName)) return undefined;
    const advanced = readChatCommandAdvancedOptions(prefix);
    return {
      enabled: true,
      keyword: String(keyword || '').trim().toLowerCase(),
      redeemName: redeemName || '',
      triggerMethod: triggerMethod || 'command',
      requirePrefix: advanced.requirePrefix,
      matchAnywhere: advanced.matchAnywhere,
      allowOverlappingRuns: advanced.allowOverlappingRuns,
      perUserCooldownSeconds: advanced.perUserCooldownSeconds,
    };
  }

  global.VDChatCommandForm = {
    readChatCommandAdvancedOptions,
    applyChatCommandAdvancedOptions,
    resetChatCommandAdvancedOptions,
    buildChatCommandPayload,
  };
})(typeof window !== 'undefined' ? window : globalThis);
