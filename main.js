const { app, BrowserWindow, globalShortcut, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra'); // helpful for file copying
const { ipcMain } = require('electron');
const ws = require('windows-shortcuts'); // Import windows-shortcuts
const { execFile } = require('child_process');
const extractIcon = require('extract-file-icon');
const { nativeImage } = require('electron');
const tmi = require('tmi.js'); // Import tmi.js for Twitch chat
const WebSocket = require('ws');
const fetch = require('node-fetch');
const http = require('http');
const { autoUpdater } = require('electron-updater');

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;

// Use Electron's userData directory for config and user files
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');
const userSoundsDir = path.join(userDataPath, 'sounds');
const userSkinsDir = path.join(userDataPath, 'skins');
const defaultConfigPath = path.join(__dirname, 'config.json');
const defaultSoundsDir = path.join(__dirname, 'public', 'assets', 'sounds');
const defaultSkinsDir = path.join(__dirname, 'skins');
const tcConfigPath = path.join(userDataPath, 'tc_config.json');
const dailyCheckinsPath = path.join(userDataPath, 'checkins.json');

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
  // Ensure skins directory exists
  if (!fs.existsSync(userSkinsDir)) {
    fse.ensureDirSync(userSkinsDir);
    if (fs.existsSync(defaultSkinsDir)) {
      fse.copySync(defaultSkinsDir, userSkinsDir);
    }
  }
  // Ensure tc_config exists with default topics
  if (!fs.existsSync(tcConfigPath)) {
    const defaultTc = {
      topics: [
        'channel.channel_points_custom_reward_redemption',
        'channel.subscribe',
        'channel.subscription.gift',
        'channel.subscription.message',
        'channel.follow',
        'channel.raid',
        'channel.cheer',
        'channel.ban'
      ]
      ,
      // ISO string for last time we polled followers; used to detect new followers since last run
  lastFollowerPoll: null,
  // track subscription ids created by this app so we don't remove subscriptions we don't own
  createdSubscriptions: []
    };
    fs.writeFileSync(tcConfigPath, JSON.stringify(defaultTc, null, 2));
  }
  // Run migration to backfill button ids if missing
  ensureButtonIds();
}

// Ensure each button in config has a stable unique id (migration/backfill)
function ensureButtonIds() {
  try {
    if (!fs.existsSync(configPath)) return;
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!Array.isArray(cfg.buttons)) return;
    let changed = false;
    const existingIds = new Set(cfg.buttons.filter(b => b && b.id).map(b => b.id));
    for (let i = 0; i < cfg.buttons.length; i++) {
      const b = cfg.buttons[i];
      if (b && !b.id) {
        // create a compact unique id
        let newId;
        do {
          newId = 'b_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        } while (existingIds.has(newId));
        b.id = newId;
        existingIds.add(newId);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
      console.log('Backfilled missing button ids in config.json');
    }
  } catch (err) {
    console.error('Error ensuring button ids:', err);
  }
}

function loadTcConfig() {
  try {
  const raw = JSON.parse(fs.readFileSync(tcConfigPath, 'utf-8'));
  // Ensure shape compatibility
  if (!raw.topics) raw.topics = [];
  if (!raw.hasOwnProperty('lastFollowerPoll')) raw.lastFollowerPoll = null;
  if (!Array.isArray(raw.createdSubscriptions)) raw.createdSubscriptions = [];
  return raw;
  } catch (e) {
  return { topics: [], lastFollowerPoll: null, createdSubscriptions: [] };
  }
}

function saveTcConfig(cfg) {
  fs.writeFileSync(tcConfigPath, JSON.stringify(cfg, null, 2));
}

let win;
let overlayWindow;
let overlayServer;
let overlayWSS;
let overlayClients = new Set();
let overlayRegistry = new Map(); // overlayName -> Set of WebSocket connections
let overlayServerPort;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 901,
    minHeight: 660,
    //alwaysOnTop: true,
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
  // Show window only when ready-to-show to avoid initial mis-sizing
  win.once('ready-to-show', () => {
    try { win.show(); } catch (e) {}
  });

  // After renderer finishes loading, notify it so it can perform layout work
  win.webContents.on('did-finish-load', () => {
    try {
      win.webContents.send('renderer-ready');
      // Inform renderer of current maximize state so the toolbar icon can initialize correctly
      try {
        if (win.isMaximized && win.isMaximized()) win.webContents.send('window-maximized');
        else win.webContents.send('window-unmaximized');
      } catch (e) {}
    } catch (e) { console.warn('Failed to send renderer-ready:', e); }
  });
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

// Overlay server for browser source
function startOverlayServer() {
  const port = 8080;
  
  // Create HTTP server to serve overlay HTML and media files
  overlayServer = http.createServer((req, res) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }
    
    if (req.url === '/overlay' || req.url === '/') {
      // Serve the main overlay HTML file
      const overlayPath = path.join(__dirname, 'public/overlay.html');
      fs.readFile(overlayPath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading overlay');
          return;
        }
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(data);
      });
    } else if (req.url.startsWith('/overlay/') || req.url.startsWith('/overlay?')) {
      // Handle custom overlays - /overlay/name or /overlay?name=name
      let overlayName = 'main';
      
      // Parse overlay name from URL
      if (req.url.includes('?')) {
        const url = new URL(req.url, `http://localhost:${port}`);
        overlayName = url.searchParams.get('name') || 'main';
      } else {
        // Extract from path like /overlay/custom-name
        overlayName = req.url.substring(9); // Remove '/overlay/'
      }
      
      console.log(`🎯 Serving overlay: ${overlayName}`);
      
      // Check if it's a predefined overlay
      const predefinedOverlays = ['hudOverlay', 'cameraFrameOverlay', 'chatOverlay'];
      if (predefinedOverlays.includes(overlayName)) {
        // Serve predefined overlay
        const overlayPath = path.join(__dirname, 'overlays', overlayName, 'index.html');
        fs.readFile(overlayPath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error loading overlay');
            return;
          }
          res.writeHead(200, { 
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(data);
        });
      } else {
        // Generate custom overlay from base template
        generateOverlayHTML(overlayName, (err, html) => {
          if (err) {
            res.writeHead(500);
            res.end('Error generating overlay');
            return;
          }
          res.writeHead(200, { 
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(html);
        });
      }
    } else if (req.url.startsWith('/media/')) {
      // Serve media files from file paths
      const filePath = decodeURIComponent(req.url.substring(7)); // Remove '/media/' prefix
      
      // Security check - ensure the file path is within allowed directories
      const normalizedPath = path.normalize(filePath);
      const isAllowed = normalizedPath.startsWith(userDataPath) || 
                       normalizedPath.startsWith(__dirname) ||
                       normalizedPath.startsWith(path.join(__dirname, 'public'));
      
      if (!isAllowed) {
        res.writeHead(403);
        res.end('Access denied');
        return;
      }
      
      // Check if file exists
      fs.access(normalizedPath, fs.constants.F_OK, (err) => {
        if (err) {
          res.writeHead(404);
          res.end('File not found');
          return;
        }
        
        // Get file extension for content type
        const ext = path.extname(normalizedPath).toLowerCase();
        const contentTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.ogg': 'video/ogg',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        // Serve the file
        fs.readFile(normalizedPath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error reading file');
            return;
          }
          res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(data);
        });
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  // Create WebSocket server for real-time communication
  overlayWSS = new WebSocket.Server({ server: overlayServer });
  
  overlayWSS.on('connection', (ws, req) => {
    console.log('Overlay client connected - URL:', req.url);
    
    // Extract overlay name from URL query parameters
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const overlayName = url.searchParams.get('overlay') || 'main';
    ws.overlayName = overlayName; // Store overlay name on the WebSocket connection
    
    // Add to global clients set
    overlayClients.add(ws);
    
    // Register in overlay registry
    if (!overlayRegistry.has(overlayName)) {
      overlayRegistry.set(overlayName, new Set());
    }
    overlayRegistry.get(overlayName).add(ws);
    
    console.log(`✅ WebSocket connected for overlay: "${overlayName}"`);
    console.log(`📊 Registry status:`, Array.from(overlayRegistry.entries()).map(([name, clients]) => `${name}:${clients.size}`));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`📨 Message from overlay ${overlayName}:`, data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(`Overlay client disconnected: ${overlayName}`);
      overlayClients.delete(ws);
      
      // Remove from overlay registry
      if (overlayRegistry.has(overlayName)) {
        overlayRegistry.get(overlayName).delete(ws);
        if (overlayRegistry.get(overlayName).size === 0) {
          overlayRegistry.delete(overlayName);
        }
      }
      
      console.log(`📊 Registry status after disconnect:`, Array.from(overlayRegistry.entries()).map(([name, clients]) => `${name}:${clients.size}`));
    });
    
    ws.on('error', (error) => {
      console.log('Overlay WebSocket error:', error);
      overlayClients.delete(ws);
      
      // Remove from overlay registry
      if (overlayRegistry.has(overlayName)) {
        overlayRegistry.get(overlayName).delete(ws);
        if (overlayRegistry.get(overlayName).size === 0) {
          overlayRegistry.delete(overlayName);
        }
      }
    });
  });

  // Try to start server with automatic port fallback
  function tryStartServer(port, attempt = 1) {
    overlayServer.listen(port, (err) => {
      if (err) {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is already in use, trying next port...`);
          if (attempt < 10) { // Try up to 10 different ports
            // Try next port
            tryStartServer(port + 1, attempt + 1);
          } else {
            console.error(`Failed to start overlay server after trying ${attempt} ports`);
            console.error('Please check if another VirtualDeck instance is running or free up some ports');
          }
        } else {
          console.error('Failed to start overlay server:', err);
        }
      } else {
        console.log(`✅ Overlay server running at http://localhost:${port}/overlay`);
        console.log(`📺 Use this URL in OBS Browser Source: http://localhost:${port}/overlay`);
        
        // Store the actual port used for reference
        overlayServerPort = port;
      }
    });
  }

  tryStartServer(port);
}

// Generate overlay HTML based on overlay name and template
function generateOverlayHTML(overlayName, callback) {
  try {
    // Use the base overlay template for custom overlays
    const templatePath = path.join(__dirname, 'overlays/baseOverlay/index.html');
    
    fs.readFile(templatePath, 'utf8', (err, template) => {
      if (err) {
        callback(err, null);
        return;
      }
      
      // Replace template variables
      let html = template.replace(/\{\{OVERLAY_NAME\}\}/g, overlayName);
      html = html.replace(/\{\{BACKGROUND_MODE\}\}/g, 'transparent');
      html = html.replace(/\{\{CHROMA_COLOR\}\}/g, '#00ff00');
      html = html.replace(/\{\{LAYOUT_CLASS\}\}/g, 'layout-center');
      
      callback(null, html);
    });
  } catch (error) {
    callback(error, null);
  }
}

