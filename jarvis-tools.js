/**
 * JARVIS Tool Registry & Handlers
 * 
 * Provides a controlled set of tool APIs for LLM brain integration.
 * Each tool has a name, description, JSON schema for parameters, and a handler function.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { normalizeTwitchLogin, isValidTwitchLogin } = require('./lib/twitch-login');
const { matchMacroByUtterance, summarizeMacroRun } = require('./lib/macro-voice');
const { applyMacroTemplateVars, mergeClipResultIntoMacroVars } = require('./lib/twitch-clips');
const { replacePlaceholders, appendSocialsToUserData } = require('./lib/alert-placeholders');
const { formatSocialsLine, normalizeSocials, splitChatMessages } = require('./lib/socials');

class JarvisToolRegistry {
  constructor() {
    this.tools = new Map();
    this.context = {}; // Will be populated with references from main.js
  }

  /**
   * Register a tool with its schema and handler
   * @param {string} name - Tool name (snake_case)
   * @param {object} schema - { description, parameters: { type, properties, required } }
   * @param {function} handler - async (args, context) => result
   */
  register(name, schema, handler) {
    this.tools.set(name, {
      name,
      ...schema,
      handler
    });
  }

  /**
   * Get all registered tools (for listing)
   */
  list() {
    const result = [];
    for (const [name, tool] of this.tools.entries()) {
      result.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      });
    }
    return result;
  }

  /**
   * Get a specific tool by name
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * Invoke a tool by name with arguments
   * @param {string} name - Tool name
   * @param {object} args - Arguments object
   * @returns {Promise<object>} - { success: boolean, result?: any, error?: string }
   */
  async invoke(name, args = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`
      };
    }

    try {
      const result = await tool.handler(args, this.context);
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error(`[JARVIS] Error invoking tool '${name}':`, error);
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }

  /**
   * Set context references from main.js (win, twitchClient, config, etc.)
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }
}

// Create singleton registry
const registry = new JarvisToolRegistry();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

// Tool: launch_app
registry.register(
  'launch_app',
  {
    description: 'Launch an application by name or path',
    parameters: {
      type: 'object',
      properties: {
        nameOrPath: {
          type: 'string',
          description: 'Application name or full path to executable'
        },
        args: {
          type: 'string',
          description: 'Optional command-line arguments',
          default: ''
        }
      },
      required: ['nameOrPath']
    }
  },
  async (args, context) => {
    const { nameOrPath, args: cmdArgs = '' } = args;
    
    return new Promise((resolve) => {
      const argsArray = cmdArgs ? cmdArgs.split(' ') : [];
      
      execFile(nameOrPath, argsArray, (error) => {
        if (error) {
          resolve({
            launched: false,
            error: error.message
          });
        } else {
          resolve({
            launched: true,
            app: nameOrPath
          });
        }
      });
    });
  }
);

// Tool: change_scene
registry.register(
  'change_scene',
  {
    description: 'Switch scene in the connected streaming app (Meld Studio, OBS or Streamlabs Desktop). The scene is validated against the app\'s live scene list.',
    parameters: {
      type: 'object',
      properties: {
        sceneName: {
          type: 'string',
          description: 'Name of the scene to switch to (or sceneId if known)'
        },
        app: {
          type: 'string',
          enum: ['meld', 'obs', 'streamlabs'],
          description: 'Optional: which streaming app to use. Omit to auto-detect the connected app.'
        }
      },
      required: ['sceneName']
    }
  },
  async (args, context) => {
    const { sceneName } = args;
    const { win } = context;

    if (context.sceneProvider) {
      const app = ['meld', 'obs', 'streamlabs'].includes(args.app) ? args.app : undefined;
      return context.sceneProvider.switchScene({ sceneName, app });
    }
    
    if (!win || win.isDestroyed()) {
      return {
        success: false,
        error: 'VirtualDeck window not available'
      };
    }

    // Send scene change request to renderer via IPC
    // The renderer will handle meldClient.showScene
    return new Promise((resolve) => {
      win.webContents.send('jarvis-change-scene', { sceneName });
      
      // Give it a moment to process
      setTimeout(() => {
        resolve({
          success: true,
          scene: sceneName,
          note: 'Scene change requested via Meld client'
        });
      }, 100);
    });
  }
);

// Tool: refresh_browser_sources
registry.register(
  'refresh_browser_sources',
  {
    description: 'Refresh browser sources in the current Meld Studio scene by toggling visibility',
    parameters: {
      type: 'object',
      properties: {
        layerName: {
          type: 'string',
          description: 'Optional: name of specific browser source layer to refresh. If not provided, all browser sources in the current scene will be refreshed.'
        },
        waitForSceneName: {
          type: 'string',
          description: 'Optional: scene name to wait for before refreshing (use when calling after change_scene to avoid race condition). Will poll up to 3 seconds for the scene to become active.'
        }
      }
    }
  },
  async (args, context) => {
    const { layerName, waitForSceneName } = args;
    const { win } = context;
    
    if (!win || win.isDestroyed()) {
      return {
        success: false,
        error: 'VirtualDeck window not available'
      };
    }

    return new Promise((resolve) => {
      win.webContents.send('jarvis-refresh-browser-sources', { layerName, waitForSceneName });
      
      setTimeout(() => {
        resolve({
          success: true,
          layerName: layerName || 'all',
          waitForSceneName: waitForSceneName || null,
          note: 'Browser source refresh requested via Meld client'
        });
      }, 100);
    });
  }
);

// Tool: get_stream_status
registry.register(
  'get_stream_status',
  {
    description: 'Get current streaming status and configuration',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  async (args, context) => {
    const { twitchClient, twitchChannel, twitchUserName } = context;
    
    return {
      connected: twitchClient && twitchClient.readyState() === 'OPEN',
      channel: twitchChannel || null,
      username: twitchUserName || null,
      overlayServerRunning: true, // VirtualDeck overlay server runs on port 8080
      overlayPort: 8080
    };
  }
);

// Tool: set_volume
registry.register(
  'set_volume',
  {
    description: 'Set volume level for a target audio source',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Audio target (e.g. "master", "media", "mic")',
          enum: ['master', 'media', 'mic']
        },
        level: {
          type: 'number',
          description: 'Volume level (0-100)',
          minimum: 0,
          maximum: 100
        }
      },
      required: ['target', 'level']
    }
  },
  async (args, context) => {
    const { target, level } = args;
    
    // TODO: Wire to VirtualDeck audio control when available
    // Implementation path:
    // 1. Check if VirtualDeck has system audio control APIs (Windows: nircmd or loudness-windows)
    // 2. For 'master': control system master volume
    // 3. For 'media': control media/application volume
    // 4. For 'mic': control microphone input level
    // 5. May require adding audio control dependency to package.json
    // 
    // Stub implementation - do not fake success for now
    return {
      success: false,
      target,
      level,
      error: 'Volume control not yet wired - requires audio API integration'
    };
  }
);

// Tool: mute_mic
registry.register(
  'mute_mic',
  {
    description: 'Mute the microphone',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  async (args, context) => {
    // TODO: Wire to VirtualDeck microphone control when available
    // Implementation path:
    // 1. Check if VirtualDeck has mic mute APIs (Windows: nircmd or audio device control)
    // 2. Set mic input level to 0 or mute via system API
    // 3. Store mute state for unmute_mic tool
    // 4. May require adding audio control dependency to package.json
    // 
    // Stub implementation - do not fake success for now
    return {
      success: false,
      error: 'Microphone control not yet wired - requires audio API integration'
    };
  }
);

// Tool: unmute_mic
registry.register(
  'unmute_mic',
  {
    description: 'Unmute the microphone',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  async (args, context) => {
    // TODO: Wire to VirtualDeck microphone control when available
    // Implementation path:
    // 1. Check if VirtualDeck has mic mute APIs (Windows: nircmd or audio device control)
    // 2. Restore mic input level to previous state or unmute via system API
    // 3. Retrieve stored mute state from mute_mic tool
    // 4. May require adding audio control dependency to package.json
    // 
    // Stub implementation - do not fake success for now
    return {
      success: false,
      error: 'Microphone control not yet wired - requires audio API integration'
    };
  }
);

// Tool: play_sound
registry.register(
  'play_sound',
  {
    description: 'Play a sound or alert from VirtualDeck library',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name or label of the sound to play'
        }
      },
      required: ['name']
    }
  },
  async (args, context) => {
    const { name } = args;
    const { win } = context;
    
    if (!win || win.isDestroyed()) {
      return {
        success: false,
        error: 'VirtualDeck window not available'
      };
    }

    // Use existing trigger-media mechanism
    win.webContents.send('trigger-media', name);
    
    return {
      success: true,
      sound: name,
      note: 'Sound triggered via VirtualDeck media system'
    };
  }
);

// Shared macro step runner. Used by run_macro (and by main.js executeMacroById, the single executor
// for the Test/Run buttons, global hotkeys and JARVIS/voice) so every trigger runs the same steps.
registry.runMacroSteps = async function runMacroSteps(macro) {
  const steps = Array.isArray(macro.steps) ? macro.steps : [];
  const results = [];
  let macroVars = {};
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`[JARVIS] Executing macro step ${i + 1}/${steps.length}: ${step.tool}`);
    try {
      const args = applyMacroTemplateVars(step.arguments || {}, macroVars);
      const result = await registry.invoke(step.tool, args);
      // registry.invoke wraps the tool's own result; a tool that returns { success: false } failed too.
      const inner = result && result.result;
      const stepOk = !!(result && result.success) && !(inner && typeof inner === 'object' && inner.success === false);
      results.push({
        step: i + 1,
        tool: step.tool,
        description: step.description,
        success: stepOk,
        result: inner,
        error: stepOk ? undefined : ((result && result.error) || (inner && (inner.error || inner.message)) || 'Step failed')
      });
      if (stepOk) {
        macroVars = mergeClipResultIntoMacroVars(macroVars, inner);
      }
      if (!stepOk && macro.stopOnError !== false) {
        console.error(`[JARVIS] Macro step ${i + 1} failed, stopping execution`);
        break;
      }
    } catch (error) {
      console.error(`[JARVIS] Error executing macro step ${i + 1}:`, error);
      results.push({ step: i + 1, tool: step.tool, description: step.description, success: false, error: error.message });
      break;
    }
  }
  const allSucceeded = results.length === steps.length && results.every(r => r.success);
  return {
    success: allSucceeded,
    macro: macro.name,
    steps: results,
    totalSteps: steps.length,
    note: allSucceeded
      ? `Macro '${macro.name}' completed successfully`
      : `Macro '${macro.name}' completed with errors`
  };
};

function refreshMacroManager(macroManager) {
  if (!macroManager) return;
  if (typeof macroManager.reload === 'function') macroManager.reload();
  else if (typeof macroManager.load === 'function') macroManager.load();
}

function resolveMacro(macroManager, ref) {
  refreshMacroManager(macroManager);
  if (!ref) return null;
  const direct = macroManager.get(ref);
  if (direct) return { id: ref, ...direct };
  const byPhrase = macroManager.findByPhrase(String(ref));
  if (byPhrase) return byPhrase;
  const wanted = String(ref).trim().toLowerCase();
  const list = typeof macroManager.list === 'function' ? macroManager.list() : [];
  return list.find(m => (m.name || '').trim().toLowerCase() === wanted) || null;
}

async function runResolvedMacro(macro, context, source) {
  if (!macro.enabled) {
    return { success: false, macro: macro.name, steps: [], error: `Macro '${macro.name}' is disabled` };
  }
  let out;
  if (typeof context.executeMacroById === 'function') {
    // Same executor as the hotkey / Test button (validation + per-step results + UI notification)
    out = await context.executeMacroById(macro.id, source);
  } else {
    out = await registry.runMacroSteps(macro);
  }
  return { ...out, id: macro.id, summary: summarizeMacroRun(out) };
}

// Tool: run_macro
registry.register(
  'run_macro',
  {
    description: 'Run one of the streamer\'s SAVED VirtualDeck macros (e.g. going live / start stream, BRB, ending stream) exactly as configured, the same as pressing its hotkey. ALWAYS use this for any routine that matches a saved macro (see list_macros); never recreate a macro\'s steps with individual tools like change_scene. Returns per-step results and a spoken summary.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Macro ID (e.g. "going-live"), exact macro name, or its trigger phrase'
        }
      },
      required: ['id']
    }
  },
  async (args, context) => {
    const { id } = args;
    const { macroManager } = context;

    if (!macroManager) {
      return { success: false, error: 'Macro manager not available' };
    }

    const macro = resolveMacro(macroManager, id);
    if (!macro) {
      const names = (typeof macroManager.list === 'function' ? macroManager.list() : []).map(m => `${m.name} (${m.id})`);
      return { success: false, error: `Macro '${id}' not found${names.length ? `. Saved macros: ${names.join(', ')}` : ''}` };
    }
    return runResolvedMacro(macro, context, 'jarvis');
  }
);

// Tool: list_macros (read-only)
registry.register(
  'list_macros',
  {
    description: 'List the streamer\'s saved VirtualDeck macros (id, name, voice trigger phrase, step tools). Use run_macro with the id to run one.',
    parameters: { type: 'object', properties: {} }
  },
  async (args, context) => {
    const { macroManager } = context;
    if (!macroManager) return { success: false, error: 'Macro manager not available' };
    refreshMacroManager(macroManager);
    const macros = macroManager.list().map(m => ({
      id: m.id,
      name: m.name,
      description: m.description || '',
      phrase: (m.triggers && m.triggers.phrase) || null,
      enabled: m.enabled !== false,
      steps: (m.steps || []).map(s => s.tool)
    }));
    return { success: true, macros };
  }
);

// Tool: run_voice_macro — deterministic voice trigger (no LLM): match the host's utterance against
// saved macro trigger phrases / "run the <name> macro" and run it through the hotkey executor.
registry.register(
  'run_voice_macro',
  {
    description: 'Match a host voice utterance against saved macro trigger phrases and, if exactly one matches, run that macro (same executor as its hotkey). Returns { matched:false } when nothing matches.',
    parameters: {
      type: 'object',
      properties: {
        utterance: { type: 'string', description: 'What the host said (wake word may be included)' }
      },
      required: ['utterance']
    }
  },
  async (args, context) => {
    const { macroManager } = context;
    if (!macroManager) return { success: false, matched: false, error: 'Macro manager not available' };
    refreshMacroManager(macroManager);
    let wakeNames = [];
    try {
      if (macroManager.macrosPath) {
        const { readHostWakeNamesFromUserData } = require('./lib/wake-names');
        const w = readHostWakeNamesFromUserData(path.dirname(macroManager.macrosPath));
        wakeNames = (w && (w.names || w.all || [])) || [];
        if (w && w.primary && !wakeNames.includes(w.primary)) wakeNames = [w.primary, ...wakeNames];
      }
    } catch (_) { /* wake names are optional */ }
    const m = matchMacroByUtterance(macroManager.list(), args.utterance, { wakeNames });
    if (!m.matched) {
      return {
        success: true,
        matched: false,
        reason: m.reason,
        ambiguous: m.ambiguous,
        summary: m.ambiguous ? `That matches more than one macro: ${m.ambiguous.join(', ')}. Which one?` : undefined
      };
    }
    console.log(`[JARVIS] Voice trigger "${args.utterance}" -> macro '${m.macro.name}' (${m.matchedOn}: "${m.phrase}")`);
    const out = await runResolvedMacro(m.macro, context, 'voice');
    // success here = the macro ran OK; matched tells Raven not to send this utterance to the LLM.
    return { ...out, matched: true, matchedOn: m.matchedOn, phrase: m.phrase };
  }
);

// Tool: send_twitch_message
registry.register(
  'send_twitch_message',
  {
    description: 'Send a message to Twitch chat',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Message text to send'
        },
        channel: {
          type: 'string',
          description: 'Optional channel override (defaults to configured channel)'
        }
      },
      required: ['text']
    }
  },
  async (args, context) => {
    const { text, channel } = args;
    const { twitchClient, twitchChannel, config, loadProfile, currentActiveProfile } = context;

    if (!twitchClient || twitchClient.readyState() !== 'OPEN') {
      return {
        success: false,
        error: 'Twitch client not connected',
      };
    }

    const targetChannel = channel || twitchChannel;
    if (!targetChannel) {
      return {
        success: false,
        error: 'No channel specified and no default configured',
      };
    }

    const profile =
      config ||
      (typeof loadProfile === 'function' && currentActiveProfile
        ? loadProfile(currentActiveProfile)
        : null);
    const placeholderData = appendSocialsToUserData({}, profile && profile.socials);
    const messageText = replacePlaceholders(text, placeholderData);

    try {
      await twitchClient.say(targetChannel, messageText);
      return {
        success: true,
        channel: targetChannel,
        message: messageText,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
);

// Tool: post_socials
registry.register(
  'post_socials',
  {
    description: 'Post configured social links to Twitch chat (splits into multiple messages if over 500 characters)',
    parameters: { type: 'object', properties: {} },
  },
  async (_args, context) => {
    const { postSocialsToChat, config, loadProfile, currentActiveProfile } = context;
    if (typeof postSocialsToChat === 'function') {
      return await postSocialsToChat({ source: 'macro' });
    }
    const profile =
      config ||
      (typeof loadProfile === 'function' && currentActiveProfile
        ? loadProfile(currentActiveProfile)
        : null);
    const line = formatSocialsLine(normalizeSocials(profile && profile.socials));
    if (!line) {
      return { success: false, error: 'No social links configured in Preferences' };
    }
    const { twitchClient, twitchChannel } = context;
    if (!twitchClient || twitchClient.readyState() !== 'OPEN') {
      return { success: false, error: 'Twitch client not connected' };
    }
    const parts = splitChatMessages(line);
    for (const part of parts) {
      await twitchClient.say(twitchChannel, part);
    }
    return { success: true, messages: parts };
  },
);

// Tool: twitch_start_commercial
registry.register(
  'twitch_start_commercial',
  {
    description: 'Start a Twitch mid-roll commercial (requires channel:edit:commercial and live stream)',
    parameters: {
      type: 'object',
      properties: {
        length: {
          type: 'number',
          description: 'Commercial length in seconds (30–180)',
        },
        chatMessage: {
          type: 'string',
          description: 'Optional message to post in chat before the ad',
        },
      },
    },
  },
  async (args, context) => {
    const { startTwitchCommercial } = context;
    if (typeof startTwitchCommercial !== 'function') {
      return { success: false, error: 'Twitch commercial is not available' };
    }
    const out = await startTwitchCommercial({
      length: args.length,
      chatMessage: args.chatMessage,
      source: 'macro',
    });
    if (!out || !out.ok) {
      return {
        success: false,
        error: (out && out.error) || 'Commercial failed',
        needsReconnect: !!(out && out.needsReconnect),
        retry_after: out && out.retry_after,
      };
    }
    return { success: true, length: out.length, retry_after: out.retry_after };
  },
);

// Tool: trigger_button
registry.register(
  'trigger_button',
  {
    description: 'Trigger a VirtualDeck deck button by stable id (preferred) or label fallback',
    parameters: {
      type: 'object',
      properties: {
        buttonId: {
          type: 'string',
          description: 'Stable deck button id (saved by the macro editor)',
        },
        label: {
          type: 'string',
          description: 'Button label (display name / legacy fallback)',
        },
      },
    },
  },
  async (args, context) => {
    const { buttonId, label } = args || {};
    const { triggerButtonFn, triggerDeckButtonFn, loadProfile, currentActiveProfile } = context;

    const triggerFn = triggerDeckButtonFn || triggerButtonFn;
    if (!triggerFn) {
      return {
        success: false,
        error: 'Button trigger function not available',
      };
    }

    if (!buttonId && !label) {
      return { success: false, error: 'buttonId or label is required' };
    }

    let resolvedLabel = label;
    if (buttonId && typeof loadProfile === 'function' && currentActiveProfile) {
      const profile = loadProfile(currentActiveProfile);
      const btn = (profile.buttons || []).find((b) => b && b.id === buttonId);
      if (!btn) {
        return {
          success: false,
          error: `Deck button ${buttonId}${label ? ` ("${label}")` : ''} was deleted or is not on the active profile`,
        };
      }
      resolvedLabel = btn.name || btn.label || label;
    }

    const triggered = triggerFn({ buttonId, label: resolvedLabel || label }, 'jarvis-api');

    return {
      success: triggered,
      buttonId: buttonId || undefined,
      button: resolvedLabel || label,
      note: triggered ? 'Button triggered' : 'Button trigger failed or debounced',
    };
  }
);

// Tool: get_scenes
registry.register(
  'get_scenes',
  {
    description: 'List scenes in the connected streaming app (Meld Studio, OBS or Streamlabs Desktop)',
    parameters: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          enum: ['meld', 'obs', 'streamlabs'],
          description: 'Optional: which streaming app to query. Omit to auto-detect.'
        }
      }
    }
  },
  async (args, context) => {
    const { win } = context;

    if (context.sceneProvider) {
      const app = ['meld', 'obs', 'streamlabs'].includes(args && args.app) ? args.app : undefined;
      const list = await context.sceneProvider.listScenes({ app });
      if (!list.success) return { success: false, error: list.error, errors: list.errors };
      return { success: true, app: list.app, scenes: list.scenes };
    }
    
    if (!win || win.isDestroyed()) {
      return {
        success: false,
        error: 'VirtualDeck window not available'
      };
    }

    // Request scene list from renderer
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: 'Timeout waiting for scene list'
        });
      }, 5000);

      const handler = (event, scenes) => {
        clearTimeout(timeoutId);
        resolve({
          success: true,
          scenes
        });
      };

      require('electron').ipcMain.once('jarvis-scenes-response', handler);
      win.webContents.send('jarvis-get-scenes');
    });
  }
);

// Tool: discord_send_message
registry.register(
  'discord_send_message',
  {
    description: 'Send a message to Discord channel via webhook or bot',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message text to send'
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID (optional if webhook URL is configured)'
        },
        embed: {
          type: 'object',
          description: 'Optional Discord embed object'
        }
      },
      required: ['message']
    }
  },
  async (args, context) => {
    const { message, channelId, embed } = args;
    const { config } = context;
    
    if (!config || !config.discord) {
      return {
        success: false,
        error: 'Discord not configured. Add webhook URL or bot token in settings.'
      };
    }

    const discordConfig = config.discord;
    const fetch = require('node-fetch');

    try {
      // Prefer webhook for simplicity
      if (discordConfig.webhookUrl) {
        const payload = {
          content: message,
          username: discordConfig.username || 'VirtualDeck'
        };

        if (embed) {
          payload.embeds = [embed];
        }

        const response = await fetch(discordConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.text();
          return {
            success: false,
            error: `Discord webhook failed: ${response.status} ${error}`
          };
        }

        return {
          success: true,
          method: 'webhook',
          message
        };
      }

      // Bot token method
      if (discordConfig.botToken) {
        const targetChannel = channelId || discordConfig.defaultChannelId;
        
        if (!targetChannel) {
          return {
            success: false,
            error: 'No channel ID specified and no default configured'
          };
        }

        const payload = { content: message };
        if (embed) {
          payload.embeds = [embed];
        }

        const response = await fetch(
          `https://discord.com/api/v10/channels/${targetChannel}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${discordConfig.botToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return {
            success: false,
            error: `Discord API failed: ${response.status} ${error}`
          };
        }

        return {
          success: true,
          method: 'bot',
          channelId: targetChannel,
          message
        };
      }

      return {
        success: false,
        error: 'No Discord webhook URL or bot token configured'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
);

