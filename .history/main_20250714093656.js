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

function registerHotkeys() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.buttons.forEach((btn) => {
    if (btn.hotkey) {
      const success = globalShortcut.register(btn.hotkey, () => {
        win.webContents.send('trigger-media', btn.label);
      });

      if (!success) {
        console.warn(`Failed to register hotkey: ${btn.hotkey}`);
      }
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