// Get layout class based on overlay name
function getLayoutClass(overlayName) {
  // Simple mapping for now - could be enhanced with stored configurations
  if (overlayName.includes('fullscreen') || overlayName.includes('full-screen')) {
    return 'fullscreen-media';
  } else if (overlayName.includes('text-only')) {
    return 'text-only';
  } else {
    return 'center-media'; // Default layout
  }
}

// Function to broadcast messages to overlay clients
// If targetOverlay is specified, only send to that overlay
// If targetOverlay is null/undefined, send to all overlays (backward compatibility)
function broadcastToOverlay(message, targetOverlay = null) {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;
  
  if (targetOverlay) {
    // Use registry for targeted messaging
    const overlayClients = overlayRegistry.get(targetOverlay);
    
    if (overlayClients && overlayClients.size > 0) {
      overlayClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
          sentCount++;
        }
      });
      console.log(`📤 Message sent to ${sentCount} client(s) on overlay: "${targetOverlay}"`);
    } else {
      console.warn(`⚠️ WARNING: No clients found for overlay "${targetOverlay}"! Is the overlay open in OBS?`);
      console.log(`📊 Available overlays:`, Array.from(overlayRegistry.keys()));
    }
  } else {
    // No target specified - send to all overlays (broadcast mode)
    overlayClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
        sentCount++;
      }
    });
    console.log(`📤 Broadcast message sent to ${sentCount} client(s) across all overlays`);
  }
  
  // Log registry status for debugging
  console.log(`📊 Registry status:`, Array.from(overlayRegistry.entries()).map(([name, clients]) => `${name}:${clients.size}`));
}

// Function to get the current overlay server URL
function getOverlayServerUrl() {
  return `http://localhost:${overlayServerPort || 8080}/overlay`;
}

ipcMain.on('add-media', (event, data) => {
  console.log('add-media received:', data);
  console.log('Chat command data:', data.chatCommand);
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
    args: data.args || undefined,
    // Persist volume if provided (expected 0.0 - 1.0). This value is only
    // meaningful for `type: 'audio'` buttons; the renderer will set the
    // Audio element's `volume` property when a button is triggered.
    volume: (typeof data.volume === 'number') ? data.volume : (data.volume ? parseFloat(data.volume) : undefined),
    // Include chat command data if provided
    chatCommand: data.chatCommand || undefined
  };

  // Ensure each button has a stable unique id
  if (typeof data.editingIndex === 'number') {
    // Preserve existing id if present
    const existing = config.buttons[data.editingIndex];
    if (existing && existing.id) newButton.id = existing.id;
    else newButton.id = 'b_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    config.buttons[data.editingIndex] = newButton;
  } else {
    newButton.id = 'b_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
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

ipcMain.handle('get-window-bounds', () => {
  if (win && !win.isDestroyed()) {
    const [x, y] = win.getPosition();
    const [width, height] = win.getSize();
    return { x, y, width, height };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
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
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Include userDataPath for constructing absolute paths in renderer
    config.userDataPath = userDataPath;
    return config;
  } catch (e) {
    return { buttons: [], userDataPath: userDataPath };
  }
});

// IPC handler to save config (complete replacement)
ipcMain.handle('save-config', async (event, config) => {
  try {
    // Write the complete config to file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Config saved successfully');
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, error: error.message };
  }
});

// Create media storage directory for multi-media button assets
const mediaStoragePath = path.join(userDataPath, 'media');
if (!fs.existsSync(mediaStoragePath)) {
  fs.mkdirSync(mediaStoragePath, { recursive: true });
}

// IPC handler to save media file by copying directly from source path (efficient for large files)
ipcMain.handle('save-media-file-by-path', async (event, { sourcePath, buttonId, mediaType, originalName }) => {
  try {
    console.log('Saving media file by path:', { sourcePath, buttonId, mediaType, originalName });
    
    // Create button-specific directory
    const buttonMediaDir = path.join(mediaStoragePath, buttonId);
    if (!fs.existsSync(buttonMediaDir)) {
      fs.mkdirSync(buttonMediaDir, { recursive: true });
    }

    // Extract extension from original name
    const extension = path.extname(originalName || sourcePath);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${mediaType}_${timestamp}${extension}`;
    const destPath = path.join(buttonMediaDir, filename);

    // Copy file directly (much faster for large video files)
    fse.copySync(sourcePath, destPath);
    
    console.log('Media file copied successfully:', destPath);
    
    // Return relative path from userDataPath for storage in config
    const relativePath = path.relative(userDataPath, destPath);
    return { success: true, filePath: relativePath };
  } catch (error) {
    console.error('Error copying media file:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to save media file from base64 data (for backwards compatibility and small files)
ipcMain.handle('save-media-file', async (event, { base64Data, buttonId, mediaType, originalName }) => {
  try {
    // Create button-specific directory
    const buttonMediaDir = path.join(mediaStoragePath, buttonId);
    if (!fs.existsSync(buttonMediaDir)) {
      fs.mkdirSync(buttonMediaDir, { recursive: true });
    }

    // Extract extension from original name or base64 mime type
    let extension = '';
    if (originalName) {
      extension = path.extname(originalName);
    } else {
      // Extract from base64 data URI
      const match = base64Data.match(/^data:([^;]+);/);
      if (match) {
        const mimeType = match[1];
        const mimeToExt = {
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
          'image/webp': '.webp',
          'video/mp4': '.mp4',
          'video/webm': '.webm',
          'audio/mpeg': '.mp3',
          'audio/mp3': '.mp3',
          'audio/wav': '.wav',
          'audio/ogg': '.ogg'
        };
        extension = mimeToExt[mimeType] || '';
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${mediaType}_${timestamp}${extension}`;
    const filePath = path.join(buttonMediaDir, filename);

    // Remove base64 prefix if present
    const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Write file
    fs.writeFileSync(filePath, Buffer.from(base64String, 'base64'));
    
    console.log('Media file saved:', filePath);
    
    // Return relative path from userDataPath for storage in config
    const relativePath = path.relative(userDataPath, filePath);
    return { success: true, filePath: relativePath };
  } catch (error) {
    console.error('Error saving media file:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to get absolute path for media file (for HTTP serving)
ipcMain.handle('get-media-file-path', async (event, relativePath) => {
  try {
    const fullPath = path.join(userDataPath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File not found' };
    }
    return { 
      success: true, 
      absolutePath: fullPath
    };
  } catch (error) {
    console.error('Error getting media file path:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to get media file as base64 (for serving to overlay) - DEPRECATED, use HTTP serving instead
ipcMain.handle('get-media-file', async (event, relativePath) => {
  try {
    const fullPath = path.join(userDataPath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File not found' };
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const base64Data = fileBuffer.toString('base64');
    
    // Detect mime type from extension
    const ext = path.extname(fullPath).toLowerCase();
    const extToMime = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg'
    };
    const mimeType = extToMime[ext] || 'application/octet-stream';
    
    return { 
      success: true, 
      data: `data:${mimeType};base64,${base64Data}`,
      mimeType: mimeType
    };
  } catch (error) {
    console.error('Error reading media file:', error);
    return { success: false, error: error.message };
  }
});


// IPC handler to update config
ipcMain.handle('update-config', async (event, configUpdate) => {
  try {
    // Read current config
    let config = { buttons: [] };
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    // Merge the update with existing config
    config = { ...config, ...configUpdate };
    
    // Write back to file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Config updated successfully:', configUpdate);
    return true;
  } catch (e) {
    console.error('Error updating config:', e);
    return false;
  }
});

// Persist button order sent from renderer to config.json
ipcMain.on('save-button-order', (event, orderedIds) => {
  try {
    if (!Array.isArray(orderedIds)) return;
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!Array.isArray(cfg.buttons)) cfg.buttons = [];
    const byId = new Map(cfg.buttons.map(b => [b.id, b]));
    const newButtons = [];
    for (const id of orderedIds) {
      if (byId.has(id)) newButtons.push(byId.get(id));
    }
    // append any missing buttons that weren't included in orderedIds
    for (const b of cfg.buttons) if (!newButtons.includes(b)) newButtons.push(b);
    cfg.buttons = newButtons;
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
    if (win && !win.isDestroyed()) win.webContents.send('refresh-ui');
  } catch (err) {
    console.error('Failed to save button order:', err);
  }
});

// Event->Sound mappings helpers stored inside config.json under 'mappings'
function loadMappings() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!Array.isArray(cfg.mappings)) cfg.mappings = [];
    return cfg.mappings;
  } catch (e) {
    return [];
  }
}

function saveMappings(maps) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    cfg.mappings = maps;
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving mappings:', e);
    return false;
  }
}

// IPC: get/save/delete event mappings
ipcMain.handle('get-event-mappings', async () => {
  return loadMappings();
});

ipcMain.on('save-event-mapping', (event, mapping) => {
  try {
    const maps = loadMappings();
    // Prevent creation of multiple follow/sub/raid mappings
    if (mapping && mapping.type && ['follow','sub','raid'].includes(mapping.type)) {
      const conflict = maps.find(m => m.type === mapping.type && (!mapping.id || m.id !== mapping.id));
      if (conflict) {
        console.log('Rejected mapping save: mapping for type already exists:', mapping.type);
        // notify renderer to refresh (no change) and return
        if (event && event.sender) event.sender.send('mapping-save-failed', { reason: 'duplicate_type', type: mapping.type });
        return;
      }
    }
    if (mapping && mapping.id) {
      // update existing
      const idx = maps.findIndex(m => m.id === mapping.id);
      if (idx !== -1) maps[idx] = mapping;
      else maps.push(mapping);
    } else {
      // create new with simple timestamp id
      mapping.id = 'm_' + Date.now();
      maps.push(mapping);
    }
    if (saveMappings(maps)) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('refresh-ui');
        // notify renderer that a mapping was saved so it can activate immediately
        win.webContents.send('mapping-saved', mapping);
      }
    }
  } catch (e) {
    console.error('Error in save-event-mapping handler:', e);
  }
});

ipcMain.on('delete-event-mapping', (event, id) => {
  try {
    let maps = loadMappings();
    maps = maps.filter(m => m.id !== id);
    if (saveMappings(maps)) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('refresh-ui');
        win.webContents.send('mapping-deleted', id);
      }
    }
  } catch (e) {
    console.error('Error in delete-event-mapping handler:', e);
  }
});

// IPC: get the saved TwitchConnected config (tc_config.json)
ipcMain.handle('get-tc-config', async () => {
  try {
    return loadTcConfig();
  } catch (err) {
    console.error('Error reading tc_config via IPC:', err);
    return { topics: [], lastFollowerPoll: null };
  }
});

// ===============================
// Daily Check-In IPC Handlers
// ===============================

