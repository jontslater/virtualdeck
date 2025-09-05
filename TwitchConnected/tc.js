// TwitchConnected/tc.js
// Scaffolding for Twitch Connect UI, config modal, and event handler

// Load config from localStorage on startup
window.twitchConfig = {
  oauth: localStorage.getItem('twitch_oauth') || '',
  twitch_ClientId: localStorage.getItem('twitch_clientid') || '',
  channel: localStorage.getItem('twitch_channel') || '',
};

window.twitchConnectionState = 'disconnected'; // Initial state

function showTwitchConfigModal() {
  let modal = document.getElementById('twitch-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'twitch-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.color = '#222';
    modal.style.padding = '32px';
    modal.style.borderRadius = '16px';
    modal.style.zIndex = '10001';
    modal.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
    modal.style.maxWidth = '420px';
    modal.style.width = '95%';
    modal.innerHTML = `
      <h2 style="text-align:center; margin-bottom:18px;">Setup Required</h2>
      <div style="margin-bottom:18px;">
        <strong>Instructions:</strong>
        <ul style="margin-bottom:12px;">
          <li>Go to <a href='https://twitchtokengenerator.com' target='_blank'>twitchtokengenerator.com</a>.</li>
          <li><strong>Important:</strong> Choose <b>Custom Token</b> and scroll down to bottom of the 'Available Token Scopes' and select <b>all token permissions</b> when generating your token.</li>
          <li>When you click <b>Generate Token!</b> you will be asked to log in with your Twitch account.</li>
          <li>Generate and copy your <b>ACCESS TOKEN</b>, <b>CLIENT_ID</b>, and <b>TWITCH_USER_NAME</b> from the site.</li>
          <li>Paste each value below.</li>
        </ul>
        After entering these values, click <b>Save</b>. You can reset them later in the app under Settings if needed.
      </div>
      <label for="twitch-oauth" style="font-weight:bold;">ACCESS_TOKEN:</label><br>
      <input id="twitch-oauth" type="text" style="width:100%;margin-bottom:14px;padding:8px;font-size:1em;background:#222;color:#fff;border-radius:6px;border:1px solid #ccc;" /><br>
      <label for="twitch-clientid" style="font-weight:bold;">CLIENT_ID:</label><br>
      <input id="twitch-clientid" type="text" style="width:100%;margin-bottom:14px;padding:8px;font-size:1em;background:#222;color:#fff;border-radius:6px;border:1px solid #ccc;" /><br>
      <label for="twitch-channel" style="font-weight:bold;">TWITCH_USER_NAME:</label><br>
      <input id="twitch-channel" type="text" style="width:100%;margin-bottom:18px;padding:8px;font-size:1em;background:#222;color:#fff;border-radius:6px;border:1px solid #ccc;" /><br>
      <button id="twitch-save" style="width:100%;background:#a6f34a;color:#222;font-weight:bold;padding:10px 0;border:none;border-radius:6px;font-size:1.1em;cursor:pointer;">Save</button>
      <button id="twitch-cancel" style="width:100%;margin-top:8px;background:#eee;color:#222;padding:8px 0;border:none;border-radius:6px;font-size:1em;cursor:pointer;">Cancel</button>
    `;
    document.body.appendChild(modal);
    // Load values from localStorage if they exist
    document.getElementById('twitch-oauth').value = localStorage.getItem('twitch_oauth') || '';
    document.getElementById('twitch-clientid').value = localStorage.getItem('twitch_clientid') || '';
    document.getElementById('twitch-channel').value = localStorage.getItem('twitch_channel') || '';
    document.getElementById('twitch-save').onclick = () => {
      window.twitchConfig.oauth = document.getElementById('twitch-oauth').value.trim();
      window.twitchConfig.clientId = document.getElementById('twitch-clientid').value.trim();
      window.twitchConfig.channel = document.getElementById('twitch-channel').value.trim();
      // Save to localStorage
      localStorage.setItem('twitch_oauth', window.twitchConfig.oauth);
      localStorage.setItem('twitch_clientid', window.twitchConfig.clientId);
      localStorage.setItem('twitch_channel', window.twitchConfig.channel);
      modal.remove();
      // Send credentials to main process to start Twitch chat connection
      console.log('Sending Twitch connect IPC');
      if (window.electronAPI && window.electronAPI.sendTwitchConnect) {
        console.log('Sending via electronAPI');
        window.electronAPI.sendTwitchConnect({
          username: window.twitchConfig.channel,
          oauth: window.twitchConfig.oauth,
          clientId: window.twitchConfig.clientId
        });
      } else if (window.ipcRenderer) {
        console.log('Sending via ipcRenderer');
        window.ipcRenderer.send('twitch-connect', {
          username: window.twitchConfig.channel,
          oauth: window.twitchConfig.oauth,
          clientId: window.twitchConfig.clientId
        });
      }
      console.log('adding connecting to twitch chat...');
      connectToTwitch();
    };
    document.getElementById('twitch-cancel').onclick = () => modal.remove();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const twitchBtn = document.getElementById('twitch-connect');
  if (twitchBtn) {
    twitchBtn.innerHTML = '';
    const img = document.createElement('img');
    img.src = '../TwitchConnected/tc.gif';
    img.alt = 'Twitch Connect';
    twitchBtn.appendChild(img);
    // Set aria-label for accessibility
    twitchBtn.setAttribute('aria-label', 'Connect to Twitch');
    // Set initial disconnected style
    twitchBtn.classList.remove('connected');
    twitchBtn.classList.add('disconnected');
    // Click logic based on connection state
    twitchBtn.onclick = () => {
      if (window.twitchConnectionState !== 'connected') {
        showTwitchConfigModal();
      } else {
        // Optionally show a status or disconnect modal
        alert('Already connected to Twitch!');
      }
    };
  }
  // Listen for Twitch connection status from main process
  if (window.electronAPI && window.electronAPI.onTwitchConnected) {
    window.electronAPI.onTwitchConnected(() => {
      const btn = document.getElementById('twitch-connect-btn');
      if (btn) {
        btn.textContent = 'Connected';
        btn.style.backgroundColor = '#2ecc40'; // green
      }
    });
  } else if (window.ipcRenderer) {
    window.ipcRenderer.on('twitch-connected', () => {
      const btn = document.getElementById('twitch-connect-btn');
      if (btn) {
        btn.textContent = 'Connected';
        btn.style.backgroundColor = '#2ecc40'; // green
      }
    });
  }
});

