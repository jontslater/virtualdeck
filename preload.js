const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  addMedia: (data) => ipcRenderer.send('add-media', data),
  deleteButton: (index) => ipcRenderer.send('delete-button', index),
  closeApp: () => ipcRenderer.send('close-app'),
  refreshHotkeys: () => ipcRenderer.send('refresh-hotkeys'),
  disableHotkeys: () => ipcRenderer.send('disable-hotkeys'),
  enableHotkeys: () => ipcRenderer.send('enable-hotkeys'),
  onTriggerMedia: (callback) => ipcRenderer.on('trigger-media', (event, mediaId) => callback(mediaId)),
  onRefreshUI: (callback) => ipcRenderer.on('refresh-ui', (event) => callback()),
  getConfig: async () => ipcRenderer.invoke('get-config'),
  getSoundPath: async (relativePath) => ipcRenderer.invoke('get-sound-path', relativePath),
  resolveShortcut: async (shortcutPath) => ipcRenderer.invoke('resolve-shortcut', shortcutPath),
  launchApp: (appData) => ipcRenderer.send('launch-app', appData),
  getAppIcon: async (filePath) => ipcRenderer.invoke('get-app-icon', filePath),
}); 
