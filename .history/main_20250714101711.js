const { app, BrowserWindow, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra'); // helpful for file copying
const { ipcMain } = require('electron');
const configPath = path.join(__dirname, 'config.json');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    alwaysOnTop: true,
    frame: false,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true
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
    fse.copySync(data.originalPath, path.join(__dirname, 'public', data.targetPath));
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
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
});

ipcMain.on('close-app', () => {
  app.quit();
});

function registerHotkeys() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.buttons.forEach((btn) => {
    if (btn.hotkey) {
      // Register the main hotkey
      const success = globalShortcut.register(btn.hotkey, () => {
        win.webContents.send('trigger-media', btn.label);
      });

      if (!success) {
        console.warn(`Failed to register hotkey: ${btn.hotkey}`);
      } else {
        console.log(`Registered hotkey: ${btn.hotkey} for ${btn.label}`);
      }

      // For single number keys, also try registering with different formats
      if (/^\d$/.test(btn.hotkey)) {
        // Try registering with explicit numpad format
        const numpadFormats = [
          `NumPad${btn.hotkey}`,
          `Numpad${btn.hotkey}`,
          `Keypad${btn.hotkey}`,
          `KP${btn.hotkey}`,
          `KP_${btn.hotkey}`
        ];
        
        numpadFormats.forEach(format => {
          try {
            const numpadSuccess = globalShortcut.register(format, () => {
              win.webContents.send('trigger-media', btn.label);
            });
            if (numpadSuccess) {
              console.log(`Registered numpad hotkey: ${format} for ${btn.label}`);
            }
          } catch (error) {
            // Ignore errors for invalid formats
          }
        });
      }
    }
  });
}

app.whenReady().then(() => {
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
