const { app, BrowserWindow, globalShortcut, Menu, dialog, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { installProductionConsole, packagedArgvFlag } = require('./lib/vd-console');
installProductionConsole();
// Node's crypto: Electron's main process also exposes WebCrypto as globalThis.crypto,
// which has no randomBytes(), so a missing require fails only at call time.
const crypto = require('crypto');
(() => {
  const envPaths = [path.join(__dirname, '.env'), path.join(process.cwd(), '.env')];
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath, override: false });
        console.log('[env] Loaded', envPath);
      }
    } catch (e) {
      console.warn('[env] Failed to load', envPath, e && e.message);
    }
  }
})();
const fse = require('fs-extra'); // helpful for file copying
const { ipcMain } = require('electron');
const ws = require('windows-shortcuts'); // Import windows-shortcuts
const { execFile } = require('child_process');
// const extractIcon = require('extract-file-icon'); // Temporarily disabled due to build issues
const { nativeImage } = require('electron');
const tmi = require('tmi.js'); // Import tmi.js for Twitch chat
const WebSocket = require('ws');
const fetch = require('node-fetch');
const http = require('http');
const { autoUpdater } = require('electron-updater');
const { createAppUpdater } = require('./lib/app-updater');
const VTuberManager = require('./vtuber-manager');
const { stopStreamlabsStreamingIfLive, streamlabsTcpRequest } = require('./streamlabs-tcp');
const { SceneProviders, DEFAULT_OBS_URL } = require('./lib/scene-providers');
const ravenHost = require('./raven-host');
const SecurityManager = require('./lib/security');
const { JarvisServer } = require('./jarvis-server');
const { registry: jarvisRegistry } = require('./jarvis-tools');
const { AIConfigManager } = require('./lib/ai-config');
const { fetchVoicePreviewAudio, validateVoicePreviewRequest } = require('./lib/ai-voice-preview');
const { readMediaFileAsDataUrl } = require('./lib/media-file');
const { WAKE_NAMES_REQUIRE_RAVEN_RESTART } = require('./lib/wake-names');
const { copyTreeSync, copyFileSyncSafe } = require('./lib/copy-tree-sync');
const RaidFavoritesStore = require('./lib/raid-favorites-store');
const { RaidHelixClient } = require('./lib/raid-helix');
const { buildTwitchAuthorizeUrl, getTwitchOAuthClientId } = require('./lib/twitch-oauth');
const {
  executeTwitchClipHelixFlow,
  shouldPostClipsToDiscord,
  TWITCH_CLIP_COOLDOWN_MS,
} = require('./lib/twitch-clips');
const { formatSocialsLine, normalizeSocials, splitChatMessages, TWITCH_CHAT_MAX_LEN } = require('./lib/socials');
const { TwitchCommercialClient } = require('./lib/twitch-commercial');
const {
  buildDeckButtonCatalog,
  normalizeMacroTriggerButtonSteps,
} = require('./lib/macro-button-picker');
const { createTwitchMessageDeduper } = require('./lib/twitch-chat-dedupe');
const { createTwitchOAuthHost } = require('./lib/twitch-oauth-host');
const { encodeField, decodeField } = require('./lib/portable-secret');
const { speakViaDevApi } = require('./lib/raven-dev-speak');
const {
  buildRavenPlayAudioMessage,
  RAVEN_AI_AUDIO_OVERLAY,
  hasAiAudioOverlayClients,
} = require('./lib/ai-audio-overlay');
const { isValidTwitchLogin, normalizeTwitchLogin } = require('./lib/twitch-login');
const { sanitizeTwitchProfileImageUrl: sanitizeTwitchProfileImageUrlLib } = require('./lib/twitch-profile-image');

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// Configure auto-updater (GitHub Releases via electron-builder publish config)
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

let appUpdater;
function sendUpdateEventToRenderer(channel, payload) {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  } catch (e) {
    console.warn('[Updater] renderer notify failed:', e && e.message);
  }
}

// Global debouncing mechanism to prevent duplicate button triggers
const recentButtonTriggers = new Map();
const BUTTON_TRIGGER_DEBOUNCE_MS = 500; // 500ms debounce window

function isRecentButtonTrigger(label) {
  const now = Date.now();
  const lastTrigger = recentButtonTriggers.get(label);
  if (lastTrigger && (now - lastTrigger) < BUTTON_TRIGGER_DEBOUNCE_MS) {
    return true;
  }
  recentButtonTriggers.set(label, now);
  return false;
}

function resolveDeckButtonInProfile(profile, { buttonId, label } = {}) {
  const buttons = profile && Array.isArray(profile.buttons) ? profile.buttons : [];
  if (buttonId) {
    const byId = buttons.find((b) => b && b.id === buttonId);
    if (byId) return byId;
  }
  if (label) {
    const key = String(label).trim().toLowerCase();
    return buttons.find((b) => {
      if (!b) return false;
      const name = String(b.name || b.label || b.sceneName || '').trim().toLowerCase();
      return name === key;
    });
  }
  return null;
}

function triggerDeckButton(ref, source = 'unknown') {
  const opts = typeof ref === 'string' ? { label: ref } : (ref || {});
  const { buttonId, label } = opts;
  const profile = loadProfile(currentActiveProfile);
  const btn = resolveDeckButtonInProfile(profile, { buttonId, label });
  const debounceKey = buttonId || label || (btn && btn.id) || '';
  const display = btn ? (btn.name || btn.label || btn.id) : label || buttonId;

  console.log(`🔍 triggerDeckButton called for "${display}" from ${source}`);

  if (licenseManager) {
    try {
      const gate = licenseManager.canTriggerButton(profile, btn || label || buttonId);
      if (!gate.allowed) {
        console.log(`🔒 Blocked trigger for "${display}" from ${source}:`, gate.reason);
        if (win && !win.isDestroyed()) {
          win.webContents.send('license-upsell', {
            reason: gate.reason,
            message: gate.message,
          });
        }
        return false;
      }
    } catch (e) {
      console.warn('[License] trigger check failed:', e && e.message);
    }
  }
  if (debounceKey && isRecentButtonTrigger(debounceKey)) {
    console.log(`🚫 Skipping duplicate trigger for "${display}" from ${source} (within ${BUTTON_TRIGGER_DEBOUNCE_MS}ms)`);
    return false;
  }

  if (win && win.webContents) {
    const identifier = btn && btn.id ? btn.id : (label || buttonId);
    console.log(`🚀 Sending trigger-media event for "${identifier}" from ${source}`);
    win.webContents.send('trigger-media', identifier);
    return true;
  }
  console.log(`❌ No window available to trigger button "${display}" from ${source}`);
  return false;
}

function triggerButtonWithDebounce(label, source = 'unknown') {
  return triggerDeckButton(label, source);
}

function loadDeckButtonCatalogForMacros() {
  const meta = loadProfilesMeta();
  const profiles = (meta.profiles || []).map((p) => ({
    profileId: p.id,
    profileName: p.name || p.id,
    buttons: loadProfile(p.id).buttons || [],
  }));
  return buildDeckButtonCatalog(profiles);
}

// Use Electron's userData directory for config and user files (never the app install dir).
const userDataPath = app.getPath('userData');
try {
  fs.mkdirSync(userDataPath, { recursive: true });
} catch (err) {
  console.warn('[startup] Could not create userData directory:', err && err.message);
}
const configPath = path.join(userDataPath, 'config.json');
const profilesMetaPath = path.join(userDataPath, 'profiles-meta.json');
const userSoundsDir = path.join(userDataPath, 'sounds');
const userSkinsDir = path.join(userDataPath, 'skins');
const defaultConfigPath = path.join(__dirname, 'config.json');

// Initialize security manager
const securityManager = new SecurityManager(userDataPath);
securityManager.getOrCreateToken();
const wsRateLimiter = securityManager.createRateLimiter(1000, 10);

const { LicenseManager } = require('./lib/license/license-manager');
const { computeButtonEntitlements } = require('./lib/license/button-entitlements');
let licenseManager;
function broadcastLicenseStatus() {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send('license-status-changed', licenseManager.getStatusForUi());
    }
  } catch (e) {
    console.warn('[License] broadcast failed', e && e.message);
  }
}
try {
  licenseManager = new LicenseManager({
    userDataPath,
    safeStorage,
    onStatusChange: () => broadcastLicenseStatus(),
  });
  licenseManager.startPeriodicRevalidation();
  const bootLicense = licenseManager.getStatusForUi();
  console.log(
    '✅ License manager initialized (provider:',
    licenseManager.config.provider,
    ', licensed:',
    !!bootLicense.licensed,
    ', unlimitedButtons:',
    !!bootLicense.unlimitedButtons,
    ')',
  );
} catch (err) {
  console.error('❌ License manager failed to initialize:', err);
  licenseManager = null;
}

function assertProfileLicenseConstraints(nextProfile, prevProfile) {
  if (!licenseManager) return;
  if (licenseManager.getEntitlements().unlimitedButtons) return;
  const prevDeck = computeButtonEntitlements(prevProfile, false);
  const nextButtons = nextProfile.buttons || [];
  const prevButtons = prevProfile.buttons || [];
  if (nextButtons.length > prevButtons.length) {
    const addCheck = licenseManager.canAddButton(prevProfile);
    if (!addCheck.allowed) {
      throw new Error(addCheck.message);
    }
  }
  for (const btn of nextButtons) {
    if (!btn || !btn.id) continue;
    if (!prevDeck.lockedIds.has(btn.id)) continue;
    const prevBtn = prevButtons.find((b) => b && b.id === btn.id);
    if (prevBtn && JSON.stringify(prevBtn) !== JSON.stringify(btn)) {
      const editCheck = licenseManager.canEditButton(prevProfile, btn.id);
      throw new Error(editCheck.message);
    }
  }
}

// Initialize VTuber Manager
let vtuberManager;
try {
  vtuberManager = new VTuberManager(userDataPath);
  console.log('✅ VTuber Manager initialized');
} catch (err) {
  console.error('❌ Error initializing VTuber Manager:', err);
  vtuberManager = null;
}

// Initialize Macro Manager
const MacroManager = require('./lib/macro-manager');
const { MacroHotkeyRegistrar } = require('./lib/macro-hotkey-registrar');
const { registerNativeDialogIpc, installWindowFocusRelay } = require('./lib/native-dialog');
const { HotkeySuspension } = require('./lib/hotkey-suspension');
const { parseAccelerator: parseMacroHotkey, findHotkeyConflicts } = require('./public/macro-hotkeys');
let macroManager;
let raidFavoritesStore;
try {
  macroManager = new MacroManager(userDataPath);
  raidFavoritesStore = new RaidFavoritesStore(userDataPath);
  console.log('✅ Macro Manager initialized');
} catch (err) {
  console.error('❌ Error initializing Macro Manager:', err);
  macroManager = null;
}
if (!raidFavoritesStore) {
  try {
    raidFavoritesStore = new RaidFavoritesStore(userDataPath);
  } catch (err) {
    console.error('❌ Error initializing Raid Favorites store:', err);
    raidFavoritesStore = null;
  }
}

// Initialize AI Config Manager
let aiConfigManager;
try {
  aiConfigManager = new AIConfigManager();
  console.log('✅ AI Config Manager initialized');
} catch (err) {
  console.error('❌ Error initializing AI Config Manager:', err);
  aiConfigManager = null;
}
const defaultSoundsDir = path.join(__dirname, 'public', 'assets', 'sounds');
const defaultSkinsDir = path.join(__dirname, 'skins');
const tcConfigPath = path.join(userDataPath, 'tc_config.json');
const dailyCheckinsPath = path.join(userDataPath, 'checkins.json');
const hydrationConfigPath = path.join(userDataPath, 'hydration-config.json');
const aiEventsLogPath = path.join(userDataPath, 'ai-events.log');
const aiCommandsPath = path.join(userDataPath, 'ai-commands.json');
const aiTtsSoundsDir = path.join(userDataPath, 'sounds', 'ai-tts');


