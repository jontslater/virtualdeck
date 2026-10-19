/**
 * GitHub Releases auto-update (electron-updater) with graceful error handling.
 */

const GITHUB_RELEASES_URL = 'https://github.com/jontslater/virtualdeck/releases/latest';

/**
 * Map electron-updater / network errors to user-facing copy.
 * @param {Error & { statusCode?: number }} err
 * @returns {{ code: string, title: string, detail: string, silent: boolean }}
 */
function classifyUpdateError(err) {
  const message = String((err && err.message) || err || '').toLowerCase();
  const status = err && err.statusCode;

  if (
    message.includes('net::') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('getaddrinfo')
  ) {
    return {
      code: 'offline',
      title: 'No connection',
      detail:
        'VirtualDeck could not reach GitHub to check for updates. Check your internet connection and try again.',
      silent: false,
    };
  }

  if (status === 403 || message.includes('rate limit') || message.includes('api rate limit')) {
    return {
      code: 'rate_limit',
      title: 'GitHub rate limit',
      detail:
        'Update check was rate-limited by GitHub. Wait a few minutes and try again, or download the installer from the releases page.',
      silent: false,
    };
  }

  if (
    status === 404 ||
    message.includes('404') ||
    message.includes('latest.yml') ||
    message.includes('cannot find') ||
    message.includes('no published versions')
  ) {
    return {
      code: 'no_release',
      title: 'No update feed',
      detail:
        'No compatible update was found on GitHub Releases. You may already be on the latest build, or this install was not built with the public updater feed.',
      silent: true,
    };
  }

  if (message.includes('not signed') || message.includes('signature')) {
    return {
      code: 'unsigned',
      title: 'Unsigned build',
      detail:
        'This installer is unsigned. Windows may still apply updates from GitHub, but SmartScreen can block downloads. You can install manually from the releases page.',
      silent: false,
    };
  }

  if (message.includes('dev') || message.includes('not packed') || message.includes('application is not packed')) {
    return {
      code: 'not_packaged',
      title: 'Updates require the installed app',
      detail:
        'Auto-update only works in the NSIS-installed VirtualDeck build, not when running from source (`npm start`).',
      silent: false,
    };
  }

  return {
    code: 'unknown',
    title: 'Update check failed',
    detail: (err && err.message) || 'Please try again later or download from GitHub Releases.',
    silent: false,
  };
}

/**
 * @param {object} deps
 * @param {import('electron-updater').AppUpdater} deps.autoUpdater
 * @param {import('electron').Dialog} deps.dialog
 * @param {import('electron').Shell} deps.shell
 * @param {() => import('electron').BrowserWindow | null} deps.getWin
 * @param {() => object} deps.getPreferences
 * @param {(channel: string, payload?: object) => void} deps.sendToRenderer
 * @param {() => boolean} deps.isPackaged
 */
