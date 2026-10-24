//const twitchConnected = require('./TwitchConnected/tc.js');
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const vdPackaged = process.argv.some((arg) => arg === '--vd-packaged=1');
contextBridge.exposeInMainWorld('__VD_IS_PACKAGED__', vdPackaged);
let ravenAiControlLib = null;
try {
  ravenAiControlLib = require('./lib/raven-ai-control');
} catch (err) {
  console.error('[preload] raven-ai-control unavailable:', err && err.message ? err.message : err);
}
contextBridge.exposeInMainWorld('__ravenAiControlLib', ravenAiControlLib);

contextBridge.exposeInMainWorld('electronAPI', {
  addMedia: (data) => ipcRenderer.send('add-media', data),
  deleteButton: (index) => ipcRenderer.send('delete-button', index),
  refreshHotkeys: () => ipcRenderer.send('refresh-hotkeys'),
  disableHotkeys: () => ipcRenderer.send('disable-hotkeys'),
  enableHotkeys: () => ipcRenderer.send('enable-hotkeys'),
  // Synchronous parented alert/confirm that hands keyboard focus back to the page (public/dialog-shim.js)
  nativeDialog: (kind, message) => ipcRenderer.sendSync('vd-native-dialog', { kind: kind === 'confirm' ? 'confirm' : 'alert', message: String(message == null ? '' : message) }),
  // Suspend global shortcuts while typing in a VirtualDeck text field (public/input-focus-guard.js)
  setTextInputActive: (active) => ipcRenderer.send('text-input-active', !!active),
  onTriggerMedia: (callback) => ipcRenderer.on('trigger-media', (event, mediaId) => callback(mediaId)),
  onPlayAiTts: (callback) => ipcRenderer.on('play-ai-tts', (event, payload) => callback(payload)),
  onRefreshUI: (callback) => ipcRenderer.on('refresh-ui', (event) => callback()),
  getConfig: async () => ipcRenderer.invoke('get-config'),
  saveConfig: async (config) => ipcRenderer.invoke('save-config', config),
  updateConfig: async (configUpdate) => ipcRenderer.invoke('update-config', configUpdate),
  createTwitchClip: async (opts) => ipcRenderer.invoke('create-twitch-clip', opts || {}),
  listMacroDeckButtons: async () => ipcRenderer.invoke('list-macro-deck-buttons'),
  // Media file storage for multi-media buttons
  saveMediaFile: async (mediaData) => ipcRenderer.invoke('save-media-file', mediaData),
  saveMediaFileByPath: async (mediaData) => ipcRenderer.invoke('save-media-file-by-path', mediaData),
  saveAudioFileToSounds: async (mediaData) => ipcRenderer.invoke('save-audio-file-to-sounds', mediaData),
  getMediaFile: async (relativePath) => ipcRenderer.invoke('get-media-file', relativePath),
  getMediaFilePath: async (relativePath) => ipcRenderer.invoke('get-media-file-path', relativePath),
  getConnectedOverlays: async () => ipcRenderer.invoke('get-connected-overlays'),
  closeOverlayConnections: async (overlayName) => ipcRenderer.invoke('close-overlay-connections', overlayName),
  // Return persisted Twitch Client config (tc_config.json in userData)
  getTwitchConfig: async () => ipcRenderer.invoke('get-tc-config'),
  getSoundPath: async (relativePath) => ipcRenderer.invoke('get-sound-path', relativePath),
  resolveShortcut: async (shortcutPath) => ipcRenderer.invoke('resolve-shortcut', shortcutPath),
  launchApp: (appData) => ipcRenderer.send('launch-app', appData),
  getAppIcon: async (filePath) => ipcRenderer.invoke('get-app-icon', filePath),
  sendTwitchConnect: (creds) => ipcRenderer.send('twitch-connect', creds),
  onTwitchConnected: (callback) => ipcRenderer.on('twitch-connected', callback),
  onTwitchChatEvent: (callback) => ipcRenderer.on('twitch-chat-event', (event, eventData) => callback(eventData)),
  sendTwitchEventSubConnect: (creds) => ipcRenderer.send('twitch-eventsub-connect', creds),
  // Request a server-side aggregated list of active EventSub subscriptions
  listEventSubSubscriptions: async () => ipcRenderer.invoke('list-eventsub-subscriptions'),
  onTwitchEventSub: (callback) => ipcRenderer.on('twitch-eventsub', (event, eventData) => callback(eventData)),
  sendFakeTwitchEvent: (evt) => ipcRenderer.send('twitch-fake-event', evt),
  sendFakeTwitchEventHandle: async (evt) => ipcRenderer.invoke('send-fake-twitch-event', evt),
  // Event->Sound mappings
  getMappings: async () => ipcRenderer.invoke('get-event-mappings'),
  saveMapping: (mapping) => ipcRenderer.send('save-event-mapping', mapping),
  deleteMapping: (id) => ipcRenderer.send('delete-event-mapping', id),
  sendTrigger: (label) => ipcRenderer.send('trigger-media-to-main', label),
  // Fetch channel point rewards (if connected) to populate Redeem dropdown in UI
  getChannelRewards: async () => ipcRenderer.invoke('get-channel-rewards'),
  // Check whether a given user follows or subscribes to the connected channel
  checkUserFollows: async (username) => ipcRenderer.invoke('check-user-follows', username),
  checkUserSubscriber: async (username) => ipcRenderer.invoke('check-user-subscriber', username),
  checkUserVip: async (username) => ipcRenderer.invoke('check-user-vip', username),
  checkUserMod: async (username) => ipcRenderer.invoke('check-user-mod', username),
  checkUserSubTier: async (username) => ipcRenderer.invoke('check-user-sub-tier', username),
  // Get channel statistics
  isStreamLive: async () => ipcRenderer.invoke('is-stream-live'),
  getViewerCount: async () => ipcRenderer.invoke('get-viewer-count'),
  getFollowerCount: async () => ipcRenderer.invoke('get-follower-count'),
  getSubscriberStats: async () => ipcRenderer.invoke('get-subscriber-stats'),
  // Get recent activity
  getRecentFollowers: async () => ipcRenderer.invoke('get-recent-followers'),
  getRecentSubscribers: async () => ipcRenderer.invoke('get-recent-subscribers'),
  getFollowersWithUsers: async () => ipcRenderer.invoke('get-followers-with-users'),
  resetFirstTimeChatters: async () => ipcRenderer.invoke('reset-first-time-chatters'),
  getTwitchProfileImage: async (params) => ipcRenderer.invoke('get-twitch-profile-image', params),
  hasTwitchCreds: async () => ipcRenderer.invoke('has-twitch-creds'),
  // Clear stored Twitch credentials and shutdown connections
  clearTwitchCreds: (opts) => ipcRenderer.send('twitch-clear-creds', opts || {}),
  // Detailed result of clear operation
  onTwitchClearResult: (callback) => ipcRenderer.on('twitch-clear-result', (event, payload) => callback(payload)),
  onTwitchCleared: (callback) => ipcRenderer.on('twitch-cleared', (event) => callback()),
  onMappingSaveFailed: (callback) => ipcRenderer.on('mapping-save-failed', (event, payload) => callback(payload)),
  onMappingSaved: (callback) => ipcRenderer.on('mapping-saved', (event, payload) => callback(payload)),
  onMappingDeleted: (callback) => ipcRenderer.on('mapping-deleted', (event, payload) => callback(payload)),
  moveWindow: (position) => ipcRenderer.send('move-window', position),
  getWindowBounds: async () => ipcRenderer.invoke('get-window-bounds'),
  getAppVersion: async () => ipcRenderer.invoke('get-app-version'),
  onOpenTwitchActivity: (callback) => ipcRenderer.on('open-twitch-activity', callback),
  onOpenEventSubSubscriptions: (callback) => ipcRenderer.on('open-eventsub-subscriptions', callback),
  onClearTwitchCreds: (callback) => ipcRenderer.on('clear-twitch-creds', callback),
  onOpenTwitchMapping: (callback) => ipcRenderer.on('open-twitch-mapping', callback),
  onRendererReady: (callback) => ipcRenderer.on('renderer-ready', callback),
  // Allow renderer to request opening Preferences in main
  openPreferences: () => ipcRenderer.send('open-preferences'),
  // Persist UI button order (array of ids) to main process
  saveButtonOrder: (orderedIds) => ipcRenderer.send('save-button-order', orderedIds),
  onShowAbout: (callback) => ipcRenderer.on('show-about', callback),
  onOpenPreferences: (callback) => ipcRenderer.on('open-preferences', callback),
  onViewShowAll: (callback) => ipcRenderer.on('view-show-all', callback),
  onViewHideAll: (callback) => ipcRenderer.on('view-hide-all', callback),
  onViewToggle: (callback) => ipcRenderer.on('view-toggle', (event, payload) => callback(payload)),
  syncViewPrefs: (prefs) => ipcRenderer.send('sync-view-prefs', prefs),
  onThemeChange: (callback) => ipcRenderer.on('theme-change', (event, themeName) => callback(themeName)),
  syncTheme: (themeName) => ipcRenderer.send('sync-theme', themeName),
  // Window controls exposed to renderer
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', () => callback()),
  onWindowUnmaximized: (callback) => ipcRenderer.on('window-unmaximized', () => callback()),
  // Skin System APIs
  getAvailableSkins: async () => ipcRenderer.invoke('get-available-skins'),
  loadSkin: async (skinId) => ipcRenderer.invoke('load-skin', skinId),
  importSkin: async (filePath) => ipcRenderer.invoke('import-skin', filePath),
  // Request that the main process (and any other windows) apply a theme.
  // The main process will broadcast back a 'theme-change' event which the renderer listens for.
  applyTheme: (themeName) => ipcRenderer.send('request-apply-theme', themeName),
  showImportSkinDialog: async () => ipcRenderer.invoke('show-import-skin-dialog'),
  showDeleteSkinDialog: async () => ipcRenderer.invoke('show-delete-skin-dialog'),
  onSkinChange: (callback) => ipcRenderer.on('skin-change', (event, skinName) => callback(skinName)),
  onImportSkinDialog: (callback) => ipcRenderer.on('import-skin-dialog', callback),
  onDeleteSkinDialog: (callback) => ipcRenderer.on('delete-skin-dialog', callback),
  onRefreshMenu: (callback) => ipcRenderer.on('refresh-menu', callback),
  syncSkin: (skinName) => ipcRenderer.send('sync-skin', skinName),
  refreshMenu: () => ipcRenderer.send('refresh-menu'),
  // Toggle DevTools from renderer
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
  // Overlay communication (browser source)
  sendOverlayMessage: (message) => ipcRenderer.send('overlay-message', message),
  sendOverlayClearAll: () => ipcRenderer.send('overlay-clear-all'),
  sendOverlayText: (data) => ipcRenderer.send('overlay-text', data),
  sendOverlayImage: (data) => ipcRenderer.send('overlay-image', data),
  sendOverlayVideo: (data) => ipcRenderer.send('overlay-video', data),
  getOverlayUrl: async () => ipcRenderer.invoke('get-overlay-url'),
  getAuthToken: async () => ipcRenderer.invoke('get-auth-token'),
  getAuthTokenPath: async () => ipcRenderer.invoke('get-auth-token-path'),
  // Preferences and updates
  savePreferences: (preferences) => ipcRenderer.send('save-preferences', preferences),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, status) => callback(status)),
  // Daily Check-In System
  loadDailyCheckins: async () => ipcRenderer.invoke('loadDailyCheckins'),
  saveDailyCheckins: async (data) => ipcRenderer.invoke('saveDailyCheckins', data),
  backupDailyCheckins: async () => ipcRenderer.invoke('backup-daily-checkins'),
  restoreDailyCheckins: async () => ipcRenderer.invoke('restore-daily-checkins'),
  onDailyCheckinsRestored: (callback) =>
    ipcRenderer.on('daily-checkins-restored', (_event, data) => callback(data)),
  sendTwitchChatMessage: async (message) => ipcRenderer.invoke('sendTwitchChatMessage', message),
  // Bug Report
  reportBug: async () => ipcRenderer.invoke('report-bug'),
  // Profile Management
  getProfiles: async () => ipcRenderer.invoke('get-profiles'),
  getProfile: async (profileId) => ipcRenderer.invoke('get-profile', profileId),
  saveProfile: async (profileId, profileData) => ipcRenderer.invoke('save-profile', { profileId, profileData }),
  createProfile: async (profileName) => ipcRenderer.invoke('create-profile', profileName),
  duplicateProfile: async (sourceProfileId, newProfileName) => ipcRenderer.invoke('duplicate-profile', { sourceProfileId, newProfileName }),
  renameProfile: async (profileId, newName) => ipcRenderer.invoke('rename-profile', { profileId, newName }),
  deleteProfile: async (profileId) => ipcRenderer.invoke('delete-profile', profileId),
  switchProfile: async (profileId) => ipcRenderer.invoke('switch-profile', profileId),
  // JARVIS tool API integration
  onJarvisChangeScene: (callback) => ipcRenderer.on('jarvis-change-scene', (event, data) => callback(data)),
  onJarvisGetScenes: (callback) => ipcRenderer.on('jarvis-get-scenes', () => callback()),
  sendJarvisScenesResponse: (scenes) => ipcRenderer.send('jarvis-scenes-response', scenes),
  listStreamingScenes: (opts) => ipcRenderer.invoke('list-streaming-scenes', opts || {}),
  getObsSceneConfig: () => ipcRenderer.invoke('get-obs-scene-config'),
  setObsSceneConfig: (data) => ipcRenderer.invoke('set-obs-scene-config', data || {}),
  onSceneProviderRequest: (callback) => ipcRenderer.on('scene-provider-request', (event, data) => callback(data)),
  sendSceneProviderResponse: (msg) => ipcRenderer.send('scene-provider-response', msg),
  onJarvisRefreshBrowserSources: (callback) => ipcRenderer.on('jarvis-refresh-browser-sources', (event, data) => callback(data)),
  // Macro Management
  getMacros: async () => ipcRenderer.invoke('get-macros'),
  getMacro: async (id) => ipcRenderer.invoke('get-macro', id),
  saveMacro: async (id, macro) => ipcRenderer.invoke('save-macro', { id, macro }),
  deleteMacro: async (id) => ipcRenderer.invoke('delete-macro', id),
  executeMacro: async (id) => ipcRenderer.invoke('execute-macro', id),
  checkMacroHotkey: async (id, hotkey) => ipcRenderer.invoke('check-macro-hotkey', { id, hotkey }),
  onMacroExecuted: (callback) => ipcRenderer.on('macro-executed', (event, data) => callback(data)),
  previewAiVoice: async (payload) => ipcRenderer.invoke('preview-ai-voice', payload),
  // Raid favorites
  raidFavoritesGet: async () => ipcRenderer.invoke('raid-favorites-get'),
  raidFavoritesAdd: async (payload) => ipcRenderer.invoke('raid-favorites-add', payload),
  raidFavoritesRemove: async (payload) => ipcRenderer.invoke('raid-favorites-remove', payload),
  raidFavoritesReorder: async (payload) => ipcRenderer.invoke('raid-favorites-reorder', payload),
  raidFavoritesUpdateNote: async (payload) => ipcRenderer.invoke('raid-favorites-update-note', payload),
  raidFavoritesAddFromHistory: async (payload) => ipcRenderer.invoke('raid-favorites-add-from-history', payload),
  raidFavoritesLiveCheck: async (payload) => ipcRenderer.invoke('raid-favorites-live-check', payload),
  raidFavoritesStartRaid: async (payload) => ipcRenderer.invoke('raid-favorites-start-raid', payload),
  raidFavoritesCancelRaid: async () => ipcRenderer.invoke('raid-favorites-cancel-raid'),
  checkTwitchRaidScope: async () => ipcRenderer.invoke('check-twitch-raid-scope'),
  getTwitchOAuthAuthorizeUrl: async () => ipcRenderer.invoke('get-twitch-oauth-authorize-url'),
  getPathForFile: (file) => {
    try {
      if (file && webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) { /* ignore */ }
    return (file && file.path) || '';
  },
  twitchOAuthStart: async () => ipcRenderer.invoke('twitch-oauth-start'),
  twitchOAuthCancel: async () => ipcRenderer.invoke('twitch-oauth-cancel'),
  twitchOAuthGetStatus: async () => ipcRenderer.invoke('twitch-oauth-get-status'),
  twitchOAuthRestoreSession: async () => ipcRenderer.invoke('twitch-oauth-restore-session'),
  ravenDevSpeak: async (payload) => ipcRenderer.invoke('raven-dev-speak', payload),
  twitchEventSubHealth: async () => ipcRenderer.invoke('twitch-eventsub-health'),
  onTwitchOAuthProgress: (callback) => ipcRenderer.on('twitch-oauth-progress', (_event, data) => callback(data)),
  onTwitchOAuthSuccess: (callback) => ipcRenderer.on('twitch-oauth-success', (_event, data) => callback(data)),
  onRaidFavoritesHistoryUpdated: (callback) => ipcRenderer.on('raid-favorites-history-updated', (_event, data) => callback(data)),
  // Licensing (entitlements enforced in main process)
  licenseGetStatus: async () => ipcRenderer.invoke('license-get-status'),
  licenseGetDeckEntitlements: async () => ipcRenderer.invoke('license-get-deck-entitlements'),
  licenseActivate: async (licenseKey) => ipcRenderer.invoke('license-activate', licenseKey),
  licenseDeactivate: async () => ipcRenderer.invoke('license-deactivate'),
  licenseRevalidate: async () => ipcRenderer.invoke('license-revalidate'),
  onLicenseStatusChanged: (callback) => ipcRenderer.on('license-status-changed', (_event, status) => callback(status)),
  onLicenseUpsell: (callback) => ipcRenderer.on('license-upsell', (_event, payload) => callback(payload)),
  ravenGetSetupStatus: async () => ipcRenderer.invoke('raven-get-setup-status'),
  ravenSaveApiKeys: async (payload) => ipcRenderer.invoke('raven-save-api-keys', payload || {}),
  ravenOpenEnvFile: async () => ipcRenderer.invoke('raven-open-env-file'),
  ravenStart: async () => ipcRenderer.invoke('raven-start'),
  ravenStop: async () => ipcRenderer.invoke('raven-stop'),
  ravenRestart: async () => ipcRenderer.invoke('raven-restart'),
  ravenIsRunning: async () => ipcRenderer.invoke('raven-is-running'),
  ravenConnectionStatus: async () => ipcRenderer.invoke('raven-connection-status'),
  ravenTestLlmKey: async (payload) => ipcRenderer.invoke('raven-test-llm-key', payload || {}),
  ravenTestTtsKey: async (payload) => ipcRenderer.invoke('raven-test-tts-key', payload || {}),
});
