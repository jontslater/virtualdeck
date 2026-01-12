// public/meldClient.js
// Lightweight client for connecting VirtualDeck to Meld Studio's WebChannel API
// Focused initially on scene switching (showScene), but extensible for other actions.

(function () {
  const MELD_ADDRESS = '127.0.0.1';
  const MELD_PORT = 13376;

  let socket = null;
  let channel = null;
  let meld = null;
  let readyPromise = null;

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

        socket = new WebSocket(`ws://${MELD_ADDRESS}:${MELD_PORT}`);

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
      } catch (e) {
        log('❌ Error creating WebSocket connection:', e);
        readyPromise = null;
        reject(e);
      }
    });

    return readyPromise;
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

  // Expose a small API on window for use in script.js and DevTools
  window.meldClient = {
    connect,
    showScene,
    getSessionItems,
    getMeld: () => meld
  };
})();