// Tool: discord_announce_live
registry.register(
  'discord_announce_live',
  {
    description: 'Post a go-live notification to Discord with stream info',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Custom announcement message (optional)'
        },
        includeStreamInfo: {
          type: 'boolean',
          description: 'Include Twitch channel info in embed',
          default: true
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID (optional if webhook is configured)'
        }
      }
    }
  },
  async (args, context) => {
    const { message, includeStreamInfo = true, channelId } = args;
    const { config, twitchChannel, twitchUserName } = context;

    const announcement = message || '🔴 Going live now! Come hang out! 🎮';

    let embed = null;
    if (includeStreamInfo && twitchChannel) {
      const channelName = twitchChannel.replace('#', '');
      embed = {
        color: 0x9146FF,
        title: '🎮 Stream is Live!',
        description: announcement,
        fields: [
          {
            name: 'Channel',
            value: `[twitch.tv/${channelName}](https://twitch.tv/${channelName})`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString()
      };

      if (twitchUserName) {
        embed.author = {
          name: twitchUserName
        };
      }
    }

    // Unwrap registry.invoke's { success, result } so a failed Discord post fails this step too.
    const sent = await registry.invoke('discord_send_message', {
      message: embed ? '' : announcement,
      embed,
      channelId
    });
    if (!sent || !sent.success) return { success: false, error: (sent && sent.error) || 'Discord post failed' };
    return sent.result;
  }
);

// Tool: twitch_create_clip
registry.register(
  'twitch_create_clip',
  {
    description: 'Create a Twitch clip of the live stream (Helix clips:edit). Announces in chat when ready; returns clipUrl and id for later macro steps.',
    parameters: {
      type: 'object',
      properties: {
        requestedBy: {
          type: 'string',
          description: 'Optional name credited in chat (default: macro or JARVIS)',
        },
      },
    },
  },
  async (args, context) => {
    const { createTwitchClip } = context;
    if (typeof createTwitchClip !== 'function') {
      return { success: false, error: 'Twitch clip is not available' };
    }
    const out = await createTwitchClip({
      requestedBy: args.requestedBy || 'Macro',
      source: 'macro',
    });
    if (!out || !out.ok) {
      return { success: false, error: (out && out.reason) || 'Clip failed' };
    }
    return {
      success: true,
      url: out.url,
      id: out.id,
      clipUrl: out.url,
      clipId: out.id,
    };
  },
);

// Tool: meld_record_clip
registry.register(
  'meld_record_clip',
  {
    description: 'Record a clip in Meld Studio (meld.recordClip). Does not create a Twitch clip.',
    parameters: { type: 'object', properties: {} },
  },
  async (args, context) => {
    const { meldRecordClip } = context;
    if (typeof meldRecordClip !== 'function') {
      return { success: false, error: 'Meld clip recording is not available' };
    }
    const out = await meldRecordClip();
    if (!out || !out.ok) {
      return { success: false, error: (out && out.reason) || 'Meld recordClip failed' };
    }
    return { success: true };
  },
);

// Tool: discord_post_clip
registry.register(
  'discord_post_clip',
  {
    description: 'Post a clip notification to Discord',
    parameters: {
      type: 'object',
      properties: {
        clipUrl: {
          type: 'string',
          description: 'URL of the clip'
        },
        title: {
          type: 'string',
          description: 'Clip title'
        },
        message: {
          type: 'string',
          description: 'Custom message (optional)'
        },
        channelId: {
          type: 'string',
          description: 'Discord channel ID (optional)'
        }
      },
      required: ['clipUrl']
    }
  },
  async (args, context) => {
    const { clipUrl, title, message, channelId } = args;

    const announcement = message || '🎬 New clip created!';

    const embed = {
      color: 0x6441A5,
      title: title || 'Stream Clip',
      description: announcement,
      url: clipUrl,
      fields: [
        {
          name: 'Watch Clip',
          value: `[Click here](${clipUrl})`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    };

    return await registry.invoke('discord_send_message', {
      message: '',
      embed,
      channelId
    });
  }
);

// Tool: list_live_raid_favorites
registry.register(
  'list_live_raid_favorites',
  {
    description: 'List raid favorites with live status (title, game, viewers). Live channels first.',
    parameters: {
      type: 'object',
      properties: {
        forceRefresh: {
          type: 'boolean',
          description: 'Bypass the 60s live-check cache',
          default: false,
        },
      },
    },
  },
  async (args, context) => {
    const { raidFavoritesListLive } = context;
    if (!raidFavoritesListLive) {
      return { success: false, error: 'Raid favorites are not available' };
    }
    return await raidFavoritesListLive({
      forceRefresh: !!args.forceRefresh,
    });
  },
);

// Tool: start_raid
registry.register(
  'start_raid',
  {
    description:
      'Start a Twitch raid to a channel (must be in favorites or raid history). Requires confirmed: true.',
    parameters: {
      type: 'object',
      properties: {
        login: {
          type: 'string',
          description: 'Target Twitch channel login',
        },
        confirmed: {
          type: 'boolean',
          description: 'Must be true to execute the raid (safety confirmation)',
          default: false,
        },
      },
      required: ['login'],
    },
  },
  async (args, context) => {
    const { raidFavoritesStartRaid } = context;
    const login = normalizeTwitchLogin(args.login);
    if (!isValidTwitchLogin(login)) {
      return { success: false, error: 'Invalid Twitch login' };
    }
    if (args.confirmed !== true) {
      return {
        success: false,
        needsConfirmation: true,
        login,
        message: `Confirm raid to ${login} by calling start_raid again with confirmed: true`,
      };
    }
    if (!raidFavoritesStartRaid) {
      return { success: false, error: 'Raid favorites are not available' };
    }
    return await raidFavoritesStartRaid({ login, source: 'jarvis' });
  },
);

module.exports = { registry, refreshMacroManager };
