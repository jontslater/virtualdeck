const { app, BrowserWindow, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra'); // helpful for file copying
const { ipcMain } = require('electron');
const ws = require('windows-shortcuts'); // Import windows-shortcuts
const { execFile } = require('child_process');
const extractIcon = require('extract-file-icon');
const { nativeImage } = require('electron');

// Use Electron's userData directory for config and user files
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');
const userSoundsDir = path.join(userDataPath, 'sounds');
const defaultConfigPath = path.join(__dirname, 'config.json');
const defaultSoundsDir = path.join(__dirname, 'public', 'assets', 'sounds');

// Ensure config and sounds exist in userData on first run
function ensureUserData() {
  if (!fs.existsSync(configPath)) {
    fse.copySync(defaultConfigPath, configPath);
  }
  if (!fs.existsSync(userSoundsDir)) {
    fse.ensureDirSync(userSoundsDir);
    if (fs.existsSync(defaultSoundsDir)) {
      fse.copySync(defaultSoundsDir, userSoundsDir);
    }
  }
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 800,
    alwaysOnTop: true,
    frame: false,
    movable: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'public/index.html'));
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Developer Tools',
      accelerator: 'F12',
      click: () => {
        win.webContents.toggleDevTools();
      }
    },
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        win.reload();
      }
    }
  ]);
  
  // Set context menu
  win.webContents.on('context-menu', (e, params) => {
    contextMenu.popup({ window: win });
  });
}

ipcMain.on('add-media', (event, data) => {
  console.log('add-media received:', data);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Handle app files differently than audio files
  if (data.type === 'app') {
    console.log('Processing as app file, using original path:', data.originalPath);
    // For app files, just store the path without copying
    data.targetPath = data.originalPath;
  } else {
    console.log('Processing as audio file');
    // Only copy file if it's a new file (not editing existing) and it's an audio file
    if (data.originalPath !== data.targetPath) {
      // Save to userData/sounds
      const ext = path.extname(data.originalPath);
      const safeLabel = data.label.replace(/[^a-z0-9_\-]/gi, '_');
      const destFile = path.join(userSoundsDir, `${safeLabel}${ext}`);
      
      console.log('Copying audio file from:', data.originalPath, 'to:', destFile);
      
      // Check if source file exists before copying
      if (!fs.existsSync(data.originalPath)) {
        console.error('Source file does not exist:', data.originalPath);
        throw new Error(`Source file does not exist: ${data.originalPath}`);
      }
      
      try {
        fse.copySync(data.originalPath, destFile);
        data.targetPath = path.relative(userDataPath, destFile).replace(/\\/g, '/');
        console.log('Audio file copied successfully, target path:', data.targetPath);
      } catch (error) {
        console.error('Error copying audio file:', error);
        throw error;
      }
    } else if (typeof data.editingIndex === 'number') {
      // Editing, no new file selected
      const oldButton = config.buttons[data.editingIndex];
      const oldLabel = oldButton.label;
      const oldSrc = oldButton.src;
      const ext = path.extname(oldSrc);
      const oldFilePath = path.join(userDataPath, oldSrc);
      const newFileName = `${data.label}${ext}`;
      const newFilePath = path.join(path.dirname(oldFilePath), newFileName);
      const newTargetPath = path.relative(userDataPath, newFilePath).replace(/\\/g, '/');
      // If label changed and file exists and file name doesn't match new label
      if (data.label !== oldLabel && fs.existsSync(oldFilePath) && !oldSrc.endsWith(newFileName)) {
        try {
          fs.renameSync(oldFilePath, newFilePath);
          data.targetPath = newTargetPath;
        } catch (err) {
          data.targetPath = oldSrc; // fallback
        }
      }
    }
  }

  const newButton = {
    label: data.label,
    type: data.type,
    src: data.targetPath,
    hotkey: data.hotkey || undefined,
    args: data.args || undefined
  };

  if (typeof data.editingIndex === 'number') {
    config.buttons[data.editingIndex] = newButton;
  } else {
    config.buttons.push(newButton);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  //checking if data is still here after write
  //console.log('Data still here?',data);
});

ipcMain.on('delete-button', (event, index) => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const removed = config.buttons.splice(index, 1);
  
  // Delete the audio file from disk
  if (removed[0] && removed[0].src) {
    const filePath = path.join(userDataPath, removed[0].src);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      // File might not exist or be locked, continue anyway
    }
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  // Notify renderer to refresh the UI
  if (win && !win.isDestroyed()) {
    win.webContents.send('refresh-ui');
  }
});

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('refresh-hotkeys', () => {
  registerHotkeys();
});

ipcMain.on('disable-hotkeys', () => {
  globalShortcut.unregisterAll();
});
ipcMain.on('enable-hotkeys', () => {
  registerHotkeys();
});

// IPC handler to get config
ipcMain.handle('get-config', async () => {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return { buttons: [] };
  }
});

// IPC handler to get sound path
ipcMain.handle('get-sound-path', async (event, relativePath) => {
  return path.join(userDataPath, relativePath);
});

// IPC handler to resolve shortcut paths
ipcMain.handle('resolve-shortcut', async (event, shortcutPath) => {
  try {
    console.log('Attempting to resolve shortcut:', shortcutPath);
    
    // Check if the shortcut file exists
    if (!fs.existsSync(shortcutPath)) {
      console.error('Shortcut file does not exist:', shortcutPath);
      return null;
    }
    
    return new Promise((resolve, reject) => {
      ws.query(shortcutPath, (err, shortcut) => {
        if (err) {
          console.error('Error querying shortcut:', err);
          // Return original path as fallback
          resolve({ target: shortcutPath, args: '' });
        } else {
          console.log('Shortcut resolved successfully:', shortcut);
          // Return both target and args
          resolve({ 
            target: shortcut.target, 
            args: shortcut.args || '' 
          });
        }
      });
    });
    
  } catch (error) {
    console.error('Error resolving shortcut:', error);
    return { target: shortcutPath, args: '' }; // Return original path as fallback
  }
});