/** Append one NDJSON line for AIChatBot bridge (same format as twitch_chat). */
function appendAiEventsLogLine(payload) {
  try {
    if (!payload || typeof payload !== 'object') return;
    const channelNorm = twitchUserName
      ? String(twitchUserName).replace(/^#/, '').toLowerCase()
      : undefined;
    const line = {
      ...payload,
      channel: payload.channel || channelNorm,
      timestamp: payload.timestamp || Date.now(),
    };
    fs.appendFileSync(aiEventsLogPath, JSON.stringify(line) + '\n', 'utf-8');
    console.log(`📝 [AI Events] wrote ${line.type}${line.channel ? ` (${line.channel})` : ''}`);
  } catch (err) {
    console.error('❌ [AI Events] append failed:', err);
  }
}

/**
 * Map Twitch EventSub notifications to ai-events.log types consumed by AIChatBot.
 * @param {string} subscriptionType e.g. channel.subscribe
 * @param {object} ev payload.event
 * @param {string} [messageId] EventSub metadata.message_id (unique per delivery)
 */
function appendAiEventSubToLog(subscriptionType, ev, messageId) {
  if (!subscriptionType || !ev || typeof ev !== 'object') return;
  const ch = twitchUserName ? String(twitchUserName).replace(/^#/, '').toLowerCase() : undefined;
  const id =
    messageId ||
    `${subscriptionType}_${ev.user_id || ev.from_broadcaster_user_id || 'evt'}_${Date.now()}`;
  try {
    switch (subscriptionType) {
      case 'channel.follow': {
        appendAiEventsLogLine({
          id,
          type: 'twitch_follow',
          channel: ch,
          user: {
            id: ev.user_id,
            name: ev.user_login,
            displayName: ev.user_name || ev.user_login,
          },
        });
        break;
      }
      case 'channel.subscribe': {
        appendAiEventsLogLine({
          id,
          type: 'twitch_sub',
          channel: ch,
          user: {
            id: ev.user_id,
            name: ev.user_login,
            displayName: ev.user_name || ev.user_login,
          },
          message: ev.is_gift ? 'Received a gifted subscription' : 'New subscriber',
          amount: ev.tier === '3000' ? 3 : ev.tier === '2000' ? 2 : 1,
        });
        break;
      }
      case 'channel.subscription.message': {
        const months = ev.cumulative_months != null ? ev.cumulative_months : undefined;
        const subText =
          ev.message && ev.message.text ? String(ev.message.text) : 'Resubscribed';
        appendAiEventsLogLine({
          id,
          type: 'twitch_sub',
          channel: ch,
          user: {
            id: ev.user_id,
            name: ev.user_login,
            displayName: ev.user_name || ev.user_login,
            monthsSubscribed: months,
          },
          message: months != null ? `${months}-month resub: ${subText}` : subText,
          amount: months,
        });
        break;
      }
      case 'channel.subscription.gift': {
        if (ev.is_anonymous) {
          appendAiEventsLogLine({
            id,
            type: 'twitch_gift_sub',
            channel: ch,
            user: { name: 'anonymous', displayName: 'Anonymous' },
            amount: ev.total || 1,
            message: `Anonymous gifted ${ev.total || 1} subs (tier ${ev.tier || '1000'})`,
          });
        } else {
          appendAiEventsLogLine({
            id,
            type: 'twitch_gift_sub',
            channel: ch,
            user: {
              id: ev.user_id,
              name: ev.user_login,
              displayName: ev.user_name || ev.user_login,
            },
            amount: ev.total || 1,
            message: `Gifted ${ev.total || 1} subscriptions (tier ${ev.tier || '1000'})`,
          });
        }
        break;
      }
      case 'channel.raid': {
        appendAiEventsLogLine({
          id,
          type: 'twitch_raid',
          channel: ch,
          user: {
            id: ev.from_broadcaster_user_id,
            name: ev.from_broadcaster_user_login,
            displayName: ev.from_broadcaster_user_name || ev.from_broadcaster_user_login,
          },
          raiderCount: ev.viewers,
          message: `Raid incoming with ${ev.viewers} viewers`,
        });
        break;
      }
      case 'channel.cheer': {
        appendAiEventsLogLine({
          id,
          type: 'twitch_bits',
          channel: ch,
          user: {
            id: ev.user_id,
            name: ev.user_login,
            displayName: ev.user_name || ev.user_login,
          },
          amount: ev.bits,
          message: ev.message ? String(ev.message) : '',
        });
        break;
      }
      case 'channel.channel_points_custom_reward_redemption.add': {
        const title = (ev.reward && ev.reward.title) || 'channel points';
        appendAiEventsLogLine({
          id: ev.id || id,
          type: 'twitch_redeem',
          channel: ch,
          user: {
            id: ev.user_id,
            name: ev.user_login,
            displayName: ev.user_name || ev.user_login,
          },
          redeemTitle: title,
          message: ev.user_input ? String(ev.user_input) : '',
        });
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('[AI Events] appendAiEventSubToLog error:', e);
  }
}

// Profile management globals
let currentActiveProfile = 'default';

// Cooldown tracking for !checkin command (username -> timestamp)
const checkinCommandCooldown = new Map();
const CHECKIN_COMMAND_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// Helper function to get check-in leaderboard
function getCheckinLeaderboard(showStreak = false, limit = 5) {
  try {
    if (!fs.existsSync(dailyCheckinsPath)) {
      return null;
    }
    const data = JSON.parse(fs.readFileSync(dailyCheckinsPath, 'utf-8'));
    const viewers = data.viewers || {};
    
    // Convert to array and filter out users with no check-ins
    const viewerArray = Object.values(viewers)
      .filter(v => v && v.total_checkins > 0)
      .map(v => ({
        username: v.username || v.display_name || 'unknown',
        display_name: v.display_name || v.username || 'unknown',
        total_checkins: v.total_checkins || 0,
        streak: v.streak || 0
      }));
    
    // Sort by streak if enabled, otherwise by total check-ins
    if (showStreak) {
      viewerArray.sort((a, b) => {
        if (b.streak !== a.streak) return b.streak - a.streak;
        return b.total_checkins - a.total_checkins;
      });
    } else {
      viewerArray.sort((a, b) => b.total_checkins - a.total_checkins);
    }
    
    return viewerArray.slice(0, limit);
  } catch (err) {
    console.error('Error getting check-in leaderboard:', err);
    return null;
  }
}

// Ensure config and sounds exist in userData on first run
function ensureUserData() {
  try {
    if (!fs.existsSync(configPath)) {
      copyFileSyncSafe(defaultConfigPath, configPath);
    }
  } catch (err) {
    console.error('[ensureUserData] Failed to copy default config.json:', err);
  }

  try {
    if (!fs.existsSync(userSoundsDir)) {
      fs.mkdirSync(userSoundsDir, { recursive: true });
      if (fs.existsSync(defaultSoundsDir)) {
        copyTreeSync(defaultSoundsDir, userSoundsDir);
      }
    }
  } catch (err) {
    console.error('[ensureUserData] Failed to seed default sounds:', err);
  }

  try {
    if (!fs.existsSync(userSkinsDir)) {
      fs.mkdirSync(userSkinsDir, { recursive: true });
      if (fs.existsSync(defaultSkinsDir)) {
        copyTreeSync(defaultSkinsDir, userSkinsDir);
      }
    }
  } catch (err) {
    console.error('[ensureUserData] Failed to seed default skins:', err);
  }

  try {
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
          'channel.ban',
        ],
        lastFollowerPoll: null,
        createdSubscriptions: [],
      };
      fs.writeFileSync(tcConfigPath, JSON.stringify(defaultTc, null, 2));
    }
  } catch (err) {
    console.error('[ensureUserData] Failed to write default tc_config.json:', err);
  }

  try {
    ensureButtonIds();
  } catch (err) {
    console.error('[ensureUserData] ensureButtonIds failed:', err);
  }

  try {
    ensureProfiles();
  } catch (err) {
    console.error('[ensureUserData] ensureProfiles failed:', err);
  }
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

// ============================================================
// PROFILE MANAGEMENT SYSTEM
// ============================================================

// Helper: Get path for a specific profile
function getProfilePath(profileId) {
  return path.join(userDataPath, `profile-${profileId}.json`);
}

// Helper: Load profiles metadata
function loadProfilesMeta() {
  try {
    if (fs.existsSync(profilesMetaPath)) {
      return JSON.parse(fs.readFileSync(profilesMetaPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading profiles-meta.json:', err);
  }
  // Default structure
  return {
    activeProfile: 'default',
    profiles: [
      { id: 'default', name: 'Default Profile', created: new Date().toISOString() }
    ]
  };
}

// Helper: Save profiles metadata
function saveProfilesMeta(meta) {
  fs.writeFileSync(profilesMetaPath, JSON.stringify(meta, null, 2));
}

// Helper: Load a specific profile
function loadProfile(profileId) {
  try {
    const profilePath = getProfilePath(profileId);
    if (fs.existsSync(profilePath)) {
      return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error loading profile ${profileId}:`, err);
  }
  // Default profile structure
  return {
    buttons: [],
    uiSettings: {
      theme: null,
      componentVisibility: {},
      chatWidth: null,
      soundButtonOrder: []
    }
  };
}

// Helper: Save a specific profile
function saveProfile(profileId, profileData) {
  const profilePath = getProfilePath(profileId);
  fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
  console.log(`Profile ${profileId} saved successfully`);
}

// Migration: Convert old config.json to profile system
function migrateToProfiles() {
  try {
    // Check if migration is needed
    if (fs.existsSync(profilesMetaPath)) {
      console.log('Profiles system already exists, skipping migration');
      return;
    }

    console.log('Migrating to profiles system...');

    // Load old config
    let oldConfig = { buttons: [] };
    if (fs.existsSync(configPath)) {
      try {
        oldConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (err) {
        console.error('Error reading old config:', err);
      }
    }

    // Create default profile with old data
    const defaultProfile = {
      buttons: oldConfig.buttons || [],
      uiSettings: {
        theme: null,
        componentVisibility: {},
        chatWidth: null,
        soundButtonOrder: []
      }
    };

    // Save default profile
    saveProfile('default', defaultProfile);

    // Create profiles metadata
    const profilesMeta = {
      activeProfile: 'default',
      profiles: [
        { id: 'default', name: 'Default Profile', created: new Date().toISOString() }
      ]
    };
    saveProfilesMeta(profilesMeta);

    console.log('Migration to profiles system complete');
  } catch (err) {
    console.error('Error during profile migration:', err);
  }
}

// Ensure profiles system is initialized
function ensureProfiles() {
  migrateToProfiles();
  
  // Load active profile
  const meta = loadProfilesMeta();
  currentActiveProfile = meta.activeProfile || 'default';
  
  // Ensure active profile exists
  const profilePath = getProfilePath(currentActiveProfile);
  if (!fs.existsSync(profilePath)) {
    console.log(`Active profile ${currentActiveProfile} not found, creating it`);
    saveProfile(currentActiveProfile, {
      buttons: [],
      uiSettings: {
        theme: null,
        componentVisibility: {},
        chatWidth: null,
        soundButtonOrder: []
      }
    });
  }
}

function loadTcConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(tcConfigPath, 'utf-8'));

    const oauthKeyMaterial = `${tcConfigPath}:oauth`;
    const refreshKeyMaterial = `${tcConfigPath}:refresh`;

    if (raw.oauth_secret) {
      const plain = decodeField(oauthKeyMaterial, raw.oauth_secret, safeStorage);
      if (plain) {
        raw.oauth_token = plain;
        raw.accessToken = plain;
      }
    } else if (raw.oauth_token_encrypted && safeStorage.isEncryptionAvailable()) {
      try {
        const encryptedBuffer = Buffer.from(raw.oauth_token_encrypted, 'base64');
        raw.oauth_token = safeStorage.decryptString(encryptedBuffer);
        raw.accessToken = raw.oauth_token;
        console.log('✅ [Security] Decrypted Twitch OAuth token');
      } catch (err) {
        console.error('❌ [Security] Failed to decrypt OAuth token:', err.message);
      }
    }
    if (raw.refresh_secret) {
      const plain = decodeField(refreshKeyMaterial, raw.refresh_secret, safeStorage);
      if (plain) raw.refreshToken = plain;
    } else if (raw.refresh_token_encrypted && safeStorage.isEncryptionAvailable()) {
      try {
        const encryptedBuffer = Buffer.from(raw.refresh_token_encrypted, 'base64');
        raw.refreshToken = safeStorage.decryptString(encryptedBuffer);
        console.log('✅ [Security] Decrypted Twitch refresh token');
      } catch (err) {
        console.error('❌ [Security] Failed to decrypt refresh token:', err.message);
      }
    }
    
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
  const toSave = { ...cfg };
  const oauthKeyMaterial = `${tcConfigPath}:oauth`;
  const refreshKeyMaterial = `${tcConfigPath}:refresh`;

  const tokenPlain = toSave.oauth_token || toSave.accessToken;
  if (tokenPlain) {
    const wrapped = encodeField(oauthKeyMaterial, String(tokenPlain).replace(/^oauth:/i, '').trim(), safeStorage);
    if (wrapped) {
      toSave.oauth_secret = wrapped;
      delete toSave.oauth_token_encrypted;
    }
    delete toSave.oauth_token;
    delete toSave.accessToken;
  }
  const refreshPlain = toSave.refreshToken;
  if (refreshPlain) {
    const wrapped = encodeField(refreshKeyMaterial, String(refreshPlain).trim(), safeStorage);
    if (wrapped) {
      toSave.refresh_secret = wrapped;
      delete toSave.refresh_token_encrypted;
    }
    delete toSave.refreshToken;
  }

  fs.writeFileSync(tcConfigPath, JSON.stringify(toSave, null, 2));
}

// Hydration config management
function loadHydrationConfig() {
  try {
    if (fs.existsSync(hydrationConfigPath)) {
      return JSON.parse(fs.readFileSync(hydrationConfigPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading hydration config:', e);
  }
  // Default config
  return {
    streamGoal: 64,
    incrementAmount: 8,
    redemptionKeyword: "hydrate",
    currentProgress: 0,
    gaugeStyle: "circular",
    waterColor: "#4fc3f7",
    backgroundColor: "transparent",
    textColor: "#ffffff",
    gaugeSize: 200,
    positionX: 50,
    positionY: 50,
    borderWidth: 0,
    borderColor: "#ffffff",
    borderRadius: 10,
    resetOnLive: true
  };
}

function saveHydrationConfig(cfg) {
  try {
    fs.writeFileSync(hydrationConfigPath, JSON.stringify(cfg, null, 2));
    console.log('Hydration config saved');
  } catch (e) {
    console.error('Error saving hydration config:', e);
  }
}

function broadcastHydrationUpdate(config) {
  const percentage = config.streamGoal > 0 ? (config.currentProgress / config.streamGoal) * 100 : 0;
  const payload = {
    type: 'hydrationUpdate',
    data: {
      current: config.currentProgress,
      goal: config.streamGoal,
      percentage: percentage,
      config: config
    }
  };
  
  // Broadcast to all connected overlay clients
  overlayClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(JSON.stringify(payload));
      } catch (error) {
        console.error('Error broadcasting hydration update:', error);
      }
    }
  });
}

// Stream monitor for auto-reset hydration
let lastStreamLiveState = false;
let streamMonitorInterval = null;

async function checkStreamAndResetHydration() {
  try {
    const config = loadHydrationConfig();
    if (!config.resetOnLive) return;
    
    // Check if stream is live
    if (!twitchClientId || !twitchToken || !twitchUserId) return;
    
    const resp = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(twitchUserId)}`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    const isLive = data.data && data.data.length > 0;
    
    // If stream just went live (transition from offline to live), reset hydration
    if (isLive && !lastStreamLiveState) {
      console.log('Stream went live - resetting hydration tracker');
      config.currentProgress = 0;
      saveHydrationConfig(config);
      broadcastHydrationUpdate(config);
    }
    
    lastStreamLiveState = isLive;
  } catch (error) {
    console.error('Error in stream monitor:', error);
  }
}

function startStreamMonitor() {
  if (streamMonitorInterval) return;
  // Check every 2 minutes
  streamMonitorInterval = setInterval(checkStreamAndResetHydration, 120000);
  // Also check immediately on start
  checkStreamAndResetHydration();
}

function stopStreamMonitor() {
  if (streamMonitorInterval) {
    clearInterval(streamMonitorInterval);
    streamMonitorInterval = null;
  }
}

let win;
let overlayWindow;
let overlayServer;
let overlayWSS;
let overlayClients = new Set();
let overlayRegistry = new Map(); // overlayName -> Set of WebSocket connections
let overlayServerPort;
let jarvisServer = null;

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
    title: 'VirtualDeck BETA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Preload requires local modules (lib/raven-ai-control). Electron 20+ sandboxes
      // preload by default, and that loader cannot resolve those files.
      sandbox: false,
      additionalArguments: [packagedArgvFlag()],
    }
  });

  // Keyboard focus safety net + hotkey suspension follow window focus.
  installWindowFocusRelay(win);
  win.on('focus', () => hotkeySuspension.apply());
  win.on('blur', () => hotkeySuspension.apply());

  win.loadFile(path.join(__dirname, 'public/index.html'));
  // Show window only when ready-to-show to avoid initial mis-sizing
  win.once('ready-to-show', () => {
    try { win.show(); } catch (e) {}
    try { win.webContents.send('renderer-ready'); } catch (e) {}
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
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    
    // Check if this is a control/API endpoint that requires auth
    const requiresAuth = req.url && (
      (req.url.startsWith('/api/vtuber/') && req.method !== 'GET') || // Only protect write operations
      req.url.startsWith('/api/ai/') // Protect all AI config endpoints (includes GET /api/ai/voices)
    );
    
    // Validate token for protected endpoints
    if (requiresAuth) {
      const token = securityManager.extractToken(req, url);
      if (!token || !securityManager.validateToken(token)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Valid authentication token required. Add ?token=YOUR_TOKEN to the URL or use X-VD-Auth header.'
        }));
        return;
      }
    }
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-VD-Auth, Authorization'
      });
      res.end();
      return;
    }
    
    if (req.url === '/overlay' || req.url === '/') {
      // Serve the default base overlay
      generateOverlayHTML('default', (err, html) => {
        if (err) {
          res.writeHead(500);
          res.end('Error generating overlay');
          return;
        }
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-VD-Auth, Authorization'
        });
        res.end(html);
      });
    } else if (req.url === '/hydration') {
      // Serve the hydration tracker overlay
      const hydrationPath = path.join(__dirname, 'overlays', 'hydrationOverlay', 'index.html');
      fs.readFile(hydrationPath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading hydration overlay');
          return;
        }
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-VD-Auth, Authorization'
        });
        res.end(data);
      });
    } else if (req.url.startsWith('/overlay/') || req.url.startsWith('/overlay?')) {
      // Handle custom overlays - /overlay/name or /overlay?name=name
      let overlayName = 'default';
      
      // Parse overlay name from URL
      if (req.url.includes('?')) {
        const url = new URL(req.url, `http://localhost:${port}`);
        overlayName = url.searchParams.get('name') || 'default';
      } else {
        // Extract from path like /overlay/custom-name
        overlayName = req.url.substring(9); // Remove '/overlay/'
      }
      
      console.log(`🎯 Serving overlay: ${overlayName}`);
      
      // Check if it's a predefined overlay
      const predefinedOverlays = ['hudOverlay', 'cameraFrameOverlay', 'chatOverlay', 'vtuberOverlay', 'aiAudio'];
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
            'Access-Control-Allow-Headers': 'Content-Type, X-VD-Auth, Authorization'
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
            'Access-Control-Allow-Headers': 'Content-Type, X-VD-Auth, Authorization'
          });
          res.end(html);
        });
      }
    } else if (req.url.startsWith('/media/')) {
      // Serve media files from relative paths
      let urlPath = req.url.substring(7); // Remove '/media/' prefix
      
      // Strip query parameters (e.g., ?t=timestamp for cache-busting)
      const queryIndex = urlPath.indexOf('?');
      if (queryIndex !== -1) {
        urlPath = urlPath.substring(0, queryIndex);
      }
      
      const relativePath = decodeURIComponent(urlPath);
      
      // Construct full path from relative path
      const fullPath = path.join(userDataPath, relativePath);
      const normalizedPath = path.normalize(fullPath);
      
      // Security check - ensure the file path is within allowed directories
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
            'Access-Control-Allow-Headers': 'Content-Type, X-VD-Auth, Authorization'
          });
          res.end(data);
        });
      });
    } else if (req.url.startsWith('/public/')) {
      // Serve static files from public directory
      const publicPath = req.url.substring(1); // Remove leading '/'
      const fullPath = path.join(__dirname, publicPath);
      
      // Security check - ensure the file path is within public directory
      if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
        res.writeHead(403);
        res.end('Access denied');
        return;
      }
      
      fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
          res.writeHead(404);
          res.end('File not found');
          return;
        }
        
        // Get file extension for content type
        const ext = path.extname(fullPath).toLowerCase();
        const contentTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.ogg': 'video/ogg',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        // Serve the file
        fs.readFile(fullPath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error reading file');
            return;
          }
          res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-VD-Auth, Authorization',
            'Cache-Control': 'public, max-age=3600'
          });
          res.end(data);
        });
      });
    } else if (req.url && req.url.startsWith('/api/vtuber/')) {
      // VTuber API endpoints
      handleVTuberAPI(req, res);
    } else if (req.url && req.url.startsWith('/api/ai/')) {
      // AI Configuration API endpoints (voices, personality)
      handleAIConfigAPI(req, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  // Create WebSocket server for real-time communication
  overlayWSS = new WebSocket.Server({ 
    server: overlayServer,
    verifyClient: (info, callback) => {
      // Extract token from query parameters for WebSocket handshake
      const url = new URL(info.req.url || '/', `http://localhost:${port}`);
      const token = url.searchParams.get('token');
      
      // Allow connection without token for read-only overlays (for OBS compatibility)
      // The individual message handlers will enforce permissions
      callback(true);
    }
  });
  
  overlayWSS.on('connection', (ws, req) => {
    console.log('Overlay client connected - URL:', req.url);
    
    // Extract overlay name and token from URL query parameters
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const overlayName = url.searchParams.get('overlay') || 'main';
    const token = url.searchParams.get('token');
    
    ws.overlayName = overlayName; // Store overlay name on the WebSocket connection
    ws.isAuthenticated = token && securityManager.validateToken(token);
    ws.clientId = crypto.randomBytes(16).toString('hex'); // Unique ID for rate limiting
    
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
        // Rate limiting check
        if (!wsRateLimiter.check(ws.clientId)) {
          console.warn(`⚠️ [Security] Rate limit exceeded for client ${ws.clientId}`);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Rate limit exceeded. Max 10 messages per second.' 
          }));
          return;
        }

        const data = JSON.parse(message);
        
        // Validate message structure
        if (!data || typeof data !== 'object') {
          console.warn(`⚠️ [Security] Invalid message structure from ${overlayName}`);
          return;
        }

        // Whitelist of allowed message types for unauthenticated clients
        const ALLOWED_TYPES = new Set(['ping', 'pong', 'status']);
        
        // If client is not authenticated and message type is not whitelisted, reject
        if (!ws.isAuthenticated && !ALLOWED_TYPES.has(data.type)) {
          console.warn(`⚠️ [Security] Unauthorized message type "${data.type}" from ${overlayName}`);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Authentication required for this message type. Add ?token=YOUR_TOKEN to connection URL.' 
          }));
          return;
        }

        console.log(`📨 Message from overlay ${overlayName}:`, data);
        
        // Future: Handle specific message types here
        // For now, just log them as this is primarily read-only
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(`Overlay client disconnected: ${overlayName}`);
      overlayClients.delete(ws);
      
      // Clean up rate limiter
      wsRateLimiter.reset(ws.clientId);
      
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
      
      // Clean up rate limiter
      wsRateLimiter.reset(ws.clientId);
      
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
        console.log(`📺 Default overlay URL: http://localhost:${port}/overlay`);
        console.log(`📺 Custom overlays: http://localhost:${port}/overlay?name=overlayName`);
        
        // Store the actual port used for reference
        overlayServerPort = port;
      }
    });
  }

  tryStartServer(port);
}

// Start JARVIS tool server
async function startJarvisServer() {
  try {
    const jarvisPort = process.env.JARVIS_PORT || 8091;
    const jarvisHost = process.env.JARVIS_HOST || '127.0.0.1';
    
    // Use JARVIS_TOKEN env var if set, otherwise fall back to shared .vd-auth-token
    let jarvisToken = process.env.JARVIS_TOKEN;
    
    if (!jarvisToken) {
      // Use shared SecurityManager token
      jarvisToken = securityManager.getOrCreateToken();
      console.log('[JARVIS] Using shared .vd-auth-token for authentication');
    } else {
      console.log('[JARVIS] Using JARVIS_TOKEN env var for authentication');
    }

    jarvisServer = new JarvisServer({
      port: jarvisPort,
      host: jarvisHost,
      token: jarvisToken
    });

    // Provide context to tool registry
    const currentProfile = loadProfile(currentActiveProfile);
    jarvisRegistry.setContext({
      win,
      twitchClient,
      twitchChannel: twitchUserName ? `#${twitchUserName}` : null,
      twitchUserName,
      config: currentProfile,
      currentActiveProfile,
      loadProfile,
      triggerButtonFn: triggerButtonWithDebounce,
      triggerDeckButtonFn: triggerDeckButton,
      macroManager,
      createTwitchClip: createTwitchClipAndAnnounce,
      postSocialsToChat,
      startTwitchCommercial,
      meldRecordClip: async () => {
        const r = await meldSceneBridge('recordClip');
        return r && r.ok ? { ok: true } : { ok: false, reason: (r && (r.error || r.reason)) || 'meld-record-failed' };
      },
      ...buildJarvisRaidContext(),
    });

    await jarvisServer.start();
    console.log(`[JARVIS] ✅ Tool API ready at http://${jarvisHost}:${jarvisPort}/jarvis/tools`);
    console.log(`[JARVIS] 📁 Auth token: ${path.join(userDataPath, '.vd-auth-token')}`);
  } catch (error) {
    console.error('[JARVIS] ❌ Failed to start tool server:', error);
  }
}

// VTuber API handler
function handleVTuberAPI(req, res) {
  if (!req.url) {
    res.writeHead(400);
    res.end('Invalid request');
    return;
  }
  
  const url = new URL(req.url, `http://localhost:${overlayServerPort || 8080}`);
  const path = url.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-VD-Auth, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (!vtuberManager) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'VTuber Manager not initialized' }));
    return;
  }
  
  try {
    if (path === '/api/vtuber/config' && req.method === 'GET') {
      // Get VTuber configuration
      const config = vtuberManager.getConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } else if (path === '/api/vtuber/config' && req.method === 'PUT') {
      // Update VTuber configuration
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const updates = JSON.parse(body);
          if (updates.state) vtuberManager.setState(updates.state);
          if (updates.position) vtuberManager.updatePosition(updates.position);
          if (updates.scale !== undefined || updates.opacity !== undefined) {
            vtuberManager.updateDisplay(updates.scale, updates.opacity);
          }
          const config = vtuberManager.getConfig();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(config));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (path === '/api/vtuber/state' && req.method === 'POST') {
      // Set avatar state
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { state } = JSON.parse(body);
          if (vtuberManager.setState(state)) {
            // Broadcast state change to overlay
            broadcastVTuberState(state);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, state }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid state' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// Broadcast VTuber state change to overlay
function broadcastVTuberState(state) {
  if (!overlayWSS) return;
  
  const message = JSON.stringify({
    type: 'vtuber-state',
    state: state,
    timestamp: Date.now(),
  });
  
  // Broadcast to vtuberOverlay clients
  const vtuberClients = overlayRegistry.get('vtuberOverlay');
  if (vtuberClients) {
    vtuberClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// AI Configuration API handler
function handleAIConfigAPI(req, res) {
  if (!req.url) {
    res.writeHead(400);
    res.end('Invalid request');
    return;
  }
  
  const url = new URL(req.url, `http://localhost:${overlayServerPort || 8080}`);
  const path = url.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-VD-Auth, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (!aiConfigManager) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'AI Config Manager not initialized' }));
    return;
  }

  if (licenseManager) {
    const aiGate = licenseManager.canUseAiAssistant();
    if (!aiGate.allowed) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: aiGate.message, code: 'license_required' }));
      return;
    }
  }
  
  try {
    if (path === '/api/ai/voices' && req.method === 'GET') {
      // Premade voices always included; merge with account when TTS_API_KEY works
      aiConfigManager.listVoices().then(result => {
        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            voices: result.voices,
            warning: result.warning || undefined,
          }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: result.error }));
        }
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    } else if (path === '/api/ai/voice' && req.method === 'POST') {
      // Set voice ID
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { voiceId, voiceName } = JSON.parse(body);
          const success = aiConfigManager.setVoice(voiceId, voiceName);
          if (success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, voiceId, voiceName }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save voice' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (path === '/api/ai/personality' && req.method === 'POST') {
      // Set personality configuration
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { personality, prompt } = JSON.parse(body);
          const success = aiConfigManager.setPersonality(personality, prompt);
          if (success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, personality, prompt }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save personality' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (path === '/api/ai/personality' && req.method === 'GET') {
      // Get saved personality configuration
      const personality = aiConfigManager.getPersonality();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ personality: personality || null }));
    } else if (path === '/api/ai/wake-names' && req.method === 'GET') {
      const wake = aiConfigManager.getWakeNames();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        names: wake.names,
        primary: wake.primary,
        envValue: wake.envValue,
        requiresRavenRestart: WAKE_NAMES_REQUIRE_RAVEN_RESTART,
      }));
    } else if (path === '/api/ai/wake-names' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const raw = data.wakeNames != null ? data.wakeNames : data.envValue;
          const result = aiConfigManager.setWakeNames(raw);
          if (result.success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (path === '/api/ai/macros' && req.method === 'GET') {
      const { formatMacrosForRaven } = require('./lib/raven-macro-api');
      const macros = macroManager ? formatMacrosForRaven(macroManager.list()) : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ macros, count: macros.length }));
    } else if (path === '/api/ai/trigger-macro' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const utterance = String(data.utterance || data.text || data.phrase || data.transcript || '').trim();
          if (!utterance) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'utterance required' }));
            return;
          }
          const result = await jarvisRegistry.invoke('run_voice_macro', { utterance });
          const payload = result.result || result;
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
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
      // Inline the shared text renderer (same file the alert editor preview loads) so
      // overlay and preview render text identically. Function replacer: no $-pattern expansion.
      try {
        const rendererJs = fs.readFileSync(path.join(__dirname, 'public', 'alert-text-render.js'), 'utf8');
        html = html.replace('/*__VD_ALERT_TEXT_RENDER__*/', () => rendererJs.replace(/<\/script/gi, '<\\/script'));
      } catch (e) {
        console.warn('⚠️ Could not inline alert-text-render.js into overlay:', e.message);
      }
      
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

