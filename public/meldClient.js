// public/meldClient.js
// Lightweight client for connecting VirtualDeck to Meld Studio's WebChannel API
// Focused initially on scene switching (showScene), but extensible for other actions.

(function () {
  const MELD_ADDRESS = '127.0.0.1';
  const MELD_PORT = 13376;

  const QWEBCHANNEL_SCRIPT = 'https://packages.streamwithmeld.com/qt6.8/qwebchannel.min.js';

  let socket = null;
  let channel = null;
  let meld = null;
  let readyPromise = null;

  function loadQWebChannel() {
    return new Promise((resolve, reject) => {
      if (typeof QWebChannel !== 'undefined') {
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-qwebchannel]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load QWebChannel')));
        return;
      }
      const script = document.createElement('script');
      script.src = QWEBCHANNEL_SCRIPT;
      script.dataset.qwebchannel = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load QWebChannel script'));
      document.head.appendChild(script);
    });
  }

  function log(...args) {
    // Prefix logs so they're easy to filter in DevTools
    console.log('[MeldClient]', ...args);
  }

  function connect() {
    if (readyPromise) {
      return readyPromise;
    }

    readyPromise = new Promise((resolve, reject) => {
      try {
        log(`Connecting to Meld WebChannel at ws://${MELD_ADDRESS}:${MELD_PORT} ...`);
        loadQWebChannel()
          .then(() => {
            socket = new WebSocket(`ws://${MELD_ADDRESS}:${MELD_PORT}`);
            bindSocket(resolve, reject);
          })
          .catch(reject);
      } catch (e) {
        log('❌ Error creating WebSocket connection:', e);
        readyPromise = null;
        reject(e);
      }
    });

    return readyPromise;
  }

  function bindSocket(resolve, reject) {
        socket.onopen = function () {
          if (typeof QWebChannel === 'undefined') {
            log('❌ QWebChannel is not available. Is qwebchannel.min.js loaded?');
            reject(new Error('QWebChannel not available'));
            return;
          }

          // Create the WebChannel and expose the meld object
          channel = new QWebChannel(socket, function (ch) {
            meld = ch.objects.meld;
            if (!meld) {
              log('❌ Connected but `meld` object is not available on channel.objects');
              reject(new Error('Meld object not found on channel'));
              return;
            }

            log('✅ Connected to Meld WebChannel. API version:', meld.version || 1);
            resolve(meld);
          });
        };

        socket.onerror = function (err) {
          log('❌ WebSocket error:', err);
          // Don't immediately reject; connection may retry later if user opens Meld
          reject(err);
        };

        socket.onclose = function () {
          log('ℹ️ WebSocket closed.');
          socket = null;
          channel = null;
          meld = null;
          readyPromise = null;
        };
  }

  async function ensureConnected() {
    try {
      const m = await connect();
      return m;
    } catch (err) {
      log('⚠️ Failed to connect to Meld. Is Meld Studio running?', err);
      return null;
    }
  }

  async function showScene(sceneId) {
    const m = await ensureConnected();
    if (!m) {
      return { ok: false, reason: 'no-connection' };
    }

    if (!sceneId) {
      log('⚠️ showScene called without a sceneId');
      return { ok: false, reason: 'missing-sceneId' };
    }

    try {
      log('🎬 Calling meld.showScene for sceneId:', sceneId);
      m.showScene(sceneId);
      return { ok: true };
    } catch (e) {
      log('❌ Error calling meld.showScene:', e);
      return { ok: false, reason: 'exception', error: e };
    }
  }

  async function getSessionItems() {
    const m = await ensureConnected();
    if (!m) {
      return null;
    }
    try {
      return m.session && m.session.items ? m.session.items : null;
    } catch (e) {
      log('❌ Error reading meld.session.items:', e);
      return null;
    }
  }

  async function getScenes() {
    const items = await getSessionItems();
    if (!items) {
      throw new Error('Meld Studio is not running or has no session.');
    }
    const scenes = [];
    for (const [id, item] of Object.entries(items)) {
      if (item && item.type === 'scene' && item.name != null) {
        scenes.push({ id, name: item.name });
      }
    }
    scenes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return scenes;
  }

  async function recordClip() {
    const m = await ensureConnected();
    if (!m) {
      return { ok: false, reason: 'no-connection' };
    }

    try {
      if (typeof m.sendCommand !== 'function') {
        log('❌ meld.sendCommand is not available on this Meld version');
        return { ok: false, reason: 'no-sendCommand' };
      }
      log('🎬 Calling meld.sendCommand("meld.recordClip")');
      m.sendCommand('meld.recordClip');
      return { ok: true };
    } catch (e) {
      log('❌ Error calling meld.recordClip:', e);
      return { ok: false, reason: 'exception', error: e };
    }
  }

  async function refreshBrowserSources(layerName = null, waitForSceneName = null) {
    const m = await ensureConnected();
    if (!m) {
      return { ok: false, reason: 'no-connection' };
    }

    try {
      // If waitForSceneName is provided, poll until current scene matches
      if (waitForSceneName) {
        log(`⏳ Waiting for scene "${waitForSceneName}" to become active...`);
        const maxWaitMs = 3000;
        const pollIntervalMs = 100;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitMs) {
          const items = await getSessionItems();
          if (items) {
            const currentSceneId = m.currentScene;
            const currentScene = items[currentSceneId];
            
            if (currentScene && currentScene.name === waitForSceneName) {
              log(`✅ Scene "${waitForSceneName}" is now active`);
              break;
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }
      }

      const items = await getSessionItems();
      if (!items) {
        return { ok: false, reason: 'no-session' };
      }

      const currentSceneId = m.currentScene;
      if (!currentSceneId) {
        log('⚠️ No current scene found');
        return { ok: false, reason: 'no-current-scene' };
      }

      const browserLayers = [];
      for (const [id, item] of Object.entries(items)) {
        if (item && item.type === 'layer' && item.parent === currentSceneId && item.url) {
          if (!layerName || item.name === layerName) {
            browserLayers.push({ id, name: item.name });
          }
        }
      }

      if (browserLayers.length === 0) {
        log('⚠️ No browser source layers found' + (layerName ? ` matching "${layerName}"` : ''));
        return { ok: false, reason: 'no-browser-layers' };
      }

      log(`🔄 Refreshing ${browserLayers.length} browser source(s)...`);
      
      for (const layer of browserLayers) {
        if (typeof m.toggleLayer !== 'function') {
          log('❌ meld.toggleLayer is not available on this Meld version');
          return { ok: false, reason: 'no-toggleLayer' };
        }
        
        m.toggleLayer(currentSceneId, layer.id);
        await new Promise(resolve => setTimeout(resolve, 100));
        m.toggleLayer(currentSceneId, layer.id);
        log(`  ✅ Refreshed: ${layer.name}`);
      }

      return { ok: true, count: browserLayers.length };
    } catch (e) {
      log('❌ Error refreshing browser sources:', e);
      return { ok: false, reason: 'exception', error: e };
    }
  }

  // Expose a small API on window for use in script.js and DevTools
  window.meldClient = {
    connect,
    showScene,
    getScenes,
    recordClip,
    refreshBrowserSources,
    getSessionItems,
    getMeld: () => meld
  };
})();