// IPC: load daily check-ins data
ipcMain.handle('loadDailyCheckins', async () => {
  try {
    if (fs.existsSync(dailyCheckinsPath)) {
      const data = fs.readFileSync(dailyCheckinsPath, 'utf-8');
      return JSON.parse(data);
    }
    // Return default structure if file doesn't exist
    return {
      viewers: {},
      config: {
        enabled: true,
        rewardName: 'Daily Check-In',
        chatResponse: 'Welcome back {username}! You\'ve checked in {total_checkins} times!',
        alreadyCheckedMessage: 'You\'ve already checked in today, {username}! Come back tomorrow!',
        showStreak: false,
        sendToChat: true,
        testMode: false
      }
    };
  } catch (err) {
    console.error('Error loading daily check-ins:', err);
    return null;
  }
});

// IPC: save daily check-ins data
ipcMain.handle('saveDailyCheckins', async (event, data) => {
  try {
    fs.writeFileSync(dailyCheckinsPath, JSON.stringify(data, null, 2));
    console.log('💾 Saved daily check-ins data');
    return true;
  } catch (err) {
    console.error('Error saving daily check-ins:', err);
    return false;
  }
});

// IPC: send Twitch chat message
ipcMain.handle('sendTwitchChatMessage', async (event, message) => {
  try {
    // Send message through TMI client if connected
    if (twitchClient && twitchClient.readyState() === 'OPEN') {
      const channels = twitchClient.getChannels();
      if (channels && channels.length > 0) {
        const channel = channels[0];
        await twitchClient.say(channel, message);
        console.log('💬 Sent chat message to', channel, ':', message);
        return true;
      } else {
        console.warn('⚠️ Twitch chat client connected but no channels joined');
        return false;
      }
    }
    console.warn('⚠️ Twitch chat client not connected');
    return false;
  } catch (err) {
    console.error('❌ Error sending Twitch chat message:', err);
    return false;
  }
});

// ===============================
// End Daily Check-In IPC Handlers
// ===============================

// IPC: list current EventSub subscriptions (aggregated)
ipcMain.handle('list-eventsub-subscriptions', async () => {
  try {
    const subs = await listEventSubscriptions();
    return subs;
  } catch (err) {
    console.error('Error listing eventsub subscriptions via IPC:', err);
    return null;
  }
});

// IPC: fetch channel point rewards for the connected channel (requires clientId and token)
ipcMain.handle('get-channel-rewards', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return [];
    const url = `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(twitchUserId)}`;
    const resp = await fetch(url, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  } catch (err) {
    console.error('Error fetching channel rewards:', err);
    return [];
  }
});

// IPC helpers to check whether a username follows or is subscribed to the connected channel
ipcMain.handle('check-user-follows', async (event, username) => {
  try {
    if (!username) return false;
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return false;
    // Get user id for the username
    const userResp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
      headers: { 'Client-ID': twitchClientId, 'Authorization': `Bearer ${twitchToken}` }
    });
    const userData = await userResp.json();
    if (!userData || !userData.data || !userData.data[0]) return false;
    const userId = userData.data[0].id;
    const followResp = await fetch(`https://api.twitch.tv/helix/users/follows?from_id=${encodeURIComponent(userId)}&to_id=${encodeURIComponent(twitchUserId)}`, {
      headers: { 'Client-ID': twitchClientId, 'Authorization': `Bearer ${twitchToken}` }
    });
    const followData = await followResp.json();
    return (followData && Array.isArray(followData.data) && followData.data.length > 0);
  } catch (err) {
    console.error('Error checking follow status:', err);
    return false;
  }
});

// Best-effort VIP check using cached chat badges (fast path). Returns true if user has 'vip' badge.
ipcMain.handle('check-user-vip', async (event, username) => {
  try {
    if (!username) return false;
    const uname = String(username).toLowerCase();
    const st = recentChatUserState.get(uname);
    if (!st) return false;
    const badges = st.badges || {};
    return !!(badges.vip || badges['vip']);
  } catch (e) {
    console.error('Error in check-user-vip:', e);
    return false;
  }
});

// Best-effort moderator check using cached chat state (fast path). Returns true if user is mod or has 'moderator' badge.
ipcMain.handle('check-user-mod', async (event, username) => {
  try {
    if (!username) return false;
    const uname = String(username).toLowerCase();
    const st = recentChatUserState.get(uname);
    if (!st) return false;
    if (st.mod) return true;
    const badges = st.badges || {};
    return !!(badges.moderator || badges.mod);
  } catch (e) {
    console.error('Error in check-user-mod:', e);
    return false;
  }
});

ipcMain.handle('check-user-subscriber', async (event, username) => {
  try {
    if (!username) return false;
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return false;
    // Get user id for the username
    const userResp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
      headers: { 'Client-ID': twitchClientId, 'Authorization': `Bearer ${twitchToken}` }
    });
    const userData = await userResp.json();
    if (!userData || !userData.data || !userData.data[0]) return false;
    const userId = userData.data[0].id;
    // Check subscriptions - requires broadcaster scope and the token belonging to the broadcaster
    const subResp = await fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${encodeURIComponent(twitchUserId)}&user_id=${encodeURIComponent(userId)}`, {
      headers: { 'Client-ID': twitchClientId, 'Authorization': `Bearer ${twitchToken}` }
    });
    const subData = await subResp.json();
    return (subData && Array.isArray(subData.data) && subData.data.length > 0);
  } catch (err) {
    console.error('Error checking subscriber status:', err);
    return false;
  }
});

// IPC: get current viewer count for the channel
ipcMain.handle('get-viewer-count', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return 0;
    
    const resp = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(twitchUserId)}`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].viewer_count || 0;
    }
    return 0;
  } catch (err) {
    console.error('Error fetching viewer count:', err);
    return 0;
  }
});

// IPC: get total follower count for the channel
ipcMain.handle('get-follower-count', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return 0;
    
    const resp = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(twitchUserId)}&first=1`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    return data.total || 0;
  } catch (err) {
    console.error('Error fetching follower count:', err);
    return 0;
  }
});

// IPC: get total subscriber count and subscription points for the channel
ipcMain.handle('get-subscriber-stats', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return { count: 0, points: 0 };
    
    let totalCount = 0;
    let totalPoints = 0;
    let cursor = '';
    
    do {
      const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${encodeURIComponent(twitchUserId)}&first=100${cursor ? `&after=${cursor}` : ''}`;
      const resp = await fetch(url, {
        headers: {
          'Client-ID': twitchClientId,
          'Authorization': `Bearer ${twitchToken}`
        }
      });
      const data = await resp.json();
      
      if (data.data) {
        totalCount += data.data.length;
        
        // Calculate subscription points
        data.data.forEach(sub => {
          const tier = sub.tier || '1000'; // Default to tier 1 if not specified
          if (tier === '1000') totalPoints += 1;      // Tier 1
          else if (tier === '2000') totalPoints += 2;  // Tier 2
          else if (tier === '3000') totalPoints += 6;  // Tier 3
          else if (tier === 'prime') totalPoints += 1; // Prime
        });
      }
      
      cursor = data.pagination?.cursor || '';
    } while (cursor);
    
    return { count: totalCount, points: totalPoints };
  } catch (err) {
    console.error('Error fetching subscriber stats:', err);
    return { count: 0, points: 0 };
  }
});

// IPC: get a user's subscription tier (best-effort). Returns 'tier1','tier2','tier3','prime','any' or null
ipcMain.handle('check-user-sub-tier', async (event, username) => {
  try {
    if (!username) return null;
    const uname = String(username).toLowerCase();
    // check cache first
    const cached = subTierCache.get(uname);
    const now = Date.now();
    if (cached && (now - cached.ts) < SUB_TIER_CACHE_TTL) return cached.tier;
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return null;
    // Get user id for the username
    const userResp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
      headers: { 'Client-ID': twitchClientId, 'Authorization': `Bearer ${twitchToken}` }
    });
    const userData = await userResp.json();
    if (!userData || !userData.data || !userData.data[0]) return null;
    const userId = userData.data[0].id;
    // Query subscriptions for this user -> broadcaster pair
    const subResp = await fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${encodeURIComponent(twitchUserId)}&user_id=${encodeURIComponent(userId)}`, {
      headers: { 'Client-ID': twitchClientId, 'Authorization': `Bearer ${twitchToken}` }
    });
    const subData = await subResp.json();
    if (!subData || !Array.isArray(subData.data) || subData.data.length === 0) {
      subTierCache.set(uname, { tier: null, ts: now });
      return null;
    }
    const rec = subData.data[0];
    // try multiple fields that different responses may use
    const maybe = (rec.tier || rec.plan || rec.plan_name || rec.sub_plan || rec.sub_plan_name || rec.tier_name || '');
    const v = String(maybe).toLowerCase();
    let resolved = 'any';
    if (v.includes('prime')) resolved = 'prime';
    else if (v.includes('3000') || v.includes('3') || v.includes('tier 3') || v.includes('tier3')) resolved = 'tier3';
    else if (v.includes('2000') || v.includes('2') || v.includes('tier 2') || v.includes('tier2')) resolved = 'tier2';
    else if (v.includes('1000') || v.includes('1') || v.includes('tier 1') || v.includes('tier1')) resolved = 'tier1';
    subTierCache.set(uname, { tier: resolved, ts: now });
    return resolved;
  } catch (err) {
    console.error('Error checking user sub tier:', err);
    return null;
  }
});

// Simple cache for check-user-sub-tier to reduce Helix calls: Map<lowercaseUsername, {tier, ts}>
const subTierCache = new Map();
const SUB_TIER_CACHE_TTL = 60 * 1000; // 60s

// IPC: get recent followers (last 10)
ipcMain.handle('get-recent-followers', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return [];
    
    const resp = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(twitchUserId)}&first=10`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    return data.data || [];
  } catch (err) {
    console.error('Error fetching recent followers:', err);
    return [];
  }
});

