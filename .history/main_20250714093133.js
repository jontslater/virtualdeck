const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

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

app.whenReady().then(() => {
  createWindow();

  // ✅ Dynamically register global shortcuts from config
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    configData.buttons.forEach(button => {
      if (button.hotkey) {
        globalShortcut.register(button.hotkey, () => {
          win.webContents.send('trigger-media', button.label.toLowerCase());
        });
        console.log(`Registered hotkey: ${button.hotkey} for ${button.label}`);
      }
    });
  } catch (error) {
    console.error('Error loading config for hotkeys:', error);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll(); // Clean up
}); 
