const fs = require('fs');
const path = require('path');
const {
  migrateHydrationConfig,
  buildHydrationBroadcastData,
  applyHydrationDelta,
  undoLastHydrationDelta,
  resolveStreamLiveTransition,
  shouldResetForGoLive,
  shouldResetAtMidnight,
  applyMidnightReset,
  resetHydrationProgress,
  DEFAULT_HYDRATION_CONFIG,
} = require('./hydration-config');
const { isHydrationRewardRedemption } = require('./hydration-redemption');

/**
 * @param {string} hydrationConfigPath
 */
function createHydrationService(hydrationConfigPath) {
  let midnightTimer = null;
  let reminderTimer = null;

  function loadHydrationConfig() {
    try {
      if (fs.existsSync(hydrationConfigPath)) {
        return migrateHydrationConfig(JSON.parse(fs.readFileSync(hydrationConfigPath, 'utf-8')));
      }
    } catch (e) {
      console.error('Error loading hydration config:', e);
    }
    return migrateHydrationConfig({ ...DEFAULT_HYDRATION_CONFIG });
  }

  function saveHydrationConfig(cfg) {
    const migrated = migrateHydrationConfig(cfg);
    try {
      fs.writeFileSync(hydrationConfigPath, JSON.stringify(migrated, null, 2));
      console.log('Hydration config saved');
    } catch (e) {
      console.error('Error saving hydration config:', e);
    }
    return migrated;
  }

  function makeBroadcastPayload(config, extras = {}) {
    const data = buildHydrationBroadcastData(config);
    return {
      type: 'hydrationUpdate',
      data: { ...data, ...extras },
    };
  }

  function broadcastHydrationUpdate(overlayClients, config, extras = {}) {
    const payload = makeBroadcastPayload(config, extras);
    overlayClients.forEach((client) => {
      if (client.readyState === 1) {
        try {
          client.send(JSON.stringify(payload));
        } catch (error) {
          console.error('Error broadcasting hydration update:', error);
        }
      }
    });
    return payload;
  }

  function broadcastHydrationSound(overlayClients, config, which) {
    const rel = which === 'goal' ? config.goalSoundPath : config.soundPath;
    const volume = which === 'goal' ? config.goalSoundVolume : config.soundVolume;
    if (!config.soundEnabled || !rel) return;
    const msg = { type: 'hydrationPlaySound', data: { path: rel, volume: volume ?? 0.7 } };
    overlayClients.forEach((client) => {
      if (client.readyState === 1) {
        try {
          client.send(JSON.stringify(msg));
        } catch (e) {
          console.error('Error broadcasting hydration sound:', e);
        }
      }
    });
  }

  function incrementHydration(overlayClients, amount, source, opts = {}) {
    let config = loadHydrationConfig();
    const before = config.currentProgress;
    const delta =
      amount === undefined || amount === null || Number.isNaN(Number(amount))
        ? config.incrementAmount
        : Number(amount);
    const result = applyHydrationDelta(config, delta, { source });
    config = saveHydrationConfig(result.config);
    const payload = broadcastHydrationUpdate(overlayClients, config, {
      leveledUp: result.leveledUp,
      celebration: result.goalMet && config.goalConfetti !== false,
      previous: before,
    });
    if (result.goalMet && config.goalSoundPath) {
      broadcastHydrationSound(overlayClients, config, 'goal');
    } else if (result.leveledUp && config.soundPath) {
      broadcastHydrationSound(overlayClients, config, 'log');
    }
    if (opts.notifyRenderer && opts.win && !opts.win.isDestroyed()) {
      opts.win.webContents.send('hydration-state-changed', buildHydrationBroadcastData(config));
    }
    return { success: true, config, ...result, payload };
  }

  function tryHandleRedemption(overlayClients, event, opts = {}) {
    const config = loadHydrationConfig();
    if (!isHydrationRewardRedemption(event, config)) return false;
    incrementHydration(overlayClients, config.incrementAmount, 'redeem', opts);
    return true;
  }

  function scheduleMidnightCheck(onTick) {
    if (midnightTimer) clearInterval(midnightTimer);
    midnightTimer = setInterval(onTick, 60 * 1000);
  }

  function scheduleReminderCheck(onTick) {
    if (reminderTimer) clearInterval(reminderTimer);
    reminderTimer = setInterval(onTick, 60 * 1000);
  }

  function stopSchedulers() {
    if (midnightTimer) clearInterval(midnightTimer);
    if (reminderTimer) clearInterval(reminderTimer);
    midnightTimer = null;
    reminderTimer = null;
  }

  return {
    loadHydrationConfig,
    saveHydrationConfig,
    makeBroadcastPayload,
    broadcastHydrationUpdate,
    broadcastHydrationSound,
    incrementHydration,
    undoLastHydrationDelta: (overlayClients, opts = {}) => {
      let config = loadHydrationConfig();
      const { config: next, undone, amount } = undoLastHydrationDelta(config);
      if (!undone) return { success: false, error: 'Nothing to undo' };
      config = saveHydrationConfig(next);
      broadcastHydrationUpdate(overlayClients, config);
      if (opts.win && !opts.win.isDestroyed()) {
        opts.win.webContents.send('hydration-state-changed', buildHydrationBroadcastData(config));
      }
      return { success: true, config, amount };
    },
    resetHydration: (overlayClients, opts = {}) => {
      let config = loadHydrationConfig();
      config = saveHydrationConfig(resetHydrationProgress(config));
      broadcastHydrationUpdate(overlayClients, config);
      if (opts.win && !opts.win.isDestroyed()) {
        opts.win.webContents.send('hydration-state-changed', buildHydrationBroadcastData(config));
      }
      return { success: true, config };
    },
    tryHandleRedemption,
    resolveStreamLiveTransition,
    shouldResetForGoLive,
    shouldResetAtMidnight,
    applyMidnightReset,
    scheduleMidnightCheck,
    scheduleReminderCheck,
    stopSchedulers,
    getHydrationUrl: (port) => `http://localhost:${port || 8080}/hydration`,
  };
}

module.exports = { createHydrationService };