// AI Integration: Handle audio commands from AI controller
function handleAIAudioCommands() {
  if (!fs.existsSync(aiCommandsPath)) {
    return; // No commands file yet
  }
  
  try {
    const content = fs.readFileSync(aiCommandsPath, 'utf-8');
    if (!content.trim()) {
      return; // Empty file
    }
    
    console.log(`🎵 [AI Audio] Command file found, content length: ${content.length} bytes`);
    const commands = content.trim().split('\n').filter(line => line.trim());
    console.log(`🎵 [AI Audio] Found ${commands.length} command(s) to process`);
    
    commands.forEach((line, index) => {
      console.log(`🎵 [AI Audio] Processing command ${index + 1}/${commands.length}: ${line.substring(0, 100)}...`);
      try {
        const command = JSON.parse(line);
        
        if (command.action === 'record-clip' || command.action === 'clip') {
          console.log('🎬 [AI Clip] Host asked to clip — creating a Twitch clip');
          void createTwitchClipAndAnnounce({ requestedBy: 'Raven' });
          return;
        }

        if (command.action === 'play-audio-file' && command.filePath) {
          // Verify file exists
          const audioPath = path.isAbsolute(command.filePath) 
            ? command.filePath 
            : path.join(userDataPath, command.filePath);
            
          if (fs.existsSync(audioPath)) {
            console.log(`🎵 [AI Audio] Playing audio file through overlay: ${audioPath}`);
            
            // Calculate relative path from userDataPath for /media/ endpoint
            let relativePath = path.relative(userDataPath, audioPath);
            // Normalize path separators for URL
            relativePath = relativePath.replace(/\\/g, '/');
            
            // Serve audio via HTTP instead of file:// (browsers block file:// URLs)
            const mediaPort = overlayServerPort || 8080;
            const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
            const audioUrl = `http://localhost:${mediaPort}/media/${encodedPath}?t=${Date.now()}`;
            
            console.log(`🎵 [AI Audio] Original path: ${audioPath}`);
            console.log(`🎵 [AI Audio] Relative path: ${relativePath}`);
            console.log(`🎵 [AI Audio] HTTP URL: ${audioUrl}`);
            
            if (win && !win.isDestroyed()) {
              win.webContents.send('play-ai-tts', {
                relativePath,
                audioUrl,
                volume: command.volume || 1.0,
              });
              console.log('🎵 [AI Audio] Sent to dashboard (same pipeline as audio buttons)');
            }

            const playAudioMessage = buildRavenPlayAudioMessage(
              audioUrl,
              command.volume || 1.0,
            );

            console.log(`🎵 [AI Audio] Overlay clients: ${overlayClients.size}`);
            broadcastToOverlay(playAudioMessage, RAVEN_AI_AUDIO_OVERLAY);
            if (hasAiAudioOverlayClients(overlayRegistry)) {
              console.log('🎵 [AI Audio] Sent to aiAudio OBS browser source');
            } else {
              console.log(
                '🎵 [AI Audio] aiAudio overlay not connected — dashboard playback only (no broadcast to other overlays)',
              );
            }
            console.log('═══════════════════════════════════════════════════════\n');
          } else {
            console.warn(`🎵 [AI Audio] Audio file not found: ${audioPath}`);
          }
        }
      } catch (err) {
        console.error('🎵 [AI Audio] Error parsing command:', err);
      }
    });
    
    // Clear the commands file after processing
    fs.writeFileSync(aiCommandsPath, '', 'utf-8');
  } catch (err) {
    // File might not exist yet, that's okay
    if (err.code !== 'ENOENT') {
      console.error('🎵 [AI Audio] Error reading commands file:', err);
    }
  }
}

// AI Integration: Watch for AI audio commands every 500ms
let aiCommandWatcherInterval = null;

function startAICommandWatcher() {
  if (aiCommandWatcherInterval) {
    clearInterval(aiCommandWatcherInterval);
  }
  console.log('🎵 [AI Audio] Starting command watcher...');
  console.log('🎵 [AI Audio] Watching file: ' + aiCommandsPath);
  
  // Write to a log file so we can verify it's running
  const logPath = path.join(userDataPath, 'ai-audio-watcher.log');
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Command watcher started\n`, 'utf-8');
  } catch (err) {
    // Ignore log file errors
  }
  
  aiCommandWatcherInterval = setInterval(() => {
    try {
      handleAIAudioCommands();
    } catch (err) {
      console.error('🎵 [AI Audio] Error in command watcher:', err);
      try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Error: ${err.message}\n`, 'utf-8');
      } catch (logErr) {
        // Ignore
      }
    }
  }, 500);
  console.log('🎵 [AI Audio] ✅ Command watcher started (checking every 500ms)');
  console.log('🎵 [AI Audio] Log file: ' + logPath);
}

function stopAICommandWatcher() {
  if (aiCommandWatcherInterval) {
    clearInterval(aiCommandWatcherInterval);
    aiCommandWatcherInterval = null;
  }
}

// Function to get the current overlay server URL
function getOverlayServerUrl() {
  return `http://localhost:${overlayServerPort || 8080}/overlay`;
}

