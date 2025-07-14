const { app, BrowserWindow, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra'); // helpful for file copying
const { ipcMain } = require('electron');

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
    height: 600,
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
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Only copy file if it's a new file (not editing existing)
  if (data.originalPath !== data.targetPath) {
    // Save to userData/sounds
    const ext = path.extname(data.originalPath);
    const safeLabel = data.label.replace(/[^a-z0-9_\-]/gi, '_');
    const destFile = path.join(userSoundsDir, `${safeLabel}${ext}`);
    fse.copySync(data.originalPath, destFile);
    data.targetPath = path.relative(userDataPath, destFile).replace(/\\/g, '/');
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

  const newButton = {
    label: data.label,
    type: data.type,
    src: data.targetPath,
    hotkey: data.hotkey || undefined
  };

  if (typeof data.editingIndex === 'number') {
    config.buttons[data.editingIndex] = newButton;
  } else {
    config.buttons.push(newButton);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
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

function registerHotkeys() {
  // Unregister all existing hotkeys first to avoid conflicts
  globalShortcut.unregisterAll();
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.buttons.forEach((btn) => {
    if (btn.hotkey) {
      // Convert hotkey to proper accelerator format
      let accelerator = btn.hotkey;
      
      // Handle F1-F12 keys
      if (/^F\d{1,2}$/.test(btn.hotkey)) {
        // F1-F12 should work as-is, but let's try different formats
        const fKeyFormats = [
          btn.hotkey, // F1, F2, etc.
          btn.hotkey.toLowerCase(), // f1, f2, etc.
          `Key${btn.hotkey}`, // KeyF1, KeyF2, etc.
          `F${btn.hotkey.slice(1)}`, // F1, F2, etc. (redundant but explicit)
          `F${parseInt(btn.hotkey.slice(1))}`, // F1, F2, etc. (numeric)
          // Additional formats for problematic keys like F1
          `Function${btn.hotkey.slice(1)}`, // Function1, Function2, etc.
          `F${btn.hotkey.slice(1)}Key`, // F1Key, F2Key, etc.
          `KeyF${btn.hotkey.slice(1)}` // KeyF1, KeyF2, etc.
        ];
        
        let registered = false;
        fKeyFormats.forEach(format => {
          if (!registered) {
            try {
              const success = globalShortcut.register(format, () => {
                win.webContents.send('trigger-media', btn.label);
              });
              if (success) {
                registered = true;
              }
            } catch (error) {
            }
          }
        });
        
        if (!registered) {
        }
      }
      // Handle single number keys (1-0)
      else if (/^\d$/.test(btn.hotkey)) {
        const numberFormats = [
          btn.hotkey, // 1, 2, 3, etc.
          `Digit${btn.hotkey}`, // Digit1, Digit2, etc.
          `Key${btn.hotkey}`, // Key1, Key2, etc.
          `NumPad${btn.hotkey}`, // NumPad1, NumPad2, etc.
          `Numpad${btn.hotkey}`, // Numpad1, Numpad2, etc.
          `KP${btn.hotkey}`, // KP1, KP2, etc.
          `KP_${btn.hotkey}`, // KP_1, KP_2, etc.
          `Keypad${btn.hotkey}` // Keypad1, Keypad2, etc.
        ];
        
        let registered = false;
        numberFormats.forEach(format => {
          if (!registered) {
            try {
              const success = globalShortcut.register(format, () => {
                win.webContents.send('trigger-media', btn.label);
              });
              if (success) {
                registered = true;
              }
            } catch (error) {
            }
          }
        });
        
        if (!registered) {
        }
      }
      // Handle other hotkeys (like Control+2)
      else {
        const success = globalShortcut.register(accelerator, () => {
          win.webContents.send('trigger-media', btn.label);
        });

        if (!success) {
        }
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
