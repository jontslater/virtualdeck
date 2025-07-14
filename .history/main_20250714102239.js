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
          `F${parseInt(btn.hotkey.slice(1))}` // F1, F2, etc. (numeric)
        ];
        
        let registered = false;
        console.log(`Attempting to register F-key: ${btn.hotkey} for ${btn.label}`);
        fKeyFormats.forEach(format => {
          if (!registered) {
            try {
              const success = globalShortcut.register(format, () => {
                console.log(`F-key triggered: ${format} for ${btn.label}`);
                win.webContents.send('trigger-media', btn.label);
              });
              if (success) {
                console.log(`✓ Successfully registered F-key hotkey: ${format} for ${btn.label}`);
                registered = true;
              } else {
                console.log(`✗ Failed to register format: ${format}`);
              }
            } catch (error) {
              console.log(`✗ Error registering format ${format}:`, error.message);
            }
          }
        });
        
        if (!registered) {
          console.warn(`❌ Failed to register any F-key format for: ${btn.hotkey} (${btn.label})`);
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
        console.log(`Attempting to register number key: ${btn.hotkey} for ${btn.label}`);
        numberFormats.forEach(format => {
          if (!registered) {
            try {
              const success = globalShortcut.register(format, () => {
                console.log(`Number key triggered: ${format} for ${btn.label}`);
                win.webContents.send('trigger-media', btn.label);
              });
              if (success) {
                console.log(`✓ Successfully registered number hotkey: ${format} for ${btn.label}`);
                registered = true;
              } else {
                console.log(`✗ Failed to register format: ${format}`);
              }
            } catch (error) {
              console.log(`✗ Error registering format ${format}:`, error.message);
            }
          }
        });
        
        if (!registered) {
          console.warn(`❌ Failed to register any number format for: ${btn.hotkey} (${btn.label})`);
        }
      }
      // Handle other hotkeys (like Control+2)
      else {
        const success = globalShortcut.register(accelerator, () => {
          win.webContents.send('trigger-media', btn.label);
        });

        if (!success) {
          console.warn(`Failed to register hotkey: ${btn.hotkey}`);
        } else {
          console.log(`Registered hotkey: ${btn.hotkey} for ${btn.label}`);
        }
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