// IPC: get recent subscribers (last 10)
ipcMain.handle('get-recent-subscribers', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return [];
    
    const resp = await fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${encodeURIComponent(twitchUserId)}&first=10`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    return data.data || [];
  } catch (err) {
    console.error('Error fetching recent subscribers:', err);
    return [];
  }
});

// Expose whether Twitch credentials are present for UI warnings
ipcMain.handle('has-twitch-creds', async () => {
  try {
    return !!(twitchClientId && twitchToken && twitchUserId);
  } catch (e) {
    return false;
  }
});

// IPC handler to get sound path
ipcMain.handle('get-sound-path', async (event, relativePath) => {
  return path.join(userDataPath, relativePath);
});

// IPC handler to get app version
ipcMain.handle('get-app-version', async () => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    return packageJson.version || 'Unknown';
  } catch (error) {
    console.error('Error reading package.json:', error);
    return 'Unknown';
  }
});

// Skin System IPC Handlers

// Get available skins from the skins directory
ipcMain.handle('get-available-skins', async () => {
  try {
    const skins = [];
    if (!fs.existsSync(userSkinsDir)) {
      return skins;
    }
    
    const files = fs.readdirSync(userSkinsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const skinPath = path.join(userSkinsDir, file);
        try {
          const skinData = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
          if (skinData.name && skinData.version) {
            skins.push({
              id: path.basename(file, '.json'),
              name: skinData.name,
              description: skinData.description || '',
              version: skinData.version,
              author: skinData.author || '',
              filename: file
            });
          }
        } catch (err) {
          console.warn(`Failed to parse skin file ${file}:`, err);
        }
      }
    }
    
    return skins.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error loading available skins:', error);
    return [];
  }
});

// Load a specific skin by name
ipcMain.handle('load-skin', async (event, skinId) => {
  try {
    const skinPath = path.join(userSkinsDir, `${skinId}.json`);
    if (!fs.existsSync(skinPath)) {
      throw new Error(`Skin file not found: ${skinId}`);
    }
    
    const skinData = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
    
    // Validate skin structure
    if (!skinData.name || !skinData.version) {
      throw new Error('Invalid skin format: missing name or version');
    }
    
    return skinData;
  } catch (error) {
    console.error(`Error loading skin ${skinId}:`, error);
    throw error;
  }
});

// Import a skin from a file
ipcMain.handle('import-skin', async (event, filePath) => {
  return await importSkinFile(filePath);
});

// Handle import skin dialog
ipcMain.handle('show-import-skin-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(win, {
      title: 'Import Skin',
      filters: [
        { name: 'Skin Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      // Call the import logic directly instead of re-registering the handler
      return await importSkinFile(filePath);
    }
    
    return null;
  } catch (error) {
    console.error('Error showing import skin dialog:', error);
    throw error;
  }
});

// Handle delete skin dialog
ipcMain.handle('show-delete-skin-dialog', async () => {
  try {
    // Get available skins
    const skins = [];
    if (fs.existsSync(userSkinsDir)) {
      const files = fs.readdirSync(userSkinsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const skinPath = path.join(userSkinsDir, file);
          try {
            const skinData = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
            if (skinData.name && skinData.version) {
              skins.push({
                id: path.basename(file, '.json'),
                name: skinData.name,
                description: skinData.description || '',
                version: skinData.version,
                author: skinData.author || '',
                filename: file
              });
            }
          } catch (err) {
            console.warn(`Failed to parse skin file ${file}:`, err);
          }
        }
      }
    }
    
    if (skins.length === 0) {
      return { canceled: true, message: 'No custom themes found to delete.' };
    }
    
    // Create options for the dialog
    const skinOptions = skins.map(skin => ({
      label: skin.name,
      detail: skin.description || `Version ${skin.version}`,
      id: skin.id,
      filename: skin.filename
    }));
    
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Delete Theme',
      message: 'Select a theme to delete:',
      detail: 'This action cannot be undone.',
      buttons: ['Cancel', ...skinOptions.map(option => option.label)],
      defaultId: 0,
      cancelId: 0
    });
    
    if (result.response === 0) {
      return { canceled: true };
    }
    
    const selectedSkin = skinOptions[result.response - 1];
    const skinPath = path.join(userSkinsDir, selectedSkin.filename);
    
    // Confirm deletion
    const confirmResult = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete "${selectedSkin.label}"?`,
      detail: 'This action cannot be undone.',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0
    });
    
    if (confirmResult.response === 0) {
      return { canceled: true };
    }
    
    // Delete the skin file
    if (fs.existsSync(skinPath)) {
      fs.unlinkSync(skinPath);
      console.log(`Deleted skin: ${selectedSkin.filename}`);
      
      // Trigger menu rebuild
      if (win && !win.isDestroyed()) {
        win.webContents.send('refresh-menu');
      }
      
      return {
        deleted: true,
        skin: selectedSkin,
        message: `Theme "${selectedSkin.label}" has been deleted.`
      };
    } else {
      throw new Error('Skin file not found');
    }
    
  } catch (error) {
    console.error('Error showing delete skin dialog:', error);
    throw error;
  }
});

// Helper function to import skin file
async function importSkinFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const skinData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Validate skin structure
    if (!skinData.name || !skinData.version) {
      throw new Error('Invalid skin format: missing name or version');
    }
    
    // Generate a safe filename from the skin name
    const safeName = skinData.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const targetPath = path.join(userSkinsDir, `${safeName}.json`);
    
    // Check if skin already exists
    if (fs.existsSync(targetPath)) {
      throw new Error('A skin with this name already exists');
    }
    
    // Copy the skin file
    fs.writeFileSync(targetPath, JSON.stringify(skinData, null, 2));
    
    // Trigger menu rebuild to show the new skin
    if (win && !win.isDestroyed()) {
      win.webContents.send('refresh-menu');
    }
    
    return {
      id: safeName,
      name: skinData.name,
      description: skinData.description || '',
      version: skinData.version,
      author: skinData.author || ''
    };
  } catch (error) {
    console.error('Error importing skin:', error);
    throw error;
  }
}

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

let twitchClient = null;
// In-memory cache of recent chat user state (badges, mod flag) to enable simple VIP/mod checks
const recentChatUserState = new Map();

function startTwitchChatConnection({ username, oauth, clientId }) {
  console.log('Starting Twitch chat connection for user:', username);
  if (!username || !oauth) {
    console.error('Missing Twitch credentials');
    return;
  }
  const opts = {
    identity: {
      username: username,
      password: oauth.startsWith('oauth:') ? oauth : 'oauth:' + oauth
    },
    channels: [username]
  };
  twitchClientId = clientId;
  console.log('Using clientId:', twitchClientId);
  twitchClient = new tmi.Client(opts);
  twitchClient.connect().then(() => {
    console.log('Connected to Twitch chat as', username);
    // Notify renderer to update button state
    if (win && win.webContents) {
      win.webContents.send('twitch-connected');
    }
    // Trigger EventSub connection after chat connects
    if (username && oauth && twitchClientId) {
      startTwitchEventSub({ username, oauth, clientId: twitchClientId });
    }
  });
  twitchClient.on('message', (channel, tags, message, self) => {
    if (self) return;
    // Cache recent user state for quick VIP/mod checks later
    try {
      if (tags && tags.username) {
        const uname = String(tags.username).toLowerCase();
        recentChatUserState.set(uname, {
          badges: tags.badges || {},
          mod: !!tags.mod
        });
        // Keep cache bounded (simple LRU-ish behavior): trim to 200 entries
        if (recentChatUserState.size > 200) {
          // delete oldest entry
          const it = recentChatUserState.keys();
          const first = it.next().value;
          if (first) recentChatUserState.delete(first);
        }
      }
    } catch (e) {
      console.warn('Failed to cache chat user state:', e);
    }
    // Log chat messages to terminal
    console.log(`[Twitch Chat] ${tags.username}: ${message}`);
    // Forward chat event to renderer via IPC
    if (win && win.webContents) {
      win.webContents.send('twitch-chat-event', {
        type: 'chat',
        user: tags.username,
        message,
        badges: tags.badges || {},
        source: 'real-twitch' // Debug: identify event source
      });
    }
    // Trigger buttons with chat commands enabled if message starts with '!'
    if (message.startsWith('!')) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const commandText = message.split(' ')[0].substring(1).toLowerCase();
      config.buttons.forEach((btn) => {
        // Check if button has chat command enabled and keyword matches
        if (btn.chatCommand && btn.chatCommand.enabled && btn.chatCommand.keyword === commandText) {
          if (win && win.webContents) {
            console.log(`[Twitch Chat] Triggering button "${btn.name || btn.label}" via chat command !${commandText}`);
            win.webContents.send('trigger-media', btn.label || btn.name);
          }
        }
        // Legacy support: Also check old 'command' type buttons
        else if (btn.type === 'command' && btn.label.toLowerCase() === commandText) {
          if (win && win.webContents) {
            console.log(`[Twitch Chat] Triggering legacy command button "${btn.label}" via chat command !${commandText}`);
            win.webContents.send('trigger-media', btn.label);
          }
        }
      });
    }
  });
}

// Example: Listen for IPC from renderer to start connection
ipcMain.on('twitch-connect', (event, creds) => {
  console.log('Received twitch-connect IPC with creds');
  console.log('Creds:', creds);
  startTwitchChatConnection(creds);
});

let lastFollowerIds = [];
let lastPollTime = null;
// Interval handle for follower polling (so we can start/stop when follows topic is enabled)
let pollIntervalId = null;
// Prevent concurrent apply/reconcile runs and track pending creations to avoid duplicates
let applyingEventSub = false;
const pendingSubFingerprints = new Set();
let eventSubSessionId = null;
let eventSubRegistered = false;
// WebSocket instance for EventSub (kept so we can close it when clearing creds)
let eventSubWs = null;
let twitchUserId = null;
let twitchToken = null;
let twitchClientId = null;
let twitchUserName = null;

async function getUserId() {
  console.log('Fetching Twitch user ID for', twitchUserName);
  if (twitchUserId) return twitchUserId;
  console.log('Using token:', twitchToken);
  console.log('Using clientId:', twitchClientId);
  console.log('Using username:', twitchUserName);
  console.log('Requesting user ID from Twitch API');
  const response = await fetch(`https://api.twitch.tv/helix/users?login=${twitchUserName}`, {
    headers: {
      'Client-ID': twitchClientId,
      'Authorization': `Bearer ${twitchToken}`
    }
  });
  const data = await response.json();
  if (data.data && data.data.length > 0) {
    twitchUserId = data.data[0].id;
    return twitchUserId;
  } else {
    throw new Error('Could not fetch Twitch user ID.');
  }
}

