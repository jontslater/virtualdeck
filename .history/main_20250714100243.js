const { app, BrowserWindow, globalShortcut } = require('electron');
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
}

ipcMain.on('add-media', (event, data) => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Copy file to assets/
  fse.copySync(data.originalPath, path.join(__dirname, 'public', data.targetPath));

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
      // Register both regular and numpad versions of number keys
      let hotkeyVariants = [btn.hotkey];
      
      // If it's a single number key, also register the numpad version
      if (/^\d$/.test(btn.hotkey)) {
        hotkeyVariants.push(btn.hotkey); // Same key, different physical location
      }
      
      hotkeyVariants.forEach(hotkey => {
        const success = globalShortcut.register(hotkey, () => {
          win.webContents.send('trigger-media', btn.label);
        });

        if (!success) {
          console.warn(`Failed to register hotkey: ${hotkey}`);
        } else {
          console.log(`Registered hotkey: ${hotkey} for ${btn.label}`);
        }
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  registerHotkeys();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 