ipcMain.on('launch-app', async (event, appData) => {
  const { path: appPath, args } = appData;
  console.log('Launching app:', appPath, args);
  
  let finalPath = appPath;
  let finalArgs = args || '';
  let isUWPShortcut = false;

  // Known UWP AppUserModelIDs for fallback
  const uwpAppIds = {
    spotify: 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify',
    // Add more as needed: 'appname': 'AppUserModelID'
  };

  // If the path is a shortcut (.lnk file), resolve it first
  if (appPath.toLowerCase().endsWith('.lnk')) {
    try {
      console.log('Resolving shortcut before launch:', appPath);
      const shortcut = await new Promise((resolve, reject) => {
        ws.query(appPath, (err, shortcut) => {
          if (err) {
            console.error('Error querying shortcut:', err);
            resolve(null);
          } else {
            console.log('Shortcut resolved successfully:', shortcut);
            resolve(shortcut);
          }
        });
      });
      
      if (shortcut && shortcut.target) {
        finalPath = shortcut.target;
        finalArgs = shortcut.args || args || '';
        console.log('Using resolved path:', finalPath, 'with args:', finalArgs);
      } else {
        // UWP/Store app detection: If shortcut target is empty, try to extract AppUserModelID from .lnk path or filename
        const lnkName = path.basename(appPath, '.lnk').toLowerCase();
        // Check for known UWP apps by filename
        for (const [key, appId] of Object.entries(uwpAppIds)) {
          if (lnkName.includes(key)) {
            isUWPShortcut = true;
            finalPath = `shell:AppsFolder\\${appId}`;
            console.log(`Detected UWP/Store app shortcut for '${key}'. Will launch with explorer.exe`, finalPath);
            break;
          }
        }
        // If not found, try to extract from path
        if (!isUWPShortcut) {
          const appsFolderMatch = appPath.match(/AppsFolder\\([^!]+![^\\]+)/i);
          if (appsFolderMatch) {
            const appId = appsFolderMatch[1];
            isUWPShortcut = true;
            finalPath = `shell:AppsFolder\\${appId}`;
            console.log('Detected UWP/Store app shortcut. Will launch with explorer.exe', finalPath);
          } else {
            // Try to extract AppUserModelID from the .lnk file path (common for desktop shortcuts)
            const possibleAppId = lnkName.match(/([\w.]+_[\w]+![\w]+)/);
            if (possibleAppId) {
              isUWPShortcut = true;
              finalPath = `shell:AppsFolder\\${possibleAppId[1]}`;
              console.log('Detected UWP/Store app shortcut by name. Will launch with explorer.exe', finalPath);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error resolving shortcut during launch:', error);
    }
  }
  
  if (isUWPShortcut) {
    // Launch UWP/Store app using explorer.exe shell:AppsFolder\APP_ID
    try {
      console.log('Launching UWP/Store app with explorer.exe', finalPath);
      execFile('explorer.exe', [finalPath], (error) => {
        if (error) {
          console.error('Failed to launch UWP/Store app:', finalPath, error);
        } else {
          console.log('UWP/Store app launched successfully:', finalPath);
        }
      });
    } catch (err) {
      console.error('Error launching UWP/Store app:', finalPath, err);
    }
    return;
  }

  if (!fs.existsSync(finalPath)) {
    console.error('App path does not exist:', finalPath);
    return;
  }
  
  try {
    const argsArray = finalArgs ? finalArgs.split(' ') : [];
    console.log('Executing:', finalPath, 'with args:', argsArray);
    execFile(finalPath, argsArray, (error) => {
      if (error) {
        console.error('Failed to launch app:', finalPath, error);
      } else {
        console.log('App launched successfully:', finalPath);
      }
    });
  } catch (err) {
    console.error('Error launching app:', finalPath, err);
  }
});

// IPC handler to get the app icon as a base64 PNG
ipcMain.handle('get-app-icon', async (event, filePath) => {
  try {
    // For UWP/Store apps, we can't extract the icon directly, so return null or a default
    if (filePath.startsWith('shell:AppsFolder')) {
      // TODO: Optionally return a custom icon for known UWP apps
      return null;
    }
    // For .exe or .lnk files, extract the icon
    const iconBuffer = extractIcon(filePath, 64); // 64x64 icon
    if (iconBuffer) {
      const image = nativeImage.createFromBuffer(iconBuffer);
      return image.toDataURL(); // Return as base64 PNG
    }
    return null;
  } catch (error) {
    console.error('Error extracting icon for', filePath, error);
    return null;
  }
});

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.buttons.forEach((btn) => {
    if (btn.hotkey) {
      // Register the full hotkey string, including modifiers
      try {
        const success = globalShortcut.register(btn.hotkey, () => {
          win.webContents.send('trigger-media', btn.label);
        });
        if (!success) {
          console.warn('Failed to register hotkey:', btn.hotkey);
        }
      } catch (error) {
        console.error('Error registering hotkey:', btn.hotkey, error);
      }
    }
  });
}

app.whenReady().then(() => {
  ensureUserData();
  createWindow();
  registerHotkeys();
  
  // Register DevTools shortcut
  globalShortcut.register('F12', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.toggleDevTools();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 
