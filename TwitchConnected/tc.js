// TwitchConnected/tc.js
// Scaffolding for Twitch Connect UI, config modal, and event handler

// Inject chooser styles so clicked items get a visible selected state
(function injectChooserStyles(){
  try {
    if (typeof document === 'undefined') return;
    if (document.getElementById('vd-chooser-styles')) return;
    const s = document.createElement('style');
    s.id = 'vd-chooser-styles';
    s.textContent = `
      /* highlight when an available/selected row is toggled */
      .vd-selected { background: #264653 !important; color: #fff !important; border-radius: 4px; }
      /* make selected list items stand out */
      #map-card-selected .map-card-selected-item { background: #081018; color: #ffd166; border-left: 4px solid #ffd166; padding-left: 8px; }
      /* subtle hover for available items */
      #map-card-available .map-card-available-item:hover { background: rgba(255,255,255,0.02); }
    `;
    document.head.appendChild(s);
  } catch (e) { console.warn('Could not inject chooser styles:', e); }
})();

// Load config from localStorage on startup
window.twitchConfig = {
  oauth: localStorage.getItem('twitch_oauth') || '',
  clientId: localStorage.getItem('twitch_clientid') || '',
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
      <div style="position:relative;margin-bottom:14px;">
  <input id="twitch-oauth" type="password" style="width:100%;box-sizing:border-box;padding:8px;padding-right:40px;font-size:1em;background:#222;color:#fff;border-radius:6px;border:1px solid #ccc;" />
        <button id="twitch-oauth-toggle" aria-label="Show token" title="Show/Hide" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1;padding:4px">👁</button>
      </div>
      <label for="twitch-clientid" style="font-weight:bold;">CLIENT_ID:</label><br>
      <div style="position:relative;margin-bottom:14px;">
  <input id="twitch-clientid" type="password" style="width:100%;box-sizing:border-box;padding:8px;padding-right:40px;font-size:1em;background:#222;color:#fff;border-radius:6px;border:1px solid #ccc;" />
        <button id="twitch-clientid-toggle" aria-label="Show client id" title="Show/Hide" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1;padding:4px">👁</button>
      </div>
      <label for="twitch-channel" style="font-weight:bold;">TWITCH_USER_NAME:</label><br>
  <input id="twitch-channel" type="text" style="width:100%;box-sizing:border-box;margin-bottom:18px;padding:8px;font-size:1em;background:#222;color:#fff;border-radius:6px;border:1px solid #ccc;" /><br>
      <button id="twitch-save" style="width:100%;background:#a6f34a;color:#222;font-weight:bold;padding:10px 0;border:none;border-radius:6px;font-size:1.1em;cursor:pointer;">Save</button>
      <button id="twitch-cancel" style="width:100%;margin-top:8px;background:#eee;color:#222;padding:8px 0;border:none;border-radius:6px;font-size:1em;cursor:pointer;">Cancel</button>
    `;
    document.body.appendChild(modal);
    // Wire up show/hide toggles for sensitive fields
    try {
      const oauthInput = document.getElementById('twitch-oauth');
      const oauthToggle = document.getElementById('twitch-oauth-toggle');
      if (oauthInput && oauthToggle) {
        oauthToggle.addEventListener('click', () => {
          if (oauthInput.type === 'password') {
            oauthInput.type = 'text';
            oauthToggle.textContent = '🙈';
            oauthToggle.setAttribute('aria-label', 'Hide token');
          } else {
            oauthInput.type = 'password';
            oauthToggle.textContent = '👁';
            oauthToggle.setAttribute('aria-label', 'Show token');
          }
        });
      }
      const clientInput = document.getElementById('twitch-clientid');
      const clientToggle = document.getElementById('twitch-clientid-toggle');
      if (clientInput && clientToggle) {
        clientToggle.addEventListener('click', () => {
          if (clientInput.type === 'password') {
            clientInput.type = 'text';
            clientToggle.textContent = '🙈';
            clientToggle.setAttribute('aria-label', 'Hide client id');
          } else {
            clientInput.type = 'password';
            clientToggle.textContent = '👁';
            clientToggle.setAttribute('aria-label', 'Show client id');
          }
        });
      }
  } catch (e) { console.warn('Could not wire toggles:', e); }

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
            // Open connected-state menu modal
            showTwitchConnectedMenu();
          }
        };
  }
  // Listen for Twitch connection status from main process
  if (window.electronAPI && window.electronAPI.onTwitchConnected) {
    window.electronAPI.onTwitchConnected(() => {
      const btn = document.getElementById('twitch-connect');
      if (btn) {
        // Keep the gif inside the button; only change visual connected state
        btn.style.backgroundColor = '#6441a5'; // Twitch purple
        btn.setAttribute('aria-label', 'Connected to Twitch');
      }
    });
  } else if (window.ipcRenderer) {
    window.ipcRenderer.on('twitch-connected', () => {
      const btn = document.getElementById('twitch-connect');
      if (btn) {
        // Keep the gif inside the button; only change visual connected state
        btn.style.backgroundColor = '#6441a5'; // Twitch purple
        btn.setAttribute('aria-label', 'Connected to Twitch');
      }
    });
  }

  // Auto-connect if credentials are already stored
  if (areTwitchCredsValid(window.twitchConfig)) {
    console.log('Auto-connecting to Twitch using stored credentials');
    if (window.electronAPI && window.electronAPI.sendTwitchConnect) {
      window.electronAPI.sendTwitchConnect({
        username: window.twitchConfig.channel,
        oauth: window.twitchConfig.oauth,
        clientId: window.twitchConfig.clientId
      });
    } else if (window.ipcRenderer) {
      window.ipcRenderer.send('twitch-connect', {
        username: window.twitchConfig.channel,
        oauth: window.twitchConfig.oauth,
        clientId: window.twitchConfig.clientId
      });
    }
    connectToTwitch();
  }
});

// Store recent events in-memory for the activity modal
window.twitchEvents = window.twitchEvents || [];

function pushTwitchEvent(evt) {
  const e = Object.assign({ ts: new Date().toISOString() }, evt);
  window.twitchEvents.unshift(e);
  // keep max 200 events
  if (window.twitchEvents.length > 200) window.twitchEvents.pop();
  // If activity modal list is open, append the new event row
  try {
    const list = document.getElementById('twitch-activity-list');
    const filter = document.getElementById('twitch-activity-filter');
    if (list) {
      const f = filter ? filter.value : 'all';
      // Determine a normalized display type.
      // Commands: chat messages starting with '!'
      let rawType = e.type || (e.event && e.event.type) || '';
      let displayType = rawType;
      if (rawType === 'chat' && e.message && e.message.startsWith('!')) displayType = 'command';
      // Map common EventSub topic substrings to friendly types
      if (typeof rawType === 'string') {
        const rt = rawType.toLowerCase();
        if (rt.includes('channel.channel_points_custom_reward_redemption')) displayType = 'redeem';
        else if (rt.includes('channel.follow')) displayType = 'follow';
        else if (rt.includes('channel.subscribe') || rt.includes('channel.subscription')) displayType = 'sub';
        else if (rt.includes('subscription.gift') || rt.includes('channel.subscription.gift')) displayType = 'subgift';
        else if (rt.includes('channel.cheer') || rt.includes('bits')) displayType = 'bits';
        else if (rt.includes('channel.raid')) displayType = 'raid';
      }
      if (e.event && e.event.type && typeof e.event.type === 'string') {
        const et = e.event.type.toLowerCase();
        if (et.includes('channel.channel_points_custom_reward_redemption')) displayType = 'redeem';
        else if (et.includes('channel.follow')) displayType = 'follow';
        else if (et.includes('channel.subscribe') || et.includes('channel.subscription')) displayType = 'sub';
        else if (et.includes('subscription.gift') || et.includes('channel.subscription.gift')) displayType = 'subgift';
        else if (et.includes('channel.cheer') || et.includes('bits')) displayType = 'bits';
        else if (et.includes('channel.raid')) displayType = 'raid';
      }
      const shouldShow = (f === 'all') || (displayType === f) || (f === 'command' && e.type === 'chat' && e.message && e.message.startsWith('!'));
      if (shouldShow) {
        // For event objects (like redeem) we prefer the nested event payload as data
        const data = e.event ? Object.assign({}, e.event, { ts: e.ts }) : Object.assign({}, e, { ts: e.ts });
        const node = addActivity(displayType, data);
        if (node) {
          // insert at top
          if (list.firstChild) list.insertBefore(node, list.firstChild);
          else list.appendChild(node);
        }
      }
    }
  } catch (err) {
    console.error('Error updating activity list:', err);
  }
}

// Whether to hide synthetic test events in the activity feed
window.hideTestEvents = window.hideTestEvents || false;

// Minimal emote parser fallback (returns escaped text for now)
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (s) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
  });
}

// Helper to trigger a mapping: supports multiple target card labels and picks one at random
function triggerMapping(mapping) {
  try {
    if (!mapping) return;
    let choices = [];
    if (Array.isArray(mapping.cardLabels) && mapping.cardLabels.length > 0) choices = mapping.cardLabels.slice();
    else if (mapping.cardLabel) choices = [mapping.cardLabel];
    if (!choices || choices.length === 0) return;
    // pick random
    const idx = Math.floor(Math.random() * choices.length);
    const label = choices[idx];
    if (window.electronAPI && window.electronAPI.sendTrigger) window.electronAPI.sendTrigger(label);
  } catch (e) {
    console.error('Error in triggerMapping:', e);
  }
}

function parseEmotes(message, emotes) {
  // TODO: implement real emote parsing. For now, escape HTML and return.
  return escapeHtml(message || '');
}

// Create a DOM row for activity using the message template provided by the user
function addActivity(type, data) {
  // Hide test events: use a helper that inspects many possible fields for "test" or common test usernames
  function isTestPayload(d) {
    if (!d || typeof d !== 'object') return false;
    const known = ['t3stus3r', 'testuser', 'test', 'testraider', 'gifteduser', 'moduser'];
    const checkFields = ['user','user_name','user_login','from_name','from_broadcaster_user_name','from_broadcaster_user_login','sender_name','sender_login','recipient_user_name','recipient_user_login','moderator_name','moderator_login','display_name','to_name'];
    for (const f of checkFields) {
      const v = d[f];
      if (v && typeof v === 'string') {
        const lv = v.toLowerCase();
        for (const k of known) if (lv.includes(k)) return true;
      }
    }
    // reward title — only consider a reward title as a test indicator when the username itself looks like a test account
    const rewardTitle = (d.reward && (d.reward.title || d.reward.name)) || d.reward_title || '';
    const input = d.user_input || d.input || d.message || d.prompt || '';
    // if username already matched known test tokens above, we've already returned true. Otherwise, require input to contain 'test' to mark as test
    if (input && /test/i.test(input)) return true;
    if (rewardTitle && /test/i.test(rewardTitle)) {
      // only mark as test if the username contains a test token as well
      for (const f of checkFields) {
        const v2 = d[f];
        if (v2 && typeof v2 === 'string' && /test/i.test(v2)) return true;
      }
    }
    return false;
  }
  // treat explicit test override as test event
  const isTestEvent = isTestPayload(data) || ((data && data._testRequirement) ? true : false);
  if (window.hideTestEvents && isTestEvent) return null;

  const row = document.createElement('div');
  row.style.padding = '6px';
  row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
  const time = new Date(data.ts || Date.now()).toLocaleTimeString();
  let msg = '';
  // draw a small badge if this was a test override
  if (data && data._testRequirement) {
    const badge = document.createElement('span');
    badge.textContent = `TEST:${String(data._testRequirement)}`;
    badge.style.background = '#ff8a65';
    badge.style.color = '#111';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '999px';
    badge.style.fontSize = '11px';
    badge.style.marginRight = '8px';
    row.appendChild(badge);
  }
  // Build badge HTML (placeholder)
  let badgeHtml = '';
  if (data.badges) {
    for (const badge in data.badges) {
      badgeHtml += `<img class="badge-icon" src="badges/${badge}.png" title="${badge}" style="height:16px;margin-right:4px;vertical-align:middle;" />`;
    }
  }

  switch (type) {
    case 'chat': {
      let userColor = data.color || '#b3b3b3';
      if (data.user === 'TestUser' || data.user === 'T3stUs3r') userColor = '#a3e635';
      const chatMsg = parseEmotes(data.message, data.emotes);
      msg = `💬 <span style="color:#9ad;font-weight:600">[Chat]</span> ${badgeHtml}<span style="color:${userColor};font-weight:500;margin-left:8px">${escapeHtml(data.user||data.user_name||'unknown')}</span>: <span class="activity-message">${chatMsg}</span>`;
      break;
    }
    case 'command': {
      let commandUserColor = (data.user === 'TestUser' || data.user === 'T3stUs3r') ? '#a3e635' : '#b3b3b3';
      const commandMsg = parseEmotes(data.message, data.emotes);
      msg = `⚡ <span style="color:#ffa500;font-weight:600">[Command]</span> ${badgeHtml}<span style="color:${commandUserColor};font-weight:500;margin-left:8px">${escapeHtml(data.user||data.user_name||'unknown')}</span>: <span class="activity-message">${commandMsg}</span>`;
      break;
    }
    case 'redeem': {
  // Normalize common EventSub fields for channel point redemptions
  const user = data.user_name || data.user || data.user_login || data.from_name || data.from_broadcaster_user_name || 'unknown';
  const reward = (data.reward && (data.reward.title || data.reward.name)) ? (data.reward.title || data.reward.name) : (data.reward_title || data.rewardType || data.reward || '');
    const input = data.user_input || data.input || data.message || data.prompt || '';
    // cost may be nested under reward.cost or as cost on the event
    const cost = (data.reward && (typeof data.reward.cost !== 'undefined')) ? data.reward.cost : (typeof data.cost !== 'undefined' ? data.cost : null);
    const redeemUserColor = (user === 'TestUser' || user === 'T3stUs3r') ? '#a3e635' : '#4dd0e1';
    const redeemMsg = parseEmotes(input, data.emotes);
    // Render similar to the left screenshot: gift emoji, [Redeem] tag, colored username, 'redeemed' and reward title
    const costHtml = (cost !== null && cost !== undefined && cost !== '') ? ` <span style="color:#ffd166;font-weight:600;margin-left:6px">(${escapeHtml(String(cost))} pts)</span>` : '';
    const inputHtml = input ? `: <em class="activity-message" style="font-style:italic;color:#ddd;margin-left:6px">${redeemMsg}</em>` : '';
    msg = `🎁 <span style="color:#9ad;font-weight:600">[Redeem]</span> ${badgeHtml}<span style="color:${redeemUserColor};font-weight:600;margin-left:8px">${escapeHtml(user)}</span> <span style="color:#fff;margin-left:6px">redeemed</span> <span style="color:#ffd166;font-weight:600;margin-left:6px">${escapeHtml(reward)}</span>${costHtml}${inputHtml}`;
      break;
    }
    case 'follow': {
      const who = data.user_name || data.user || data.from_name || data.user_login || 'unknown';
      msg = `➕ <span style="color:#9ad;font-weight:600">[Follow]</span> ${badgeHtml}<span style="color:#fff;font-weight:600;margin-left:8px">${escapeHtml(who)}</span> <span style="color:#ccc;margin-left:6px">followed the channel</span>`;
      break;
    }
    case 'sub': {
      // subscription (can be tiered)
      const subUser = data.user_name || data.user || data.user_login || data.from_name || 'unknown';
      const tier = data.tier || data.sub_plan || (data.subscription && data.subscription.plan) || '';
      msg = `🎉 <span style="color:#ffd700;font-weight:600">[Sub]</span> ${badgeHtml}<span style="color:#fff;font-weight:600;margin-left:8px">${escapeHtml(subUser)}</span> <span style="color:#ccc;margin-left:6px">subscribed ${escapeHtml(tier || '')}</span>`;
      break;
    }
    case 'subgift': {
      const sender = data.user_name || data.from_name || data.sender_name || data.user || 'unknown';
      const recipient = data.recipient_user_name || data.recipient || data.to_name || 'someone';
      msg = `🎁 <span style="color:#ff9f43;font-weight:600">[Sub Gift]</span> ${badgeHtml}<span style="color:#fff;font-weight:600;margin-left:8px">${escapeHtml(sender)}</span> gifted a sub to <strong style="color:#ffd166;margin-left:6px">${escapeHtml(recipient)}</strong>`;
      break;
    }
    case 'bits': {
      const who = data.user_name || data.user || data.from_name || 'unknown';
      const amount = data.bits || data.bits_used || data.bits_amount || data.amount || (data.message && (data.message.match(/\d+/) || [''])[0]) || '';
      msg = `💎 <span style="color:#ff66cc;font-weight:600">[Bits]</span> ${badgeHtml}<span style="color:#fff;font-weight:600;margin-left:8px">${escapeHtml(who)}</span> <span style="color:#ffd166;margin-left:6px">${escapeHtml(String(amount))} bits</span>`;
      break;
    }
    case 'raid': {
      const raider = data.from_broadcaster_user_name || data.from_name || data.user_name || data.user || 'unknown';
      const viewers = data.viewers || data.view_count || data.viewer_count || (data.event && data.event.viewers) || '';
      msg = `🚀 <span style="color:#9ad;font-weight:600">[Raid]</span> ${badgeHtml}<span style="color:#fff;font-weight:600;margin-left:8px">${escapeHtml(raider)}</span> <span style="color:#ccc;margin-left:6px">raided with ${escapeHtml(String(viewers))} viewers</span>`;
      break;
    }
    default: {
      msg = `<span style="color:#9ad">[${escapeHtml(type)}]</span> ${badgeHtml}<strong style="margin-left:8px">${escapeHtml(data.user||data.user_name||'unknown')}</strong> ${escapeHtml(JSON.stringify(data))}`;
    }
  }

  row.innerHTML = `<span style="color:#999;margin-right:8px">[${time}]</span> ${msg}`;
  return row;
}

// Helper to render a single event row DOM node
function renderEventRow(ev) {
  const row = document.createElement('div');
  row.style.padding = '6px';
  row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
  const time = new Date(ev.ts).toLocaleTimeString();
  if (ev.type === 'chat') {
    const isCmd = ev.message && ev.message.startsWith('!');
    row.innerHTML = `<span style="color:#999;margin-right:8px">[${time}]</span> <span style="color:${isCmd? '#ffa500':'#9ad' }">${isCmd? '[Command]':'[Chat]'}</span> <strong style="margin-left:8px">${ev.user || 'unknown'}</strong>: <span style="margin-left:6px">${ev.message}</span>`;
  } else if (ev.type && ev.type.includes('redeem')) {
    row.innerHTML = `<span style="color:#999;margin-right:8px">[${time}]</span> <span style="color:#ff66cc">[Redeem]</span> <strong style="margin-left:8px">${(ev.event && ev.event.user_name) || ev.user || 'unknown'}</strong>: <span style="margin-left:6px">${(ev.event && ev.event.reward && ev.event.reward.title) || JSON.stringify(ev.event)}</span>`;
  } else {
    row.innerHTML = `<span style="color:#999;margin-right:8px">[${time}]</span> <span style="color:#9ad">[${ev.type}]</span> <strong style="margin-left:8px">${ev.user || (ev.event && (ev.event.user_name||ev.event.from_name)) || 'unknown'}</strong> <span style="margin-left:6px">${ev.message || (ev.event && JSON.stringify(ev.event)) || ''}</span>`;
  }
  return row;
}

// IPC listeners to receive events from main
if (window.electronAPI && window.electronAPI.onTwitchChatEvent) {
  window.electronAPI.onTwitchChatEvent((e) => {
    pushTwitchEvent({ type: 'chat', user: e.user, message: e.message });
  });
} else if (window.ipcRenderer) {
  window.ipcRenderer.on('twitch-chat-event', (event, e) => {
  console.debug('renderer received twitch-chat-event:', e);
  pushTwitchEvent({ type: 'chat', user: e.user, message: e.message });
  });
}

if (window.electronAPI && window.electronAPI.onTwitchEventSub) {
  window.electronAPI.onTwitchEventSub((e) => {
  // Normalize eventsub redemption topics to 'redeem' for cleaner rendering
  let t = e.type || 'eventsub';
  if (typeof t === 'string' && t.includes('channel.channel_points_custom_reward_redemption')) t = 'redeem';
  // Some payloads nest the topic under event.type
  if (!t && e.event && e.event.type && typeof e.event.type === 'string' && e.event.type.includes('channel.channel_points_custom_reward_redemption')) t = 'redeem';
  pushTwitchEvent({ type: t, event: e.event });
  });
} else if (window.ipcRenderer) {
  window.ipcRenderer.on('twitch-eventsub', (event, e) => {
    console.debug('renderer received twitch-eventsub:', e);
  let t = e.type || 'eventsub';
  if (typeof t === 'string' && t.includes('channel.channel_points_custom_reward_redemption')) t = 'redeem';
  if (!t && e.event && e.event.type && typeof e.event.type === 'string' && e.event.type.includes('channel.channel_points_custom_reward_redemption')) t = 'redeem';
  pushTwitchEvent({ type: t, event: e.event });
  });
}

// Mapping support: load mappings and trigger mapped card when events arrive
window.twitchMappings = window.twitchMappings || [];
async function loadMappings() {
  try {
    if (window.electronAPI && window.electronAPI.getMappings) {
      window.twitchMappings = await window.electronAPI.getMappings();
    } else {
      window.twitchMappings = [];
    }
  } catch (e) {
    console.error('Error loading twitch mappings:', e);
    window.twitchMappings = [];
  }
}
loadMappings();

// React to main process mapping changes so new mappings become active immediately
if (window.electronAPI && window.electronAPI.onMappingSaved) {
  window.electronAPI.onMappingSaved((payload) => {
    console.log('Received mapping-saved from main:', payload);
    loadMappings();
  });
}
if (window.electronAPI && window.electronAPI.onMappingDeleted) {
  window.electronAPI.onMappingDeleted((payload) => {
    console.log('Received mapping-deleted from main:', payload);
    loadMappings();
  });
}

function matchMappingForEvent(evt) {
  if (!evt) return null;
  // support structured mappings saved as { type, command, rewardTitle, bits }
  const rawType = evt.type || (evt.event && evt.event.type) || '';
  // Chat command mapping
  if ((rawType === 'chat' || rawType === 'command') && evt.message && evt.message.startsWith('!')) {
    const cmd = evt.message.split(' ')[0].substring(1).toLowerCase(); // without '!'
    for (const m of (window.twitchMappings || [])) {
      if (!m) continue;
      if (m.type === 'command' && m.command && m.command.toLowerCase() === cmd) return m;
    }
  }
  // EventSub / other mappings
  for (const m of (window.twitchMappings || [])) {
    if (!m || !m.type) continue;
    const t = m.type;
    if (t === 'follow' && rawType && rawType.includes('follow')) return m;
    // support new mapping types like sub_any, sub_tier1, sub_tier2, sub_prime
    if ((t === 'sub' || (t && t.startsWith('sub_'))) && rawType && (rawType === 'sub' || rawType.includes('subscribe') || rawType.includes('subscription'))) {
      // determine mapping tier from the type string or legacy m.tier
      let mapTier = 'any';
      if (t && t.startsWith('sub_')) {
        const suffix = t.substring(4); // after 'sub_'
        if (suffix === 'tier1') mapTier = 'tier1';
        else if (suffix === 'tier2') mapTier = 'tier2';
        else if (suffix === 'tier3') mapTier = 'tier3';
        else if (suffix === 'prime') mapTier = 'prime';
        else mapTier = 'any';
      } else {
        mapTier = (m.tier || 'any').toLowerCase();
      }
      if (!mapTier || mapTier === 'any') return m;
      const evTier = normalizeSubTier(evt);
      if (evTier === mapTier) return m;
      // otherwise don't match this mapping
      continue;
    }
    if (t === 'raid' && rawType && rawType.includes('raid')) return m;
    if (t === 'bits' && rawType && (rawType.includes('cheer') || rawType.includes('bits'))) {
  // Collect candidate bit mappings elsewhere (see below). Here, skip; we'll handle after loop
  // (keep placeholder)
  continue;
    }
    if (t === 'redeem' && (rawType && rawType.includes('reward') || rawType === 'redeem')) {
      // Normalize reward title from payload
      const title = (evt.event && (evt.event.reward && (evt.event.reward.title || evt.event.reward.name))) || evt.event && (evt.event.reward_title || evt.event.reward) || '';
      if (m.rewardTitle && title && String(title).toLowerCase() === String(m.rewardTitle).toLowerCase()) return m;
      // if mapping was created with rewardTitle blank, treat as match-all redeems
      if (!m.rewardTitle) return m;
    }
  }
  return null;
}

// Improved bits-matching: pick the mapping with the highest bits threshold <= amount.
function findBestBitsMapping(evt) {
  if (!evt) return null;
  // allow passing either an event object or a numeric amount
  let amt = 0;
  if (typeof evt === 'number') amt = evt;
  else {
    amt = (evt.event && (evt.event.bits || evt.event.bits_used || evt.event.amount || evt.event.amount_used)) || 0;
    // also try to extract numeric tokens from user_input or reward title (bit redeems)
    if (!amt) {
      const maybe = extractBitsAmountFromEvent(evt);
      if (maybe) amt = maybe;
    }
  }
  const candidates = (window.twitchMappings || []).filter(m => m && m.type === 'bits');
  if (!candidates || candidates.length === 0) return null;
  // Split into mappings with numeric thresholds and those without
  const withThreshold = [];
  let generic = null;
  for (const m of candidates) {
    if (m.bits && Number(m.bits) > 0) withThreshold.push(m);
    else generic = generic || m; // fallback mapping without a threshold
  }
  // Find the highest threshold <= amt
  let best = null;
  let bestVal = -1;
  for (const m of withThreshold) {
    const v = Number(m.bits) || 0;
    if (v <= Number(amt) && v > bestVal) {
      bestVal = v;
      best = m;
    }
  }
  if (best) return best;
  // If none matched threshold, return the generic bits mapping (if present)
  return generic;
}

// Try to extract a numeric bits amount from various redeem-like payload fields
function extractBitsAmountFromEvent(evt) {
  if (!evt) return 0;
  const fields = [];
  if (evt.event) {
    const e = evt.event;
    if (e.user_input) fields.push(String(e.user_input));
    if (e.input) fields.push(String(e.input));
    if (e.message) fields.push(String(e.message));
    if (e.prompt) fields.push(String(e.prompt));
    if (e.reward && (e.reward.title || e.reward.name)) fields.push(String(e.reward.title || e.reward.name));
    if (typeof e.cost !== 'undefined') {
      // cost is usually channel points, but include it in case bits are encoded
      fields.push(String(e.cost));
    }
  } else {
    // top-level fields
    if (evt.user_input) fields.push(String(evt.user_input));
    if (evt.message) fields.push(String(evt.message));
  }
  for (const s of fields) {
    if (!s) continue;
    const m = s.match(/(\d{1,7})/); // find first number
    if (m) return Number(m[1]);
  }
  return 0;
}

// Normalize subscription tier from event payload to one of: 'tier1','tier2','prime' or 'any'
function normalizeSubTier(evt) {
  if (!evt) return 'any';
  let v = null;
  if (evt.event) {
    const e = evt.event;
    v = e.tier || e.sub_plan || e.sub_plan_name || e.tier_name || e.plan || e.plan_name || '';
    // some test payloads set a simple tier field
    if (!v && e.tier) v = e.tier;
  }
  if (!v && typeof evt === 'string') v = evt;
  if (!v) return 'any';
  v = String(v).toLowerCase();
  if (v.includes('prime')) return 'prime';
  if (v.includes('1') || v.includes('1000') || v.includes('tier 1') || v.includes('tier1')) return 'tier1';
  if (v.includes('2') || v.includes('2000') || v.includes('tier 2') || v.includes('tier2')) return 'tier2';
  return 'any';
}

// Wrap pushTwitchEvent to also evaluate mappings
const _origPush = pushTwitchEvent;
pushTwitchEvent = function(evt) {
  _origPush(evt);
  try {
    // First try standard matching
    let m = matchMappingForEvent(evt);
    // If bits event, try best-match algorithm
    if (!m && evt && ((evt.type && evt.type.includes('bits')) || (evt.event && (evt.event.bits || evt.event.amount)))) {
      m = findBestBitsMapping(evt);
    }
    if (m && m.cardLabel) {
      // enforce optional user requirement (none/follower/subscriber)
      const req = (m.requirement || 'none').toLowerCase();
      async function doTrigger() {
        // resolve username from event payload
        let uname = null;
        if (evt && evt.event) {
          const e = evt.event;
          uname = e.user_login || e.user_name || e.from_name || e.from_broadcaster_user_login || e.from_broadcaster_user_name || e.sender_login || e.sender_name || e.recipient_user_login || e.recipient_user_name || null;
        } else {
          uname = evt && (evt.user || evt.user_name || evt.from_name) ? (evt.user || evt.user_name || evt.from_name) : null;
        }
        // allow test events to simulate requirement satisfaction via evt._testRequirement
        const testReq = evt && evt._testRequirement ? String(evt._testRequirement).toLowerCase() : null;
        function testReqSatisfies(mappingReq, testVal) {
          if (!testVal) return false;
          if (mappingReq === 'none') return true;
          if (mappingReq === 'follower') {
              // followers accept subscribers as well, and treat vip/mod as follower in test overrides
              return testVal === 'follower' || testVal === 'subscriber' || testVal === 'sub_any' || testVal.startsWith('sub_tier') || testVal === 'sub_prime' || testVal === 'vip' || testVal === 'mod' || testVal === 'moderator';
          }
          if (mappingReq === 'subscriber') {
            return testVal === 'subscriber' || testVal === 'sub_any' || testVal.startsWith('sub_tier') || testVal === 'sub_prime';
          }
          if (mappingReq === 'vip') return testVal === 'vip';
          if (mappingReq === 'mod' || mappingReq === 'moderator') return testVal === 'mod' || testVal === 'moderator';
          return false;
        }

        if (req === 'none') {
          if (window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
          return;
        }

        // If a test requirement override is present, let it short-circuit the real checks
        if (testReq) {
            try {
            if (testReqSatisfies(req, testReq)) {
              if (window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
            } else {
              console.log('Test override says user does NOT satisfy requirement', req, 'for mapping', m.cardLabel);
            }
          } catch (e) {
            console.error('Error evaluating test requirement override:', e);
          }
          return;
        }

        if (!uname) {
          console.log('Mapping requires', req, 'but event has no username; skipping trigger for', m.cardLabel);
          return;
        }
        try {
          if (req === 'follower') {
            if (window.electronAPI && window.electronAPI.checkUserFollows) {
              let ok = await window.electronAPI.checkUserFollows(uname);
              // Accept subscribers as followers as well
              if (!ok && window.electronAPI && window.electronAPI.checkUserSubscriber) {
                ok = await window.electronAPI.checkUserSubscriber(uname);
              }
              // If still not ok, accept VIPs and moderators as followers too (useful for alt/mod accounts)
              if (!ok && window.electronAPI && window.electronAPI.checkUserVip) {
                try { ok = await window.electronAPI.checkUserVip(uname); } catch (e) { /* ignore */ }
              }
              if (!ok && window.electronAPI && window.electronAPI.checkUserMod) {
                try { ok = await window.electronAPI.checkUserMod(uname); } catch (e) { /* ignore */ }
              }
              if (ok && window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
              else console.log('User', uname, 'is not a follower/subscriber; skipping mapping', m.cardLabel);
            }
          } else if (req === 'subscriber' || req.startsWith && req.startsWith('sub_')) {
            // support plain subscriber requirement and specific tier requirements (sub_tier1/sub_prime/etc.)
            try {
              // If mapping requires a specific sub tier, query the user's sub tier
              if (req !== 'subscriber' && window.electronAPI && window.electronAPI.checkUserSubTier) {
                const userTier = await window.electronAPI.checkUserSubTier(uname);
                // userTier may be 'tier1','tier2','tier3','prime','any' or null
                if (userTier) {
                  const expected = req === 'sub_any' ? 'any' : (req === 'sub_prime' ? 'prime' : req.replace('sub_tier', 'tier'));
                  if (expected === 'any' || userTier === expected) {
                    if (window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
                    else console.log('User', uname, 'does not meet required sub tier for mapping', m.cardLabel);
                  } else {
                    console.log('User', uname, 'sub tier', userTier, 'does not match required', expected, 'for mapping', m.cardLabel);
                  }
                } else {
                  // fallback: if we couldn't determine tier, accept if user is a subscriber
                  if (window.electronAPI && window.electronAPI.checkUserSubscriber) {
                    const subOk = await window.electronAPI.checkUserSubscriber(uname);
                    if (subOk && window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
                    else console.log('Could not determine user sub tier for', uname, '; and user is not confirmed subscriber; skipping mapping', m.cardLabel);
                  } else {
                    console.log('Could not determine user sub tier for', uname, '; skipping mapping', m.cardLabel);
                  }
                }
              } else if (window.electronAPI && window.electronAPI.checkUserSubscriber) {
                const ok = await window.electronAPI.checkUserSubscriber(uname);
                if (ok && window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
                else console.log('User', uname, 'is not a subscriber; skipping mapping', m.cardLabel);
              }
            } catch (e) {
              console.error('Error checking subscriber/tier status:', e);
            }
          } else if (req === 'vip') {
            if (window.electronAPI && window.electronAPI.checkUserVip) {
              const ok = await window.electronAPI.checkUserVip(uname);
              if (ok && window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
              else console.log('User', uname, 'is not a VIP; skipping mapping', m.cardLabel);
            }
          } else if (req === 'mod' || req === 'moderator') {
            if (window.electronAPI && window.electronAPI.checkUserMod) {
              const ok = await window.electronAPI.checkUserMod(uname);
              if (ok && window.electronAPI && window.electronAPI.sendTrigger) triggerMapping(m);
              else console.log('User', uname, 'is not a moderator; skipping mapping', m.cardLabel);
            }
          }
        } catch (err) {
          console.error('Error checking user requirement for mapping:', err);
        }
      }
      doTrigger();
    }
  } catch (e) {
    console.error('Error applying mapping for event:', e);
  }
};

// Small toast helper for user notifications
function showToast(msg, timeout = 3000) {
  let t = document.getElementById('vd-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'vd-toast';
    t.style.position = 'fixed';
    t.style.bottom = '20px';
    t.style.right = '20px';
    t.style.background = 'rgba(0,0,0,0.85)';
    t.style.color = '#fff';
    t.style.padding = '10px 14px';
    t.style.borderRadius = '8px';
    t.style.zIndex = '20000';
    t.style.fontSize = '13px';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  if (t._to) clearTimeout(t._to);
  t._to = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => { try { t.remove(); } catch (e) {} }, 300);
  }, timeout);
}

// Listen for server-side mapping-save failures
if (window.electronAPI && window.electronAPI.onMappingSaveFailed) {
  window.electronAPI.onMappingSaveFailed((payload) => {
    const msg = (payload && payload.reason) ? `Mapping save failed: ${payload.reason}` : 'Mapping save failed (server)';
    console.warn('Mapping save failed received from main:', payload);
    showToast(msg, 5000);
  });
}

function showTwitchActivityModal() {
  let modal = document.getElementById('twitch-activity-modal');
  if (modal) return; // already open
  modal = document.createElement('div');
  modal.id = 'twitch-activity-modal';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.background = '#111';
  modal.style.color = '#fff';
  modal.style.padding = '18px';
  modal.style.borderRadius = '10px';
  modal.style.zIndex = '10003';
  modal.style.width = '560px';
  modal.style.maxHeight = '60vh';
  modal.style.overflow = 'hidden';
  modal.style.boxShadow = '0 6px 30px rgba(0,0,0,0.5)';

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <strong>Twitch Activity</strong>
        <span id="twitch-conn-status" style="font-size:12px;padding:4px 8px;border-radius:6px;background:#333;color:#bbb;border:1px solid rgba(255,255,255,0.04);">Checking...</span>
      </div>
      <div>
        <select id="twitch-activity-filter">
          <option value="all">All</option>
          <option value="chat">Chat</option>
          <option value="command">Command</option>
          <option value="redeem">Redeem</option>
        </select>
  <label style="margin-left:8px;color:#ccc;font-size:12px;display:inline-flex;align-items:center;gap:6px;"><input id="twitch-hide-tests" type="checkbox" style="transform:scale(1.05);" /> Hide Test Events</label>
  <button id="twitch-activity-close" style="margin-left:8px">Close</button>
      </div>
    </div>
    <div id="twitch-activity-list" style="background:#0f0f0f;padding:8px;border-radius:6px;overflow:auto;height:calc(60vh - 180px);font-family:monospace;font-size:13px;"></div>
    <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <select id="twitch-test-select">
        <option value="chat">Test Chat</option>
        <option value="command">Test Command</option>
        <option value="redeem">Test Redeem</option>
        <option value="follow">Test Follow</option>
        <option value="sub">Test Sub</option>
        <option value="subgift">Test Sub Gift</option>
        <option value="bits">Test Bits/Cheer</option>
        <option value="raid">Test Raid</option>
      </select>
      <select id="twitch-test-req" style="padding:6px;border-radius:6px;border:1px solid #333;background:#222;color:#fff;">
        <option value="none">No Requirement</option>
        <option value="follower">Follower</option>
        <option value="subscriber">Subscriber</option>
        <option value="vip">VIP</option>
        <option value="mod">Moderator</option>
        <option value="sub_any">Sub Any</option>
        <option value="sub_tier1">Sub Tier1</option>
        <option value="sub_tier2">Sub Tier2</option>
        <option value="sub_tier3">Sub Tier3</option>
        <option value="sub_prime">Sub Prime</option>
      </select>
      <input id="twitch-test-username" placeholder="(optional username)" style="width:160px;padding:6px;border-radius:6px;border:1px solid #333;background:#222;color:#fff;" />
      <input id="twitch-test-input" placeholder="Optional message or value" style="flex:1;min-width:160px;padding:6px;border-radius:6px;border:1px solid #333;background:#222;color:#fff;" />
      <button id="twitch-test-fire" style="background:#a6f34a;color:#222;padding:8px 12px;border-radius:6px;border:none;">Fire Test</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Update connection status pill
  async function updateTwitchConnStatus() {
    const pill = document.getElementById('twitch-conn-status');
    if (!pill) return;
    try {
      const ok = window.electronAPI && window.electronAPI.hasTwitchCreds ? await window.electronAPI.hasTwitchCreds() : false;
      if (ok) {
        pill.textContent = 'Twitch: Connected';
        pill.style.background = '#072';
        pill.style.color = '#eaffd0';
        pill.style.border = '1px solid rgba(0,0,0,0.3)';
      } else {
        pill.textContent = 'Twitch: No creds';
        pill.style.background = '#3a2f00';
        pill.style.color = '#ffd9a8';
        pill.style.border = '1px solid rgba(255,165,0,0.15)';
      }
    } catch (e) {
      pill.textContent = 'Twitch: Unknown';
      pill.style.background = '#333';
      pill.style.color = '#ccc';
    }
  }
  updateTwitchConnStatus();
  if (window.electronAPI && window.electronAPI.onTwitchConnected) {
    window.electronAPI.onTwitchConnected(() => { updateTwitchConnStatus(); });
  }

  const closeBtn = document.getElementById('twitch-activity-close');
  closeBtn.onclick = () => modal.remove();

  const list = document.getElementById('twitch-activity-list');
  const filter = document.getElementById('twitch-activity-filter');
  const hideTestsCheckbox = document.getElementById('twitch-hide-tests');
  // initialize checkbox
  hideTestsCheckbox.checked = !!window.hideTestEvents;
  hideTestsCheckbox.onchange = () => {
    window.hideTestEvents = hideTestsCheckbox.checked;
    renderList();
  };
  function renderList() {
    const f = filter.value;
    list.innerHTML = '';
    const items = window.twitchEvents.filter(ev => f === 'all' ? true : (ev.type === f || (f === 'command' && ev.type === 'chat' && ev.message && ev.message.startsWith('!'))));
    items.slice(0, 200).forEach(ev => {
      // Use addActivity to create a richer DOM node; respect hideTestEvents inside addActivity
      const displayType = (ev.type === 'chat' && ev.message && ev.message.startsWith('!')) ? 'command' : ev.type;
      const data = ev.event ? Object.assign({}, ev.event, { ts: ev.ts }) : Object.assign({}, ev, { ts: ev.ts });
      const node = addActivity(displayType, data);
      if (node) list.appendChild(node);
    });
  }
  filter.onchange = renderList;
  renderList();

  // Test fire
  document.getElementById('twitch-test-fire').onclick = () => {
    const t = document.getElementById('twitch-test-select').value;
    const msg = document.getElementById('twitch-test-input').value || 'TEST';
    const req = (document.getElementById('twitch-test-req') && document.getElementById('twitch-test-req').value) || 'none';
    const userInput = (document.getElementById('twitch-test-username') && document.getElementById('twitch-test-username').value.trim()) || '';
    const user = userInput || 'T3stUs3r';
    if (t === 'chat') {
      pushTwitchEvent({ type: 'chat', user, user_name: user, message: msg, _testRequirement: req });
    } else if (t === 'command') {
      pushTwitchEvent({ type: 'chat', user, user_name: user, message: '!' + (msg || 'test'), _testRequirement: req });
    } else if (t === 'redeem') {
      // msg = reward title
  pushTwitchEvent({ type: 'redeem', user: user, user_name: user, event: { user_name: user, reward: { title: msg }, user_input: '' }, _testRequirement: req });
    } else if (t === 'follow') {
  pushTwitchEvent({ type: 'follow', user: user, user_name: user, event: { user_name: user }, _testRequirement: req });
    } else if (t === 'sub') {
      // msg = optional tier (e.g., Tier 1)
      const tier = msg || 'Tier 1';
  const ev = { type: 'sub', user: user, user_name: user, event: { user_name: user, tier }, _testRequirement: req };
      // if the selected req encodes a sub tier, mirror it
      if (req && req.startsWith('sub_tier')) ev.event.tier = 'Tier ' + req.replace('sub_tier', '');
      if (req === 'sub_prime') ev.event.tier = 'Prime';
      pushTwitchEvent(ev);
    } else if (t === 'subgift') {
      // msg = recipient username
  pushTwitchEvent({ type: 'subgift', user: user, user_name: user, event: { user_name: user, recipient_user_name: (msg || 'GiftedUser') }, _testRequirement: req });
    } else if (t === 'bits') {
      // msg = amount
      const amt = parseInt(msg, 10) || 100;
  pushTwitchEvent({ type: 'bits', user: user, user_name: user, event: { user_name: user, bits: amt }, _testRequirement: req });
    } else if (t === 'raid') {
      // msg = viewer count
      const v = parseInt(msg, 10) || 5;
  pushTwitchEvent({ type: 'raid', user: user, user_name: user, event: { from_broadcaster_user_name: user, viewers: v }, _testRequirement: req });
    }
    renderList();
  };

  // adjust placeholder based on selected test type
  const testSelect = document.getElementById('twitch-test-select');
  const testInput = document.getElementById('twitch-test-input');
  testSelect.onchange = () => {
    const val = testSelect.value;
    switch (val) {
      case 'chat': testInput.placeholder = 'Optional chat message'; break;
      case 'command': testInput.placeholder = 'Command text (without !)'; break;
      case 'redeem': testInput.placeholder = 'Reward title'; break;
      case 'follow': testInput.placeholder = 'Optional follower name override'; break;
      case 'sub': testInput.placeholder = 'Tier (e.g. Tier 1)'; break;
      case 'subgift': testInput.placeholder = 'Recipient username'; break;
      case 'bits': testInput.placeholder = 'Amount (e.g. 100)'; break;
      case 'raid': testInput.placeholder = 'Viewer count (e.g. 10)'; break;
      default: testInput.placeholder = 'Optional message or value';
    }
  };
}

// Connected-state menu modal
function showTwitchConnectedMenu() {
  let modal = document.getElementById('twitch-connected-menu');
  if (modal) return;
  modal = document.createElement('div');
  modal.id = 'twitch-connected-menu';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.background = '#111';
  modal.style.color = '#fff';
  modal.style.padding = '16px';
  modal.style.borderRadius = '10px';
  modal.style.zIndex = '10005';
  modal.style.width = '320px';
  modal.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)';
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><strong>Twitch Menu</strong><button id="twitch-connected-menu-close">Close</button></div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button id="twitch-menu-view-events" style="padding:8px;border-radius:6px;background:#222;color:#fff;border:1px solid #333;">View Twitch Events / Test Events</button>
      <button id="twitch-menu-subscriptions" style="padding:8px;border-radius:6px;background:#222;color:#fff;border:1px solid #333;">EventSub Subscriptions (Select)</button>
  <button id="twitch-menu-clear-creds" style="padding:8px;border-radius:6px;background:#661111;color:#fff;border:1px solid #330000;">Clear Twitch Credentials</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('twitch-connected-menu-close').onclick = () => modal.remove();
  document.getElementById('twitch-menu-view-events').onclick = () => { modal.remove(); showTwitchActivityModal(); };
  document.getElementById('twitch-menu-subscriptions').onclick = () => { modal.remove(); showTwitchSubscriptionsModal(); };
  // Clear creds handler — show a single custom confirmation dialog with a checkbox for purging topics
  document.getElementById('twitch-menu-clear-creds').onclick = async () => {
    try {
      // Build a small confirmation modal instead of two browser confirms
      const conf = document.createElement('div');
      conf.id = 'vd-twitch-clear-confirm';
      conf.style.position = 'fixed';
      conf.style.top = '50%';
      conf.style.left = '50%';
      conf.style.transform = 'translate(-50%,-50%)';
      conf.style.zIndex = '10020';
      conf.style.background = '#111';
      conf.style.color = '#fff';
      conf.style.padding = '16px';
      conf.style.borderRadius = '8px';
      conf.style.width = '420px';
      conf.style.boxShadow = '0 6px 30px rgba(0,0,0,0.5)';
      conf.innerHTML = `
        <div style="margin-bottom:8px"><strong>Disconnect & clear Twitch</strong></div>
        <div style="color:#ddd;margin-bottom:12px">Clear Twitch credentials and disconnect? This will remove EventSub subscriptions created by this app and close chat connections.</div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><input id="vd-purge-topics" type="checkbox" /> Also remove saved EventSub topics from app settings</label>
        <div style="display:flex;justify-content:flex-end;gap:8px"><button id="vd-clear-ok" style="padding:8px 10px;background:#4dd0e1;border:none;border-radius:6px">OK</button><button id="vd-clear-cancel" style="padding:8px 10px;background:#333;border:none;border-radius:6px">Cancel</button></div>
      `;
      document.body.appendChild(conf);

      const ok = conf.querySelector('#vd-clear-ok');
      const cancel = conf.querySelector('#vd-clear-cancel');
      cancel.onclick = () => { try { conf.remove(); } catch (e) {} };
      ok.onclick = () => {
        try {
          const purge = !!conf.querySelector('#vd-purge-topics').checked;
          // disable UI immediately
          ok.disabled = true; cancel.disabled = true;
          ok.innerText = 'Clearing...';
          // send clear request to main
          if (window.electronAPI && window.electronAPI.clearTwitchCreds) {
            window.electronAPI.clearTwitchCreds({ purgeTopics: purge });
          } else if (window.ipcRenderer) {
            window.ipcRenderer.send('twitch-clear-creds', { purgeTopics: purge });
          }
          // remove both the confirmation and the connected menu so user returns to main UI
          try { conf.remove(); } catch (e) {}
          try { modal.remove(); } catch (e) {}

          // Show a persistent "Clearing..." modal while main performs teardown.
          try {
            // Avoid creating multiple clearing modals
            if (!document.getElementById('vd-twitch-clearing')) {
              const clearing = document.createElement('div');
              clearing.id = 'vd-twitch-clearing';
              clearing.style.position = 'fixed';
              clearing.style.top = '50%';
              clearing.style.left = '50%';
              clearing.style.transform = 'translate(-50%,-50%)';
              clearing.style.zIndex = '10030';
              clearing.style.background = '#111';
              clearing.style.color = '#fff';
              clearing.style.padding = '18px';
              clearing.style.borderRadius = '8px';
              clearing.style.boxShadow = '0 6px 30px rgba(0,0,0,0.5)';
              clearing.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;gap:10px;min-width:320px">
                  <div style="font-weight:700">Clearing Twitch credentials</div>
                  <div style="color:#ccc;font-size:13px;text-align:center">Please wait while the app disconnects from Twitch and removes any subscriptions created by this app.</div>
                  <div style="margin-top:6px"><svg width="36" height="36" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="20" stroke="#4dd0e1" stroke-width="4" stroke-linecap="round" stroke-dasharray="31.4 31.4" fill="none"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/></circle></svg></div>
                </div>
              `;
              document.body.appendChild(clearing);

              // Setup one-time handlers to remove clearing modal when main notifies completion.
              // Use a guarded flag so handlers only run once.
              let _vdClearingHandled = false;
              const clearHandler = function() {
                if (_vdClearingHandled) return; _vdClearingHandled = true;
                try {
                  const el = document.getElementById('vd-twitch-clearing');
                  if (el) el.remove();
                } catch (e) {}

                // Update the main Twitch Connect button to a disconnected/red state
                try {
                  window.twitchConnectionState = 'disconnected';
                  const btn = document.getElementById('twitch-connect');
                  if (btn) {
                    // red background used elsewhere for destructive actions
                    btn.style.backgroundColor = '#661111';
                    btn.setAttribute('aria-label', 'Disconnected from Twitch');
                    btn.title = 'Disconnected from Twitch';
                    btn.classList.remove('connected');
                    btn.classList.add('disconnected');
                    // if button contains an image, update its alt text; otherwise show text
                    const im = btn.querySelector('img');
                    if (im) im.alt = 'Disconnected';
                    else btn.textContent = 'Disconnected';
                  }
                } catch (e) {}
              };

              // Prefer the electronAPI listeners if available, otherwise fall back to ipcRenderer.once
              if (window.electronAPI && window.electronAPI.onTwitchClearResult) {
                window.electronAPI.onTwitchClearResult(() => { clearHandler(); });
              } else if (window.ipcRenderer && window.ipcRenderer.once) {
                window.ipcRenderer.once('twitch-clear-result', () => { clearHandler(); });
              }

              if (window.electronAPI && window.electronAPI.onTwitchCleared) {
                window.electronAPI.onTwitchCleared(() => { clearHandler(); });
              } else if (window.ipcRenderer && window.ipcRenderer.once) {
                window.ipcRenderer.once('twitch-cleared', () => { clearHandler(); });
              }
            }
          } catch (e) { console.warn('Failed to show clearing modal:', e); }
        } catch (e) { console.warn('Failed to request clear creds:', e); }
      };
    } catch (e) { console.warn('Failed to show clear creds confirmation:', e); }
  };

    // Mapping area: quick Map Events -> Sound Cards
    const mapSection = document.createElement('div');
  mapSection.style.marginTop = '8px';
  mapSection.style.fontSize = '13px';
  mapSection.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><strong>Event → Sound Mappings</strong><button id="add-mapping-btn" style="padding:6px 8px;border-radius:6px;background:#4dd0e1;color:#111;border:none;cursor:pointer">Add mapping</button></div><div id="mappings-list" style="margin-top:6px;max-height:180px;overflow:auto;border:1px solid rgba(255,255,255,0.04);padding:6px;border-radius:6px;background:#0b0b0b"></div>`;
  modal.appendChild(mapSection);

    // Load existing mappings
    const mappingsList = mapSection.querySelector('#mappings-list');
    async function openMappingModal(existing) {
      // existing: mapping object or undefined
      // reuse Add Mapping modal UI but prefill when editing
      const cfg = await window.electronAPI.getConfig();
      const cards = cfg.buttons || [];
      let rewards = [];
      try {
        if (window.electronAPI && window.electronAPI.getChannelRewards) {
          rewards = await window.electronAPI.getChannelRewards();
        }
      } catch (e) { console.warn('Could not load channel rewards:', e); }

      const modal = document.createElement('div');
      modal.style.position = 'fixed'; modal.style.top='50%'; modal.style.left='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.zIndex='10010'; modal.style.background='#111'; modal.style.color='#fff'; modal.style.padding='16px'; modal.style.borderRadius='8px'; modal.style.width='480px';
      modal.innerHTML = `<h3>${existing ? 'Edit' : 'Map'} Event → Sound</h3>
        <label style="display:block;margin-top:8px;font-weight:600">Event Type</label>
        <select id="map-event-type" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff">
          <option value="command">Chat Command (e.g. !hello)</option>
          <option value="redeem">Channel Points Redeem</option>
          <option value="bits">Bits/Cheer</option>
          <option value="follow">Follow</option>
          <option value="sub_any" title="Subscribe">Subscribe (Any)</option>
          <option value="sub_tier1" title="Subscribe Tier 1">Subscribe — Tier 1</option>
          <option value="sub_tier2" title="Subscribe Tier 2">Subscribe — Tier 2</option>
          <option value="sub_tier3" title="Subscribe Tier 3">Subscribe — Tier 3</option>
          <option value="sub_prime" title="Subscribe Prime">Subscribe — Prime</option>
          <option value="raid">Raid</option>
        </select>
        <div id="map-event-context" style="margin-top:10px"></div>
  <!-- subscribe tier selector removed; tiers are separate event types now -->
        <label id="map-user-req-label" hidden style="display:block;margin-top:10px;font-weight:600">User Requirement (coming soon)</label>
        <select id="map-user-req" hidden style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff">
          <option value="none">None</option>
          <option value="follower">Follower</option>
          <option value="subscriber">Subscriber</option>
          <option value="sub_tier1">Subscriber — Tier 1</option>
          <option value="sub_tier2">Subscriber — Tier 2</option>
          <option value="sub_tier3">Subscriber — Tier 3</option>
          <option value="sub_prime">Subscriber — Prime</option>
          <option value="vip">VIP</option>
          <option value="mod">Moderator</option>
        </select>
        <label style="display:block;margin-top:12px;font-weight:600">Select Sound Card(s)</label>
        <div id="map-card-chooser" style="display:flex;gap:8px;margin-top:6px">
          <div style="flex:1">
            <div style="color:#ccc;font-size:12px;margin-bottom:6px">Available</div>
            <div id="map-card-available" style="max-height:120px;overflow:auto;padding:6px;background:#0b0b0b;border-radius:6px;border:1px solid #333"></div>
          </div>
          <div style="width:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
            <button id="map-card-add" style="padding:6px;border-radius:6px;background:#4dd0e1;border:none;cursor:pointer">→</button>
            <button id="map-card-remove" style="padding:6px;border-radius:6px;background:#ff8a65;border:none;cursor:pointer">←</button>
          </div>
          <div style="flex:1">
            <div style="color:#ccc;font-size:12px;margin-bottom:6px">Selected</div>
            <div id="map-card-selected" style="max-height:120px;overflow:auto;padding:6px;background:#0b0b0b;border-radius:6px;border:1px solid #333"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button id="map-save" style="padding:8px 10px;background:#4dd0e1;border:none;border-radius:6px;margin-right:8px">Save</button><button id="map-cancel" style="padding:8px 10px;background:#ff8a65;border:none;border-radius:6px">Cancel</button></div>`;
      document.body.appendChild(modal);
      // Disable the User Requirement select in Add Mapping modal as well
      try {
        const _reqControl2 = modal.querySelector && modal.querySelector('#map-user-req');
        if (_reqControl2) {
          _reqControl2.disabled = true;
          _reqControl2.title = 'Feature Coming Soon!';
          _reqControl2.style.opacity = '0.7';
          _reqControl2.style.cursor = 'not-allowed';
          _reqControl2.addEventListener('change', () => { if (_reqControl2.value && _reqControl2.value !== 'none') { alert('Feature Coming Soon!'); _reqControl2.value = 'none'; } });
          _reqControl2.addEventListener('click', () => { if (_reqControl2.disabled) alert('Feature Coming Soon!'); });
        }
      } catch (e) {}
      // Temporarily disable the User Requirement control and surface a friendly message
      try {
        const _reqControl = modal.querySelector && modal.querySelector('#map-user-req');
        if (_reqControl) {
          _reqControl.disabled = true;
          _reqControl.title = 'Feature Coming Soon!';
          _reqControl.style.opacity = '0.7';
          _reqControl.style.cursor = 'not-allowed';
          // If users try to interact, show an alert and keep value at 'none'
          _reqControl.addEventListener('change', () => {
            if (_reqControl.value && _reqControl.value !== 'none') {
              alert('Feature Coming Soon!');
              _reqControl.value = 'none';
            }
          });
          _reqControl.addEventListener('click', () => { if (_reqControl.disabled) alert('Feature Coming Soon!'); });
        }
      } catch (e) { /* ignore */ }
      const avail = modal.querySelector('#map-card-available');
      const selBox = modal.querySelector('#map-card-selected');
      avail.innerHTML = '';
      selBox.innerHTML = '';
      for (const c of cards) {
        const node = document.createElement('div');
        node.className = 'map-card-available-item';
        node.style.padding = '6px';
        node.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        node.style.cursor = 'pointer';
        node.textContent = c.label;
        node.dataset.value = c.label;
        // double click moves to selected
        node.ondblclick = () => { moveToSelected(node.dataset.value); };
        node.onclick = () => { node.classList.toggle('vd-selected'); };
        avail.appendChild(node);
      }

      function makeSelectedNode(label) {
        const node = document.createElement('div');
        node.className = 'map-card-selected-item';
        node.style.padding = '6px';
        node.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        node.style.cursor = 'pointer';
        node.textContent = label;
        node.dataset.value = label;
        node.ondblclick = () => { moveToAvailable(node.dataset.value); };
        node.onclick = () => { node.classList.toggle('vd-selected'); };
        return node;
      }

      function moveToSelected(val) {
        if (!val) return;
        // find in available and remove
        const a = Array.from(avail.children).find(ch => ch.dataset && ch.dataset.value === val);
        if (a) a.parentNode.removeChild(a);
        // don't duplicate
        if (!Array.from(selBox.children).some(ch => ch.dataset && ch.dataset.value === val)) {
          selBox.appendChild(makeSelectedNode(val));
        }
      }

      function moveToAvailable(val) {
        if (!val) return;
        // remove from selected
        const s = Array.from(selBox.children).find(ch => ch.dataset && ch.dataset.value === val);
        if (s) s.parentNode.removeChild(s);
        // don't duplicate
        if (!Array.from(avail.children).some(ch => ch.dataset && ch.dataset.value === val)) {
          const node = document.createElement('div');
          node.className = 'map-card-available-item';
          node.style.padding = '6px';
          node.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
          node.style.cursor = 'pointer';
          node.textContent = val;
          node.dataset.value = val;
          node.ondblclick = () => { moveToSelected(node.dataset.value); };
          node.onclick = () => { node.classList.toggle('vd-selected'); };
          avail.appendChild(node);
        }
      }

      modal.querySelector('#map-card-add').onclick = () => {
        const picked = Array.from(avail.querySelectorAll('.vd-selected')).map(n => n.dataset.value);
        for (const p of picked) moveToSelected(p);
      };
      modal.querySelector('#map-card-remove').onclick = () => {
        const picked = Array.from(selBox.querySelectorAll('.vd-selected')).map(n => n.dataset.value);
        for (const p of picked) moveToAvailable(p);
      };

      const ctx = modal.querySelector('#map-event-context');
      const typeSelect = modal.querySelector('#map-event-type');

      function renderContextInput() {
        const t = typeSelect.value;
        ctx.innerHTML = '';
  // tiers are chosen via dedicated event type values like sub_tier2 / sub_prime
        // show user requirement only for command and bits mappings
        try {
          const reqEl = modal.querySelector('#map-user-req');
          const reqLbl = modal.querySelector('#map-user-req-label');
          if (reqEl) reqEl.style.display = (t === 'command' || t === 'bits') ? 'block' : 'none';
          if (reqLbl) reqLbl.style.display = (t === 'command' || t === 'bits') ? 'block' : 'none';
        } catch (e) {}
  if (t === 'command') {
          ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Command (without leading '!')</label><input id="map-cmd-input" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff" placeholder="hello" /><div style="color:#888;font-size:12px;margin-top:6px">You can type with or without '!' — both are accepted.</div>`;
        } else if (t === 'redeem') {
          // show dropdown of rewards if available else free text
          if (rewards && rewards.length > 0) {
            const opts = rewards.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('');
            ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Select Reward</label><select id="map-reward-select" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff">${opts}</select>`;
          } else {
            ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Reward Title</label><input id="map-reward-input" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff" placeholder="Reward title" />`;
          }
        } else if (t === 'bits') {
          ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Minimum Bits Amount</label><input id="map-bits-input" type="number" min="1" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff" placeholder="e.g. 100" />`;
        } else {
          ctx.innerHTML = `<div style="color:#aaa;font-size:13px;margin-top:6px">No extra options for this type. Mapping will trigger on the event.</div>`;
        }
  // insert helper warning element for tier-specific requirement
  const warnRow = document.createElement('div');
  warnRow.id = 'map-req-creds-warning';
  warnRow.style.color = '#ffcc88';
  warnRow.style.fontSize = '12px';
  warnRow.style.marginTop = '8px';
  warnRow.style.display = 'none';
  warnRow.textContent = 'Note: Tier-specific subscriber checks require broadcaster Twitch credentials to be connected.';
  ctx.appendChild(warnRow);
      }

      typeSelect.onchange = renderContextInput;
      renderContextInput();

      // show/hide creds warning when requirement select changes
      async function updateReqCredsWarning() {
        try {
          const warn = modal.querySelector('#map-req-creds-warning');
          const reqEl = modal.querySelector('#map-user-req');
          if (!warn || !reqEl) return;
          const val = reqEl.value || '';
          if (val && val.startsWith && val.startsWith('sub_')) {
            const hasCreds = window.electronAPI && window.electronAPI.hasTwitchCreds ? await window.electronAPI.hasTwitchCreds() : false;
            warn.style.display = hasCreds ? 'none' : 'block';
          } else {
            warn.style.display = 'none';
          }
        } catch (e) {}
      }
      const reqElWatch = modal.querySelector('#map-user-req'); if (reqElWatch) reqElWatch.onchange = updateReqCredsWarning;
      updateReqCredsWarning();

      // prefill
      if (existing) {
        // select type
        if (existing.type) typeSelect.value = existing.type;
        // set card
        if (existing.cardLabels && Array.isArray(existing.cardLabels)) {
          for (const v of existing.cardLabels) moveToSelected(v);
        } else if (existing.cardLabel) {
          moveToSelected(existing.cardLabel);
        }
        renderContextInput();
        if (existing.type === 'command' && existing.command) modal.querySelector('#map-cmd-input').value = existing.command;
        if (existing.type === 'redeem' && existing.rewardTitle) {
          const sel = modal.querySelector('#map-reward-select');
          if (sel) sel.value = existing.rewardTitle;
          else modal.querySelector('#map-reward-input').value = existing.rewardTitle;
        }
        if (existing.type === 'bits' && existing.bits) modal.querySelector('#map-bits-input').value = existing.bits;
        // Legacy: if existing mapping used type 'sub' with a tier field, convert it to the new type values
        if (existing.type === 'sub' && existing.tier) {
          const tval = (existing.tier || 'any').toLowerCase();
          if (tval === 'tier1') typeSelect.value = 'sub_tier1';
          else if (tval === 'tier2') typeSelect.value = 'sub_tier2';
          else if (tval === 'tier3') typeSelect.value = 'sub_tier3';
          else if (tval === 'prime') typeSelect.value = 'sub_prime';
          else typeSelect.value = 'sub_any';
        }
        if (existing.requirement) {
          const rs = modal.querySelector('#map-user-req'); if (rs) rs.value = existing.requirement;
        }
      }

      modal.querySelector('#map-cancel').onclick = () => modal.remove();
      modal.querySelector('#map-save').onclick = async () => {
        const t = typeSelect.value;
        const mapping = existing ? Object.assign({}, existing) : {};
        mapping.type = t;
  // gather selected labels from selected box
  const selBoxSave = modal.querySelector('#map-card-selected');
  const chosen = Array.from(selBoxSave.children).map(ch => ch.dataset && ch.dataset.value).filter(Boolean);
  mapping.cardLabels = chosen;
  mapping.cardLabel = (chosen && chosen.length > 0) ? chosen[0] : '';
  // persist tier for subscribe mappings
  // If user picked a sub_* event type, keep that as mapping.type; for legacy mappings with mapping.tier, we will convert below
  // persist user requirement (none/follower/subscriber/vip/mod)
  // User Requirement feature disabled for now — do not persist requirements
  mapping.requirement = 'none';
        // If user selected a tier-specific subscriber requirement, warn if Twitch creds are missing
        if (mapping.requirement && mapping.requirement.startsWith && mapping.requirement.startsWith('sub_')) {
          try {
            const hasCreds = window.electronAPI && window.electronAPI.hasTwitchCreds ? await window.electronAPI.hasTwitchCreds() : false;
            if (!hasCreds) {
              const ok = confirm('You selected a tier-specific subscriber requirement but Twitch credentials are not connected; tier checks will not work without a broadcaster token. Save anyway?');
              if (!ok) return; // abort save
            }
          } catch (e) {}
        }
        if (t === 'command') {
          const v = (modal.querySelector('#map-cmd-input').value || '').trim();
          if (!v) return alert('Please enter a command');
          mapping.command = v.startsWith('!') ? v.substring(1) : v;
        } else if (t === 'redeem') {
          const sel = modal.querySelector('#map-reward-select');
          mapping.rewardTitle = sel ? sel.value : (modal.querySelector('#map-reward-input').value || '').trim();
          if (!mapping.rewardTitle) return alert('Please select or enter a reward title');
        } else if (t === 'bits') {
          const bits = parseInt(modal.querySelector('#map-bits-input').value, 10) || 0;
          if (!bits) return alert('Please enter a minimum bits amount');
          mapping.bits = bits;
        }
        // enforce single mapping for follow/sub/raid
        if (['follow','sub','raid'].includes(mapping.type)) {
          const existingMaps = await (window.electronAPI.getMappings ? window.electronAPI.getMappings() : []);
          const conflict = existingMaps.find(m => m.type === mapping.type && (!mapping.id || m.id !== mapping.id));
          if (conflict) return alert(`A mapping for ${mapping.type} already exists. Only one mapping allowed for this type.`);
        }
        // save mapping
        if (window.electronAPI && window.electronAPI.saveMapping) window.electronAPI.saveMapping(mapping);
        modal.remove();
        setTimeout(loadMappingsUI, 200);
      };
    }

    async function loadMappingsUI() {
      mappingsList.innerHTML = '<div style="color:#888">Loading...</div>';
      let maps = [];
      try {
        if (window.electronAPI && window.electronAPI.getMappings) maps = await window.electronAPI.getMappings();
      } catch (e) { console.error('Error loading mappings UI:', e); }
      mappingsList.innerHTML = '';
      if (!maps || maps.length === 0) mappingsList.innerHTML = '<div style="color:#666">No mappings yet.</div>';
      for (const m of (maps || [])) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '6px 6px';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        row.style.fontSize = '13px';
        // Build a friendly description for structured mappings
        let desc = 'unknown';
        try {
          if (m.type === 'command') desc = 'Command';
          else if (m.type === 'redeem') desc = 'Redeem';
          else if (m.type === 'bits') desc = 'Bits';
          else if (m.type === 'follow') desc = 'Follow';
          else if (m.type && m.type.startsWith('sub_')) {
            if (m.type === 'sub_any') desc = 'Subscribe';
            else if (m.type === 'sub_tier1') desc = 'Subscribe — Tier 1';
            else if (m.type === 'sub_tier2') desc = 'Subscribe — Tier 2';
            else if (m.type === 'sub_tier3') desc = 'Subscribe — Tier 3';
            else if (m.type === 'sub_prime') desc = 'Subscribe — Prime';
            else desc = 'Subscribe';
          }
          else if (m.type === 'raid') desc = 'Raid';
          else desc = m.event || m.type || JSON.stringify(m);
        } catch (e) { desc = m.event || m.type || 'unknown'; }
        // build a compact context and requirement display for the menu (omit sound card names)
        function prettyRequirement(r) {
          const rr = (r || 'none').toString();
          if (rr === 'none') return 'None';
          if (rr === 'follower') return 'Follower';
          if (rr === 'subscriber' || rr === 'sub_any') return 'Subscriber';
          if (rr === 'vip') return 'VIP';
          if (rr === 'mod' || rr === 'moderator') return 'Moderator';
          if (rr.startsWith('sub_tier')) return rr.replace('sub_tier', 'Sub Tier ');
          if (rr === 'sub_prime') return 'Sub — Prime';
          return rr;
        }

        let contextText = '';
        try {
          if (m.type === 'command') contextText = (m.command ? `!${m.command}` : '');
          else if (m.type === 'redeem') contextText = (m.rewardTitle || 'any');
          else if (m.type === 'bits') contextText = (m.bits ? `≥ ${m.bits}` : 'any');
          else if (m.type && m.type.startsWith('sub_')) contextText = ''; // type already describes tier
          else contextText = '';
        } catch (e) { contextText = ''; }

        const left = document.createElement('div');
        left.style.flex = '1';
  // show full description (allow wrapping) so users can see the whole mapping
  left.style.overflow = 'auto';
  left.style.whiteSpace = 'normal';
  left.style.textOverflow = 'clip';
        left.style.paddingRight = '8px';
  const reqText = (m && m.requirement && String(m.requirement).toLowerCase() !== 'none') ? ` <span style="color:#ffcc88;margin-left:8px">| Req: ${escapeHtml(prettyRequirement(m.requirement))}</span>` : '';
  left.innerHTML = `<strong style="color:#9ad;display:inline-block;min-width:0">${escapeHtml(desc)}</strong>` +
       (contextText ? ` <span style="color:#ddd;margin-left:8px">| ${escapeHtml(contextText)}</span>` : '') +
       reqText;
        // add edit and delete icons to save space
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        // darker buttons with stroke
        function makeBtn(txt, title, onClick) {
          const b = document.createElement('button');
          b.innerHTML = txt;
          b.title = title;
          b.style.padding = '6px 8px';
          b.style.background = '#111';
          b.style.color = '#fff';
          b.style.border = '1px solid rgba(255,255,255,0.08)';
          b.style.borderRadius = '6px';
          b.style.cursor = 'pointer';
          b.onclick = onClick;
          return b;
        }
        const editBtn = makeBtn('✏️', 'Edit mapping', () => openMappingModal(m));
        const playBtn = makeBtn('▶️', 'Play mapping (test)', async () => {
          // open a small test modal that shows requirement checks and allows firing
          openMappingTestModal(m);
        });
        const delBtn = makeBtn('🗑️', 'Delete mapping', () => { if (confirm('Delete mapping?')) { window.electronAPI.deleteMapping(m.id); loadMappingsUI(); } });
        actions.appendChild(editBtn); actions.appendChild(playBtn); actions.appendChild(delBtn);

        row.appendChild(left);
        row.appendChild(actions);
  // no auto scroll; left pane is scrollable vertically if needed

        mappingsList.appendChild(row);
      }
    }
    loadMappingsUI();

    // Open a small modal to test a mapping: shows requirement checks and can fire the mapping
    function openMappingTestModal(mapping) {
      const modal = document.createElement('div');
      modal.style.position = 'fixed'; modal.style.top='50%'; modal.style.left='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.zIndex='10020'; modal.style.background='#111'; modal.style.color='#fff'; modal.style.padding='12px'; modal.style.borderRadius='8px'; modal.style.width='380px';
      const req = mapping.requirement || 'none';
      modal.innerHTML = `<h4 style="margin:0 0 8px 0">Test Mapping</h4><div style="margin-bottom:8px">${escapeHtml(mapping.type || '')} → <strong style="color:#ffd166">${escapeHtml(mapping.cardLabel||'unknown')}</strong></div>
        <div style="margin-bottom:8px"><label style="display:block;font-weight:600">Test Requirement</label>
          <select id="map-test-req" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff">
            <option value="none">None</option>
            <option value="follower">Follower</option>
            <option value="subscriber">Subscriber</option>
            <option value="vip">VIP</option>
            <option value="mod">Moderator</option>
            <option value="sub_any">Sub — Any</option>
            <option value="sub_tier1">Sub — Tier 1</option>
            <option value="sub_tier2">Sub — Tier 2</option>
            <option value="sub_tier3">Sub — Tier 3</option>
            <option value="sub_prime">Sub — Prime</option>
          </select>
        </div>
        <div id="map-test-username-row" style="margin-bottom:8px"><label style="display:block;font-weight:600">Optional Username (for live checks)</label><input id="map-test-username" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff" placeholder="username to test (optional)" /></div>
        <div id="map-test-checks" style="margin-bottom:8px;color:#aaa;font-size:13px">Requirement: <strong>${escapeHtml(req)}</strong></div>
        <div style="display:flex;justify-content:flex-end;gap:8px"><button id="map-test-fire" style="padding:8px 10px;background:#4dd0e1;border:none;border-radius:6px">Fire Test</button><button id="map-test-close" style="padding:8px 10px;background:#333;border:none;border-radius:6px">Close</button></div>`;
      document.body.appendChild(modal);
      const reqSelect = modal.querySelector('#map-test-req');
      // Disable requirement selection in test modal as well
      try {
        if (reqSelect) {
          reqSelect.disabled = true;
          reqSelect.title = 'Feature Coming Soon!';
          reqSelect.style.opacity = '0.7';
          reqSelect.style.cursor = 'not-allowed';
          reqSelect.addEventListener('change', () => { if (reqSelect.value && reqSelect.value !== 'none') { alert('Feature Coming Soon!'); reqSelect.value = 'none'; } });
          reqSelect.addEventListener('click', () => { if (reqSelect.disabled) alert('Feature Coming Soon!'); });
        }
      } catch (e) {}
      const usernameInput = modal.querySelector('#map-test-username');
      const checksDiv = modal.querySelector('#map-test-checks');
      const updateChecks = async () => {
        const sel = (reqSelect.value || 'none');
        const uname = (usernameInput.value || '').trim();
        let out = `Requirement: ${sel} — `;
        try {
          // Evaluate multiple checks for display
          let followerOk = false, subOk = false, vipOk = false, modOk = false;
          if (uname) {
            if (window.electronAPI && window.electronAPI.checkUserFollows) followerOk = await window.electronAPI.checkUserFollows(uname);
            if (window.electronAPI && window.electronAPI.checkUserSubscriber) subOk = await window.electronAPI.checkUserSubscriber(uname);
            if (window.electronAPI && window.electronAPI.checkUserVip) vipOk = await window.electronAPI.checkUserVip(uname);
            if (window.electronAPI && window.electronAPI.checkUserMod) modOk = await window.electronAPI.checkUserMod(uname);
          } else {
            out += 'enter username for live checks';
            checksDiv.textContent = out;
            return;
          }
          out += `follower:${followerOk? 'Y':'N'} sub:${subOk? 'Y':'N'} vip:${vipOk? 'Y':'N'} mod:${modOk? 'Y':'N'}`;
        } catch (e) { out += 'error'; }
        checksDiv.textContent = out;
      };
      reqSelect.onchange = updateChecks;
      usernameInput.oninput = updateChecks;
      modal.querySelector('#map-test-close').onclick = () => modal.remove();
      modal.querySelector('#map-test-fire').onclick = async () => {
        const sel = (reqSelect.value || 'none');
        const uname = (usernameInput.value || '').trim() || 'T3stUs3r';
        // Build synthetic event and attach a _testRequirement field so UI can surface it
        const t = mapping.type || '';
        let evt = null;
  if (t === 'command') evt = { type: 'chat', message: `!${mapping.command}`, user: uname, user_name: uname, _testRequirement: sel };
  else if (t === 'redeem') evt = { type: 'redeem', user: uname, user_name: uname, event: { user_name: uname, reward: { title: mapping.rewardTitle }, user_input: '' }, _testRequirement: sel };
  else if (t === 'bits') evt = { type: 'bits', user: uname, user_name: uname, event: { user_name: uname, bits: mapping.bits || 100 }, _testRequirement: sel };
  else if (t.startsWith('sub')) evt = { type: 'sub', user: uname, user_name: uname, event: { user_name: uname, tier: t.includes('tier1') ? 'tier1' : t.includes('tier2') ? 'tier2' : t.includes('tier3') ? 'tier3' : t.includes('prime') ? 'prime' : 'any' }, _testRequirement: sel };
  else evt = { type: t, user: uname, user_name: uname, _testRequirement: sel };
        // push through same pipeline
        pushTwitchEvent(evt);
        checksDiv.textContent = 'Fired test event — check logs/outputs';
      };
    }

    // Add Mapping modal
  // when opening Add Mapping modal, disable creation of subscribe mappings
  mapSection.querySelector('#add-mapping-btn').onclick = async () => {
      // gather available cards and channel rewards
      const cfg = await window.electronAPI.getConfig();
      const cards = cfg.buttons || [];
      let rewards = [];
      try {
        if (window.electronAPI && window.electronAPI.getChannelRewards) {
          rewards = await window.electronAPI.getChannelRewards();
        }
      } catch (e) { console.warn('Could not load channel rewards:', e); }

      const modal = document.createElement('div');
      modal.style.position = 'fixed'; modal.style.top='50%'; modal.style.left='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.zIndex='10010'; modal.style.background='#111'; modal.style.color='#fff'; modal.style.padding='16px'; modal.style.borderRadius='8px'; modal.style.width='480px';
    modal.innerHTML = `<h3>Map Event → Sound</h3>
        <label style="display:block;margin-top:8px;font-weight:600">Event Type</label>
        <select id="map-event-type" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff">
          <option value="command">Chat Command (e.g. !hello)</option>
          <option value="redeem">Channel Points Redeem</option>
          <option value="bits">Bits/Cheer</option>
          <option value="follow">Follow</option>
          <option value="sub_any" title="Subscribe">Subscribe (Any)</option>
          <option value="sub_tier1" title="Subscribe Tier 1">Subscribe — Tier 1</option>
          <option value="sub_tier2" title="Subscribe Tier 2">Subscribe — Tier 2</option>
          <option value="sub_tier3" title="Subscribe Tier 3">Subscribe — Tier 3</option>
          <option value="sub_prime" title="Subscribe Prime">Subscribe — Prime</option>
          <option value="raid">Raid</option>
        </select>
        <div id="map-event-context" style="margin-top:10px"></div>
  <!-- subscribe tier controls removed; tiers are separate event types now -->
        <label id="map-user-req-label" hidden style="display:block;margin-top:10px;font-weight:600">User Requirement (coming soon)</label>
        <select id="map-user-req" hidden style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff">
          <option value="none">None</option>
          <option value="follower">Follower</option>
          <option value="subscriber">Subscriber</option>
          <option value="vip">VIP</option>
          <option value="mod">Moderator</option>
        </select>
        <label style="display:block;margin-top:12px;font-weight:600">Select Sound Card(s)</label>
        <div id="map-card-chooser" style="display:flex;gap:8px;margin-top:6px">
          <div style="flex:1">
            <div style="color:#ccc;font-size:12px;margin-bottom:6px">Available</div>
            <div id="map-card-available" style="max-height:120px;overflow:auto;padding:6px;background:#0b0b0b;border-radius:6px;border:1px solid #333"></div>
          </div>
          <div style="width:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
            <button id="map-card-add" style="padding:6px;border-radius:6px;background:#4dd0e1;border:none;cursor:pointer">→</button>
            <button id="map-card-remove" style="padding:6px;border-radius:6px;background:#ff8a65;border:none;cursor:pointer">←</button>
          </div>
          <div style="flex:1">
            <div style="color:#ccc;font-size:12px;margin-bottom:6px">Selected</div>
            <div id="map-card-selected" style="max-height:120px;overflow:auto;padding:6px;background:#0b0b0b;border-radius:6px;border:1px solid #333"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button id="map-save" style="padding:8px 10px;background:#4dd0e1;border:none;border-radius:6px;margin-right:8px">Save</button><button id="map-cancel" style="padding:8px 10px;background:#ff8a65;border:none;border-radius:6px">Cancel</button></div>`;
      document.body.appendChild(modal);
      const avail = modal.querySelector('#map-card-available');
      const selBox = modal.querySelector('#map-card-selected');
      avail.innerHTML = '';
      selBox.innerHTML = '';
      for (const c of cards) {
        const node = document.createElement('div');
        node.className = 'map-card-available-item';
        node.style.padding = '6px';
        node.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        node.style.cursor = 'pointer';
        node.textContent = c.label;
        node.dataset.value = c.label;
        node.ondblclick = () => { moveToSelected(node.dataset.value); };
        node.onclick = () => { node.classList.toggle('vd-selected'); };
        avail.appendChild(node);
      }

      function makeSelectedNode(label) {
        const node = document.createElement('div');
        node.className = 'map-card-selected-item';
        node.style.padding = '6px';
        node.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        node.style.cursor = 'pointer';
        node.textContent = label;
        node.dataset.value = label;
        node.ondblclick = () => { moveToAvailable(node.dataset.value); };
        node.onclick = () => { node.classList.toggle('vd-selected'); };
        return node;
      }

      function moveToSelected(val) {
        if (!val) return;
        const a = Array.from(avail.children).find(ch => ch.dataset && ch.dataset.value === val);
        if (a) a.parentNode.removeChild(a);
        if (!Array.from(selBox.children).some(ch => ch.dataset && ch.dataset.value === val)) {
          selBox.appendChild(makeSelectedNode(val));
        }
      }

      function moveToAvailable(val) {
        if (!val) return;
        const s = Array.from(selBox.children).find(ch => ch.dataset && ch.dataset.value === val);
        if (s) s.parentNode.removeChild(s);
        if (!Array.from(avail.children).some(ch => ch.dataset && ch.dataset.value === val)) {
          const node = document.createElement('div');
          node.className = 'map-card-available-item';
          node.style.padding = '6px';
          node.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
          node.style.cursor = 'pointer';
          node.textContent = val;
          node.dataset.value = val;
          node.ondblclick = () => { moveToSelected(node.dataset.value); };
          node.onclick = () => { node.classList.toggle('vd-selected'); };
          avail.appendChild(node);
        }
      }

      modal.querySelector('#map-card-add').onclick = () => {
        const picked = Array.from(avail.querySelectorAll('.vd-selected')).map(n => n.dataset.value);
        for (const p of picked) moveToSelected(p);
      };
      modal.querySelector('#map-card-remove').onclick = () => {
        const picked = Array.from(selBox.querySelectorAll('.vd-selected')).map(n => n.dataset.value);
        for (const p of picked) moveToAvailable(p);
      };

      const ctx = modal.querySelector('#map-event-context');
      const typeSelect = modal.querySelector('#map-event-type');

      function renderContextInput() {
        const t = typeSelect.value;
        ctx.innerHTML = '';
        // show tier selector only for subscribe mappings
        try {
          const lbl = modal.querySelector('#map-tier-label');
          const ts = modal.querySelector('#map-tier-select');
          if (lbl) lbl.hidden = (t !== 'sub');
          if (ts) ts.hidden = (t !== 'sub');
        } catch (e) {}
        // show user requirement only for command and bits mappings
        try {
          const reqEl = modal.querySelector('#map-user-req');
          const reqLbl = modal.querySelector('#map-user-req-label');
          if (reqEl) reqEl.style.display = (t === 'command' || t === 'bits') ? 'block' : 'none';
          if (reqLbl) reqLbl.style.display = (t === 'command' || t === 'bits') ? 'block' : 'none';
        } catch (e) {}
        if (t === 'command') {
          ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Command (without leading '!')</label><input id="map-cmd-input" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff" placeholder="hello" /><div style="color:#888;font-size:12px;margin-top:6px">You can type with or without '!' — both are accepted.</div>`;
        } else if (t === 'redeem') {
          // show dropdown of rewards if available else free text
          if (rewards && rewards.length > 0) {
            const opts = rewards.map(r => `<option value="${escapeHtml(r.title)}">${escapeHtml(r.title)}</option>`).join('');
            ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Select Reward</label><select id="map-reward-select" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff">${opts}</select>`;
          } else {
            ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Reward Title</label><input id="map-reward-input" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff" placeholder="Reward title" />`;
          }
        } else if (t === 'bits') {
          ctx.innerHTML = `<label style="display:block;margin-top:6px;font-weight:600">Minimum Bits Amount</label><input id="map-bits-input" type="number" min="1" style="width:100%;padding:8px;margin-top:6px;background:#222;border-radius:6px;border:1px solid #333;color:#fff" placeholder="e.g. 100" />`;
        } else {
          ctx.innerHTML = `<div style="color:#aaa;font-size:13px;margin-top:6px">No extra options for this type. Mapping will trigger on the event.</div>`;
        }
      }

      typeSelect.onchange = renderContextInput;
      renderContextInput();

      modal.querySelector('#map-cancel').onclick = () => modal.remove();
      modal.querySelector('#map-save').onclick = () => {
        const t = typeSelect.value;
        // gather selected labels
        const selBoxSave = modal.querySelector('#map-card-selected');
        const chosen = Array.from(selBoxSave.children).map(ch => ch.dataset && ch.dataset.value).filter(Boolean);
        if (!chosen || chosen.length === 0) return alert('Please select at least one sound card for this mapping');
        let mapping = { type: t, cardLabels: chosen, cardLabel: chosen[0] };
  const tierSel = modal.querySelector('#map-tier-select');
  if (tierSel) mapping.tier = tierSel.value || 'any';
  // persist user requirement from Add modal
  // Requirement feature disabled for now — force none
  mapping.requirement = 'none';
        if (t === 'command') {
          const v = (modal.querySelector('#map-cmd-input').value || '').trim();
          if (!v) return alert('Please enter a command');
          mapping.command = v.startsWith('!') ? v.substring(1) : v;
        } else if (t === 'redeem') {
          const sel = modal.querySelector('#map-reward-select');
          if (sel) mapping.rewardTitle = sel.value;
          else mapping.rewardTitle = (modal.querySelector('#map-reward-input').value || '').trim();
          if (!mapping.rewardTitle) return alert('Please select or enter a reward title');
        } else if (t === 'bits') {
          const bits = parseInt(modal.querySelector('#map-bits-input').value, 10) || 0;
          if (!bits) return alert('Please enter a minimum bits amount');
          mapping.bits = bits;
        }
        // save mapping
        // Backwards-compat: if mapping has explicit tier field, convert to new type encoding
        if (mapping.type === 'sub' && mapping.tier) {
          const t = (mapping.tier || '').toLowerCase();
          if (t === 'tier1') mapping.type = 'sub_tier1';
          else if (t === 'tier2') mapping.type = 'sub_tier2';
          else if (t === 'tier3') mapping.type = 'sub_tier3';
          else if (t === 'prime') mapping.type = 'sub_prime';
          else mapping.type = 'sub_any';
          delete mapping.tier;
        }
        if (window.electronAPI && window.electronAPI.saveMapping) window.electronAPI.saveMapping(mapping);
        modal.remove();
        setTimeout(loadMappingsUI, 200);
      };
    };
}