async function pollFollowers() {
  try {
    console.log('Polling Twitch followers');;
    const resp = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${twitchUserId}&first=10`, {
      headers: {
    'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    if (data.data) {
      const now = new Date();
      let newFollowers = data.data;
      if (lastPollTime) {
        newFollowers = newFollowers.filter(f => new Date(f.followed_at) > lastPollTime);
      } else if (data.data.length > 0) {
        lastPollTime = new Date(data.data[0].followed_at);
        newFollowers = [];
      }
      if (newFollowers.length > 0) {
        newFollowers.forEach(f => {
          console.log('[Poll] New Follower:', f);
          if (win && win.webContents) {
            win.webContents.send('twitch-eventsub', { type: 'poll.follow', event: f });
          }
        });
      }
      lastFollowerIds = data.data.map(f => f.user_id);
      // Update lastPollTime to now and persist to tc_config
      if (now && (!lastPollTime || now > lastPollTime)) lastPollTime = now;
      try {
        const tc = loadTcConfig();
        tc.lastFollowerPoll = lastPollTime ? lastPollTime.toISOString() : new Date().toISOString();
        saveTcConfig(tc);
        console.log('Saved lastFollowerPoll to tc_config:', tc.lastFollowerPoll);
      } catch (err) {
        console.error('Error saving lastFollowerPoll to tc_config:', err);
      }
    }
  } catch (err) {
    console.error('Error polling followers:', err);
  }
}

// Stable fingerprint for a subscription (type + sorted condition keys)
function subFingerprint(type, condition) {
  try {
    const keys = condition && typeof condition === 'object' ? Object.keys(condition).sort() : [];
    const parts = keys.map(k => `${k}=${String(condition[k])}`);
    return `${type}|${parts.join('&')}`;
  } catch (e) {
    return `${type}|${JSON.stringify(condition)}`;
  }
}

// Persist a created subscription id into tc_config.createdSubscriptions (idempotent)
function addCreatedSubscriptionId(id) {
  if (!id) return;
  try {
    const tc = loadTcConfig();
    tc.createdSubscriptions = tc.createdSubscriptions || [];
    if (!tc.createdSubscriptions.includes(id)) {
      tc.createdSubscriptions.push(id);
      saveTcConfig(tc);
      console.log('Persisted created subscription id to tc_config:', id);
    }
  } catch (e) {
    console.error('Error persisting created subscription id:', e);
  }
}

async function subscribeEventSub(type, condition, sessionId) {
  console.log('Subscribing to EventSub:', type, condition);
  const fp = subFingerprint(type, condition);
  if (pendingSubFingerprints.has(fp)) {
    console.log('Subscription creation already pending for fingerprint, skipping:', fp);
    return null;
  }
  pendingSubFingerprints.add(fp);
  try {
    // First, list existing subscriptions and check for an existing match to avoid creating duplicates
    const listed = await listEventSubscriptions();
    const currentList = (listed && listed.data) ? listed.data : [];
    for (const cur of currentList) {
      try {
        if (subFingerprint(cur.type, cur.condition) === fp) {
          console.log('Found existing EventSub matching fingerprint, skipping POST:', fp, 'id:', cur.id);
          if (cur.id) addCreatedSubscriptionId(cur.id);
          return cur;
        }
      } catch (e) {
        // ignore per-item errors
      }
    }

    // If not present, proceed to create the subscription
    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        version: '1',
        condition,
        transport: {
          method: 'websocket',
          session_id: sessionId
        }
      })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      console.warn('Non-JSON response from subscribe POST; will attempt to confirm by re-listing', e);
    }

    if (response.status === 410 || (data && data.status === 410)) {
      console.warn(`Subscription type not available for ${type}:`, data);
      return null;
    }
    if (data && data.error) {
      console.error(`Failed to subscribe to ${type}:`, data);
    } else {
      console.log(`Subscription POST result for ${type}:`, data);
    }

    // If POST returned a subscription id, persist it. Otherwise, wait briefly and re-list to find it.
    if (data && data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].id) {
      const subId = data.data[0].id;
      addCreatedSubscriptionId(subId);
      return data;
    }

    // Short delay to allow Helix eventual consistency, then re-list and try to find the subscription
    await new Promise((resolve) => setTimeout(resolve, 800));
    const after = await listEventSubscriptions();
    const afterList = (after && after.data) ? after.data : [];
    for (const cur of afterList) {
      try {
        if (subFingerprint(cur.type, cur.condition) === fp) {
          if (cur.id) addCreatedSubscriptionId(cur.id);
          console.log('Found EventSub after create by re-listing:', cur.id);
          return cur;
        }
      } catch (e) {}
    }

    return data;
  } finally {
    try { pendingSubFingerprints.delete(fp); } catch (e) {}
  }
}

// List existing EventSub subscriptions (first page)
async function listEventSubscriptions() {
  try {
    const all = [];
    let cursor = null;
    const pageSize = 100; // max allowed by Helix is 100
    do {
      const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
      url.searchParams.set('first', String(pageSize));
      if (cursor) url.searchParams.set('after', cursor);
      const resp = await fetch(url.toString(), {
        headers: {
          'Client-ID': twitchClientId,
          'Authorization': `Bearer ${twitchToken}`
        }
      });
      const data = await resp.json();
      if (data && Array.isArray(data.data)) {
        all.push(...data.data);
      }
      cursor = (data && data.pagination && data.pagination.cursor) ? data.pagination.cursor : null;
      // stop if no more pages
    } while (cursor);
    return { data: all };
  } catch (err) {
    console.error('Error listing EventSub subscriptions:', err);
    return null;
  }
}

// Delete a subscription by id
async function deleteEventSubSubscription(id) {
  try {
    const resp = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`,
        'Content-Type': 'application/json'
      }
    });
    // Twitch may return 204 No Content or an empty body on DELETE. Don't assume JSON.
    if (resp.status === 204) {
      console.log('Deleted EventSub subscription (204 No Content):', id);
      return { status: 204 };
    }
    const text = await resp.text();
    let data = null;
    if (!text || text.trim().length === 0) {
      console.log('Deleted EventSub subscription (empty body):', id, 'status:', resp.status);
      data = { status: resp.status };
    } else {
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        // Non-JSON response; include raw text for debugging
        console.warn('Non-JSON response deleting subscription', id, 'body:', text);
        data = { status: resp.status, raw: text };
      }
    }
    console.log('Deleted EventSub subscription:', id, data);
    // If delete returned 404 or body indicates not found, treat as already-removed and prune locally
    try {
      const tc = loadTcConfig();
      // detect not-found condition in response data
      const notFound = (resp.status === 404) || (data && ((data.status === 404) || (data.error && /not found/i.test(String(data.error))) || (data.message && /not found/i.test(String(data.message)))));
      if (notFound) {
        // remove id from our createdSubscriptions if present
        if (tc.createdSubscriptions && Array.isArray(tc.createdSubscriptions)) {
          const idx = tc.createdSubscriptions.indexOf(id);
          if (idx !== -1) {
            tc.createdSubscriptions.splice(idx, 1);
            saveTcConfig(tc);
            console.log('Subscription not found on Twitch; removed id from createdSubscriptions:', id);
          }
        }
      } else {
        // For successful deletes (204 or JSON body), remove tracked id as before
        if (tc.createdSubscriptions && Array.isArray(tc.createdSubscriptions)) {
          const idx2 = tc.createdSubscriptions.indexOf(id);
          if (idx2 !== -1) {
            tc.createdSubscriptions.splice(idx2, 1);
            saveTcConfig(tc);
            console.log('Removed subscription id from createdSubscriptions:', id);
          }
        }
      }
    } catch (e) {
      console.error('Error removing deleted subscription id from tc_config:', e);
    }
    return data;
  } catch (err) {
    console.error('Error deleting EventSub subscription', id, err);
    return null;
  }
}

// Reconcile desired topic keys with current subscriptions: add missing, remove extras
async function reconcileEventSubTopics(desiredKeys) {
  if (!eventSubSessionId) {
    console.log('No EventSub session yet; saved topics will be applied when session opens.');
    return;
  }
  if (applyingEventSub) {
    console.log('Reconcile already running; skipping this invocation');
    return;
  }
  applyingEventSub = true;
  try {
    const tc = loadTcConfig();
    tc.topics = desiredKeys;
    saveTcConfig(tc);

    // Build desired subs mapping: key -> { type, condition }
    if (!twitchUserId) await getUserId();
    const desiredMap = {};
    for (const key of desiredKeys) {
      const sub = buildSubscriptionFromKey(key, twitchUserId);
      if (sub) desiredMap[key] = sub;
    }

    // Start or stop follower polling depending on whether 'channel.follow' is desired
    try {
      const wantsFollow = Array.isArray(desiredKeys) && desiredKeys.includes('channel.follow');
      if (wantsFollow) {
        if (!pollIntervalId) {
          // Ensure lastPollTime is initialized from tc_config
          try {
            const curTc = loadTcConfig();
            if (curTc && curTc.lastFollowerPoll) {
              lastPollTime = new Date(curTc.lastFollowerPoll);
            } else {
              lastPollTime = new Date();
              if (curTc) {
                curTc.lastFollowerPoll = lastPollTime.toISOString();
                saveTcConfig(curTc);
              }
            }
          } catch (e) {
            console.error('Error initializing lastPollTime for follower polling:', e);
            lastPollTime = new Date();
          }
          // Make sure we have a userId before polling
          if (!twitchUserId) await getUserId();
          // Run an immediate poll and then schedule periodic polling
          pollFollowers();
          pollIntervalId = setInterval(pollFollowers, 30000);
          console.log('Follower polling started (every 30s)');
        }
      } else {
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
          console.log('Follower polling stopped because channel.follow is no longer selected');
        }
      }
    } catch (e) {
      console.error('Error toggling follower polling based on desired topics:', e);
    }

    // Fetch current subscriptions from Twitch
    const current = await listEventSubscriptions();
    const currentSubs = (current && current.data) ? current.data : [];

    // Helper to find a current subscription that matches a desired sub (by type + condition)
    function matchSub(desired, cur) {
      if (!desired || !cur) return false;
      if (desired.type !== cur.type) return false;
      try {
        return subFingerprint(desired.type, desired.condition) === subFingerprint(cur.type, cur.condition);
      } catch (e) {
        return false;
      }
    }

    // Determine which desired keys are already present
    const presentKeys = new Set();
    for (const key of Object.keys(desiredMap)) {
      const desired = desiredMap[key];
      for (const cur of currentSubs) {
        if (matchSub(desired, cur)) {
          presentKeys.add(key);
          break;
        }
      }
    }

    // Add missing subscriptions
    for (const key of Object.keys(desiredMap)) {
      if (!presentKeys.has(key)) {
        // Do not attempt to create an EventSub for follows; we use polling instead
        if (key === 'channel.follow') {
          console.log('Skipping EventSub creation for channel.follow; using polling instead');
          continue;
        }
        console.log('Adding missing EventSub for key:', key);
        await subscribeEventSub(desiredMap[key].type, desiredMap[key].condition, eventSubSessionId);
      }
    }

    // Determine current subs that are not desired and remove them
    const tcState = loadTcConfig();
    const ownedIds = Array.isArray(tcState.createdSubscriptions) ? tcState.createdSubscriptions.slice() : [];
    for (const cur of currentSubs) {
      let shouldKeep = false;
      for (const key of Object.keys(desiredMap)) {
        if (matchSub(desiredMap[key], cur)) {
          shouldKeep = true;
          break;
        }
      }
      if (!shouldKeep) {
        // Do not manage 'channel.follow' via EventSub here; we rely on polling instead
        if (cur && cur.type === 'channel.follow') {
          console.log('Leaving existing channel.follow EventSub alone; using polling instead');
          continue;
        }
        // Only delete subscriptions we created. If we have no ownership info, fall back to deleting.
        if (ownedIds.length > 0 && (!cur.id || !ownedIds.includes(cur.id))) {
          console.log('Skipping deletion of EventSub we do not own:', cur.id, cur.type);
          continue;
        }
        // Delete this subscription
        console.log('Removing EventSub not in desired set (owned):', cur.id, cur.type);
        await deleteEventSubSubscription(cur.id);
      }
    }
  } catch (err) {
    console.error('Error reconciling EventSub topics:', err);
  }
  applyingEventSub = false;
}