function nextUniqueButtonId(buttons) {
  const existingIds = new Set((buttons || []).map((b) => b && b.id).filter(Boolean));
  let id;
  do {
    id = 'b_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  } while (existingIds.has(id));
  return id;
}

ipcMain.on('add-media', (event, data) => {
  try {
    if (licenseManager) {
      const profile = loadProfile(currentActiveProfile);
      if (typeof data.editingIndex === 'number') {
        const existing = profile.buttons[data.editingIndex];
        if (existing && existing.id) {
          const editCheck = licenseManager.canEditButton(profile, existing.id);
          if (!editCheck.allowed) {
            if (win && !win.isDestroyed()) {
              dialog.showMessageBox(win, {
                type: 'info',
                title: 'Button locked',
                message: 'VirtualDeck Pro required',
                detail: editCheck.message,
                buttons: ['OK'],
              });
            }
            return;
          }
        }
      } else {
        const addCheck = licenseManager.canAddButton(profile);
        if (!addCheck.allowed) {
          if (win && !win.isDestroyed()) {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'Button limit reached',
              message: 'Upgrade to VirtualDeck Pro',
              detail: addCheck.message,
              buttons: ['OK'],
            });
            win.webContents.send('license-upsell', {
              reason: addCheck.reason,
              message: addCheck.message,
            });
          }
          return;
        }
      }
    }
    console.log('add-media received:', data);
    console.log('Chat command data:', data.chatCommand);
    // Load from active profile instead of old config.json
    const profile = loadProfile(currentActiveProfile);
    const config = profile; // Keep variable name for compatibility

    if (data.type === 'meld-scene') {
      const existing = typeof data.editingIndex === 'number' ? config.buttons[data.editingIndex] : null;
      const newButton = {
        id: (existing && existing.id) || nextUniqueButtonId(config.buttons),
        label: data.label,
        type: 'meld-scene',
        sceneId: data.sceneId,
        sceneName: data.sceneName || data.label,
        src: '',
        hotkey: data.hotkey || undefined,
        chatCommand: data.chatCommand || undefined,
      };
      if (typeof data.editingIndex === 'number') {
        config.buttons[data.editingIndex] = newButton;
        console.log('✏️ Edited Meld scene button at index', data.editingIndex, ':', newButton.label);
      } else {
        config.buttons.push(newButton);
        console.log('➕ Added Meld scene button:', newButton.label);
      }
      saveProfile(currentActiveProfile, config);
      if (win && !win.isDestroyed()) win.webContents.send('refresh-ui');
      return;
    }

    if (data.type === 'twitch-clip') {
      const existing = typeof data.editingIndex === 'number' ? config.buttons[data.editingIndex] : null;
      const newButton = {
        id: (existing && existing.id) || nextUniqueButtonId(config.buttons),
        label: data.label,
        name: data.label,
        type: 'twitch-clip',
        src: '',
        hotkey: data.hotkey || undefined,
        chatCommand: data.chatCommand || undefined,
      };
      if (typeof data.editingIndex === 'number') {
        config.buttons[data.editingIndex] = newButton;
        console.log('✏️ Edited Twitch clip button at index', data.editingIndex, ':', newButton.label);
      } else {
        config.buttons.push(newButton);
        console.log('➕ Added Twitch clip button:', newButton.label);
      }
      saveProfile(currentActiveProfile, config);
      if (win && !win.isDestroyed()) win.webContents.send('refresh-ui');
      return;
    }

    if (data.type === 'post-socials') {
      const existing = typeof data.editingIndex === 'number' ? config.buttons[data.editingIndex] : null;
      const newButton = {
        id: (existing && existing.id) || nextUniqueButtonId(config.buttons),
        label: data.label,
        name: data.label,
        type: 'post-socials',
        src: '',
        hotkey: data.hotkey || undefined,
        chatCommand: data.chatCommand || undefined,
      };
      if (typeof data.editingIndex === 'number') {
        config.buttons[data.editingIndex] = newButton;
      } else {
        config.buttons.push(newButton);
      }
      saveProfile(currentActiveProfile, config);
      if (win && !win.isDestroyed()) win.webContents.send('refresh-ui');
      return;
    }

    if (data.type === 'run-ad') {
      const existing = typeof data.editingIndex === 'number' ? config.buttons[data.editingIndex] : null;
      let commercialLength = Number(data.commercialLength);
      if (!Number.isFinite(commercialLength)) commercialLength = 60;
      commercialLength = Math.min(180, Math.max(30, Math.round(commercialLength)));
      const newButton = {
        id: (existing && existing.id) || nextUniqueButtonId(config.buttons),
        label: data.label,
        name: data.label,
        type: 'run-ad',
        src: '',
        commercialLength,
        chatMessage: data.chatMessage ? String(data.chatMessage).trim() : '',
        hotkey: data.hotkey || undefined,
        chatCommand: data.chatCommand || undefined,
      };
      if (typeof data.editingIndex === 'number') {
        config.buttons[data.editingIndex] = newButton;
      } else {
        config.buttons.push(newButton);
      }
      saveProfile(currentActiveProfile, config);
      if (win && !win.isDestroyed()) win.webContents.send('refresh-ui');
      return;
    }

    // Validate required data
    if (!data.originalPath) {
      console.error('Error: originalPath is missing from add-media data:', data);
      if (win && !win.isDestroyed()) {
        dialog.showErrorBox('Save Error', 'Failed to save button: File path is missing. Please select a file and try again.');
      }
      return;
    }

  // Handle app files differently than audio files
  if (data.type === 'app') {
    console.log('Processing as app file, using original path:', data.originalPath);
    // For app files, just store the path without copying
    data.targetPath = data.originalPath;
  } else {
    console.log('Processing as audio file');
    // Check if originalPath is already in the sounds directory (file was already saved via saveAudioFileToSounds)
    // If it's a relative path starting with "sounds/", it's already in the right place
    const isAlreadyInSoundsDir = !path.isAbsolute(data.originalPath) && data.originalPath.startsWith('sounds/');
    const originalPathAbsolute = path.isAbsolute(data.originalPath) ? data.originalPath : path.join(userDataPath, data.originalPath);
    
    if (isAlreadyInSoundsDir || originalPathAbsolute.startsWith(userSoundsDir)) {
      // File is already in sounds directory, use its relative path directly
      if (isAlreadyInSoundsDir) {
        data.targetPath = data.originalPath; // Already a relative path
      } else {
        data.targetPath = path.relative(userDataPath, originalPathAbsolute).replace(/\\/g, '/');
      }
      console.log('Audio file already in sounds directory, using path:', data.targetPath);
    } else if (data.originalPath !== data.targetPath) {
      // Save to userData/sounds (file from external location)
      const ext = path.extname(originalPathAbsolute);
      const safeLabel = data.label.replace(/[^a-z0-9_\-]/gi, '_');
      const destFile = path.join(userSoundsDir, `${safeLabel}${ext}`);
      
      console.log('Copying audio file from:', originalPathAbsolute, 'to:', destFile);
      
      // Check if source file exists before copying
      if (!fs.existsSync(originalPathAbsolute)) {
        console.error('Source file does not exist:', originalPathAbsolute);
        throw new Error(`Source file does not exist: ${originalPathAbsolute}`);
      }
      
      try {
        fse.copySync(originalPathAbsolute, destFile);
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
        // Check if any other button in ANY profile uses this same file
        let fileInUseByOther = false;
        
        try {
          const meta = loadProfilesMeta();
          for (const profileInfo of meta.profiles) {
            const otherProfile = loadProfile(profileInfo.id);
            if (otherProfile.buttons && Array.isArray(otherProfile.buttons)) {
              // Check all buttons in this profile
              for (let i = 0; i < otherProfile.buttons.length; i++) {
                const btn = otherProfile.buttons[i];
                // Skip the button we're currently editing
                if (profileInfo.id === currentActiveProfile && i === data.editingIndex) {
                  continue;
                }
                // If another button uses the same file, don't rename it
                if (btn.src === oldSrc) {
                  fileInUseByOther = true;
                  console.log(`⚠️ File ${oldSrc} is used by button "${btn.label}" in profile ${profileInfo.id}, skipping rename`);
                  break;
                }
              }
              if (fileInUseByOther) break;
            }
          }
        } catch (err) {
          console.warn('Error checking if file is used by other buttons:', err);
        }
        
        // Only rename if no other button uses this file
        if (!fileInUseByOther) {
          try {
            fs.renameSync(oldFilePath, newFilePath);
            data.targetPath = newTargetPath;
            console.log(`✅ Renamed ${oldFilePath} to ${newFilePath}`);
          } catch (err) {
            console.warn('Failed to rename file:', err);
            data.targetPath = oldSrc; // fallback
          }
        } else {
          // Keep using the old file path since other buttons need it
          data.targetPath = oldSrc;
          console.log(`⏭️ Keeping original file path ${oldSrc} (shared with other buttons)`);
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
    chatCommand: data.chatCommand || undefined,
    // Include AI use settings if provided (for audio buttons)
    aiAllowed: data.aiAllowed !== undefined ? data.aiAllowed : undefined,
    description: data.description || undefined,
    deckIcon: data.deckIcon && data.deckIcon.source ? data.deckIcon : undefined,
  };

  // Ensure each button has a stable unique id
  if (typeof data.editingIndex === 'number') {
    // Preserve existing id if present
    const existing = config.buttons[data.editingIndex];
    if (existing && existing.id) newButton.id = existing.id;
    else newButton.id = 'b_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    config.buttons[data.editingIndex] = newButton;
    console.log('✏️ Edited button at index', data.editingIndex, ':', newButton.label);
  } else {
    newButton.id = 'b_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    config.buttons.push(newButton);
    console.log('➕ Added new button:', newButton.label);
  }

  // Save back to active profile (preserves uiSettings)
  saveProfile(currentActiveProfile, profile);
  console.log('✅ Button saved to profile:', currentActiveProfile);
  } catch (error) {
    console.error('Error in add-media handler:', error);
    if (win && !win.isDestroyed()) {
      dialog.showErrorBox('Save Error', `Failed to save button: ${error.message}`);
    }
  }
});

ipcMain.on('delete-button', (event, index) => {
  // Load from active profile instead of old config.json
  const profile = loadProfile(currentActiveProfile);
  const removed = profile.buttons.splice(index, 1);
  
  // Only delete the audio file from disk if no other profile is using it
  if (removed[0] && removed[0].src) {
    const filePath = path.join(userDataPath, removed[0].src);
    const srcToDelete = removed[0].src;
    
    try {
      // Check if any other profile uses this same file
      const meta = loadProfilesMeta();
      let fileStillInUse = false;
      
      for (const profileInfo of meta.profiles) {
        // Skip the current profile (we already removed the button from it)
        if (profileInfo.id === currentActiveProfile) continue;
        
        const otherProfile = loadProfile(profileInfo.id);
        if (otherProfile.buttons && Array.isArray(otherProfile.buttons)) {
          // Check if any button in this profile uses the same file
          const stillUsed = otherProfile.buttons.some(btn => btn.src === srcToDelete);
          if (stillUsed) {
            fileStillInUse = true;
            console.log(`File ${srcToDelete} is still used by profile ${profileInfo.id}, not deleting`);
            break;
          }
        }
      }
      
      // Only delete the file if no other profile uses it
      if (!fileStillInUse && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file ${filePath} (not used by any other profile)`);
      }
    } catch (err) {
      // File might not exist or be locked, continue anyway
      console.warn('Error checking/deleting file:', err);
    }
  }
  
  // Save back to active profile
  saveProfile(currentActiveProfile, profile);
  
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

// Global shortcuts are suspended for explicit reasons (modals / hotkey capture via
// disable/enable) and while typing in a VirtualDeck text field with the window focused.
var hotkeySuspension = new HotkeySuspension({ // var: registerHotkeys may reference it early
  register: () => registerHotkeysNow(),
  unregisterAll: () => globalShortcut.unregisterAll(),
  isWindowFocused: () => !!(win && !win.isDestroyed() && win.isFocused())
});
ipcMain.on('disable-hotkeys', () => {
  hotkeySuspension.add('renderer');
});
ipcMain.on('enable-hotkeys', () => {
  hotkeySuspension.remove('renderer');
});
ipcMain.on('text-input-active', (event, active) => {
  hotkeySuspension.setTextInputActive(active);
});
registerNativeDialogIpc({ ipcMain, dialog, BrowserWindow });

// IPC handler to get config (now loads from active profile)
ipcMain.handle('get-config', async () => {
  try {
    const profile = loadProfile(currentActiveProfile);
    // Include userDataPath for constructing absolute paths in renderer
    profile.userDataPath = userDataPath;
    return profile;
  } catch (e) {
    return { buttons: [], uiSettings: {}, userDataPath: userDataPath };
  }
});

// IPC handler to save config (now saves to active profile)
ipcMain.handle('save-config', async (event, config) => {
  try {
    // Load current profile to preserve uiSettings
    const currentProfile = loadProfile(currentActiveProfile);
    
    // Merge: keep existing uiSettings, update buttons and other data
    const mergedConfig = {
      ...config,
      uiSettings: config.uiSettings || currentProfile.uiSettings || {
        theme: null,
        componentVisibility: {},
        chatWidth: null,
        soundButtonOrder: []
      }
    };

    assertProfileLicenseConstraints(mergedConfig, currentProfile);
    
    // Save to active profile
    saveProfile(currentActiveProfile, mergedConfig);
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================
// PROFILE IPC HANDLERS
// ============================================================

// Get all profiles metadata
ipcMain.handle('get-profiles', async () => {
  try {
    return loadProfilesMeta();
  } catch (error) {
    console.error('Error getting profiles:', error);
    return { activeProfile: 'default', profiles: [] };
  }
});

ipcMain.handle('list-macro-deck-buttons', async () => {
  try {
    return loadDeckButtonCatalogForMacros();
  } catch (error) {
    console.error('Error listing deck buttons for macros:', error);
    return { error: error.message || String(error), buttons: [] };
  }
});

// Get a specific profile
ipcMain.handle('get-profile', async (event, profileId) => {
  try {
    const profile = loadProfile(profileId);
    profile.userDataPath = userDataPath;
    return profile;
  } catch (error) {
    console.error(`Error getting profile ${profileId}:`, error);
    return { buttons: [], uiSettings: {}, userDataPath: userDataPath };
  }
});

// Save a specific profile
ipcMain.handle('save-profile', async (event, { profileId, profileData }) => {
  try {
    const previous = loadProfile(profileId);
    assertProfileLicenseConstraints(profileData, previous);
    saveProfile(profileId, profileData);
    return { success: true };
  } catch (error) {
    console.error(`Error saving profile ${profileId}:`, error);
    return { success: false, error: error.message };
  }
});

// Create a new profile
ipcMain.handle('create-profile', async (event, profileName) => {
  try {
    const meta = loadProfilesMeta();
    
    // Generate unique ID
    const profileId = 'profile_' + Date.now();
    
    // Create new profile with empty data
    const newProfile = {
      buttons: [],
      uiSettings: {
        theme: null,
        componentVisibility: {},
        chatWidth: null,
        soundButtonOrder: []
      }
    };
    
    saveProfile(profileId, newProfile);
    
    // Add to metadata
    meta.profiles.push({
      id: profileId,
      name: profileName,
      created: new Date().toISOString()
    });
    saveProfilesMeta(meta);
    
    console.log(`Created new profile: ${profileName} (${profileId})`);
    return { success: true, profileId };
  } catch (error) {
    console.error('Error creating profile:', error);
    return { success: false, error: error.message };
  }
});

// Duplicate an existing profile
ipcMain.handle('duplicate-profile', async (event, { sourceProfileId, newProfileName }) => {
  try {
    const meta = loadProfilesMeta();
    
    // Load source profile
    const sourceProfile = loadProfile(sourceProfileId);
    
    // Generate unique ID for new profile
    const newProfileId = 'profile_' + Date.now();
    
    // Deep copy the source profile data
    const newProfile = JSON.parse(JSON.stringify(sourceProfile));
    
    // Save the duplicated profile
    saveProfile(newProfileId, newProfile);
    
    // Add to metadata
    meta.profiles.push({
      id: newProfileId,
      name: newProfileName,
      created: new Date().toISOString()
    });
    saveProfilesMeta(meta);
    
    console.log(`Duplicated profile ${sourceProfileId} to ${newProfileName} (${newProfileId})`);
    return { success: true, profileId: newProfileId };
  } catch (error) {
    console.error('Error duplicating profile:', error);
    return { success: false, error: error.message };
  }
});

// Rename a profile
ipcMain.handle('rename-profile', async (event, { profileId, newName }) => {
  try {
    const meta = loadProfilesMeta();
    
    // Find and update the profile name
    const profile = meta.profiles.find(p => p.id === profileId);
    if (profile) {
      profile.name = newName;
      saveProfilesMeta(meta);
      console.log(`Renamed profile ${profileId} to ${newName}`);
      return { success: true };
    } else {
      return { success: false, error: 'Profile not found' };
    }
  } catch (error) {
    console.error('Error renaming profile:', error);
    return { success: false, error: error.message };
  }
});

// Delete a profile
ipcMain.handle('delete-profile', async (event, profileId) => {
  try {
    const meta = loadProfilesMeta();
    
    // Prevent deleting the last profile
    if (meta.profiles.length <= 1) {
      return { success: false, error: 'Cannot delete the last profile' };
    }
    
    // Can now delete any profile, frontend handles showing only non-active ones
    
    // Remove from metadata
    meta.profiles = meta.profiles.filter(p => p.id !== profileId);
    saveProfilesMeta(meta);
    
    // Delete the profile file
    const profilePath = getProfilePath(profileId);
    if (fs.existsSync(profilePath)) {
      fs.unlinkSync(profilePath);
    }
    
    console.log(`Deleted profile ${profileId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting profile:', error);
    return { success: false, error: error.message };
  }
});

// Switch to a different profile
ipcMain.handle('switch-profile', async (event, profileId) => {
  try {
    const meta = loadProfilesMeta();
    
    // Verify profile exists
    const profile = meta.profiles.find(p => p.id === profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    
    // Update active profile
    meta.activeProfile = profileId;
    currentActiveProfile = profileId;
    saveProfilesMeta(meta);
    
    // Re-register hotkeys for the new profile
    registerHotkeys();
    
    console.log(`Switched to profile ${profileId}`);
    return { success: true };
  } catch (error) {
    console.error('Error switching profile:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================
// HYDRATION TRACKER IPC HANDLERS
// ============================================================

// Get hydration config
ipcMain.handle('get-hydration-config', async () => {
  try {
    return loadHydrationConfig();
  } catch (error) {
    console.error('Error getting hydration config:', error);
    return loadHydrationConfig(); // Return default
  }
});

// Save hydration config
ipcMain.handle('save-hydration-config', async (event, config) => {
  try {
    saveHydrationConfig(config);
    broadcastHydrationUpdate(config);
    return { success: true };
  } catch (error) {
    console.error('Error saving hydration config:', error);
    return { success: false, error: error.message };
  }
});

// Update hydration progress (increment)
ipcMain.handle('update-hydration-progress', async () => {
  try {
    const config = loadHydrationConfig();
    // Allow currentProgress to exceed streamGoal (for numerical display)
    config.currentProgress = config.currentProgress + config.incrementAmount;
    saveHydrationConfig(config);
    broadcastHydrationUpdate(config);
    console.log(`Hydration updated: ${config.currentProgress}/${config.streamGoal} oz`);
    return { success: true, config };
  } catch (error) {
    console.error('Error updating hydration progress:', error);
    return { success: false, error: error.message };
  }
});

// Reset hydration progress
ipcMain.handle('reset-hydration', async () => {
  try {
    const config = loadHydrationConfig();
    config.currentProgress = 0;
    saveHydrationConfig(config);
    broadcastHydrationUpdate(config);
    console.log('Hydration progress reset to 0');
    return { success: true, config };
  } catch (error) {
    console.error('Error resetting hydration:', error);
    return { success: false, error: error.message };
  }
});

// Test hydration (for preview)
ipcMain.handle('test-hydration', async () => {
  try {
    const config = loadHydrationConfig();
    broadcastHydrationUpdate(config);
    return { success: true };
  } catch (error) {
    console.error('Error testing hydration:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// MACRO IPC HANDLERS
// ============================================================================

// Get all macros
ipcMain.handle('get-macros', async () => {
  try {
    if (!macroManager) {
      return { success: false, error: 'Macro manager not available' };
    }
    const macros = macroManager.list();
    return { success: true, macros };
  } catch (error) {
    console.error('Error getting macros:', error);
    return { success: false, error: error.message };
  }
});

// Get a single macro
ipcMain.handle('get-macro', async (event, id) => {
  try {
    if (!macroManager) {
      return { success: false, error: 'Macro manager not available' };
    }
    const macro = macroManager.get(id);
    if (!macro) {
      return { success: false, error: 'Macro not found' };
    }
    return { success: true, macro: { id, ...macro } };
  } catch (error) {
    console.error('Error getting macro:', error);
    return { success: false, error: error.message };
  }
});

// Save or update a macro
ipcMain.handle('save-macro', async (event, { id, macro }) => {
  try {
    if (!macroManager) {
      return { success: false, error: 'Macro manager not available' };
    }

    // Validate macro
    const catalog = loadDeckButtonCatalogForMacros();
    const normalized = normalizeMacroTriggerButtonSteps(
      macro.steps,
      catalog,
      currentActiveProfile,
    );
    macro.steps = normalized.steps;
    const stepWarnings = normalized.warnings || [];

    const validation = macroManager.validate(macro);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const hotkey = macro.triggers && macro.triggers.hotkey;
    if (hotkey) {
      const check = checkMacroHotkey(id, hotkey);
      if (!check.valid) return { success: false, errors: check.errors };
      macro.triggers.hotkey = check.accelerator;
    }

    const saved = macroManager.set(id, macro);
    const sync = syncMacroHotkeys();
    const failedReg = sync.failed.find((f) => f.id === id);
    const warningParts = [];
    if (stepWarnings.length) warningParts.push(stepWarnings.join(' '));
    if (failedReg) {
      warningParts.push(`Hotkey ${failedReg.hotkey} could not be registered: ${failedReg.reason}`);
    }
    return {
      success: true,
      macro: { id, ...saved },
      warning: warningParts.length ? warningParts.join(' ') : undefined,
    };
  } catch (error) {
    console.error('Error saving macro:', error);
    return { success: false, error: error.message };
  }
});

// Delete a macro
ipcMain.handle('delete-macro', async (event, id) => {
  try {
    if (!macroManager) {
      return { success: false, error: 'Macro manager not available' };
    }
    const deleted = macroManager.delete(id);
    syncMacroHotkeys();
    return { success: deleted };
  } catch (error) {
    console.error('Error deleting macro:', error);
    return { success: false, error: error.message };
  }
});

// One execution path for the Run/Test buttons and global hotkeys (no AI assistant involved).
// Re-validates against the macro allowlist / start_raid confirm rule before running.
async function executeMacroById(id, source) {
  if (!macroManager) return { success: false, error: 'Macro manager not available', steps: [] };
  const macro = macroManager.get(id);
  if (!macro) return { success: false, error: `Macro '${id}' not found`, steps: [] };
  const validation = macroManager.validate(macro);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; '), steps: [], macro: macro.name };
  }
  console.log(`[Macro] Running '${macro.name}' (${source})`);
  let inner;
  try {
    inner = await jarvisRegistry.runMacroSteps({ id, ...macro });
  } catch (err) {
    inner = { success: false, error: err.message || String(err), steps: [] };
  }
  const steps = Array.isArray(inner.steps) ? inner.steps : [];
  const failed = steps.find((s) => !s.success);
  return {
    success: inner.success === true,
    macro: inner.macro || macro.name,
    steps,
    error: inner.success === true ? undefined : (inner.error || (failed && failed.error) || 'Macro failed'),
    note: inner.note,
    totalSteps: Array.isArray(macro.steps) ? macro.steps.length : steps.length,
    source,
  };
}

// JARVIS run_macro / run_voice_macro (Raven voice) use this same executor as the hotkey.
jarvisRegistry.setContext({
  executeMacroById: async (id, source) => {
    const result = await executeMacroById(id, source || 'jarvis');
    if (win && !win.isDestroyed()) win.webContents.send('macro-executed', { id, ...result });
    return result;
  },
});

async function runMacroFromHotkey(id) {
  try {
    const result = await executeMacroById(id, 'hotkey');
    if (win && !win.isDestroyed()) win.webContents.send('macro-executed', { id, ...result });
  } catch (err) {
    console.error('[Macro] Hotkey run failed:', err);
  }
}

const macroHotkeyRegistrar = new MacroHotkeyRegistrar({
  globalShortcut,
  onTrigger: (id) => runMacroFromHotkey(id),
});
let lastMacroHotkeySync = { registered: [], failed: [] };

function syncMacroHotkeys() {
  if (!macroManager) return lastMacroHotkeySync;
  try {
    lastMacroHotkeySync = macroHotkeyRegistrar.sync(macroManager.list());
  } catch (err) {
    console.error('[MacroHotkeys] sync failed:', err);
  }
  return lastMacroHotkeySync;
}

function activeButtonHotkeys() {
  try {
    const profile = loadProfile(currentActiveProfile);
    return (profile.buttons || []).filter((b) => b && b.hotkey).map((b) => ({ label: b.name || b.label, hotkey: b.hotkey }));
  } catch {
    return [];
  }
}

function checkMacroHotkey(id, hotkey) {
  if (!hotkey) return { valid: true, accelerator: '', errors: [] };
  const parsed = parseMacroHotkey(hotkey);
  if (!parsed.valid) return parsed;
  const conflicts = findHotkeyConflicts({
    hotkey: parsed.accelerator,
    macroId: id,
    macros: macroManager ? macroManager.list() : [],
    buttonHotkeys: activeButtonHotkeys(),
  });
  return { valid: conflicts.length === 0, accelerator: parsed.accelerator, errors: conflicts };
}

ipcMain.handle('check-macro-hotkey', async (_event, payload) => {
  const input = payload && typeof payload === 'object' ? payload : {};
  return checkMacroHotkey(String(input.id || ''), String(input.hotkey || ''));
});

ipcMain.handle('execute-macro', async (event, id) => {
  try {
    return await executeMacroById(id, 'ui');
  } catch (error) {
    console.error('Error executing macro:', error);
    return { success: false, error: error.message, steps: [] };
  }
});

ipcMain.handle('raid-favorites-get', async () => {
  if (!raidFavoritesStore) return { success: false, error: 'Raid favorites unavailable' };
  return {
    success: true,
    favorites: raidFavoritesStore.listFavorites(),
    history: raidFavoritesStore.listHistory(),
  };
});

ipcMain.handle('raid-favorites-add', async (_event, payload) => {
  try {
    if (!raidFavoritesStore) return { success: false, error: 'Raid favorites unavailable' };
    const input = payload && typeof payload === 'object' ? payload : {};
    const entry = raidFavoritesStore.addFavorite({
      login: input.login,
      note: input.note,
    });
    return { success: true, favorite: entry };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('raid-favorites-remove', async (_event, payload) => {
  try {
    if (!raidFavoritesStore) return { success: false, error: 'Raid favorites unavailable' };
    const input = payload && typeof payload === 'object' ? payload : {};
    if (!isValidTwitchLogin(input.login)) {
      return { success: false, error: 'Invalid Twitch login' };
    }
    const removed = raidFavoritesStore.removeFavorite(input.login);
    return { success: removed };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('raid-favorites-reorder', async (_event, payload) => {
  try {
    if (!raidFavoritesStore) return { success: false, error: 'Raid favorites unavailable' };
    const input = payload && typeof payload === 'object' ? payload : {};
    if (!Array.isArray(input.orderedLogins)) {
      return { success: false, error: 'orderedLogins must be an array' };
    }
    const favorites = raidFavoritesStore.reorderFavorites(input.orderedLogins);
    return { success: true, favorites };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('raid-favorites-update-note', async (_event, payload) => {
  try {
    if (!raidFavoritesStore) return { success: false, error: 'Raid favorites unavailable' };
    const input = payload && typeof payload === 'object' ? payload : {};
    if (!isValidTwitchLogin(input.login)) {
      return { success: false, error: 'Invalid Twitch login' };
    }
    const updated = raidFavoritesStore.updateFavoriteNote(input.login, input.note);
    return { success: updated };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('raid-favorites-add-from-history', async (_event, payload) => {
  try {
    if (!raidFavoritesStore) return { success: false, error: 'Raid favorites unavailable' };
    const input = payload && typeof payload === 'object' ? payload : {};
    const entry = raidFavoritesStore.addFavorite({
      login: input.login,
      note: input.note || '',
    });
    return { success: true, favorite: entry };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('raid-favorites-live-check', async (_event, payload) => {
  const input = payload && typeof payload === 'object' ? payload : {};
  return await raidFavoritesListLive({ forceRefresh: !!input.forceRefresh });
});

ipcMain.handle('raid-favorites-start-raid', async (_event, payload) => {
  const input = payload && typeof payload === 'object' ? payload : {};
  if (!isValidTwitchLogin(input.login)) {
    return { success: false, error: 'Invalid Twitch login' };
  }
  return await raidFavoritesStartRaid({ login: input.login, source: 'ui' });
});

ipcMain.handle('raid-favorites-cancel-raid', async () => {
  try {
    const helix = createRaidHelixClient();
    const result = await helix.cancelRaid();
    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        needsReconnect: !!result.needsReconnect,
        authorizeUrl: result.needsReconnect ? buildTwitchAuthorizeUrl({ forceVerify: true }) : null,
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('check-twitch-raid-scope', async () => {
  try {
    const helix = createRaidHelixClient();
    const scope = await helix.validateToken();
    return {
      success: scope.ok,
      hasRaidScope: !!scope.hasRaidScope,
      scopes: scope.scopes || [],
      authorizeUrl: scope.hasRaidScope ? null : buildTwitchAuthorizeUrl({ forceVerify: true }),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('check-twitch-commercial-scope', async () => {
  try {
    const helix = createCommercialHelixClient();
    const scope = await helix.validateToken();
    return {
      success: scope.ok,
      hasCommercialScope: !!scope.hasCommercialScope,
      scopes: scope.scopes || [],
      authorizeUrl: scope.hasCommercialScope ? null : buildTwitchAuthorizeUrl({ forceVerify: true }),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('get-twitch-oauth-authorize-url', async () => {
  const url = buildTwitchAuthorizeUrl({ forceVerify: true });
  return { success: !!url, authorizeUrl: url };
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
    
    // Validate source path exists and is readable
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source file not found');
    }
    
    // Basic validation - reject paths that look suspicious
    const normalizedSource = path.normalize(sourcePath);
    if (normalizedSource.includes('..')) {
      console.error('⚠️ [Security] Rejected path with traversal attempt:', sourcePath);
      throw new Error('Invalid source path');
    }
    
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

// IPC handler to save audio file directly to sounds directory (for simple audio buttons)
ipcMain.handle('save-audio-file-to-sounds', async (event, { base64Data, label, originalName }) => {
  try {
    // Ensure sounds directory exists
    if (!fs.existsSync(userSoundsDir)) {
      fs.mkdirSync(userSoundsDir, { recursive: true });
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
          'audio/mpeg': '.mp3',
          'audio/mp3': '.mp3',
          'audio/wav': '.wav',
          'audio/wave': '.wav',
          'audio/ogg': '.ogg',
          'audio/oga': '.oga',
          'audio/m4a': '.m4a',
          'audio/aac': '.aac'
        };
        extension = mimeToExt[mimeType] || '.mp3';
      }
    }

    // Use label as filename (sanitized), but handle case where file already exists
    const safeLabel = label.replace(/[^a-z0-9_\-]/gi, '_');
    let filename = `${safeLabel}${extension}`;
    let filePath = path.join(userSoundsDir, filename);
    
    // If file already exists, append timestamp to make it unique
    if (fs.existsSync(filePath)) {
      const timestamp = Date.now();
      filename = `${safeLabel}_${timestamp}${extension}`;
      filePath = path.join(userSoundsDir, filename);
    }

    // Remove base64 prefix if present
    const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Write file
    fs.writeFileSync(filePath, Buffer.from(base64String, 'base64'));
    
    console.log('Audio file saved to sounds directory:', filePath);
    
    // Return relative path from userDataPath for storage in config
    const relativePath = path.relative(userDataPath, filePath).replace(/\\/g, '/');
    return { success: true, filePath: relativePath };
  } catch (error) {
    console.error('Error saving audio file to sounds:', error);
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
    // Sanitize path to prevent traversal
    const sanitizedPath = securityManager.sanitizePath(userDataPath, relativePath);
    
    if (!fs.existsSync(sanitizedPath)) {
      return { success: false, error: 'File not found' };
    }
    return { 
      success: true, 
      absolutePath: sanitizedPath
    };
  } catch (error) {
    console.error('Error getting media file path:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to get media file as base64 (for serving to overlay) - DEPRECATED, use HTTP serving instead
ipcMain.handle('get-media-file', async (event, relativePath) => {
  const result = readMediaFileAsDataUrl({ userDataPath, relativePath, securityManager });
  if (!result.success) {
    console.error('Error reading media file:', relativePath, result.error);
  }
  return result;
});


// IPC handler to update config
ipcMain.handle('update-config', async (event, configUpdate) => {
  try {
    // Load current profile instead of old config
    const profile = loadProfile(currentActiveProfile);
    
    // If updating theme, save it in uiSettings
    if (configUpdate.theme) {
      if (!profile.uiSettings) {
        profile.uiSettings = {};
      }
      profile.uiSettings.theme = configUpdate.theme;
      delete configUpdate.theme; // Remove from top level
    }
    
    // Merge other updates with existing profile
    const updatedProfile = { ...profile, ...configUpdate };
    
    // Save to active profile
    saveProfile(currentActiveProfile, updatedProfile);
    updateJarvisContext();
    console.log('Profile updated successfully:', configUpdate);
    return true;
  } catch (e) {
    console.error('Error updating config:', e);
    return false;
  }
});

// Persist button order sent from renderer to active profile
ipcMain.on('save-button-order', (event, orderedIds) => {
  try {
    if (!Array.isArray(orderedIds)) return;
    const profile = loadProfile(currentActiveProfile);
    if (!Array.isArray(profile.buttons)) profile.buttons = [];
    const byId = new Map(profile.buttons.map(b => [b.id, b]));
    const newButtons = [];
    for (const id of orderedIds) {
      if (byId.has(id)) newButtons.push(byId.get(id));
    }
    // append any missing buttons that weren't included in orderedIds
    for (const b of profile.buttons) if (!newButtons.includes(b)) newButtons.push(b);
    profile.buttons = newButtons;
    saveProfile(currentActiveProfile, profile);
    if (win && !win.isDestroyed()) win.webContents.send('refresh-ui');
  } catch (err) {
    console.error('Failed to save button order:', err);
  }
});

// Event->Sound mappings helpers stored inside active profile under 'mappings'
function loadMappings() {
  try {
    const profile = loadProfile(currentActiveProfile);
    if (!Array.isArray(profile.mappings)) profile.mappings = [];
    return profile.mappings;
  } catch (e) {
    return [];
  }
}

function saveMappings(maps) {
  try {
    const profile = loadProfile(currentActiveProfile);
    profile.mappings = maps;
    saveProfile(currentActiveProfile, profile);
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
    const tc = loadTcConfig();
    const safe = { ...tc };
    delete safe.accessToken;
    delete safe.oauth_token;
    delete safe.oauth_token_encrypted;
    delete safe.refreshToken;
    delete safe.refresh_token_encrypted;
    return safe;
  } catch (err) {
    console.error('Error reading tc_config via IPC:', err);
    return { topics: [], lastFollowerPoll: null };
  }
});


// ===============================
// Daily Check-In IPC Handlers
// ===============================

const {
  loadCheckinsFromPath,
  writeCheckinsJsonFile,
  readCheckinsJsonFile,
  backupCurrentCheckinsFile,
  formatExportBasename,
} = require('./lib/checkins-backup');
const { filterMenuTemplateForPackaged, filterRavenMenuItems } = require('./lib/packaged-ui-policy');

async function runBackupDailyCheckinsDialog() {
  try {
    const data = loadCheckinsFromPath(dailyCheckinsPath);
    const defaultPath = path.join(app.getPath('documents'), formatExportBasename());
    const result = await dialog.showSaveDialog(win, {
      title: 'Back up check-ins',
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    writeCheckinsJsonFile(result.filePath, data);
    return { success: true, path: result.filePath };
  } catch (err) {
    console.error('Backup daily check-ins failed:', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

async function runRestoreDailyCheckinsDialog() {
  try {
    const open = await dialog.showOpenDialog(win, {
      title: 'Restore check-ins',
      filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    if (open.canceled || !open.filePaths.length) {
      return { canceled: true };
    }
    const validated = readCheckinsJsonFile(open.filePaths[0]);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }
    const viewerCount = Object.keys(validated.data.viewers).length;
    const confirm = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Replace check-ins', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Restore check-ins',
      message: 'Replace your current check-in data?',
      detail:
        `The selected file contains ${viewerCount} viewer record(s). ` +
        'Your current checkins.json will be copied to checkins.json.bak, then replaced.',
    });
    if (confirm !== 0) {
      return { canceled: true };
    }
    backupCurrentCheckinsFile(dailyCheckinsPath);
    writeCheckinsJsonFile(dailyCheckinsPath, validated.data);
    if (win && !win.isDestroyed()) {
      win.webContents.send('daily-checkins-restored', validated.data);
    }
    return { success: true, data: validated.data };
  } catch (err) {
    console.error('Restore daily check-ins failed:', err);
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

ipcMain.handle('backup-daily-checkins', async () => runBackupDailyCheckinsDialog());
ipcMain.handle('restore-daily-checkins', async () => runRestoreDailyCheckinsDialog());

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
      liveDays: [], // Array of date strings (YYYY-MM-DD) when stream was live
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
ipcMain.handle('twitch-eventsub-health', async () => {
  try {
    return await getTwitchEventSubHealth();
  } catch (err) {
    console.error('twitch-eventsub-health error:', err);
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('get-channel-rewards', async () => {
  try {
    const token = helixAccessToken();
    const clientId = helixClientId();
    if (!clientId || !token) {
      return { ok: false, rewards: [], error: 'Twitch is not connected in VirtualDeck.' };
    }
    twitchUserId = null;
    twitchUserIdFor = null;
    await getUserId();
    const url = `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(twitchUserId)}`;
    const resp = await fetch(url, {
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = (data && data.message) || `Twitch returned ${resp.status}`;
      console.warn('Helix custom_rewards failed', resp.status, message);
      return { ok: false, rewards: [], error: message };
    }
    const rewards = data && Array.isArray(data.data) ? data.data : [];
    return { ok: true, rewards, error: null };
  } catch (err) {
    console.error('Error fetching channel rewards:', err);
    return { ok: false, rewards: [], error: err && err.message ? err.message : 'Could not load channel rewards' };
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

// IPC: check if stream is currently live
ipcMain.handle('is-stream-live', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return false;
    
    const resp = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(twitchUserId)}`, {
      headers: {
        'Client-ID': twitchClientId,
        'Authorization': `Bearer ${twitchToken}`
      }
    });
    const data = await resp.json();
    // Stream is live if data.data is not empty
    return data.data && data.data.length > 0;
  } catch (err) {
    console.error('Error checking stream status:', err);
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

// IPC: Get followers with full user data (user_id -> username/display_name)
ipcMain.handle('get-followers-with-users', async () => {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchClientId || !twitchToken) return [];
    
    // Fetch ALL followers using pagination
    const allFollowers = [];
    let cursor = null;
    let pageCount = 0;
    const maxPages = 100; // Safety limit to prevent infinite loops
    
    console.log('[Followers] Starting to fetch all followers...');
    
    do {
      let url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(twitchUserId)}&first=100`;
      if (cursor) {
        url += `&after=${encodeURIComponent(cursor)}`;
      }
      
      const resp = await fetch(url, {
        headers: {
          'Client-ID': twitchClientId,
          'Authorization': `Bearer ${twitchToken}`
        }
      });
      
      const followerData = await resp.json();
      
      if (followerData.data && followerData.data.length > 0) {
        allFollowers.push(...followerData.data);
        console.log(`[Followers] Fetched page ${pageCount + 1}: ${followerData.data.length} followers (total so far: ${allFollowers.length})`);
      }
      
      cursor = followerData.pagination?.cursor || null;
      pageCount++;
      
      // Safety check
      if (pageCount >= maxPages) {
        console.warn(`[Followers] Reached safety limit of ${maxPages} pages. Stopping pagination.`);
        break;
      }
      
      // Small delay to avoid rate limiting
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (cursor);
    
    console.log(`[Followers] Total followers fetched: ${allFollowers.length}`);
    
    if (allFollowers.length === 0) {
      console.log('[Followers] No followers found');
      return [];
    }
    
    // Get user IDs from all followers
    const userIds = allFollowers.map(f => f.user_id);
    
    // Batch fetch user data (Twitch allows up to 100 users per request)
    // Split into chunks of 100
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 100) {
      chunks.push(userIds.slice(i, i + 100));
    }
    
    console.log(`[Followers] Fetching user data for ${userIds.length} users in ${chunks.length} batches...`);
    
    const allUsers = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const userIdsParam = chunk.join('&id=');
      const userResp = await fetch(`https://api.twitch.tv/helix/users?id=${userIdsParam}`, {
        headers: {
          'Client-ID': twitchClientId,
          'Authorization': `Bearer ${twitchToken}`
        }
      });
      const userData = await userResp.json();
      if (userData.data) {
        allUsers.push(...userData.data);
        console.log(`[Followers] Fetched user data batch ${i + 1}/${chunks.length}: ${userData.data.length} users`);
      }
      
      // Small delay between batches to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[Followers] Total user data fetched: ${allUsers.length}`);
    
    // Combine follower data with user data
    const followersWithUsers = allFollowers.map(follower => {
      const user = allUsers.find(u => u.id === follower.user_id);
      return {
        user_id: follower.user_id,
        followed_at: follower.followed_at,
        username: user ? user.login : null,
        display_name: user ? user.display_name : null,
        profile_image_url: user ? user.profile_image_url : null
      };
    }).filter(f => f.username) // Only return followers with username data
      .sort((a, b) => {
        // Sort alphabetically by display_name (fallback to username)
        const nameA = (a.display_name || a.username || '').toLowerCase();
        const nameB = (b.display_name || b.username || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    
    console.log(`[Followers] Returning ${followersWithUsers.length} followers with user data (sorted alphabetically)`);
    
    return followersWithUsers;
  } catch (err) {
    console.error('Error fetching followers with user data:', err);
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

// IPC handler to open bug report form
ipcMain.handle('report-bug', async () => {
  try {
    const { shell } = require('electron');
    const bugReportUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdHUauA7LI_bJtfKRKrbD81lZ8Xs6R3egGOEalqAF2KHUNDdg/viewform';
    await shell.openExternal(bugReportUrl);
    console.log('Opened bug report form in browser');
    return { success: true };
  } catch (error) {
    console.error('Error opening bug report form:', error);
    return { success: false, error: error.message };
  }
});

// Get connected overlays
ipcMain.handle('get-connected-overlays', async () => {
  try {
    const connections = [];
    // Convert overlayRegistry Map to array of connection objects (OPEN sockets only).
    // Merged from the former duplicate handler in app.whenReady: the renderer reads clientCount.
    for (const [overlayName, clientSet] of overlayRegistry.entries()) {
      const activeClients = Array.from(clientSet).filter(client => client.readyState === WebSocket.OPEN);
      if (activeClients.length > 0) {
        connections.push({
          name: overlayName,
          connected: true,
          clientCount: activeClients.length,
          count: activeClients.length
        });
      }
    }
    console.log('📊 Connected overlays:', connections);
    return connections;
  } catch (error) {
    console.error('Error getting connected overlays:', error);
    return [];
  }
});

// Close all WebSocket connections for a specific overlay
ipcMain.handle('close-overlay-connections', async (event, overlayName) => {
  try {
    console.log(`🔌 Closing connections for overlay: ${overlayName}`);
    
    if (overlayRegistry.has(overlayName)) {
      const clientSet = overlayRegistry.get(overlayName);
      const clientCount = clientSet.size;
      
      // Close all WebSocket connections for this overlay
      for (const ws of clientSet) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, `Overlay "${overlayName}" deleted`);
        }
      }
      
      // Clear the registry entry
      overlayRegistry.delete(overlayName);
      
      console.log(`✅ Closed ${clientCount} connection(s) for overlay: ${overlayName}`);
      return { success: true, closedCount: clientCount };
    } else {
      console.log(`ℹ️ No connections found for overlay: ${overlayName}`);
      return { success: true, closedCount: 0 };
    }
  } catch (error) {
    console.error('Error closing overlay connections:', error);
    return { success: false, error: error.message };
  }
});

// Skin System IPC Handlers

// Helper function to recursively search for JSON files in directory
function findSkinFiles(dir, baseDir = dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findSkinFiles(fullPath, baseDir, files);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Get available skins from the skins directory
ipcMain.handle('get-available-skins', async () => {
  try {
    const skins = [];
    if (!fs.existsSync(userSkinsDir)) {
      return skins;
    }
    
    // Find all JSON files recursively
    const skinFiles = findSkinFiles(userSkinsDir);
    
    for (const skinPath of skinFiles) {
      try {
        const skinData = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
        if (skinData.name && skinData.version) {
          // Get relative path from userSkinsDir for id generation
          const relativePath = path.relative(userSkinsDir, skinPath);
          const id = relativePath.replace(/\\/g, '/').replace(/\.json$/, '');
          
          skins.push({
            id: id,
            name: skinData.name,
            description: skinData.description || '',
            version: skinData.version,
            author: skinData.author || '',
            filename: path.basename(skinPath),
            fullPath: relativePath
          });
        }
      } catch (err) {
        console.warn(`Failed to parse skin file ${skinPath}:`, err);
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
    // Convert the skinId to a path (handles subdirectories)
    // e.g., "HalloweenByTati/halloween" -> "HalloweenByTati/halloween.json"
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
    // Get available skins using the same recursive function
    const skins = [];
    if (fs.existsSync(userSkinsDir)) {
      const skinFiles = findSkinFiles(userSkinsDir);
      
      for (const skinPath of skinFiles) {
        try {
          const skinData = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
          if (skinData.name && skinData.version) {
            const relativePath = path.relative(userSkinsDir, skinPath);
            const id = relativePath.replace(/\\/g, '/').replace(/\.json$/, '');
            
            skins.push({
              id: id,
              name: skinData.name,
              description: skinData.description || '',
              version: skinData.version,
              author: skinData.author || '',
              filename: path.basename(skinPath),
              fullPath: relativePath
            });
          }
        } catch (err) {
          console.warn(`Failed to parse skin file ${skinPath}:`, err);
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
      filename: skin.filename,
      fullPath: skin.fullPath
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
    const skinPath = path.join(userSkinsDir, selectedSkin.fullPath);
    
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
    
    // Validate file extension
    if (!filePath.toLowerCase().endsWith('.json')) {
      throw new Error('Invalid file type. Only JSON files are allowed.');
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

// --- !killcommand → Streamlabs Desktop (local TCP JSON-RPC, port 28194) ---
let lastKillcommandAt = 0;
const KILLCOMMAND_DEBOUNCE_MS = 5000;

function getKillcommandUserAllowlist() {
  const raw = process.env.VD_KILLCOMMAND_USERS || '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isKillcommandAuthorized(username) {
  const list = getKillcommandUserAllowlist();
  const u = String(username || '').toLowerCase();
  return list.length > 0 && list.includes(u);
}

async function handleKillcommandFromChat(username) {
  const channels = twitchClient && twitchClient.getChannels();
  const ch = channels && channels[0];
  const reply = (text) => {
    if (twitchClient && twitchClient.readyState() === 'OPEN' && ch) {
      twitchClient.say(ch, text);
    }
  };

  const now = Date.now();
  if (now - lastKillcommandAt < KILLCOMMAND_DEBOUNCE_MS) {
    reply(`@${username} — !killcommand is on cooldown.`);
    return;
  }

  try {
    const result = await stopStreamlabsStreamingIfLive();
    lastKillcommandAt = Date.now();
    if (!result.ok) {
      if (result.reason === 'not_streaming') {
        reply(`@${username} — Streamlabs is not live (status: ${result.detail || 'offline'}).`);
      } else {
        reply(`@${username} — Could not end stream: ${result.reason || 'unknown'}.`);
      }
      return;
    }
    reply(`@${username} — Ending stream via Streamlabs…`);
  } catch (e) {
    console.error('!killcommand / Streamlabs error:', e);
    lastKillcommandAt = Date.now();
    reply(
      `@${username} — Streamlabs error: ${e.message || String(e)} (is Streamlabs running on this PC?)`,
    );
  }
}

let twitchClient = null;
let twitchChatConnectGeneration = 0;
const twitchChatMessageDeduper = createTwitchMessageDeduper();

async function stopTwitchChatConnection() {
  const client = twitchClient;
  twitchClient = null;
  if (!client) return;
  try {
    client.removeAllListeners();
  } catch (e) {
    console.warn('Twitch chat removeAllListeners failed:', e && e.message);
  }
  try {
    if (typeof client.disconnect === 'function') {
      await client.disconnect();
    }
  } catch (e) {
    console.warn('Twitch chat disconnect failed:', e && e.message);
  }
}

// In-memory cache of recent chat user state (badges, mod flag) to enable simple VIP/mod checks
const recentChatUserState = new Map();
// Track users who have chatted this session (for walk-on alerts)
const firstTimeChatters = new Set();

const TWITCH_PROFILE_IMAGE_CACHE_TTL_MS = 30 * 60 * 1000;
const TWITCH_PROFILE_IMAGE_ERROR_CACHE_TTL_MS = 60 * 1000;
const TWITCH_PROFILE_HELIX_TIMEOUT_MS = 2500;
const TWITCH_USER_ID_PATTERN = /^\d{1,20}$/;
const TWITCH_LOGIN_PATTERN = /^[a-zA-Z0-9_]{1,25}$/;
const twitchProfileImageCache = new Map();

function twitchProfileCacheKey({ userId, login }) {
  if (userId) return `id:${userId}`;
  if (login) return `login:${String(login).toLowerCase()}`;
  return null;
}

function getCachedTwitchProfileImage(cacheKey) {
  const cached = twitchProfileImageCache.get(cacheKey);
  if (!cached) return undefined;
  const ttlMs = cached.ttlMs ?? TWITCH_PROFILE_IMAGE_CACHE_TTL_MS;
  if (Date.now() - cached.ts >= ttlMs) return undefined;
  return cached.profileImageUrl;
}

function setCachedTwitchProfileImage(cacheKey, profileImageUrl, ttlMs = TWITCH_PROFILE_IMAGE_CACHE_TTL_MS) {
  twitchProfileImageCache.set(cacheKey, {
    profileImageUrl,
    ts: Date.now(),
    ttlMs,
  });
}

function cacheTwitchProfileLookupResult(user, profileImageUrl) {
  const ttlMs = TWITCH_PROFILE_IMAGE_CACHE_TTL_MS;
  if (user?.id) {
    setCachedTwitchProfileImage(`id:${user.id}`, profileImageUrl, ttlMs);
  }
  if (user?.login) {
    setCachedTwitchProfileImage(`login:${user.login.toLowerCase()}`, profileImageUrl, ttlMs);
  }
}

function sanitizeTwitchProfileImageUrl(url) {
  return sanitizeTwitchProfileImageUrlLib(url);
}

async function helixFetchTwitchUser({ userId, login, signal }) {
  let helixUrl = 'https://api.twitch.tv/helix/users?';
  if (userId) {
    helixUrl += `id=${encodeURIComponent(userId)}`;
  } else {
    helixUrl += `login=${encodeURIComponent(String(login).toLowerCase())}`;
  }

  const resp = await fetch(helixUrl, {
    headers: {
      'Client-ID': twitchClientId,
      'Authorization': `Bearer ${twitchToken}`,
    },
    signal,
  });
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
}

async function lookupTwitchProfileImage({ userId, login }) {
  const cacheKey = twitchProfileCacheKey({ userId, login });
  if (!cacheKey) return null;

  const cached = getCachedTwitchProfileImage(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  if (!twitchClientId || !twitchToken) {
    setCachedTwitchProfileImage(cacheKey, null, TWITCH_PROFILE_IMAGE_ERROR_CACHE_TTL_MS);
    return null;
  }

  const signal = AbortSignal.timeout(TWITCH_PROFILE_HELIX_TIMEOUT_MS);

  try {
    let user = null;

    if (userId) {
      const { resp, data } = await helixFetchTwitchUser({ userId, signal });
      if (!resp.ok) {
        setCachedTwitchProfileImage(cacheKey, null, TWITCH_PROFILE_IMAGE_ERROR_CACHE_TTL_MS);
        console.warn('[Walk On] Helix users lookup failed:', resp.status);
        return null;
      }
      user = data.data && data.data[0];
      if (!user && login) {
        const fallback = await helixFetchTwitchUser({ login, signal });
        if (!fallback.resp.ok) {
          setCachedTwitchProfileImage(cacheKey, null, TWITCH_PROFILE_IMAGE_ERROR_CACHE_TTL_MS);
          console.warn('[Walk On] Helix users login fallback failed:', fallback.resp.status);
          return null;
        }
        user = fallback.data.data && fallback.data.data[0];
      }
    } else if (login) {
      const { resp, data } = await helixFetchTwitchUser({ login, signal });
      if (!resp.ok) {
        setCachedTwitchProfileImage(cacheKey, null, TWITCH_PROFILE_IMAGE_ERROR_CACHE_TTL_MS);
        console.warn('[Walk On] Helix users lookup failed:', resp.status);
        return null;
      }
      user = data.data && data.data[0];
    }

    const profileImageUrl = sanitizeTwitchProfileImageUrl(user?.profile_image_url);
    setCachedTwitchProfileImage(cacheKey, profileImageUrl, TWITCH_PROFILE_IMAGE_CACHE_TTL_MS);
    if (user) {
      cacheTwitchProfileLookupResult(user, profileImageUrl);
    }
    return profileImageUrl;
  } catch (err) {
    const isTimeout = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error('[Walk On] Twitch profile image lookup failed:', isTimeout ? 'timed out' : err);
    setCachedTwitchProfileImage(cacheKey, null, TWITCH_PROFILE_IMAGE_ERROR_CACHE_TTL_MS);
    return null;
  }
}

// Function to reset first-time chatters (useful when restarting stream)
function resetFirstTimeChatters() {
  firstTimeChatters.clear();
  console.log('[Walk On] First-time chatters list cleared');
}

// IPC handler to reset first-time chatters for testing
ipcMain.handle('reset-first-time-chatters', async () => {
  try {
    resetFirstTimeChatters();
    return { success: true, message: 'First-time chatters list reset' };
  } catch (error) {
    console.error('Error resetting first-time chatters:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-twitch-profile-image', async (_event, params) => {
  const input = params && typeof params === 'object' ? params : {};
  let userId = input.userId;
  let login = input.login;

  if (userId != null && userId !== '') {
    userId = String(userId);
    if (!TWITCH_USER_ID_PATTERN.test(userId)) {
      return { success: false, profileImageUrl: null, error: 'Invalid userId' };
    }
  } else {
    userId = undefined;
  }

  if (login != null && login !== '') {
    login = String(login);
    if (!TWITCH_LOGIN_PATTERN.test(login)) {
      return { success: false, profileImageUrl: null, error: 'Invalid login' };
    }
  } else {
    login = undefined;
  }

  if (!userId && !login) {
    return { success: false, profileImageUrl: null, error: 'userId or login required' };
  }

  try {
    const profileImageUrl = await lookupTwitchProfileImage({ userId, login });
    return { success: true, profileImageUrl };
  } catch (error) {
    console.error('Error fetching Twitch profile image:', error);
    return { success: false, profileImageUrl: null, error: error.message };
  }
});

function startTwitchChatConnection({ username, oauth, clientId }) {
  console.log('Starting Twitch chat connection for user:', username);
  if (!username || !oauth) {
    console.error('Missing Twitch credentials');
    return;
  }
  twitchChatConnectGeneration += 1;
  const connectGeneration = twitchChatConnectGeneration;
  void (async () => {
    await stopTwitchChatConnection();
    if (connectGeneration !== twitchChatConnectGeneration) {
      console.log('Twitch chat connect superseded by a newer request; skipping');
      return;
    }
    twitchChatMessageDeduper.reset();
    beginTwitchChatClient({ username, oauth, clientId, connectGeneration });
  })();
}

function beginTwitchChatClient({ username, oauth, clientId, connectGeneration }) {
  const opts = {
    identity: {
      username: username,
      password: oauth.startsWith('oauth:') ? oauth : 'oauth:' + oauth
    },
    channels: [username]
  };
  const nextLogin = String(username || '').replace(/^#/, '').trim().toLowerCase();
  if (twitchUserIdFor && nextLogin && twitchUserIdFor !== nextLogin) {
    twitchUserId = null;
    twitchUserIdFor = null;
  }
  twitchClientId = clientId;
  twitchToken = oauth;
  twitchUserName = username;
  console.log('Using clientId:', twitchClientId);
  twitchClient = new tmi.Client(opts);
  twitchClient.on('disconnected', (reason) => {
    console.warn('Twitch chat disconnected:', reason);
    if (win && win.webContents) {
      win.webContents.send('twitch-cleared');
    }
  });

  twitchClient.connect().then(() => {
    console.log('Connected to Twitch chat as', username);
    
    // Update JARVIS context with Twitch connection
    updateJarvisContext();

    const kcUsers = getKillcommandUserAllowlist();
    if (kcUsers.length === 0) {
      console.warn(
        '⚠️ !killcommand disabled: set VD_KILLCOMMAND_USERS in .env (comma-separated Twitch logins).',
      );
    } else {
      console.log(`✅ !killcommand allowed users: ${kcUsers.join(', ')}`);
    }
    
    // Save Twitch credentials to tc_config for AI controller to use
    try {
      const tc = loadTcConfig();
      tc.username = username.toLowerCase().trim(); // Normalize for comparison
      tc.clientId = clientId; // Save client ID for AI controller
      tc.accessToken = oauth; // Save access token for AI controller
      // Note: Token is stored but should be kept secure
      saveTcConfig(tc);
      console.log(`📺 Saved Twitch credentials to tc_config (username: ${tc.username}, clientId: ${tc.clientId?.substring(0, 7)}...)`);
    } catch (err) {
      console.warn('⚠️ Could not save Twitch credentials to tc_config:', err);
    }
    
    // Reset first-time chatters when connecting (new stream session)
    resetFirstTimeChatters();
    // Notify renderer to update button state
    if (win && win.webContents) {
      win.webContents.send('twitch-connected');
    }
    // Trigger EventSub connection after chat connects
    if (username && oauth && twitchClientId) {
      startTwitchEventSub({ username, oauth, clientId: twitchClientId });
    }
    // Start stream monitor for hydration auto-reset
    startStreamMonitor();
  });
  twitchClient.on('message', (channel, tags, message, self) => {
    if (self) return;
    if (connectGeneration !== twitchChatConnectGeneration) return;
    if (twitchChatMessageDeduper.isDuplicate(tags)) {
      console.log('[Twitch Chat] Skipping duplicate message id:', tags && tags.id);
      return;
    }

    const username = tags.username;
    const userId = tags['user-id'];
    const displayName = tags['display-name'] || username;
    const uname = String(username).toLowerCase();
    
    // Check if this is first chat this session
    const isFirstTime = !firstTimeChatters.has(uname);
    
    if (isFirstTime) {
      firstTimeChatters.add(uname);
      // Send first-chat walk-on event
      if (win && win.webContents) {
        win.webContents.send('twitch-eventsub', {
          type: 'first-chat-walkon',
          event: {
            user_id: userId,
            user_name: username,
            display_name: displayName
          }
        });
        console.log(`[Walk On] First-time chatter detected: ${username}`);
      }
    }
    
    // Cache recent user state for quick VIP/mod checks later
    try {
      if (tags && tags.username) {
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
    
    // Write chat event to ai-events.log for AI controller
    // Include channel info so AI can filter by authenticated user
    try {
      const chatEvent = {
        type: 'twitch_chat',
        channel: channel.replace('#', '').toLowerCase(), // Remove # and normalize
        user: {
          name: tags.username,
          displayName: tags['display-name'] || tags.username,
          id: tags['user-id'],
          isMod: !!tags.mod,
          isSub: !!tags.subscriber,
          isVip: !!tags.vip,
        },
        message: message,
        badges: tags.badges || {},
        timestamp: Date.now(),
      };
      fs.appendFileSync(aiEventsLogPath, JSON.stringify(chatEvent) + '\n', 'utf-8');
      console.log(`📝 [AI Events] Wrote chat event to log (channel: ${chatEvent.channel})`);
    } catch (err) {
      console.error('❌ [AI Events] Error writing chat event:', err);
    }
    
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
      const commandText = message.split(' ')[0].substring(1).toLowerCase();
      
      // Handle !checkin command specifically
      if (commandText === 'checkin') {
        const uname = String(username).toLowerCase();
        const now = Date.now();
        
        // Check cooldown
        const lastUsed = checkinCommandCooldown.get(uname);
        if (lastUsed && (now - lastUsed) < CHECKIN_COMMAND_COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((CHECKIN_COMMAND_COOLDOWN_MS - (now - lastUsed)) / 1000);
          const remainingMinutes = Math.floor(remainingSeconds / 60);
          const remainingSecs = remainingSeconds % 60;
          const timeLeft = remainingMinutes > 0 
            ? `${remainingMinutes}m ${remainingSecs}s`
            : `${remainingSecs}s`;
          
          if (twitchClient && twitchClient.readyState() === 'OPEN') {
            const channels = twitchClient.getChannels();
            if (channels && channels.length > 0) {
              twitchClient.say(channels[0], `@${username}, the check-in leaderboard was recently shown. Please wait ${timeLeft} before using !checkin again.`);
            }
          }
          return;
        }
        
        // Update cooldown
        checkinCommandCooldown.set(uname, now);
        
        // Get check-in config to see if streaks are enabled
        let showStreak = false;
        try {
          if (fs.existsSync(dailyCheckinsPath)) {
            const data = JSON.parse(fs.readFileSync(dailyCheckinsPath, 'utf-8'));
            showStreak = data.config?.showStreak || false;
          }
        } catch (err) {
          console.error('Error reading check-in config:', err);
        }
        
        // Get leaderboard
        const leaderboard = getCheckinLeaderboard(showStreak, 5);
        
        if (!leaderboard || leaderboard.length === 0) {
          if (twitchClient && twitchClient.readyState() === 'OPEN') {
            const channels = twitchClient.getChannels();
            if (channels && channels.length > 0) {
              twitchClient.say(channels[0], '📊 No check-in data available yet. Be the first to check in!');
            }
          }
          return;
        }
        
        // Format leaderboard message
        let leaderboardMsg = '📊 Top Check-Ins: ';
        const entries = [];
        leaderboard.forEach((viewer, index) => {
          let entry = `${index + 1}. ${viewer.display_name} (${viewer.total_checkins}`;
          if (showStreak && viewer.streak > 0) {
            entry += ` | ${viewer.streak}-day streak`;
          }
          entry += ')';
          entries.push(entry);
        });
        
        leaderboardMsg += entries.join(' • ');
        
        // Twitch chat message limit is 500 characters, truncate if needed
        if (leaderboardMsg.length > 500) {
          leaderboardMsg = leaderboardMsg.substring(0, 497) + '...';
        }
        
        // Send to chat
        if (twitchClient && twitchClient.readyState() === 'OPEN') {
          const channels = twitchClient.getChannels();
          if (channels && channels.length > 0) {
            twitchClient.say(channels[0], leaderboardMsg);
            console.log(`📊 Sent check-in leaderboard to chat for ${username}`);
          }
        }
        
        return;
      }

      // !clip — Twitch Helix clip + chat link (any viewer; cooldown applies)
      if (commandText === 'clip') {
        void createTwitchClipAndAnnounce({ requestedBy: displayName || username });
        return;
      }

      if (commandText === 'socials') {
        const now = Date.now();
        if (now - lastSocialsCommandAt < TWITCH_SOCIALS_COOLDOWN_MS) {
          void sayInTwitchChat(`@${username} — !socials is on cooldown. Try again in a few seconds.`);
          return;
        }
        lastSocialsCommandAt = now;
        void postSocialsToChat({ requestedBy: displayName || username, source: 'chat' });
        return;
      }

      // !killcommand — Streamlabs end-stream (allowlist from .env VD_KILLCOMMAND_USERS)
      if (commandText === 'killcommand') {
        if (isKillcommandAuthorized(username)) {
          void handleKillcommandFromChat(username);
        }
        return;
      }

      // Regular button command handling
      const profile = loadProfile(currentActiveProfile);
      profile.buttons.forEach((btn) => {
        // Check if button has chat command enabled and keyword matches
        if (btn.chatCommand && btn.chatCommand.enabled && btn.chatCommand.keyword && btn.chatCommand.keyword.toLowerCase() === commandText) {
          const triggerMethod = btn.chatCommand.triggerMethod || 'command';
          console.log(`🔍 main.js checking button "${btn.label || btn.name}" with chatCommand:`, btn.chatCommand);
          console.log(`🔍 main.js checking button "${btn.label || btn.name}" with triggerMethod: "${triggerMethod}" for command: "${commandText}"`);
          
          // Only trigger if the button is configured to accept chat commands
          if (triggerMethod === 'command' || triggerMethod === 'both') {
            console.log(`🚀 main.js triggering button "${btn.label || btn.name}" (triggerMethod: ${triggerMethod} allows chat commands)`);
            triggerButtonWithDebounce(btn.label || btn.name, `chat command !${commandText}`);
          } else {
            console.log(`⏭️ main.js skipping chat command "${commandText}" for button "${btn.label || btn.name}" (triggerMethod: ${triggerMethod} - redeem only)`);
          }
        }
        // Legacy support: Only check old 'command' type buttons if no modern chatCommand exists
        else if (!btn.chatCommand && btn.type === 'command' && btn.label.toLowerCase() === commandText) {
          triggerButtonWithDebounce(btn.label, `legacy chat command !${commandText}`);
        }
      });
    }
  });
}

// Example: Listen for IPC from renderer to start connection
ipcMain.on('twitch-connect', (event, creds) => {
  console.log('Received twitch-connect IPC with creds');
  console.log('Creds:', creds);
  const clientId = creds.clientId || getTwitchOAuthClientId();
  startTwitchChatConnection({
    username: creds.username,
    oauth: creds.oauth,
    clientId,
  });
  if (creds.oauth && creds.username && twitchOAuthHost) {
    try {
      twitchOAuthHost.persistOAuthSession({
        accessToken: creds.oauth,
        refreshToken: creds.refreshToken || null,
        expiresIn: creds.expiresIn,
        clientId,
        username: creds.username,
        userId: creds.userId,
      });
    } catch (err) {
      console.warn('[Twitch OAuth] Could not persist manual credentials:', err.message);
    }
  }
});

let twitchOAuthHost = null;
function isTwitchChatConnected() {
  try {
    return !!(twitchClient && typeof twitchClient.readyState === 'function' && twitchClient.readyState() === 'OPEN');
  } catch {
    return false;
  }
}

function isEventSubConnected() {
  try {
    return !!(eventSubWs && eventSubWs.readyState === WebSocket.OPEN && eventSubSessionId);
  } catch {
    return false;
  }
}

function vdDebugLog(...args) {
  const v = String(process.env.VD_DEBUG || '').trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') {
    console.log('[VD_DEBUG]', ...args);
  }
}

async function getTwitchEventSubHealth() {
  const oauth = await getTwitchOAuthStatus();
  let hasChannelPointsSub = false;
  let channelPointsSubscriptionIds = [];
  try {
    const listed = await listEventSubscriptions();
    const rows = listed && listed.data ? listed.data : [];
    const cp = rows.filter((s) => s.type === 'channel.channel_points_custom_reward_redemption.add');
    hasChannelPointsSub = cp.length > 0;
    channelPointsSubscriptionIds = cp.map((s) => s.id).filter(Boolean);
    vdDebugLog('EventSub channel_points subscriptions:', channelPointsSubscriptionIds.length, channelPointsSubscriptionIds);
  } catch (err) {
    vdDebugLog('EventSub list failed:', err.message || err);
  }
  let wantsChannelPointsTopic = false;
  try {
    const tc = loadTcConfig();
    wantsChannelPointsTopic =
      Array.isArray(tc.topics) && tc.topics.includes('channel.channel_points_custom_reward_redemption');
  } catch (e) {
    wantsChannelPointsTopic = false;
  }
  const missingRedemptionsScope =
    Array.isArray(oauth.missingScopes) && oauth.missingScopes.includes('channel:read:redemptions');
  return {
    ...oauth,
    eventSubWsOpen: isEventSubConnected(),
    eventSubSessionId: eventSubSessionId || null,
    wantsChannelPointsTopic,
    hasChannelPointsSub,
    channelPointsSubscriptionIds,
    channelPointsReady:
      hasChannelPointsSub &&
      oauth.eventSubConnected &&
      !missingRedemptionsScope &&
      oauth.chatConnected,
  };
}

async function getTwitchOAuthStatus() {
  const clientId = getTwitchOAuthClientId();
  const session = twitchOAuthHost ? twitchOAuthHost.readStoredTokens() : readStoredTokensFromTc();
  const hasSession = !!(session.accessToken || session.refreshToken);
  const chatConnected = isTwitchChatConnected();
  const eventSubConnected = isEventSubConnected();
  let missingScopes = [];
  let scopeWarning = null;
  if (session.accessToken) {
    try {
      const { validateTwitchAccessToken } = require('./lib/twitch-oauth');
      const validation = await validateTwitchAccessToken(fetch, session.accessToken);
      if (validation.ok && Array.isArray(validation.scopes)) {
        const required = ['channel:read:redemptions'];
        missingScopes = required.filter((s) => !validation.scopes.includes(s));
        if (missingScopes.length) {
          scopeWarning = `Reconnect Twitch to grant: ${missingScopes.join(', ')}`;
        }
      }
    } catch (err) {
      console.warn('[Twitch OAuth] scope validation failed:', err.message || err);
    }
  }
  return {
    clientIdConfigured: !!clientId,
    hasSession,
    login: session.username || twitchUserName || null,
    chatConnected,
    eventSubConnected,
    connected: chatConnected,
    missingScopes,
    scopeWarning,
    needsReconnect: hasSession && !chatConnected,
  };
}

function readStoredTokensFromTc() {
  const tc = loadTcConfig();
  return {
    accessToken: String(tc.accessToken || tc.oauth_token || '').replace(/^oauth:/i, '').trim(),
    refreshToken: String(tc.refreshToken || '').trim(),
    username: tc.username || '',
  };
}

function initTwitchOAuthHost() {
  if (twitchOAuthHost) return twitchOAuthHost;
  twitchOAuthHost = createTwitchOAuthHost({
    fetchFn: fetch,
    safeStorage,
    shell,
    getMainWindow: () => win,
    loadTcConfig,
    saveTcConfig,
    startTwitchChatConnection,
    ipcMain,
    getTwitchConnected: isTwitchChatConnected,
    getTwitchOAuthStatus,
  });
  twitchOAuthHost.registerIpc();
  return twitchOAuthHost;
}

let lastFollowerIds = [];
let lastPollTime = null;
// Interval handle for follower polling (so we can start/stop when follows topic is enabled)
let pollIntervalId = null;
// Prevent concurrent apply/reconcile runs and track pending creations to avoid duplicates
let applyingEventSub = false;
const pendingSubFingerprints = new Set();
let eventSubSessionId = null;
let eventSubRegistered = false;
let eventSubGeneration = 0;
// WebSocket instance for EventSub (kept so we can close it when clearing creds)
let eventSubWs = null;
let twitchUserId = null;
let twitchUserIdFor = null;
let twitchToken = null;
let twitchClientId = null;
let twitchUserName = null;
const TWITCH_WEB_CLIENT_ID = 'gp762nuuoqcoxypju8c569th9wz7q5';
let lastTwitchClipAt = 0;
let lastSocialsCommandAt = 0;
const TWITCH_SOCIALS_COOLDOWN_MS = 20000;

function helixAccessToken() {
  let token = twitchToken;
  if (!token) {
    // Reuse the connection saved by Twitch setup (tc_config) instead of asking for a reconnect.
    try {
      const tc = loadTcConfig();
      token = (tc && tc.accessToken) || '';
    } catch {
      token = '';
    }
  }
  return String(token || '').replace(/^oauth:/i, '').trim();
}

function helixClientId() {
  const usable = (id) => {
    const value = String(id || '').trim();
    if (!value || value === TWITCH_WEB_CLIENT_ID) return '';
    return value;
  };
  const fromMemory = usable(twitchClientId);
  if (fromMemory) return fromMemory;
  try {
    const tc = loadTcConfig();
    const saved = usable(tc && tc.clientId);
    if (saved) return saved;
  } catch {
    // fall through
  }
  return getTwitchOAuthClientId();
}

// Reuse one client so the 60s live-check cache survives across IPC/JARVIS calls.
// Credentials are read through getters on every request, so reconnects are picked up.
let raidHelixClient = null;
function createRaidHelixClient() {
  if (raidHelixClient) return raidHelixClient;
  raidHelixClient = new RaidHelixClient({
    fetchFn: fetch,
    getClientId: helixClientId,
    getAccessToken: helixAccessToken,
    getBroadcasterId: async () => {
      if (!twitchUserId) await getUserId();
      return twitchUserId;
    },
  });
  return raidHelixClient;
}

function recordOutgoingRaidTarget({ login, displayName, source }) {
  if (!raidFavoritesStore || !login) return null;
  try {
    const entry = raidFavoritesStore.recordRaid({ login, displayName });
    if (win && !win.isDestroyed()) {
      win.webContents.send('raid-favorites-history-updated', { entry, source });
    }
    return entry;
  } catch (err) {
    console.warn('[Raid Favorites] Failed to record raid history:', err);
    return null;
  }
}

function handleRaidEventSubNotification(type, eventData) {
  if (type !== 'channel.raid' || !eventData || !twitchUserId) return;
  if (String(eventData.from_broadcaster_user_id) !== String(twitchUserId)) return;
  const login = eventData.to_broadcaster_user_login || eventData.to_broadcaster_user_name;
  if (!login) return;
  recordOutgoingRaidTarget({
    login,
    displayName: eventData.to_broadcaster_user_name || login,
    source: 'eventsub',
  });
}

async function raidFavoritesListLive({ forceRefresh = false } = {}) {
  if (!raidFavoritesStore) {
    return { success: false, error: 'Raid favorites unavailable' };
  }
  const favorites = raidFavoritesStore.listFavorites();
  const logins = favorites.map((f) => f.login);
  if (logins.length === 0) {
    return {
      success: true,
      favorites: [],
      channels: [],
      checkedAt: new Date().toISOString(),
      hasRaidScope: false,
    };
  }
  try {
    const helix = createRaidHelixClient();
    const { channels, checkedAt, cached } = await helix.getLiveStatusForLogins(logins, { forceRefresh });
    const merged = favorites.map((f) => {
      const key = normalizeTwitchLogin(f.login);
      const live = channels.find((c) => c.login === key);
      return { ...f, ...(live || { login: key, live: false }) };
    });
    merged.sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      if (a.live && b.live) return (b.viewerCount || 0) - (a.viewerCount || 0);
      return a.login.localeCompare(b.login);
    });
    const scope = await helix.validateToken();
    return {
      success: true,
      favorites: merged,
      channels,
      checkedAt,
      cached: !!cached,
      hasRaidScope: !!scope.hasRaidScope,
      scopeStatus: scope.scopeStatus || (scope.hasRaidScope ? 'ok' : 'unknown'),
      authorizeUrl: scope.hasRaidScope ? null : buildTwitchAuthorizeUrl({ forceVerify: true }),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

async function raidFavoritesStartRaid({ login, source = 'ui' }) {
  if (!raidFavoritesStore) {
    return { success: false, error: 'Raid favorites unavailable' };
  }
  const normalized = normalizeTwitchLogin(login);
  if (!isValidTwitchLogin(normalized)) {
    return { success: false, error: 'Invalid Twitch login' };
  }
  if (!raidFavoritesStore.isAllowedRaidTarget(normalized)) {
    return { success: false, error: 'Target must be in favorites or raid history' };
  }
  try {
    const helix = createRaidHelixClient();
    const result = await helix.startRaid({ toLogin: normalized });
    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        needsReconnect: !!result.needsReconnect,
        authorizeUrl: result.needsReconnect ? buildTwitchAuthorizeUrl({ forceVerify: true }) : null,
      };
    }
    recordOutgoingRaidTarget({ login: normalized, displayName: normalized, source });
    return { success: true, login: normalized, raid: result.raid };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

function buildJarvisRaidContext() {
  return {
    raidFavoritesStore,
    raidFavoritesListLive,
    raidFavoritesStartRaid,
  };
}

async function sayInTwitchChat(text) {
  try {
    if (!twitchClient || twitchClient.readyState() !== 'OPEN') return false;
    const channels = twitchClient.getChannels();
    if (!channels || channels.length === 0) return false;
    await twitchClient.say(channels[0], text);
    return true;
  } catch (err) {
    console.error('💬 Failed to send Twitch chat:', err);
    return false;
  }
}

let commercialHelixClient = null;
function createCommercialHelixClient() {
  if (commercialHelixClient) return commercialHelixClient;
  commercialHelixClient = new TwitchCommercialClient({
    fetchFn: fetch,
    getClientId: helixClientId,
    getAccessToken: helixAccessToken,
    getBroadcasterId: async () => {
      if (!twitchUserId) await getUserId();
      return twitchUserId;
    },
  });
  return commercialHelixClient;
}

async function postSocialsToChat({ source } = {}) {
  try {
    const profile = loadProfile(currentActiveProfile);
    const line = formatSocialsLine(normalizeSocials(profile && profile.socials));
    if (!line) {
      return { ok: false, error: 'No social links configured in Preferences' };
    }
    const parts = splitChatMessages(line, TWITCH_CHAT_MAX_LEN);
    for (const part of parts) {
      const sent = await sayInTwitchChat(part);
      if (!sent) {
        return { ok: false, error: 'Twitch chat not connected' };
      }
    }
    console.log(`🔗 Posted socials (${parts.length} message(s))`, source || '');
    return { ok: true, messages: parts };
  } catch (err) {
    console.error('🔗 postSocialsToChat error:', err);
    return { ok: false, error: err.message || String(err) };
  }
}

async function startTwitchCommercial({ length, chatMessage, source } = {}) {
  try {
    const msg = chatMessage != null ? String(chatMessage).trim() : '';
    if (msg) {
      await sayInTwitchChat(msg);
    }
    const helix = createCommercialHelixClient();
    const result = await helix.startCommercial({ length });
    if (!result.ok) {
      if (result.error) {
        await sayInTwitchChat(result.error);
      }
      console.warn('📺 Commercial failed:', result.error || result.reason, source || '');
      return result;
    }
    console.log('📺 Commercial started', result.length, 's', source || '');
    return result;
  } catch (err) {
    const message = err.message || String(err);
    await sayInTwitchChat(message);
    return { ok: false, error: message };
  }
}

async function maybePostTwitchClipToDiscord(clipUrl, title) {
  try {
    const profile = loadProfile(currentActiveProfile);
    const discord = profile && profile.discord;
    if (!shouldPostClipsToDiscord(discord)) return;
    const sent = await jarvisRegistry.invoke('discord_post_clip', {
      clipUrl,
      title: title || 'Stream Clip',
    });
    if (!sent || !sent.success) {
      console.warn('🎬 Discord clip post failed:', sent && sent.error);
    }
  } catch (err) {
    console.warn('🎬 Discord clip post error:', err);
  }
}

async function createTwitchClipAndAnnounce({ requestedBy, source } = {}) {
  try {
    if (!twitchUserId) await getUserId();
    const token = helixAccessToken();
    const clientId = helixClientId();
    const profile = loadProfile(currentActiveProfile);
    const discordConfig = profile && profile.discord;

    const out = await executeTwitchClipHelixFlow({
      broadcasterId: twitchUserId,
      clientId,
      token,
      fetchImpl: fetch,
      requestedBy,
      source,
      lastClipAt: lastTwitchClipAt,
      sayInChat: sayInTwitchChat,
      discordConfig,
      postClipToDiscord: async (clipUrl, title) => {
        await maybePostTwitchClipToDiscord(clipUrl, title);
      },
    });

    if (out.ok && out.clipAt) {
      lastTwitchClipAt = out.clipAt;
      console.log('🎬 Twitch clip ready', out.url, source || '');
    } else if (out.reason && out.reason !== 'cooldown') {
      console.error('🎬 Twitch clip failed:', out.reason);
    }

    const { clipAt, ...rest } = out;
    return rest;
  } catch (err) {
    console.error('🎬 Twitch clip error:', err);
    await sayInTwitchChat("Couldn't create a Twitch clip.");
    return { ok: false, reason: err && err.message };
  }
}

function twitchLoginKey(name) {
  return String(name || '').replace(/^#/, '').trim().toLowerCase();
}

async function getUserId() {
  const wanted = twitchLoginKey(twitchUserName);
  if (twitchUserId && twitchUserIdFor && (!wanted || twitchUserIdFor === wanted)) {
    return twitchUserId;
  }
  const token = helixAccessToken();
  const clientId = helixClientId();
  if (!token || !clientId) {
    throw new Error('Twitch is not connected in VirtualDeck.');
  }
  console.log('Fetching Twitch user ID for', wanted || 'the connected account');
  const response = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data && data.message) || `Twitch user lookup failed (${response.status})`;
    throw new Error(message);
  }
  const match = data.data && data.data[0];
  if (!match || !match.id) {
    throw new Error('Could not fetch Twitch user ID.');
  }
  const login = twitchLoginKey(match.login);
  if (wanted && login && wanted !== login) {
    console.warn(`Twitch token is for ${match.login}, not ${twitchUserName}. Channel points will use ${match.login}.`);
  }
  twitchUserId = match.id;
  twitchUserIdFor = login || wanted || match.id;
  if (match.login) twitchUserName = match.login;
  return twitchUserId;
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
          try {
            appendAiEventsLogLine({
              id: `follow_${f.user_id}_${f.followed_at}`,
              type: 'twitch_follow',
              channel: twitchUserName ? String(twitchUserName).replace(/^#/, '').toLowerCase() : undefined,
              user: {
                id: f.user_id,
                name: f.user_login,
                displayName: f.user_name || f.user_login,
              },
            });
          } catch (e) {
            console.error('[AI Events] follow poll append failed:', e);
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
  vdDebugLog('subscribeEventSub request', type, condition);
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
async function ensureOutgoingRaidEventSub(sessionId) {
  try {
    if (!twitchUserId) await getUserId();
    if (!twitchUserId || !sessionId) return;
    await subscribeEventSub('channel.raid', { from_broadcaster_user_id: twitchUserId }, sessionId);
  } catch (err) {
    console.warn('[Raid Favorites] Could not subscribe to outgoing raids EventSub:', err);
  }
}

async function applyEventSubSubscriptions(sessionId) {
  if (applyingEventSub) {
    console.log('applyEventSubSubscriptions: another apply is running; skipping');
    return;
  }
  applyingEventSub = true;
  try {
    const tc = loadTcConfig() || { topics: [], createdSubscriptions: [] };
    if (!Array.isArray(tc.topics) || tc.topics.length === 0) {
      tc.topics = [
        'channel.channel_points_custom_reward_redemption',
        'channel.subscribe',
        'channel.subscription.gift',
        'channel.subscription.message',
        'channel.follow',
        'channel.raid',
        'channel.cheer',
        'channel.ban',
      ];
      saveTcConfig(tc);
      console.log('[EventSub] No topics were saved. Subscribing to channel point redeems and the other default events.');
    }
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

    await ensureOutgoingRaidEventSub(sessionId);
  } catch (err) {
    console.error('Error applying EventSub subscriptions:', err);
  } finally {
    applyingEventSub = false;
  }
}

function startTwitchEventSub({ username, oauth, clientId}) {
  console.log('Starting Twitch EventSub for user:', username);
  const generation = ++eventSubGeneration;
  twitchUserName = username;
  twitchToken = String(oauth || '').replace('oauth:', '');
  if (clientId) twitchClientId = clientId;
  eventSubRegistered = false;
  eventSubSessionId = null;
  if (eventSubWs) {
    try { eventSubWs.close(); } catch (e) {}
    eventSubWs = null;
  }
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  getUserId().then((userId) => {
    if (generation !== eventSubGeneration) return;
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

    pollIntervalId = setInterval(pollFollowers, 30000);
    pollFollowers();
    // create and store the EventSub websocket so we can close it later if needed
    eventSubWs = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
    eventSubWs.on('open', () => {
      console.log('EventSub WebSocket connected');
    });
    eventSubWs.on('message', async (data) => {
      if (generation !== eventSubGeneration) return;
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
        appendAiEventSubToLog(type, eventData, msg.metadata && msg.metadata.message_id);
        handleRaidEventSubNotification(type, eventData);
      }
    });
    eventSubWs.on('error', (err) => {
      console.error('EventSub WebSocket error:', err);
    });
    eventSubWs.on('close', () => {
      if (generation !== eventSubGeneration) return;
      console.log('EventSub WebSocket closed');
      eventSubWs = null;
      eventSubRegistered = false;
      eventSubSessionId = null;
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
        const profile = loadProfile(currentActiveProfile);
        const commandText = evt.message.split(' ')[0].substring(1).toLowerCase();
        profile.buttons.forEach((btn) => {
          // Check if button has chat command enabled and keyword matches
          if (btn.chatCommand && btn.chatCommand.enabled && btn.chatCommand.keyword && btn.chatCommand.keyword.toLowerCase() === commandText) {
            const triggerMethod = btn.chatCommand.triggerMethod || 'command';
            if (triggerMethod === 'command' || triggerMethod === 'both') {
              triggerButtonWithDebounce(btn.label || btn.name, `fake chat command !${commandText}`);
            }
          }
          // Legacy support: Only check old 'command' type buttons if no modern chatCommand exists
          else if (!btn.chatCommand && btn.type === 'command' && btn.label.toLowerCase() === commandText) {
            triggerButtonWithDebounce(btn.label, `fake legacy chat command !${commandText}`);
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
        const profile = loadProfile(currentActiveProfile);
        const commandText = evt.message.split(' ')[0].substring(1).toLowerCase();
        profile.buttons.forEach((btn) => {
          // Check if button has chat command enabled and keyword matches
          if (btn.chatCommand && btn.chatCommand.enabled && btn.chatCommand.keyword && btn.chatCommand.keyword.toLowerCase() === commandText) {
            const triggerMethod = btn.chatCommand.triggerMethod || 'command';
            if (triggerMethod === 'command' || triggerMethod === 'both') {
              triggerButtonWithDebounce(btn.label || btn.name, `fake event handle chat command !${commandText}`);
            }
          }
          // Legacy support: Only check old 'command' type buttons if no modern chatCommand exists
          else if (!btn.chatCommand && btn.type === 'command' && btn.label.toLowerCase() === commandText) {
            triggerButtonWithDebounce(btn.label, `fake event handle legacy chat command !${commandText}`);
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
    triggerButtonWithDebounce(label, 'renderer mapping');
  } catch (e) {
    console.error('Error handling trigger-media-to-main:', e);
  }
});

function registerHotkeys() {
  // While suspended (typing in VirtualDeck / modal open) keep shortcuts off; they are
  // registered from the current profile as soon as the suspension ends.
  if (typeof hotkeySuspension !== 'undefined' && hotkeySuspension.shouldSuspend()) {
    globalShortcut.unregisterAll();
    hotkeySuspension.suspendedNow = true;
    return;
  }
  registerHotkeysNow();
}

function registerHotkeysNow() {
  globalShortcut.unregisterAll();
  // Load buttons from active profile
  const profile = loadProfile(currentActiveProfile);
  const unlimited = licenseManager ? licenseManager.getEntitlements().unlimitedButtons : true;
  const deck = computeButtonEntitlements(profile, unlimited);
  const buttons = deck.ordered || profile.buttons || [];
  buttons.forEach((btn) => {
    if (btn && btn.id && deck.lockedIds && deck.lockedIds.has(btn.id)) {
      return;
    }
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
  // unregisterAll above also cleared macro hotkeys; register them again after the buttons.
  syncMacroHotkeys();
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

function initAppUpdater() {
  if (appUpdater) return appUpdater;
  appUpdater = createAppUpdater({
    autoUpdater,
    dialog,
    shell,
    getWin: () => win,
    getPreferences: getStoredPreferences,
    sendToRenderer: sendUpdateEventToRenderer,
    isPackaged: () => app.isPackaged,
  });
  return appUpdater;
}

function checkForUpdates() {
  initAppUpdater().checkForUpdates({ manual: true });
}

app.whenReady().then(() => {
  try {
    ensureUserData();
  } catch (err) {
    console.error('[startup] ensureUserData failed:', err);
  }
  // Ensure AI TTS sounds directory exists
  if (!fs.existsSync(aiTtsSoundsDir)) {
    fs.mkdirSync(aiTtsSoundsDir, { recursive: true });
  }
  if (licenseManager && licenseManager.canUseAiAssistant().allowed) {
    startAICommandWatcher();
  } else {
    console.log('[AI Audio] Command watcher not started (VirtualDeck Pro license required)');
  }
  createWindow();
  try {
    initTwitchOAuthHost();
    setTimeout(() => {
      twitchOAuthHost.connectFromStoredSession().then((result) => {
        if (result && result.ok) {
          console.log('[Twitch OAuth] Restored session for', result.username);
        }
      }).catch((err) => {
        console.warn('[Twitch OAuth] Session restore failed:', err.message || err);
      });
    }, 1200);
  } catch (err) {
    console.warn('[Twitch OAuth] Host init failed:', err.message || err);
  }
  registerHotkeys();
  startOverlayServer();
  startJarvisServer();
  ravenHost.setOpenPreferences(() => {
    if (win && !win.isDestroyed()) {
      win.show();
      win.webContents.send('open-preferences');
    }
  });
  ravenHost.setLicenseGate(() => {
    if (!licenseManager) return { allowed: true };
    return licenseManager.canUseAiAssistant();
  });
  ravenHost.maybeAutoStart();
  
  initAppUpdater();
  setTimeout(() => {
    initAppUpdater().maybeCheckOnStartup();
  }, 3000);
  
  // Setting menuItem.checked fires the click handler. Ignore those echoes so
  // syncing the View menu cannot hide a panel the user left visible.
  let applyingViewMenuSync = false;
  function sendViewToggle(key, checked) {
    if (applyingViewMenuSync) return;
    if (win && !win.isDestroyed()) win.webContents.send('view-toggle', { key: key, checked: checked });
  }

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
  { id: 'view_sound_grid', label: 'Sound Grid', type: 'checkbox', checked: true, click: (menuItem) => { sendViewToggle('sound-grid', menuItem.checked); } },
  { id: 'view_twitch_stats', label: 'Twitch Statistics', type: 'checkbox', checked: true, click: (menuItem) => { sendViewToggle('twitch-stats-container', menuItem.checked); } },
  { id: 'view_recent_activity', label: 'Recent Activity', type: 'checkbox', checked: false, click: (menuItem) => { sendViewToggle('recent-activity-container', menuItem.checked); } },
  { id: 'view_twitch_chat', label: 'Twitch Chat', type: 'checkbox', checked: false, click: (menuItem) => { sendViewToggle('twitch-chat-container', menuItem.checked); } },
  { id: 'view_sound_controls', label: 'Sound Controls', type: 'checkbox', checked: true, click: (menuItem) => { sendViewToggle('sound-controls', menuItem.checked); } },
  { id: 'view_ai_dashboard', label: 'AI Dashboard', type: 'checkbox', checked: true, click: (menuItem) => { sendViewToggle('ai-dashboard-controls', menuItem.checked); } }
    ] },
    { label: 'Profile', submenu: [
      { label: 'Profile Manager...', click: () => { if (win && !win.isDestroyed()) win.webContents.send('open-profile-manager'); } }
    ] },
    { label: 'Tools', submenu: [
      { label: 'Check for Updates...', click: () => { checkForUpdates(); } },
      { type: 'separator' },
      { label: 'Developer Tools', accelerator: 'F12', click: () => { if (win && !win.isDestroyed()) win.webContents.toggleDevTools(); } },
      { label: 'Back up check-ins...', click: () => { runBackupDailyCheckinsDialog(); } },
      { label: 'Restore check-ins...', click: () => { runRestoreDailyCheckinsDialog(); } },
      { type: 'separator' },
      { label: 'Twitch Setup', submenu: [
          { label: 'View Twitch Events / Test Events', click: () => { if (win && !win.isDestroyed()) win.webContents.send('open-twitch-activity'); } },
          { label: 'EventSub Subscriptions (Select)', click: () => { if (win && !win.isDestroyed()) win.webContents.send('open-eventsub-subscriptions'); } },
          { label: 'Twitch Event Mapping', click: () => { if (win && !win.isDestroyed()) win.webContents.send('open-twitch-mapping'); } },
        { type: 'separator' },
        { label: 'Clear Twitch Credentials', click: () => { if (win && !win.isDestroyed()) win.webContents.send('clear-twitch-creds'); } }
      ] },
      { label: 'Raven AI', submenu: filterRavenMenuItems(ravenHost.menuTemplateItems(), app.isPackaged) },
      { type: 'separator' },
      { label: 'Themes', submenu: [] }, // Will be populated dynamically with themes and skins
      { role: 'reload' }
    ] },
    { label: 'Help', submenu: [ 
      { label: 'Report Bug', click: async () => {
        try {
          const { shell } = require('electron');
          const bugReportUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdHUauA7LI_bJtfKRKrbD81lZ8Xs6R3egGOEalqAF2KHUNDdg/viewform';
          await shell.openExternal(bugReportUrl);
        } catch (error) {
          console.error('Error opening bug report form:', error);
        }
      } },
      { type: 'separator' },
      { label: 'About', click: () => {
        if (win && !win.isDestroyed()) win.webContents.send('show-about');
      } } 
    ] }
  ];
  // Function to rebuild menu with integrated themes and skins
  async function rebuildMenu() {
    try {
      console.log('Rebuilding menu with themes and skins...');
      // Get available skins using recursive search
      const skins = [];
      if (fs.existsSync(userSkinsDir)) {
        const skinFiles = findSkinFiles(userSkinsDir);
        console.log(`Found ${skinFiles.length} skin files in skins directory (including subdirectories)`);
        
        for (const skinPath of skinFiles) {
          try {
            const skinData = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
            if (skinData.name && skinData.version) {
              const relativePath = path.relative(userSkinsDir, skinPath);
              const id = relativePath.replace(/\\/g, '/').replace(/\.json$/, '');
              
              skins.push({
                id: id,
                name: skinData.name,
                description: skinData.description || '',
                version: skinData.version,
                author: skinData.author || '',
                filename: path.basename(skinPath)
              });
            }
          } catch (err) {
            console.warn(`Failed to parse skin file ${skinPath}:`, err);
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
      
      const appMenu = Menu.buildFromTemplate(filterMenuTemplateForPackaged(menuTemplate, app.isPackaged));
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
      applyingViewMenuSync = true;
      try {
        Object.keys(mapping).forEach(componentId => {
          if (!prefs || !Object.prototype.hasOwnProperty.call(prefs, componentId)) return;
          const itemId = mapping[componentId];
          const mi = menu.getMenuItemById ? menu.getMenuItemById(itemId) : null;
          const desired = !!prefs[componentId];
          if (mi && typeof mi.checked !== 'undefined' && mi.checked !== desired) {
            mi.checked = desired;
          }
        });
      } finally {
        applyingViewMenuSync = false;
      }
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

  // Get auth token for display in settings
  ipcMain.handle('get-auth-token', async () => {
    return securityManager.getOrCreateToken();
  });

  // Get auth token file path
  ipcMain.handle('get-auth-token-path', async () => {
    return securityManager.tokenPath;
  });

  ipcMain.handle('raven-get-setup-status', async () => ravenHost.getSetupStatus());

  ipcMain.handle('raven-save-api-keys', async (_event, payload) => {
    try {
      if (!licenseManager || !licenseManager.canUseAiAssistant().allowed) {
        return { success: false, error: 'VirtualDeck Pro license required for Raven AI' };
      }
      const updates = {};
      if (payload && payload.llmApiKey) updates.llmApiKey = payload.llmApiKey;
      if (payload && payload.ttsApiKey) updates.ttsApiKey = payload.ttsApiKey;
      if (!updates.llmApiKey && !updates.ttsApiKey) {
        return { success: false, error: 'Enter at least one API key to save' };
      }
      // Validate before saving so a typo never silently breaks Raven.
      // Network failures don't block saving (offline setup), but real rejections do.
      const { testOpenAiApiKey, testElevenLabsApiKey } = require('./lib/raven-llm-test');
      const warnings = [];
      if (!(payload && payload.skipValidation)) {
        if (updates.llmApiKey) {
          const r = await testOpenAiApiKey(updates.llmApiKey);
          if (!r.ok && r.kind !== 'network' && r.kind !== 'no_credit') return { success: false, field: 'llm', error: r.error };
          if (!r.ok) warnings.push(r.error);
        }
        if (updates.ttsApiKey) {
          const r = await testElevenLabsApiKey(updates.ttsApiKey);
          if (!r.ok && r.kind !== 'network') return { success: false, field: 'tts', error: r.error };
          if (!r.ok) warnings.push(r.error);
          if (r.warning) warnings.push(r.warning);
        }
      }
      const status = ravenHost.updateApiKeys(updates);
      const restart = ravenHost.restartRavenIfRunning();
      return { success: true, status, restart, warnings };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  });

  function probeLocalHttpStatus(url, timeoutMs = 1200) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (status) => {
        if (settled) return;
        settled = true;
        resolve(status);
      };
      try {
        const req = http.get(url, (res) => {
          res.resume();
          finish(typeof res.statusCode === 'number' ? res.statusCode : null);
        });
        req.setTimeout(timeoutMs, () => {
          req.destroy();
          finish(null);
        });
        req.on('error', () => finish(null));
      } catch (err) {
        finish(null);
      }
    });
  }

  function fetchLocalJson(url, timeoutMs = 1500) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };
      try {
        const req = http.get(url, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const status = typeof res.statusCode === 'number' ? res.statusCode : null;
            const raw = Buffer.concat(chunks).toString('utf8');
            let body = null;
            try {
              body = raw ? JSON.parse(raw) : null;
            } catch {
              body = null;
            }
            finish({
              ok: status !== null && status >= 200 && status < 300,
              status,
              body,
            });
          });
        });
        req.setTimeout(timeoutMs, () => {
          req.destroy();
          finish({ ok: false, status: null, body: null });
        });
        req.on('error', () => finish({ ok: false, status: null, body: null }));
      } catch (err) {
        finish({ ok: false, status: null, body: null });
      }
    });
  }

  async function probeLocalHttp(url) {
    const status = await probeLocalHttpStatus(url);
    return status !== null && status >= 200 && status < 300;
  }

  ipcMain.handle('raven-is-running', async () => ({ running: ravenHost.isRunning() }));

  ipcMain.handle('raven-connection-status', async () => {
    const running = ravenHost.isRunning();
    // AITuber controller (Raven brain): default 3004; sidecar may use +10 offset (3014) if 3004 is busy.
    const controllerStatusCandidates = [
      'http://127.0.0.1:3004/api/ai/status',
      'http://127.0.0.1:3014/api/ai/status',
    ];
    let controllerProbe = { ok: false, status: null, body: null };
    let controllerStatusUrl = controllerStatusCandidates[0];
    for (const url of controllerStatusCandidates) {
      const probe = await fetchLocalJson(url);
      if (probe.ok) {
        controllerProbe = probe;
        controllerStatusUrl = url;
        break;
      }
      if (probe.status !== null) controllerProbe = probe;
    }
    const controllerOk = controllerProbe.ok;
    const bridgeStatus = await probeLocalHttpStatus('http://127.0.0.1:3000/api/ai/enabled');
    const bridgeOk = bridgeStatus !== null && bridgeStatus < 500;
    const connected = controllerOk || bridgeOk;
    let source = 'offline';
    if (controllerOk) source = 'controller';
    else if (bridgeOk) source = bridgeStatus === 404 || bridgeStatus === 405 ? 'bridge-legacy' : 'bridge';
    else if (running) source = 'process';
    const aiStatus = controllerProbe.body && typeof controllerProbe.body === 'object' ? controllerProbe.body : null;
    const userData = app.getPath('userData');
    return {
      running,
      connected: connected || running,
      httpReachable: connected,
      source: connected ? source : (running ? 'process' : 'offline'),
      controllerOk,
      bridgeStatus,
      aiStatus,
      logPaths: {
        raven: path.join(userData, 'raven.log'),
        aiAudioWatcher: path.join(userData, 'ai-audio-watcher.log'),
      },
      statusUrl: controllerStatusUrl,
      statusUrls: controllerStatusCandidates,
    };
  });

  ipcMain.handle('raven-test-llm-key', async (_event, payload) => {
    try {
      if (!licenseManager || !licenseManager.canUseAiAssistant().allowed) {
        return { ok: false, error: 'VirtualDeck Pro license required' };
      }
      const { testOpenAiApiKey } = require('./lib/raven-llm-test');
      let key = payload && payload.apiKey ? String(payload.apiKey).trim() : '';
      if (!key) {
        key = ravenHost.readEnvValue('LLM_API_KEY');
        if (!key) {
          return { ok: false, error: 'Enter an API key or save one first' };
        }
      }
      return await testOpenAiApiKey(key);
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('raven-test-tts-key', async (_event, payload) => {
    try {
      if (!licenseManager || !licenseManager.canUseAiAssistant().allowed) {
        return { ok: false, error: 'VirtualDeck Pro license required' };
      }
      const { testElevenLabsApiKey } = require('./lib/raven-llm-test');
      let key = payload && payload.apiKey ? String(payload.apiKey).trim() : '';
      if (!key) {
        key = ravenHost.readEnvValue('TTS_API_KEY');
        if (!key) return { ok: false, error: 'Enter an API key or save one first' };
      }
      return await testElevenLabsApiKey(key);
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('raven-open-env-file', async () => {
    ravenHost.openEnvFile();
    return { success: true };
  });

  ipcMain.handle('raven-start', async () => {
    try {
      ravenHost.startRaven();
      return { success: true, running: ravenHost.isRunning() };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('raven-stop', async () => {
    try {
      ravenHost.stopRaven();
      return { success: true, running: ravenHost.isRunning() };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('raven-restart', async () => {
    try {
      const result = ravenHost.restartRaven();
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('license-get-status', async () => {
    if (!licenseManager) {
      return {
        licensed: false,
        aiAssistant: false,
        unlimitedButtons: false,
        maxButtons: 15,
        status: 'unavailable',
        message: 'License manager not initialized',
      };
    }
    return licenseManager.getStatusForUi();
  });

  ipcMain.handle('license-get-deck-entitlements', async () => {
    if (!licenseManager) {
      return { licensed: false, unlimitedButtons: false, canAddButton: true, lockedButtonIds: [], activeButtonIds: [] };
    }
    const profile = loadProfile(currentActiveProfile);
    const deck = licenseManager.getButtonEntitlementsForProfile(profile);
    const locked = deck.lockedButtonIds || (deck.lockedIds ? Array.from(deck.lockedIds) : []);
    const active = deck.activeButtonIds || (deck.activeIds ? Array.from(deck.activeIds) : []);
    return {
      licensed: !!deck.licensed,
      unlimitedButtons: !!deck.unlimitedButtons,
      aiAssistant: !!deck.aiAssistant,
      canAddButton: deck.canAddButton !== false,
      maxActiveButtons: deck.maxActiveButtons == null ? null : deck.maxActiveButtons,
      buttonCount: deck.buttonCount || 0,
      lockedButtonIds: locked,
      activeButtonIds: active,
      status: deck.status || null,
      message: deck.message || '',
    };
  });

  ipcMain.handle('license-activate', async (_event, licenseKey) => {
    if (!licenseManager) {
      return { success: false, error: 'License manager not initialized' };
    }
    const result = await licenseManager.activate(licenseKey);
    if (result.success) {
      registerHotkeys();
      try {
        ravenHost.stopRaven();
      } catch (e) {
        // ignore
      }
    }
    return result;
  });

  ipcMain.handle('license-deactivate', async () => {
    if (!licenseManager) {
      return { success: false, error: 'License manager not initialized' };
    }
    try {
      ravenHost.stopRaven();
    } catch (e) {
      // ignore
    }
    const result = await licenseManager.deactivate();
    registerHotkeys();
    return result;
  });

  ipcMain.handle('license-revalidate', async () => {
    if (!licenseManager) {
      return { success: false, error: 'License manager not initialized' };
    }
    return licenseManager.revalidate();
  });

  ipcMain.handle('raven-dev-speak', async (_event, payload) => {
    try {
      if (licenseManager) {
        const aiGate = licenseManager.canUseAiAssistant();
        if (!aiGate.allowed) {
          return { ok: false, error: aiGate.message };
        }
      }
      const text = payload && payload.text;
      let storedDevBase = null;
      try {
        const tc = loadTcConfig();
        storedDevBase = tc.devApiBaseUrl || null;
      } catch (e) {
        storedDevBase = null;
      }
      return await speakViaDevApi(
        {
          fetchFn: fetch,
          userDataPath,
          overlayPort: overlayServerPort || 8080,
          aiCommandsPath,
          getMainWindow: () => win,
          handleAIAudioCommands,
          storedDevBaseUrl: storedDevBase,
        },
        text,
      );
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('preview-ai-voice', async (_event, payload) => {
    try {
      if (licenseManager) {
        const aiGate = licenseManager.canUseAiAssistant();
        if (!aiGate.allowed) {
          return { success: false, error: aiGate.message };
        }
      }
      if (!aiConfigManager) {
        return { success: false, error: 'AI configuration is not available' };
      }
      const validated = validateVoicePreviewRequest(payload);
      if (!validated.ok) {
        return { success: false, error: validated.error };
      }
      const config = aiConfigManager.readConfig();
      return await fetchVoicePreviewAudio({
        voiceId: validated.voiceId,
        previewUrl: validated.previewUrl,
        apiKey: aiConfigManager.getTTSApiKey(),
        configMap: config,
      });
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : 'Preview failed' };
    }
  });

  // Handle preferences save from renderer
  ipcMain.on('save-preferences', (event, preferences) => {
    try {
      console.log('Saving preferences:', preferences);
      saveStoredPreferences(preferences);
      if (preferences && Array.isArray(preferences.socials)) {
        const profile = loadProfile(currentActiveProfile);
        profile.socials = normalizeSocials(preferences.socials);
        saveProfile(currentActiveProfile, profile);
        updateJarvisContext();
      }
    } catch (e) { console.warn('save-preferences failed', e); }
  });

  // Handle manual check for updates from renderer
  ipcMain.on('check-for-updates', () => {
    try {
      console.log('Manual update check requested from preferences');
      initAppUpdater().checkForUpdates({ manual: true });
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
  try { ravenHost.stopRaven(); } catch (e) {}
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
    // Stop stream monitor for hydration
    stopStreamMonitor();
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
      if (twitchOAuthHost) {
        const cleared = twitchOAuthHost.clearOAuthSessionFields(tc);
        saveTcConfig(cleared);
      } else {
        saveTcConfig(tc);
      }
      // attach deletionResults and purgedTopics to the result object below
      // will be sent to renderer once teardown completes
      event.deletionResults = deletionResults;
      event.purgedTopics = purgedTopics;
    } catch (e) { console.warn('Error cleaning created subscriptions state', e); }
    // Disconnect chat client
    try {
      await stopTwitchChatConnection();
      console.log('Disconnected twitch chat client');
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
      firstTimeChatters.clear();

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

// JARVIS API IPC handlers - for renderer to respond to tool calls
ipcMain.on('jarvis-scenes-response', (event, scenes) => {
  // This is handled by the get_scenes tool promise
});

// ---------- Streaming-app scene providers (Meld / OBS / Streamlabs) ----------
const pendingSceneProviderRequests = new Map();
let sceneProviderReqSeq = 0;
ipcMain.on('scene-provider-response', (event, msg) => {
  if (!msg || !pendingSceneProviderRequests.has(msg.reqId)) return;
  const resolve = pendingSceneProviderRequests.get(msg.reqId);
  pendingSceneProviderRequests.delete(msg.reqId);
  resolve(msg);
});
function meldSceneBridge(op, payload = {}) {
  if (!win || win.isDestroyed()) return Promise.resolve({ ok: false, error: 'VirtualDeck window not available' });
  const reqId = ++sceneProviderReqSeq;
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      pendingSceneProviderRequests.delete(reqId);
      resolve({ ok: false, error: 'Meld Studio did not respond' });
    }, 3000);
    pendingSceneProviderRequests.set(reqId, (msg) => { clearTimeout(t); resolve(msg); });
    win.webContents.send('scene-provider-request', { reqId, op, ...payload });
  });
}
let obsSessionPassword = null; // used only when safeStorage is unavailable (never written to disk)
function getObsSceneConfig() {
  const prefs = getStoredPreferences();
  const cfg = prefs.obsWebsocket || {};
  let password = process.env.VD_OBS_WS_PASSWORD || '';
  if (!password && cfg.passwordEncrypted && safeStorage.isEncryptionAvailable()) {
    try { password = safeStorage.decryptString(Buffer.from(cfg.passwordEncrypted, 'base64')); } catch (e) { console.warn('[Scenes] Could not decrypt OBS password'); }
  }
  if (!password && obsSessionPassword) password = obsSessionPassword;
  return { url: process.env.VD_OBS_WS_URL || cfg.url || DEFAULT_OBS_URL, password };
}
const sceneProviders = new SceneProviders({
  meldBridge: meldSceneBridge,
  getObsConfig: getObsSceneConfig,
  streamlabsRequest: (opts) => streamlabsTcpRequest({
    host: process.env.VD_STREAMLABS_TCP_HOST || undefined,
    port: Number(process.env.VD_STREAMLABS_TCP_PORT) || undefined,
    ...opts,
  }),
});
jarvisRegistry.setContext({ sceneProvider: sceneProviders });

ipcMain.handle('list-streaming-scenes', async (event, opts = {}) => {
  const app = opts && ['meld', 'obs', 'streamlabs'].includes(opts.app) ? opts.app : undefined;
  return sceneProviders.listScenes({ app });
});
ipcMain.handle('get-obs-scene-config', async () => {
  const cfg = getObsSceneConfig();
  return { url: cfg.url, hasPassword: !!cfg.password };
});
ipcMain.handle('set-obs-scene-config', async (event, data = {}) => {
  const url = String((data && data.url) || '').trim() || DEFAULT_OBS_URL;
  if (!/^wss?:\/\/[^\s]+$/i.test(url)) return { success: false, error: 'URL must start with ws:// or wss://' };
  const prefs = getStoredPreferences();
  const next = { ...(prefs.obsWebsocket || {}), url };
  let note;
  if (typeof data.password === 'string') {
    if (!data.password) {
      delete next.passwordEncrypted; obsSessionPassword = null;
    } else if (safeStorage.isEncryptionAvailable()) {
      next.passwordEncrypted = safeStorage.encryptString(data.password).toString('base64');
    } else {
      obsSessionPassword = data.password;
      note = 'password kept for this session only; secure storage unavailable';
    }
  }
  prefs.obsWebsocket = next;
  saveStoredPreferences(prefs);
  return { success: true, note };
});

// Update JARVIS context when config or connections change
function updateJarvisContext() {
  if (jarvisRegistry) {
    const currentProfile = loadProfile(currentActiveProfile);
    jarvisRegistry.setContext({
      win,
      twitchClient,
      twitchChannel: twitchUserName ? `#${twitchUserName}` : null,
      twitchUserName,
      config: currentProfile,
      currentActiveProfile,
      loadProfile,
      triggerButtonFn: triggerButtonWithDebounce,
      triggerDeckButtonFn: triggerDeckButton,
      macroManager,
      createTwitchClip: createTwitchClipAndAnnounce,
      postSocialsToChat,
      startTwitchCommercial,
      meldRecordClip: async () => {
        const r = await meldSceneBridge('recordClip');
        return r && r.ok ? { ok: true } : { ok: false, reason: (r && (r.error || r.reason)) || 'meld-record-failed' };
      },
      ...buildJarvisRaidContext(),
    });
  }
}

ipcMain.handle('create-twitch-clip', async (event, opts = {}) => {
  return await createTwitchClipAndAnnounce({
    requestedBy: opts.requestedBy || 'Deck',
    source: opts.source || 'button',
  });
});

ipcMain.handle('post-socials', async (_event, opts = {}) => {
  const out = await postSocialsToChat({ source: opts.source || 'button' });
  return out;
});

ipcMain.handle('start-twitch-commercial', async (_event, opts = {}) => {
  const out = await startTwitchCommercial({
    length: opts.length,
    chatMessage: opts.chatMessage,
    source: opts.source || 'button',
  });
  if (!out.ok) {
    return {
      success: false,
      error: out.error,
      needsReconnect: !!out.needsReconnect,
      retry_after: out.retry_after,
      reason: out.reason,
    };
  }
  return { success: true, length: out.length, retry_after: out.retry_after };
});