// EventSub subscriptions selector modal
function showTwitchSubscriptionsModal() {
  let modal = document.getElementById('twitch-subscriptions-modal');
  if (modal) return;
  modal = document.createElement('div');
  modal.id = 'twitch-subscriptions-modal';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.background = '#111';
  modal.style.color = '#fff';
  modal.style.padding = '18px';
  modal.style.borderRadius = '10px';
  modal.style.zIndex = '10005';
  modal.style.width = '520px';
  modal.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)';

  const topics = [
    {key:'channel.follow', label:'Follows'},
    {key:'channel.subscribe', label:'Subscriptions'},
    {key:'channel.subscription.gift', label:'Subscription Gifts'},
    {key:'channel.cheer', label:'Bits/Cheers'},
    {key:'channel.raid', label:'Raids'},
    {key:'channel.channel_points_custom_reward_redemption', label:'Channel Points Redeems'},
  ];

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><strong>EventSub Subscriptions</strong><button id="twitch-subscriptions-close">Close</button></div>
    <div id="twitch-subscriptions-list" style="max-height:50vh;overflow:auto;padding-right:8px;display:flex;flex-direction:column;gap:8px;"></div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;gap:8px;">
      <button id="twitch-subscriptions-cancel" style="padding:8px 12px;border-radius:6px;background:#222;border:1px solid #333;color:#fff;">Cancel</button>
      <button id="twitch-subscriptions-save" style="padding:8px 12px;border-radius:6px;background:#7ccf7c;border:none;color:#062f06;">Save</button>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('twitch-subscriptions-close').onclick = () => modal.remove();
  document.getElementById('twitch-subscriptions-cancel').onclick = () => modal.remove();

  const list = document.getElementById('twitch-subscriptions-list');
  // Create checkboxes
  topics.forEach(t => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    // default to unchecked; we'll set checked based on persisted tc_config
    row.innerHTML = `<input type="checkbox" id="sub_${t.key}" data-key="${t.key}" /> <label for="sub_${t.key}">${t.label}</label>`;
    list.appendChild(row);
  });
  // Add a container for current Helix subscriptions (populated below)
  const currentSubsContainer = document.createElement('div');
  currentSubsContainer.id = 'twitch-current-subs';
  currentSubsContainer.style.marginTop = '12px';
  currentSubsContainer.style.paddingTop = '8px';
  currentSubsContainer.style.borderTop = '1px solid rgba(255,255,255,0.04)';
  currentSubsContainer.innerHTML = `<strong style="display:block;margin-bottom:8px">Current EventSub Subscriptions</strong><div id="twitch-current-subs-list" style="max-height:180px;overflow:auto;padding:6px;background:#0b0b0b;border-radius:6px;font-family:monospace;font-size:12px;color:#ddd"></div>`;
  list.parentNode.insertBefore(currentSubsContainer, list.nextSibling);

  // Fetch persisted twitch config (tc_config) and pre-check boxes, then fetch Helix subscriptions to display
  (async () => {
    try {
      let tc = null;
      if (window.electronAPI && window.electronAPI.getTwitchConfig) {
        tc = await window.electronAPI.getTwitchConfig();
      } else if (window.ipcRenderer && window.ipcRenderer.invoke) {
        tc = await window.ipcRenderer.invoke('get-tc-config');
      }
      if (tc && Array.isArray(tc.topics)) {
        // Uncheck all first, then check only those saved
        list.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
        tc.topics.forEach(k => {
          const el = document.querySelector(`#sub_${CSS.escape(k)}`);
          if (el) el.checked = true;
        });
      }

      // Now fetch Helix subscriptions to show current state
      let subsResp = null;
      try {
        if (window.electronAPI && window.electronAPI.listEventSubSubscriptions) {
          subsResp = await window.electronAPI.listEventSubSubscriptions();
        } else if (window.ipcRenderer && window.ipcRenderer.invoke) {
          subsResp = await window.ipcRenderer.invoke('list-eventsub-subscriptions');
        }
      } catch (err) {
        console.debug('Could not retrieve EventSub subscription list:', err);
      }

      const subsListEl = document.getElementById('twitch-current-subs-list');
      subsListEl.innerHTML = '';
      const owned = (tc && Array.isArray(tc.createdSubscriptions)) ? tc.createdSubscriptions : [];

      if (subsResp && subsResp.data && Array.isArray(subsResp.data) && subsResp.data.length > 0) {
        subsResp.data.forEach(s => {
          const row = document.createElement('div');
          row.style.padding = '6px';
          row.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
          const type = s.type || 'unknown';
          const id = s.id || '';
          const cond = s.condition || {};
          const condText = Object.keys(cond).map(k => `${k}=${cond[k]}`).join(' ');
          const ownerBadge = owned.includes(id) ? '<span style="background:#3b8; color:#022; padding:2px 6px;border-radius:6px;margin-left:8px;font-weight:700;font-size:11px">OWNED</span>' : '';
          row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong style="color:#9ad">${escapeHtml(type)}</strong><div style="color:#999;font-size:11px;margin-top:4px">${escapeHtml(condText)} ${id? ('· id: '+escapeHtml(id)) : ''}</div></div><div>${ownerBadge}</div></div>`;
          subsListEl.appendChild(row);
        });
      } else {
        subsListEl.innerHTML = '<div style="color:#777">No subscriptions found or unable to query Twitch.</div>';
      }

    } catch (err) {
      console.debug('Could not read persisted twitch config or subs:', err);
    }
  })();

  document.getElementById('twitch-subscriptions-save').onclick = () => {
    const checked = Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(i => i.getAttribute('data-key'));
    // Send selected subscriptions to main process to update EventSub subscriptions
    if (window.electronAPI && window.electronAPI.sendTwitchEventSubConnect) {
      window.electronAPI.sendTwitchEventSubConnect({ topics: checked, channel: window.twitchConfig.channel });
    } else if (window.ipcRenderer) {
      window.ipcRenderer.send('twitch-eventsub-connect', { topics: checked, channel: window.twitchConfig.channel });
    }
    modal.remove();
  };
}

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
    // Set visual connected color (Twitch purple) but keep inner GIF intact
    twitchBtn.style.backgroundColor = '#6441a5';
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
    // Prepare fade-in/out
    status.style.opacity = '0';
    status.style.transition = 'opacity 300ms ease';
    document.body.appendChild(status);
  }
  // Update text and fade in, then fade out after 4s
  status.textContent = `Twitch Connected: ${window.twitchConfig.channel}`;
  // Force reflow then fade in
  // eslint-disable-next-line no-unused-expressions
  status.offsetHeight;
  status.style.opacity = '1';
  // Clear any existing hide timer
  if (status._hideTimer) clearTimeout(status._hideTimer);
  status._hideTimer = setTimeout(() => {
    status.style.opacity = '0';
    // remove after transition
    setTimeout(() => {
      if (status && status.parentNode) status.parentNode.removeChild(status);
    }, 300);
  }, 4000);
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

// React to main process notification that creds were cleared
if (window.electronAPI && window.electronAPI.onTwitchCleared) {
  window.electronAPI.onTwitchCleared(() => {
    // Clear stored local credentials in renderer and show config modal
    try {
      localStorage.removeItem('twitch_oauth');
      localStorage.removeItem('twitch_clientid');
      localStorage.removeItem('twitch_channel');
      window.twitchConfig = { oauth: '', clientId: '', channel: '' };
    } catch (e) {}
    // reopen the config modal so the user can re-enter creds
    showTwitchConfigModal();
  });
} else if (window.ipcRenderer) {
  window.ipcRenderer.on('twitch-cleared', () => {
    try {
      localStorage.removeItem('twitch_oauth');
      localStorage.removeItem('twitch_clientid');
      localStorage.removeItem('twitch_channel');
      window.twitchConfig = { oauth: '', clientId: '', channel: '' };
    } catch (e) {}
    showTwitchConfigModal();
  });
}

// Show detailed result when main sends deletion/purge results
if (window.electronAPI && window.electronAPI.onTwitchClearResult) {
  window.electronAPI.onTwitchClearResult((payload) => {
    // payload: { success, deletions: [{id,success,result|error}], purgedTopics }
    const modal = document.createElement('div');
    modal.style.position = 'fixed'; modal.style.top='50%'; modal.style.left='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.zIndex='10030'; modal.style.background='#111'; modal.style.color='#fff'; modal.style.padding='12px'; modal.style.borderRadius='8px'; modal.style.width='540px';
    const lines = [];
    lines.push(`<div style="font-weight:700;margin-bottom:8px">Twitch credentials cleared</div>`);
    if (payload && Array.isArray(payload.deletions)) {
      lines.push(`<div style="font-weight:600;margin-top:6px">Subscription deletions:</div>`);
      if (payload.deletions.length === 0) lines.push(`<div style="color:#aaa;margin-top:6px">No created subscriptions were tracked.</div>`);
      else {
        lines.push('<div style="max-height:200px;overflow:auto;padding:6px;background:#0b0b0b;border-radius:6px;margin-top:6px">');
        for (const d of payload.deletions) {
          const s = d.success ? 'Deleted' : `Failed: ${escapeHtml(d.error || String(d.result || ''))}`;
          lines.push(`<div style="padding:6px;border-bottom:1px solid rgba(255,255,255,0.03)"><strong>${escapeHtml(d.id)}</strong> — ${s}</div>`);
        }
        lines.push('</div>');
      }
    }
    lines.push(`<div style="margin-top:8px">Purged topics: <strong>${payload && payload.purgedTopics ? 'Yes' : 'No'}</strong></div>`);
    lines.push(`<div style="display:flex;justify-content:flex-end;margin-top:12px"><button id="twitch-clear-result-close" style="padding:8px 10px;background:#4dd0e1;border:none;border-radius:6px">Close</button></div>`);
    modal.innerHTML = lines.join('\n');
    document.body.appendChild(modal);
    modal.querySelector('#twitch-clear-result-close').onclick = () => modal.remove();

    // show a brief toast notification
    const toast = document.createElement('div');
    toast.style.position = 'fixed'; toast.style.bottom = '18px'; toast.style.left = '18px'; toast.style.background = '#3b8'; toast.style.color = '#022'; toast.style.padding = '10px 14px'; toast.style.borderRadius = '8px'; toast.style.zIndex='10040'; toast.style.fontWeight='700';
    toast.textContent = 'Twitch credentials cleared';
    document.body.appendChild(toast);
    setTimeout(() => { try { if (toast && toast.parentNode) toast.parentNode.removeChild(toast); } catch(e){} }, 3500);
  });
}