// Map a friendly/topic key to the actual EventSub type and condition
function buildSubscriptionFromKey(key, userId) {
  switch (key) {
    case 'channel.channel_points_custom_reward_redemption':
      return { type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: userId } };
    case 'channel.subscribe':
      return { type: 'channel.subscribe', condition: { broadcaster_user_id: userId } };
    case 'channel.subscription.gift':
      return { type: 'channel.subscription.gift', condition: { broadcaster_user_id: userId } };
    case 'channel.subscription.message':
      return { type: 'channel.subscription.message', condition: { broadcaster_user_id: userId } };
    case 'channel.follow':
      return { type: 'channel.follow', condition: { broadcaster_user_id: userId } };
    case 'channel.raid':
      return { type: 'channel.raid', condition: { to_broadcaster_user_id: userId } };
    case 'channel.cheer':
    case 'channel.bits':
      return { type: 'channel.cheer', condition: { broadcaster_user_id: userId } };
    case 'channel.ban':
      return { type: 'channel.ban', condition: { broadcaster_user_id: userId } };
    default:
      return null;
  }
}

// Apply subscriptions for the given session id using saved tc_config topics
async function applyEventSubSubscriptions(sessionId) {
  if (applyingEventSub) {
    console.log('applyEventSubSubscriptions: another apply is running; skipping');
    return;
  }
  applyingEventSub = true;
  try {
    const tc = loadTcConfig();
    if (!tc || !Array.isArray(tc.topics) || tc.topics.length === 0) return;
    if (!twitchUserId) await getUserId();
    // Fetch current subscriptions and only add missing ones to avoid duplicates
    const current = await listEventSubscriptions();
    const currentSubs = (current && current.data) ? current.data : [];

    // Prune createdSubscriptions to remove ids that no longer exist on Twitch (avoid noisy deletes later)
    try {
      const presentIds = new Set((currentSubs || []).map(s => s.id).filter(Boolean));
      const tcCfg = loadTcConfig();
      if (tcCfg && Array.isArray(tcCfg.createdSubscriptions) && tcCfg.createdSubscriptions.length > 0) {
        const before = tcCfg.createdSubscriptions.slice();
        tcCfg.createdSubscriptions = tcCfg.createdSubscriptions.filter(i => presentIds.has(i));
        if (tcCfg.createdSubscriptions.length !== before.length) {
          saveTcConfig(tcCfg);
          console.log('Pruned stale createdSubscriptions that are no longer present on Twitch');
        }
      }
    } catch (e) { console.warn('Failed to prune createdSubscriptions at startup reconciliation:', e); }

    function matchSub(desired, cur) {
      if (!desired || !cur) return false;
      if (desired.type !== cur.type) return false;
      try {
        return subFingerprint(desired.type, desired.condition) === subFingerprint(cur.type, cur.condition);
      } catch (e) {
        return false;
      }
    }

    const desiredMap = {};
    for (const key of tc.topics) {
      const sub = buildSubscriptionFromKey(key, twitchUserId);
      if (sub) desiredMap[key] = sub;
    }

    const presentKeys = new Set();
    for (const key of Object.keys(desiredMap)) {
      for (const cur of currentSubs) {
        if (matchSub(desiredMap[key], cur)) {
          presentKeys.add(key);
          break;
        }
      }
    }

    for (const key of Object.keys(desiredMap)) {
      if (key === 'channel.follow') {
        // follows are handled by polling, not EventSub
        continue;
      }

      // If there are existing subscriptions that match by fingerprint, verify transport/session
      let keepSubscription = false;
      const matches = (currentSubs || []).filter(cur => {
        try { return matchSub(desiredMap[key], cur); } catch (e) { return false; }
      });

      if (matches.length > 0) {
        for (const cur of matches) {
          try {
            const transportType = (cur.transport && cur.transport.method) ? cur.transport.method : (cur.transport && cur.transport.type) ? cur.transport.type : null;
            // Normalize websocket detection: Twitch may expose transport.method or transport.type
            const isWebsocket = transportType && transportType.toLowerCase && transportType.toLowerCase().includes('websocket');
            const sessionIdMatch = (isWebsocket && cur.transport && cur.transport.session && cur.transport.session.id && eventSubSessionId && cur.transport.session.id === eventSubSessionId);
            if (isWebsocket && sessionIdMatch) {
              // Existing subscription is using our websocket session — keep it
              keepSubscription = true;
              break;
            } else {
              // Existing subscription is 'cold' (http callback) or belongs to a different websocket session — delete it so we can recreate on our session
              if (cur.id) {
                console.log('Existing subscription for key uses different transport/session — deleting to recreate:', key, cur.id);
                try { await deleteEventSubSubscription(cur.id); } catch (e) { console.warn('Failed to delete mismatched EventSub subscription', cur.id, e); }
              }
            }
          } catch (e) { console.warn('Error inspecting existing subscription for key', key, e); }
        }
      }

      if (keepSubscription) {
        console.log('Subscription already present for key with matching websocket session, skipping:', key);
        continue;
      }

      console.log('Applying missing EventSub for key on session welcome:', key);
      await subscribeEventSub(desiredMap[key].type, desiredMap[key].condition, sessionId);
    }
  } catch (err) {
    console.error('Error applying EventSub subscriptions:', err);
  }
  applyingEventSub = false;
}

function startTwitchEventSub({ username, oauth, clientId}) {
  console.log('Starting Twitch EventSub for user:', username);
  twitchUserName = username;
  twitchToken = oauth.replace('oauth:', '');
  // Ensure global clientId is set for subsequent API calls
  if (clientId) twitchClientId = clientId;

  getUserId().then((userId) => {
    twitchUserId = userId;
    // Load last poll timestamp from tc_config so we only report new followers since last run
    try {
      const tc = loadTcConfig();
      if (tc && tc.lastFollowerPoll) {
        lastPollTime = new Date(tc.lastFollowerPoll);
        console.log('Loaded lastFollowerPoll from tc_config:', lastPollTime);
      } else {
        // If there's no saved timestamp, set to now to avoid reporting historical followers
        lastPollTime = new Date();
        console.log('No lastFollowerPoll found, initializing to now:', lastPollTime);
        tc.lastFollowerPoll = lastPollTime.toISOString();
        saveTcConfig(tc);
      }
    } catch (err) {
      console.error('Error loading tc_config for lastFollowerPoll:', err);
      lastPollTime = new Date();
    }

    setInterval(pollFollowers, 30000);
    pollFollowers();
    // create and store the EventSub websocket so we can close it later if needed
    eventSubWs = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
    eventSubWs.on('open', () => {
      console.log('EventSub WebSocket connected');
    });
    eventSubWs.on('message', async (data) => {
      const msg = JSON.parse(data);
      console.log('Raw EventSub message:', msg);
      if (!eventSubSessionId && msg.metadata && msg.metadata.message_type === 'session_welcome') {
        eventSubSessionId = msg.payload.session.id;
        console.log('Session ID:', eventSubSessionId);
      }
      if (eventSubSessionId && !eventSubRegistered) {
        eventSubRegistered = true;
        // Apply saved/topic-selected subscriptions
        await applyEventSubSubscriptions(eventSubSessionId);
      }
      if (msg.metadata && msg.payload && msg.payload.subscription) {
        const type = msg.payload.subscription.type;
        const eventData = msg.payload.event;
        if (win && win.webContents) {
          win.webContents.send('twitch-eventsub', { type, event: eventData });
        }
        console.log(`[EventSub] ${type}:`, eventData);
      }
    });
    eventSubWs.on('error', (err) => {
      console.error('EventSub WebSocket error:', err);
    });
    eventSubWs.on('close', () => {
      console.log('EventSub WebSocket closed');
      // clear reference when closed
      eventSubWs = null;
    });
  }).catch((err) => {
    console.error('Failed to get userId:', err);
  });
}

ipcMain.on('twitch-eventsub-connect', (event, creds) => {
  // If payload contains topics array, save to tc_config and apply subscriptions
  if (creds && creds.topics && Array.isArray(creds.topics)) {
  // Reconcile changes: save desired topics and add/remove subscriptions appropriately
  reconcileEventSubTopics(creds.topics);
  } else {
    startTwitchEventSub(creds);
  }
});

// Accept fake/test events from renderer for testing bindings
ipcMain.on('twitch-fake-event', (event, evt) => {
  console.log('Received fake twitch event from renderer:', evt);
  // Forward to renderer as if it came from twitch
  if (win && win.webContents) {
    if (evt.type === 'chat') {
      win.webContents.send('twitch-chat-event', { 
        type: 'chat', 
        user: evt.user, 
        message: evt.message,
        badges: evt.badges || {},
        source: 'fake-event-ipc' // Debug: identify event source
      });
      // also run command matching logic to trigger media
      if (evt.message && evt.message.startsWith('!')) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const commandText = evt.message.split(' ')[0].substring(1).toLowerCase();
        config.buttons.forEach((btn) => {
          // Check if button has chat command enabled and keyword matches
          if (btn.chatCommand && btn.chatCommand.enabled && btn.chatCommand.keyword === commandText) {
            console.log(`[Fake Event] Triggering button "${btn.name || btn.label}" via chat command !${commandText}`);
            win.webContents.send('trigger-media', btn.label || btn.name);
          }
          // Legacy support: Also check old 'command' type buttons
          else if (btn.type === 'command' && btn.label.toLowerCase() === commandText) {
            console.log(`[Fake Event] Triggering legacy command button "${btn.label}" via chat command !${commandText}`);
            win.webContents.send('trigger-media', btn.label);
          }
        });
      }
    } else {
      win.webContents.send('twitch-eventsub', { type: evt.type || 'test', event: evt.event || {} });
    }
  }
});

// IPC handler to send fake Twitch events for testing
ipcMain.handle('send-fake-twitch-event', async (event, evt) => {
  console.log('Received fake twitch event via handle:', evt);
  // Forward to renderer as if it came from twitch
  if (win && win.webContents) {
    if (evt.type === 'chat') {
      win.webContents.send('twitch-chat-event', { 
        type: 'chat', 
        user: evt.user, 
        message: evt.message,
        badges: evt.badges || {},
        source: 'fake-event-handle' // Debug: identify event source
      });
      // also run command matching logic to trigger media
      if (evt.message && evt.message.startsWith('!')) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const commandText = evt.message.split(' ')[0].substring(1).toLowerCase();
        config.buttons.forEach((btn) => {
          // Check if button has chat command enabled and keyword matches
          if (btn.chatCommand && btn.chatCommand.enabled && btn.chatCommand.keyword === commandText) {
            console.log(`[Fake Event Handle] Triggering button "${btn.name || btn.label}" via chat command !${commandText}`);
            win.webContents.send('trigger-media', btn.label || btn.name);
          }
          // Legacy support: Also check old 'command' type buttons
          else if (btn.type === 'command' && btn.label.toLowerCase() === commandText) {
            console.log(`[Fake Event Handle] Triggering legacy command button "${btn.label}" via chat command !${commandText}`);
            win.webContents.send('trigger-media', btn.label);
          }
        });
      }
    } else {
      win.webContents.send('twitch-eventsub', { type: evt.type || 'test', event: evt.event || {} });
    }
  }
  return { success: true };
});