function createAppUpdater(deps) {
  const { autoUpdater, dialog, shell, getWin, getPreferences, sendToRenderer, isPackaged } = deps;
  let listenersAttached = false;
  /** @type {'idle'|'checking'|'available'|'downloading'|'downloaded'|'error'} */
  let phase = 'idle';
  let lastManualCheck = false;

  function notify(channel, payload) {
    try {
      sendToRenderer(channel, payload);
    } catch (e) {
      console.warn('[Updater]', channel, e && e.message);
    }
  }

  function showDialog(options) {
    const win = getWin();
    if (win && !win.isDestroyed()) {
      return dialog.showMessageBox(win, options);
    }
    return dialog.showMessageBox(options);
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    const isMac = process.platform === 'darwin';
    const isWindows = process.platform === 'win32';

    autoUpdater.on('checking-for-update', () => {
      phase = 'checking';
      notify('update-status', { phase, message: 'Checking for updates…' });
      console.log('[Updater] Checking for updates…');
    });

    autoUpdater.on('update-available', (info) => {
      phase = 'available';
      notify('update-status', {
        phase,
        version: info.version,
        message: `Update ${info.version} is available`,
      });
      console.log('[Updater] Update available:', info.version);

      if (isMac) {
        showDialog({
          type: 'info',
          title: 'Update Available',
          message: `A new version (${info.version}) is available!`,
          detail: 'Download the latest installer from GitHub Releases.',
          buttons: ['Open GitHub Releases', 'Later'],
          defaultId: 0,
        }).then((result) => {
          if (result.response === 0) shell.openExternal(GITHUB_RELEASES_URL);
        });
        return;
      }

      if (isWindows) {
        showDialog({
          type: 'info',
          title: 'Update Available',
          message: `VirtualDeck ${info.version} is available`,
          detail: 'Download now? You can keep using the app while the installer downloads.',
          buttons: ['Download', 'Later'],
          defaultId: 0,
        }).then((result) => {
          if (result.response === 0) {
            phase = 'downloading';
            notify('update-status', { phase, percent: 0, message: 'Starting download…' });
            autoUpdater.downloadUpdate().catch((err) => handleError(err));
          }
        });
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      phase = 'idle';
      notify('update-status', {
        phase: 'idle',
        version: info.version,
        message: 'You are on the latest version',
      });
      console.log('[Updater] Up to date:', info.version);
      if (lastManualCheck) {
        showDialog({
          type: 'info',
          title: 'No Updates',
          message: 'You are up to date',
          detail: `VirtualDeck ${info.version} is the latest release on GitHub.`,
          buttons: ['OK'],
        });
      }
      lastManualCheck = false;
    });

    autoUpdater.on('download-progress', (progressObj) => {
      phase = 'downloading';
      const percent = Math.round(progressObj.percent || 0);
      notify('update-status', {
        phase,
        percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
        message: `Downloading update… ${percent}%`,
      });
      console.log(`[Updater] Download ${percent}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      phase = 'downloaded';
      notify('update-status', {
        phase,
        version: info.version,
        message: 'Update ready to install',
      });
      console.log('[Updater] Downloaded:', info.version);

      showDialog({
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded successfully',
        detail: 'Restart VirtualDeck to install the update. You can also wait — it will install on quit if you enabled that behavior.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    });

    function handleError(err) {
      phase = 'error';
      const classified = classifyUpdateError(err);
      notify('update-status', {
        phase: 'error',
        code: classified.code,
        message: classified.detail,
      });
      console.error('[Updater] Error:', err);

      const shouldShow = lastManualCheck || !classified.silent;
      lastManualCheck = false;
      if (!shouldShow) return;

      const buttons =
        classified.code === 'offline' || classified.code === 'rate_limit'
          ? ['Open Releases Page', 'OK']
          : ['OK'];
      showDialog({
        type: classified.code === 'unknown' ? 'error' : 'warning',
        title: classified.title,
        message: classified.title,
        detail: classified.detail,
        buttons,
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0 && buttons[0] === 'Open Releases Page') {
          shell.openExternal(GITHUB_RELEASES_URL);
        }
      });
    }

    autoUpdater.on('error', handleError);
  }

  function canCheck() {
    if (!isPackaged()) {
      return { ok: false, reason: 'not_packaged' };
    }
    if (process.env.VD_DISABLE_AUTO_UPDATE === '1') {
      return { ok: false, reason: 'disabled_env' };
    }
    return { ok: true };
  }

  async function checkForUpdates(options = {}) {
    const manual = Boolean(options.manual);
    lastManualCheck = manual;
    attachListeners();

    const gate = canCheck();
    if (!gate.ok) {
      const classified = classifyUpdateError(
        new Error(
          gate.reason === 'not_packaged'
            ? 'Application is not packed'
            : 'Auto-update disabled by VD_DISABLE_AUTO_UPDATE',
        ),
      );
      notify('update-status', { phase: 'error', code: classified.code, message: classified.detail });
      if (manual) {
        showDialog({
          type: 'info',
          title: classified.title,
          message: classified.title,
          detail: classified.detail,
          buttons: ['OK'],
        });
      }
      return { success: false, reason: gate.reason };
    }

    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err) {
      classifyUpdateError(err);
      autoUpdater.emit('error', err);
      return { success: false, error: err };
    }
  }

  function maybeCheckOnStartup() {
    attachListeners();
    const prefs = getPreferences();
    if (prefs.autoUpdate === false) {
      console.log('[Updater] Startup check skipped (preferences)');
      return;
    }
    const gate = canCheck();
    if (!gate.ok) {
      console.log('[Updater] Startup check skipped:', gate.reason);
      return;
    }
    lastManualCheck = false;
    autoUpdater.checkForUpdates().catch((err) => {
      console.log('[Updater] Startup check failed (non-fatal):', err && err.message);
    });
  }

  return {
    attachListeners,
    checkForUpdates,
    maybeCheckOnStartup,
    classifyUpdateError,
    canCheck,
    getPhase: () => phase,
  };
}

module.exports = { createAppUpdater, classifyUpdateError, GITHUB_RELEASES_URL };
