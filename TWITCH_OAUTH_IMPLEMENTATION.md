# Twitch OAuth Implementation Guide

## Overview
This guide outlines how to implement direct Twitch OAuth 2.0 authentication in VirtualDeck, replacing the current manual token entry system with a "Login with Twitch" button flow similar to MixItUp Bot and FrostyTools.

## Current Implementation
- Manual token entry from twitchtokengenerator.com
- Users paste OAuth token, Client ID, and username
- Tokens stored in localStorage
- Located in: `TwitchConnected/tc.js` (lines 122-156)

---

## Implementation Steps

### 1. Register Twitch Application

**Requirements:**
1. Go to https://dev.twitch.tv/console/apps
2. Create a new application
3. Set OAuth Redirect URLs:
   - `http://localhost:3000/auth/callback` (for development)
   - `virtualdeck://auth/callback` (for production using custom protocol)
4. Note your **Client ID** and **Client Secret**

**Required Scopes:**
```javascript
const requiredScopes = [
  'chat:read',           // Read chat messages
  'chat:edit',           // Send chat messages
  'channel:read:subscriptions',  // Read subscription info
  'channel:read:redemptions',    // Read channel point redemptions
  'moderator:read:followers',    // Read follower info
  'channel:manage:redemptions',  // Manage channel points
  'bits:read',           // Read bits/cheers
  'channel:read:hype_train',     // Read hype train events
  'moderator:read:chatters',     // Read chatters list
  'user:read:email'      // Optional: Read user email
];
```

---

### 2. OAuth Flow Implementation

#### Option A: Localhost Callback Server (Simpler)

**Install Dependencies:**
```bash
npm install express
```

**In `main.js`, add:**

```javascript
const express = require('express');
const { shell } = require('electron');

// Twitch OAuth Configuration
const TWITCH_CLIENT_ID = 'YOUR_CLIENT_ID';
const TWITCH_CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

let oauthServer = null;

// Start OAuth flow
function startTwitchOAuth() {
  const scopes = [
    'chat:read',
    'chat:edit',
    'channel:read:subscriptions',
    'channel:read:redemptions',
    'moderator:read:followers',
    'channel:manage:redemptions',
    'bits:read',
    'channel:read:hype_train',
    'moderator:read:chatters'
  ].join('+');
  
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scopes}`;
  
  // Start callback server first
  startCallbackServer();
  
  // Open Twitch login in default browser
  shell.openExternal(authUrl);
}