// Allow renderer to request a media trigger by label (used by event->sound mappings)
ipcMain.on('trigger-media-to-main', (event, label) => {
  try {
    if (win && !win.isDestroyed()) {
      console.log('Triggering media from renderer mapping:', label);
      win.webContents.send('trigger-media', label);
    }
  } catch (e) {
    console.error('Error handling trigger-media-to-main:', e);
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
          // Use name for multi-media buttons, label for others
          const identifier = btn.name || btn.label;
          win.webContents.send('trigger-media', identifier);
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

// Preferences management
function getStoredPreferences() {
  try {
    const preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
    if (fs.existsSync(preferencesPath)) {
      const data = fs.readFileSync(preferencesPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading preferences:', error);
  }
  return {}; // Return empty object if no preferences file exists
}

function saveStoredPreferences(preferences) {
  try {
    const preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
    fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
    console.log('Preferences saved to:', preferencesPath);
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

// Auto-updater event handlers
function setupAutoUpdater() {
  // Detect platform
  const isMac = process.platform === 'darwin';
  const isWindows = process.platform === 'win32';

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    
    if (isMac) {
      // macOS: unsigned builds can't auto-update, show download link
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Please visit the GitHub releases page to download the latest version.',
        buttons: ['Open GitHub Releases', 'Later'],
        defaultId: 0
      }).then(result => {
        if (result.response === 0) {
          require('electron').shell.openExternal('https://github.com/jontslater/VirtualDeck/releases/latest');
        }
      });
    } else if (isWindows) {
      // Windows: can auto-update even unsigned
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          if (win && !win.isDestroyed()) {
            win.webContents.send('update-downloading');
          }
        }
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available. Current version is latest:', info.version);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const msg = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    console.log(msg);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: 'The application will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
    dialog.showMessageBox(win, {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates',
      detail: err.message || 'Please try again later.',
      buttons: ['OK']
    });
  });
}

// Manual update check function
function checkForUpdates() {
  setupAutoUpdater();
  autoUpdater.checkForUpdates();
}

app.whenReady().then(() => {
  ensureUserData();
  createWindow();
  registerHotkeys();
  startOverlayServer();
  
  // Setup and check for updates on startup (delay by 3 seconds to let app initialize)
  setTimeout(() => {
    setupAutoUpdater();
    
    // Check if auto-update is enabled in preferences
    const preferences = getStoredPreferences();
    if (preferences.autoUpdate !== false) { // default to true if not set
      autoUpdater.checkForUpdates().catch(err => {
        console.log('Auto-update check failed (expected if not installed from installer):', err.message);
      });
    } else {
      console.log('Auto-update disabled in preferences');
    }
  }, 3000);
  
  // Build application menu: Edit contains Preferences, View & Window removed, Tools added
  const menuTemplate = [
    { label: 'File', submenu: [ { role: 'quit' } ] },
    { label: 'Edit', submenu: [
      { label: 'Preferences', accelerator: 'CmdOrCtrl+,', click: () => {
        if (win && !win.isDestroyed()) win.webContents.send('open-preferences');
      } }
    ] },
    { label: 'View', submenu: [
  { id: 'view_show_all', label: 'Show All', click: () => { if (win && !win.isDestroyed()) win.webContents.send('view-show-all'); } },
  { id: 'view_hide_all', label: 'Hide All', click: () => { if (win && !win.isDestroyed()) win.webContents.send('view-hide-all'); } },
      { type: 'separator' },
  { id: 'view_sound_grid', label: 'Sound Grid', type: 'checkbox', checked: true, click: (menuItem) => { if (win && !win.isDestroyed()) win.webContents.send('view-toggle', { key: 'sound-grid', checked: menuItem.checked }); } },
  { id: 'view_twitch_stats', label: 'Twitch Statistics', type: 'checkbox', checked: false, click: (menuItem) => { if (win && !win.isDestroyed()) win.webContents.send('view-toggle', { key: 'twitch-stats-container', checked: menuItem.checked }); } },
  { id: 'view_recent_activity', label: 'Recent Activity', type: 'checkbox', checked: false, click: (menuItem) => { if (win && !win.isDestroyed()) win.webContents.send('view-toggle', { key: 'recent-activity-container', checked: menuItem.checked }); } },
  { id: 'view_twitch_chat', label: 'Twitch Chat', type: 'checkbox', checked: false, click: (menuItem) => { if (win && !win.isDestroyed()) win.webContents.send('view-toggle', { key: 'twitch-chat-container', checked: menuItem.checked }); } },
  { id: 'view_sound_controls', label: 'Sound Controls', type: 'checkbox', checked: true, click: (menuItem) => { if (win && !win.isDestroyed()) win.webContents.send('view-toggle', { key: 'sound-controls', checked: menuItem.checked }); } }
    ] },
    { label: 'Tools', submenu: [
      { label: 'Check for Updates...', click: () => { checkForUpdates(); } },
      { type: 'separator' },
      { label: 'Developer Tools', accelerator: 'F12', click: () => { if (win && !win.isDestroyed()) win.webContents.toggleDevTools(); } },
      { label: 'Twitch Setup', submenu: [
          { label: 'View Twitch Events / Test Events', click: () => { if (win && !win.isDestroyed()) win.webContents.send('open-twitch-activity'); } },
          { label: 'EventSub Subscriptions (Select)', click: () => { if (win && !win.isDestroyed()) win.webContents.send('open-eventsub-subscriptions'); } },
          { label: 'Twitch Event Mapping', click: () => { if (win && !win.isDestroyed()) win.webContents.send('open-twitch-mapping'); } },
        { type: 'separator' },
        { label: 'Clear Twitch Credentials', click: () => { if (win && !win.isDestroyed()) win.webContents.send('clear-twitch-creds'); } }
      ] },
      { type: 'separator' },
      { label: 'Themes', submenu: [] }, // Will be populated dynamically with themes and skins
      { role: 'reload' }
    ] },
    { label: 'Help', submenu: [ 
      { label: 'About', click: () => {
        if (win && !win.isDestroyed()) win.webContents.send('show-about');
      } } 
    ] }
  ];
  // Function to rebuild menu with integrated themes and skins
  async function rebuildMenu() {
    try {
      console.log('Rebuilding menu with themes and skins...');
      // Get available skins
      const skins = [];
      if (fs.existsSync(userSkinsDir)) {
        const files = fs.readdirSync(userSkinsDir);
        console.log(`Found ${files.length} files in skins directory:`, files);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const skinPath = path.join(userSkinsDir, file);
            try {
              const skinData = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
              if (skinData.name && skinData.version) {
                skins.push({
                  id: path.basename(file, '.json'),
                  name: skinData.name,
                  description: skinData.description || '',
                  version: skinData.version,
                  author: skinData.author || '',
                  filename: file
                });
              }
            } catch (err) {
              console.warn(`Failed to parse skin file ${file}:`, err);
            }
          }
        }
      }
      const sortedSkins = skins.sort((a, b) => a.name.localeCompare(b.name));
      console.log(`Loaded ${sortedSkins.length} skins:`, sortedSkins.map(s => s.name));
      
      // Build integrated themes submenu (themes + skins)
      const themesSubmenu = [
        // Built-in themes
        { id: 'theme_dark', label: '🌙 Dark', type: 'radio', click: () => { if (win && !win.isDestroyed()) win.webContents.send('theme-change', 'dark'); } },
        { id: 'theme_light', label: '☀️ Light', type: 'radio', click: () => { if (win && !win.isDestroyed()) win.webContents.send('theme-change', 'light'); } },
        { id: 'theme_red', label: '❤️ Red', type: 'radio', click: () => { if (win && !win.isDestroyed()) win.webContents.send('theme-change', 'red'); } },
        { id: 'theme_purple', label: '💜 Purple', type: 'radio', click: () => { if (win && !win.isDestroyed()) win.webContents.send('theme-change', 'purple'); } },
        { id: 'theme_blue', label: '💙 Blue', type: 'radio', click: () => { if (win && !win.isDestroyed()) win.webContents.send('theme-change', 'blue'); } },
        { id: 'theme_darkpop', label: '🎵 Dark Pop', type: 'radio', click: () => { if (win && !win.isDestroyed()) win.webContents.send('theme-change', 'darkpop'); } }
      ];
      
      // Add skins as additional themes
      if (sortedSkins && sortedSkins.length > 0) {
        themesSubmenu.push({ type: 'separator' });
        for (const skin of sortedSkins) {
          themesSubmenu.push({
            id: `theme_${skin.id}`,
            label: `🎨 ${skin.name}`,
            type: 'radio',
            click: () => { if (win && !win.isDestroyed()) win.webContents.send('theme-change', skin.id); }
          });
        }
      }
      
      // Add management options
      themesSubmenu.push(
        { type: 'separator' },
        { label: 'Import Theme...', click: () => { if (win && !win.isDestroyed()) win.webContents.send('import-skin-dialog'); } },
        { label: 'Delete Theme...', click: () => { if (win && !win.isDestroyed()) win.webContents.send('delete-skin-dialog'); } },
        { label: 'Refresh Themes', click: () => { 
          if (win && !win.isDestroyed()) {
            rebuildMenu().catch(console.error);
          }
        } }
      );
      
      // Find and replace the themes submenu in menuTemplate
      const toolsMenu = menuTemplate.find(item => item.label === 'Tools');
      if (toolsMenu && toolsMenu.submenu) {
        console.log('Tools menu found, current submenu items:', toolsMenu.submenu.map(item => item.label || item.type));
        
        const themesMenuIndex = toolsMenu.submenu.findIndex(item => item.label === 'Themes');
        if (themesMenuIndex !== -1) {
          toolsMenu.submenu[themesMenuIndex].submenu = themesSubmenu;
        }
        
        // Ensure "Check for Updates" is preserved at the top of Tools menu
        const checkUpdatesIndex = toolsMenu.submenu.findIndex(item => item.label === 'Check for Updates...');
        console.log('Check for Updates index:', checkUpdatesIndex);
        
        if (checkUpdatesIndex === -1) {
          console.log('Adding Check for Updates to Tools menu');
          // Add "Check for Updates" at the beginning if it's missing
          toolsMenu.submenu.unshift(
            { label: 'Check for Updates...', click: () => { checkForUpdates(); } },
            { type: 'separator' }
          );
        } else {
          console.log('Check for Updates already exists at index:', checkUpdatesIndex);
        }
        
        console.log('Final Tools submenu items:', toolsMenu.submenu.map(item => item.label || item.type));
      } else {
        console.log('Tools menu not found or has no submenu');
      }
      
      // Preserve the Help menu with "Check for Updates" from original template
      const originalHelpMenu = menuTemplate.find(item => item.label === 'Help');
      
      const appMenu = Menu.buildFromTemplate(menuTemplate);
      Menu.setApplicationMenu(appMenu);
      console.log('Menu rebuilt successfully with themes and skins');
    } catch (error) {
      console.error('Error rebuilding menu:', error);
    }
  }

  // Build initial menu
  rebuildMenu().catch(console.error);

  // Listen for visibility prefs from renderer and sync menu checkbox states
  ipcMain.on('sync-view-prefs', (event, prefs) => {
    try {
      const menu = Menu.getApplicationMenu();
      if (!menu) return;
      const mapping = {
        'sound-grid': 'view_sound_grid',
        'twitch-stats-container': 'view_twitch_stats',
        'recent-activity-container': 'view_recent_activity',
        'twitch-chat-container': 'view_twitch_chat',
        'sound-controls': 'view_sound_controls'
      };
      Object.keys(mapping).forEach(componentId => {
        const itemId = mapping[componentId];
        const mi = menu.getMenuItemById ? menu.getMenuItemById(itemId) : null;
        if (mi && typeof mi.checked !== 'undefined') {
          mi.checked = !!(prefs && prefs[componentId]);
        }
      });
    } catch (e) {
      console.warn('Failed to sync view prefs to menu:', e);
    }
  });

  // Listen for theme changes from renderer and sync menu radio states
  ipcMain.on('sync-theme', (event, themeName) => {
    try {
      const menu = Menu.getApplicationMenu();
      if (!menu) return;
      
      // Clear all theme radio buttons (built-in themes)
      const builtInThemeIds = ['theme_dark', 'theme_light', 'theme_red', 'theme_purple', 'theme_blue', 'theme_darkpop'];
      builtInThemeIds.forEach(themeId => {
        const mi = menu.getMenuItemById ? menu.getMenuItemById(themeId) : null;
        if (mi && typeof mi.checked !== 'undefined') {
          mi.checked = false;
        }
      });
      
      // Clear all skin radio buttons (dynamic themes)
      const toolsMenu = menu.items.find(item => item.label === 'Tools');
      if (toolsMenu && toolsMenu.submenu) {
        const themesMenu = toolsMenu.submenu.items.find(item => item.label === 'Themes');
        if (themesMenu && themesMenu.submenu) {
          for (const item of themesMenu.submenu.items) {
            if (item.type === 'radio' && item.id && item.id.startsWith('theme_')) {
              item.checked = false;
            }
          }
        }
      }
      
      // Set the active theme
      const activeThemeId = `theme_${themeName}`;
      const activeMenuItem = menu.getMenuItemById ? menu.getMenuItemById(activeThemeId) : null;
      if (activeMenuItem && typeof activeMenuItem.checked !== 'undefined') {
        activeMenuItem.checked = true;
      }
      
      console.log('Synced theme menu to:', themeName);
    } catch (e) {
      console.error('Error syncing theme menu:', e);
    }
  });

  // Allow renderer to request applying a theme which will be broadcast back to renderer(s)
  ipcMain.on('request-apply-theme', (event, themeName) => {
    try {
      if (win && !win.isDestroyed()) {
        // Broadcast theme-change to the renderer processes
        win.webContents.send('theme-change', themeName);
      }
      // Also sync the native menu radio states
      ipcMain.emit('sync-theme', event, themeName);
    } catch (e) {
      console.warn('request-apply-theme failed', e);
    }
  });

  // Note: Skin functionality is now integrated into the theme system

  // Listen for menu refresh requests
  ipcMain.on('refresh-menu', () => {
    rebuildMenu().catch(console.error);
  });

  // Allow renderer to request toggling DevTools (used by renderer Tools menu)
  ipcMain.on('toggle-devtools', () => {
    try {
      if (win && !win.isDestroyed()) win.webContents.toggleDevTools();
    } catch (e) {
      console.warn('toggle-devtools failed', e);
    }
  });

  // Window control IPC handlers from renderer app toolbar
  ipcMain.on('window-minimize', () => {
    try { if (win && !win.isDestroyed()) win.minimize(); } catch (e) { console.warn('window-minimize failed', e); }
  });
  ipcMain.on('window-toggle-maximize', () => {
    try {
      if (!win || win.isDestroyed()) return;
      if (win.isMaximized()) win.unmaximize(); else win.maximize();
    } catch (e) { console.warn('window-toggle-maximize failed', e); }
  });
  ipcMain.on('window-close', () => {
    try { if (win && !win.isDestroyed()) win.close(); } catch (e) { console.warn('window-close failed', e); }
  });

  // Handle window move requests from renderer
  ipcMain.on('move-window', (event, position) => {
    try {
      if (!win || win.isDestroyed()) return;
      const currentPos = win.getPosition();
      win.setPosition(currentPos[0] + position.x, currentPos[1] + position.y);
    } catch (e) { console.warn('move-window failed', e); }
  });

  // Allow renderer to request the Preferences view (forward to renderer)
  ipcMain.on('open-preferences', () => {
    try { if (win && !win.isDestroyed()) win.webContents.send('open-preferences'); } catch (e) { console.warn('open-preferences failed', e); }
  });

  // Allow renderer to get the current overlay server URL
  ipcMain.handle('get-overlay-url', async () => {
    return getOverlayServerUrl();
  });

  // Handle preferences save from renderer
  ipcMain.on('save-preferences', (event, preferences) => {
    try {
      console.log('Saving preferences:', preferences);
      saveStoredPreferences(preferences);
    } catch (e) { console.warn('save-preferences failed', e); }
  });

  // Handle manual check for updates from renderer
  ipcMain.on('check-for-updates', () => {
    try {
      console.log('Manual update check requested from preferences');
      checkForUpdates();
    } catch (e) { console.warn('check-for-updates failed', e); }
  });

  // Overlay communication handlers - now using WebSocket broadcast
  ipcMain.on('overlay-message', (event, message) => {
    try {
      console.log('📨 Overlay message received:', message);
      console.log('🎯 Message type:', message.type);
      console.log('🎯 Target overlay:', message.targetOverlay);
      console.log('🎯 Available overlays in registry:', Array.from(overlayRegistry.keys()));
      
      // Extract target overlay from message (if specified)
      const targetOverlay = message.targetOverlay || null;
      console.log('🎯 Broadcasting to overlay:', targetOverlay);
      
      broadcastToOverlay(message, targetOverlay);
    } catch (e) { 
      console.warn('overlay-message failed', e); 
    }
  });

  ipcMain.on('overlay-clear-all', (event) => {
    try {
      console.log('Overlay clear all requested');
      broadcastToOverlay({ type: 'overlay-clear-all' });
    } catch (e) { 
      console.warn('overlay-clear-all failed', e); 
    }
  });

  ipcMain.on('overlay-text', (event, data) => {
    try {
      console.log('Overlay text message:', data);
      broadcastToOverlay({ 
        type: 'overlay-text', 
        position: data.position, 
        text: data.text 
      });
    } catch (e) { 
      console.warn('overlay-text failed', e); 
    }
  });

  ipcMain.on('overlay-image', (event, data) => {
    try {
      console.log('Overlay image message:', data);
      broadcastToOverlay({ 
        type: 'overlay-image', 
        position: data.position, 
        imageUrl: data.imageUrl 
      });
    } catch (e) { 
      console.warn('overlay-image failed', e); 
    }
  });

  ipcMain.on('overlay-video', (event, data) => {
    try {
      console.log('Overlay video message:', data);
      broadcastToOverlay({ 
        type: 'overlay-video', 
        position: data.position, 
        videoUrl: data.videoUrl 
      });
    } catch (e) { 
      console.warn('overlay-video failed', e); 
    }
  });

  // IPC handler to get connected overlays
  ipcMain.handle('get-connected-overlays', () => {
    const connections = [];
    overlayRegistry.forEach((clients, overlayName) => {
      const activeClients = Array.from(clients).filter(client => client.readyState === WebSocket.OPEN);
      if (activeClients.length > 0) {
        connections.push({
          name: overlayName,
          connected: true,
          clientCount: activeClients.length
        });
      }
    });
    return connections;
  });

  // Overlay is now a browser source - no window management needed

  // Propagate maximize/unmaximize events to renderer so UI can update
  if (win) {
    win.on('maximize', () => {
      try { win.webContents.send('window-maximized'); } catch (e) {}
    });
    win.on('unmaximize', () => {
      try { win.webContents.send('window-unmaximized'); } catch (e) {}
    });
  }

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

// IPC: Clear stored Twitch credentials, close EventSub and chat connections, and remove created subscriptions
ipcMain.on('twitch-clear-creds', async (event) => {
  console.log('Received twitch-clear-creds request; shutting down Twitch connections and clearing credentials');
  // allow caller to pass options via event (ipcRenderer.send(channel, opts))
  const callerOpts = (event && event.args && event.args[0]) ? event.args[0] : {};
  const purgeTopicsRequested = !!(callerOpts && callerOpts.purgeTopics);
  try {
    // Stop follower polling
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
      console.log('Stopped follower polling');
    }
    // Close EventSub websocket if present
    try {
      if (eventSubWs) {
        try { eventSubWs.close(); } catch (e) { console.warn('Error closing EventSub websocket:', e); }
        eventSubWs = null;
      }
    } catch (e) { console.warn('Error while closing EventSub websocket', e); }
    // Delete created subscriptions we tracked and collect per-id results
    const deletionResults = [];
    try {
      const tc = loadTcConfig();
      const owned = Array.isArray(tc.createdSubscriptions) ? tc.createdSubscriptions.slice() : [];
      for (const id of owned) {
        try {
          const res = await deleteEventSubSubscription(id);
          deletionResults.push({ id, success: true, result: res });
        } catch (e) {
          console.warn('Error deleting subscription', id, e);
          deletionResults.push({ id, success: false, error: String(e) });
        }
      }
      // clear createdSubscriptions list
      tc.createdSubscriptions = [];
      // optionally purge saved topics if requested by caller
      let purgedTopics = false;
      if (purgeTopicsRequested) {
        tc.topics = [];
        purgedTopics = true;
      }
      saveTcConfig(tc);
      // attach deletionResults and purgedTopics to the result object below
      // will be sent to renderer once teardown completes
      event.deletionResults = deletionResults;
      event.purgedTopics = purgedTopics;
    } catch (e) { console.warn('Error cleaning created subscriptions state', e); }
    // Disconnect chat client
    try {
      if (twitchClient && typeof twitchClient.disconnect === 'function') {
        await twitchClient.disconnect();
        twitchClient = null;
        console.log('Disconnected twitch chat client');
      }
    } catch (e) { console.warn('Error disconnecting twitch client', e); }
    // Clear in-memory state
    eventSubSessionId = null;
    eventSubRegistered = false;
    twitchUserId = null;
    twitchToken = null;
    twitchClientId = null;
    twitchUserName = null;
    lastFollowerIds = [];
    lastPollTime = null;
    recentChatUserState.clear();

    // Notify renderer with detailed result
    if (win && !win.isDestroyed()) {
      const payload = {
        success: true,
        deletions: event.deletionResults || [],
        purgedTopics: !!event.purgedTopics
      };
      win.webContents.send('twitch-clear-result', payload);
      // also keep a simple cleared signal for backward-compat
      win.webContents.send('twitch-cleared');
    }
  } catch (err) {
    console.error('Error handling twitch-clear-creds:', err);
  }
});
