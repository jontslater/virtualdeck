const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

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

  // ✅ Register global shortcuts here
  globalShortcut.register('Control+1', () => {
    win.webContents.send('trigger-media', 'airhorn');
  });

  globalShortcut.register('Control+2', () => {
    win.webContents.send('trigger-media', 'firework');
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll(); // Clean up
}); 
