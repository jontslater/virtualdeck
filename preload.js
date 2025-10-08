//const twitchConnected = require('./TwitchConnected/tc.js');
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  addMedia: (data) => ipcRenderer.send('add-media', data),
  deleteButton: (index) => ipcRenderer.send('delete-button', index),
  refreshHotkeys: () => ipcRenderer.send('refresh-hotkeys'),
  disableHotkeys: () => ipcRenderer.send('disable-hotkeys'),
  enableHotkeys: () => ipcRenderer.send('enable-hotkeys'),
  onTriggerMedia: (callback) => ipcRenderer.on('trigger-media', (event, mediaId) => callback(mediaId)),
  onRefreshUI: (callback) => ipcRenderer.on('refresh-ui', (event) => callback()),
  getConfig: async () => ipcRenderer.invoke('get-config'),
  saveConfig: async (config) => ipcRenderer.invoke('save-config', config),
  updateConfig: async (configUpdate) => ipcRenderer.invoke('update-config', configUpdate),
  // Media file storage for multi-media buttons
  saveMediaFile: async (mediaData) => ipcRenderer.invoke('save-media-file', mediaData),
  saveMediaFileByPath: async (mediaData) => ipcRenderer.invoke('save-media-file-by-path', mediaData),
  getMediaFile: async (relativePath) => ipcRenderer.invoke('get-media-file', relativePath),
  getMediaFilePath: async (relativePath) => ipcRenderer.invoke('get-media-file-path', relativePath),
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
  getViewerCount: async () => ipcRenderer.invoke('get-viewer-count'),
  getFollowerCount: async () => ipcRenderer.invoke('get-follower-count'),
  getSubscriberStats: async () => ipcRenderer.invoke('get-subscriber-stats'),
  // Get recent activity
  getRecentFollowers: async () => ipcRenderer.invoke('get-recent-followers'),
  getRecentSubscribers: async () => ipcRenderer.invoke('get-recent-subscribers'),
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
});
