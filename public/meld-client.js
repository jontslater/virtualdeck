/**
 * Meld Studio WebChannel API client for VirtualDeck.
 * Connects to Meld at ws://127.0.0.1:13376 and provides getScenes() / showScene(id).
 * API docs: https://github.com/MeldStudio/streamdeck/blob/main/WebChannelAPI.md
 */
(function () {
  const MELD_WS_URL = 'ws://127.0.0.1:13376';
  const QWEBCHANNEL_SCRIPT = 'https://packages.streamwithmeld.com/qt6.8/qwebchannel.min.js';

  let socket = null;
  let channel = null;
  let meld = null;
  let QWebChannel = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.QWebChannel) {
        QWebChannel = window.QWebChannel;
        return resolve();
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        QWebChannel = window.QWebChannel;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load QWebChannel script'));
      document.head.appendChild(script);
    });
  }

  function connect() {
    return new Promise((resolve, reject) => {
      if (meld) {
        return resolve(meld);
      }
      if (!QWebChannel) {
        loadScript(QWEBCHANNEL_SCRIPT)
          .then(() => connect().then(resolve, reject))
          .catch(reject);
        return;
      }
      try {
        socket = new WebSocket(MELD_WS_URL);
      } catch (e) {
        reject(e);
        return;
      }
      socket.onopen = function () {
        try {
          channel = new QWebChannel(socket, function (ch) {
            meld = ch.objects.meld;
            if (meld) {
              resolve(meld);
            } else {
              reject(new Error('Meld API object not found'));
            }
          });
        } catch (e) {
          reject(e);
        }
      };
      socket.onclose = function () {
        socket = null;
        channel = null;
        meld = null;
      };
      socket.onerror = function () {
        reject(new Error('WebSocket connection failed. Is Meld Studio running?'));
      };
    });
  }

  /**
   * Fetch list of scenes from Meld. Returns [{ id, name }, ...].
   */
  async function getScenes() {
    const m = await connect();
    const items = m.session && m.session.items ? m.session.items : {};
    const scenes = [];
    for (const [id, item] of Object.entries(items)) {
      if (item && item.type === 'scene' && item.name != null) {
        scenes.push({ id, name: item.name });
      }
    }
    scenes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return scenes;
  }

  /**
   * Switch Meld to the given scene by ID.
   */
  async function showScene(sceneId) {
    const m = await connect();
    m.showScene(sceneId);
  }

  /**
   * Check if Meld is reachable (optional quick check).
   */
  async function isConnected() {
    try {
      await connect();
      return true;
    } catch (_) {
      return false;
    }
  }

  window.meldClient = {
    getScenes,
    showScene,
    isConnected,
    connect
  };
})();