// Start local server to catch OAuth callback
function startCallbackServer() {
  if (oauthServer) return; // Already running
  
  const app = express();
  
  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    
    if (error) {
      res.send(`<html><body><h1>Authentication Failed</h1><p>${error}</p><p>You can close this window.</p></body></html>`);
      oauthServer.close();
      oauthServer = null;
      return;
    }
    
    if (code) {
      try {
        // Exchange code for access token
        const tokenData = await exchangeCodeForToken(code);
        
        // Get user info
        const userInfo = await getTwitchUserInfo(tokenData.access_token);
        
        // Save tokens securely
        await saveOAuthTokens({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          username: userInfo.login,
          user_id: userInfo.id,
          expires_at: Date.now() + (tokenData.expires_in * 1000)
        });
        
        // Send success to renderer
        if (win && !win.isDestroyed()) {
          win.webContents.send('twitch-oauth-success', {
            username: userInfo.login
          });
        }
        
        // Start Twitch connection
        startTwitchChatConnection({
          username: userInfo.login,
          oauth: tokenData.access_token,
          clientId: TWITCH_CLIENT_ID
        });
        
        res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1 style="color:#9146FF;">✓ Login Successful!</h1><p>Connected as <strong>${userInfo.display_name}</strong></p><p>You can close this window now.</p></body></html>`);
        
        // Close server after 5 seconds
        setTimeout(() => {
          if (oauthServer) {
            oauthServer.close();
            oauthServer = null;
          }
        }, 5000);
        
      } catch (error) {
        console.error('OAuth error:', error);
        res.send(`<html><body><h1>Authentication Error</h1><p>${error.message}</p></body></html>`);
        
        if (oauthServer) {
          oauthServer.close();
          oauthServer = null;
        }
      }
    }
  });
  
  oauthServer = app.listen(3000, () => {
    console.log('OAuth callback server listening on port 3000');
  });
  
  // Close server after 5 minutes if no response
  setTimeout(() => {
    if (oauthServer) {
      oauthServer.close();
      oauthServer = null;
      console.log('OAuth callback server timeout');
    }
  }, 300000);
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }
  
  return await response.json();
  // Returns: { access_token, refresh_token, expires_in, scope, token_type }
}

// Get Twitch user info from access token
async function getTwitchUserInfo(accessToken) {
  const response = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to get user info');
  }
  
  const data = await response.json();
  return data.data[0]; // { id, login, display_name, ... }
}

// Save OAuth tokens securely (use electron-store or similar)
async function saveOAuthTokens(tokens) {
  // Option 1: Use electron-store (recommended)
  // const Store = require('electron-store');
  // const store = new Store({ encryptionKey: 'your-encryption-key' });
  // store.set('twitch_oauth', tokens);
  
  // Option 2: Use existing config system
  const configPath = path.join(app.getPath('userData'), 'twitch_oauth.json');
  fs.writeFileSync(configPath, JSON.stringify(tokens, null, 2));
  
  console.log('OAuth tokens saved');
}

// Load OAuth tokens
async function loadOAuthTokens() {
  try {
    const configPath = path.join(app.getPath('userData'), 'twitch_oauth.json');
    if (fs.existsSync(configPath)) {
      const tokens = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      
      // Check if token is expired
      if (tokens.expires_at && Date.now() > tokens.expires_at) {
        console.log('Token expired, refreshing...');
        return await refreshAccessToken(tokens.refresh_token);
      }
      
      return tokens;
    }
  } catch (error) {
    console.error('Error loading OAuth tokens:', error);
  }
  return null;
}

// Refresh expired access token
async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }
  
  const tokenData = await response.json();
  const userInfo = await getTwitchUserInfo(tokenData.access_token);
  
  const tokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    username: userInfo.login,
    user_id: userInfo.id,
    expires_at: Date.now() + (tokenData.expires_in * 1000)
  };
  
  await saveOAuthTokens(tokens);
  return tokens;
}

// IPC handler to start OAuth flow
ipcMain.on('start-twitch-oauth', () => {
  startTwitchOAuth();
});

// Auto-login on app start if tokens exist
app.on('ready', async () => {
  // ... existing code ...
  
  // Try to auto-connect with saved OAuth tokens
  const tokens = await loadOAuthTokens();
  if (tokens) {
    console.log('Auto-connecting to Twitch with saved OAuth tokens');
    startTwitchChatConnection({
      username: tokens.username,
      oauth: tokens.access_token,
      clientId: TWITCH_CLIENT_ID
    });
  }
});
```

---

#### Option B: Custom Protocol Handler (More Professional)

**In `main.js`, add:**

```javascript
// Register custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('virtualdeck', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('virtualdeck');
}

// Handle custom protocol callback
app.on('open-url', (event, url) => {
  event.preventDefault();
  
  // Parse URL: virtualdeck://auth/callback?code=...
  const urlObj = new URL(url);
  if (urlObj.pathname === '/auth/callback') {
    const code = urlObj.searchParams.get('code');
    const error = urlObj.searchParams.get('error');
    
    if (error) {
      console.error('OAuth error:', error);
      return;
    }
    
    if (code) {
      handleOAuthCallback(code);
    }
  }
});

async function handleOAuthCallback(code) {
  try {
    const tokenData = await exchangeCodeForToken(code);
    const userInfo = await getTwitchUserInfo(tokenData.access_token);
    
    await saveOAuthTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      username: userInfo.login,
      user_id: userInfo.id,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    });
    
    // Notify renderer
    if (win && !win.isDestroyed()) {
      win.webContents.send('twitch-oauth-success', {
        username: userInfo.login
      });
    }
    
    // Start connection
    startTwitchChatConnection({
      username: userInfo.login,
      oauth: tokenData.access_token,
      clientId: TWITCH_CLIENT_ID
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
  }
}
```

---

### 3. Frontend Changes

**In `TwitchConnected/tc.js`, modify the config modal:**

```javascript
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
      <h2 style="margin-top:0;text-align:center;">Connect to Twitch</h2>
      
      <!-- OAuth Login (Primary) -->
      <button id="twitch-oauth-login" style="
        width:100%;
        padding:16px;
        background:#9146FF;
        color:white;
        border:none;
        border-radius:8px;
        font-size:16px;
        font-weight:600;
        cursor:pointer;
        margin-bottom:16px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
        </svg>
        Login with Twitch
      </button>
      
      <div style="text-align:center;margin:20px 0;color:#999;font-size:14px;">
        — or —
      </div>
      
      <!-- Manual Token Entry (Fallback) -->
      <details style="margin-bottom:16px;">
        <summary style="cursor:pointer;color:#666;font-size:14px;">Manual Token Entry</summary>
        <div style="margin-top:16px;">
          <label>OAuth Token:</label>
          <input type="password" id="twitch-oauth" placeholder="oauth:..." style="width:100%;margin-bottom:10px;padding:8px;border:1px solid #ccc;border-radius:4px;" />
          
          <label>Client ID:</label>
          <input type="text" id="twitch-clientid" placeholder="..." style="width:100%;margin-bottom:10px;padding:8px;border:1px solid #ccc;border-radius:4px;" />
          
          <label>Username:</label>
          <input type="text" id="twitch-channel" placeholder="yourusername" style="width:100%;margin-bottom:10px;padding:8px;border:1px solid #ccc;border-radius:4px;" />
          
          <button id="twitch-save-manual" style="width:100%;padding:12px;background:#4dd0e1;color:#062f06;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Connect Manually</button>
        </div>
      </details>
      
      <button id="twitch-cancel" style="width:100%;padding:10px;background:transparent;border:1px solid #ccc;border-radius:6px;cursor:pointer;">Cancel</button>
    `;
    
    document.body.appendChild(modal);
    
    // OAuth login button
    document.getElementById('twitch-oauth-login').onclick = () => {
      if (window.electronAPI && window.electronAPI.startTwitchOAuth) {
        window.electronAPI.startTwitchOAuth();
      }
      modal.remove();
    };
    
    // Manual save button (existing logic)
    document.getElementById('twitch-save-manual').onclick = () => {
      window.twitchConfig.oauth = document.getElementById('twitch-oauth').value.trim();
      window.twitchConfig.clientId = document.getElementById('twitch-clientid').value.trim();
      window.twitchConfig.channel = document.getElementById('twitch-channel').value.trim();
      
      localStorage.setItem('twitch_oauth', window.twitchConfig.oauth);
      localStorage.setItem('twitch_clientid', window.twitchConfig.clientId);
      localStorage.setItem('twitch_channel', window.twitchConfig.channel);
      
      modal.remove();
      
      if (window.electronAPI && window.electronAPI.sendTwitchConnect) {
        window.electronAPI.sendTwitchConnect({
          username: window.twitchConfig.channel,
          oauth: window.twitchConfig.oauth,
          clientId: window.twitchConfig.clientId
        });
      }
      
      connectToTwitch();
    };
    
    // Cancel button
    document.getElementById('twitch-cancel').onclick = () => {
      modal.remove();
    };
  }
}

// Listen for OAuth success
if (window.electronAPI && window.electronAPI.onTwitchOAuthSuccess) {
  window.electronAPI.onTwitchOAuthSuccess((data) => {
    console.log('OAuth login successful:', data.username);
    // Update UI to show connected state
    const btn = document.getElementById('twitch-connect');
    if (btn) {
      btn.style.backgroundColor = '#6441a5';
      btn.setAttribute('aria-label', `Connected to Twitch as ${data.username}`);
    }
    try { localStorage.setItem('vd_hide_twitch_banner', '1'); } catch (e) {}
  });
}
```

**In `preload.js`, add:**

```javascript
  startTwitchOAuth: () => ipcRenderer.send('start-twitch-oauth'),
  onTwitchOAuthSuccess: (callback) => ipcRenderer.on('twitch-oauth-success', (event, data) => callback(data)),
```

---

### 4. Security Considerations

1. **Never commit Client Secret**: Store in environment variables or secure config
2. **Encrypt stored tokens**: Use `electron-store` with encryption
3. **Token expiration**: Implement automatic token refresh
4. **Revocation**: Allow users to disconnect/revoke access
5. **Secure storage**: Don't use plain localStorage for tokens

**Recommended: Use electron-store with encryption**
```bash
npm install electron-store
```

```javascript
const Store = require('electron-store');
const store = new Store({
  encryptionKey: 'your-encryption-key-here', // Generate a secure key
  name: 'twitch-oauth'
});

// Save tokens
store.set('tokens', {
  access_token: '...',
  refresh_token: '...',
  // ...
});

// Load tokens
const tokens = store.get('tokens');
```

---

### 5. Testing

1. Test with Twitch's OAuth approval page
2. Test token refresh flow
3. Test reconnection after app restart
4. Test error cases (denied permission, network errors)
5. Test token revocation from Twitch settings

---

### 6. User Experience Improvements

- Show loading spinner during OAuth flow
- Display connected username prominently
- Add "Switch Account" option
- Show what permissions are being requested
- Remember last logged-in account
- Graceful error handling with user-friendly messages

---

### 7. Resources

- **Twitch OAuth Documentation**: https://dev.twitch.tv/docs/authentication
- **Twitch API Reference**: https://dev.twitch.tv/docs/api/reference
- **OAuth 2.0 Spec**: https://oauth.net/2/
- **Electron Protocol Handlers**: https://www.electronjs.org/docs/latest/api/protocol
- **Electron Store**: https://github.com/sindresorhus/electron-store

---

### 8. Implementation Checklist

- [ ] Register Twitch application on dev.twitch.tv
- [ ] Add OAuth flow to main.js
- [ ] Implement token exchange
- [ ] Implement token refresh logic
- [ ] Add secure token storage (electron-store)
- [ ] Update frontend UI with "Login with Twitch" button
- [ ] Add IPC handlers in preload.js
- [ ] Test OAuth flow end-to-end
- [ ] Test token refresh
- [ ] Test auto-reconnect on app restart
- [ ] Add error handling
- [ ] Update user documentation
- [ ] Keep manual token entry as fallback option

---

## Benefits of OAuth Implementation

1. **Better User Experience**: One-click login vs copying/pasting tokens
2. **More Secure**: Tokens aren't exposed to users
3. **Automatic Refresh**: Tokens auto-refresh when expired
4. **Professional**: Matches UX of established apps like MixItUp
5. **Proper Permissions**: Only request needed scopes
6. **Revocable**: Users can revoke from Twitch settings easily
7. **No Third-Party**: Don't rely on twitchtokengenerator.com

---

## Notes

- Keep manual token entry as a fallback option for advanced users
- Store Client Secret securely (environment variable or encrypted config)
- Consider implementing token revocation endpoint for clean logout
- Test thoroughly with both OAuth and manual token flows