function areTwitchCredsValid(config) {
  return config.oauth && config.clientId && config.channel;
}

// Placeholder for Twitch chat and eventsub connection
function connectToTwitch() {
  if (!areTwitchCredsValid(window.twitchConfig)) {
    alert('Please enter all Twitch credentials before connecting.');
    return;
  }
  // All Twitch chat logic will be handled in main.js via require('tmi.js') and IPC
  window.twitchConnectionState = 'connected';
  const twitchBtn = document.getElementById('twitch-connect');
  if (twitchBtn) {
    twitchBtn.classList.remove('disconnected');
    twitchBtn.classList.add('connected');
    twitchBtn.setAttribute('title', 'Connected to Twitch');
  }
  let status = document.getElementById('twitch-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'twitch-status';
    status.style.position = 'fixed';
    status.style.bottom = '20px';
    status.style.right = '20px';
    status.style.background = '#6441a5';
    status.style.color = '#fff';
    status.style.padding = '10px 18px';
    status.style.borderRadius = '8px';
    status.style.zIndex = '10002';
    document.body.appendChild(status);
  }
  status.textContent = `Twitch Connected: ${window.twitchConfig.channel}`;
}

// Event handler for Twitch events
function handleTwitchEvent(event) {
  // Example event: { type: 'chat', user: '...', message: '...' }
  // Here you would check event type/message and trigger sound
  // Example: if event.message matches a sound card label, play it
  if (event.type === 'chat' && event.message === '!sound') {
    // Replace with your sound trigger logic
    if (window.electronAPI && window.electronAPI.onTriggerMedia) {
      window.electronAPI.onTriggerMedia('applause'); // Example label
    }
    // Or call your frontend sound trigger function
    // window.triggerSound('applause');
  }
}
