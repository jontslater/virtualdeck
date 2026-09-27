/**
 * JARVIS Tool Registry & Handlers
 * 
 * Provides a controlled set of tool APIs for LLM brain integration.
 * Each tool has a name, description, JSON schema for parameters, and a handler function.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

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
    description: 'Switch to a different Meld Studio scene',
    parameters: {
      type: 'object',
      properties: {
        sceneName: {
          type: 'string',
          description: 'Name of the scene to switch to (or sceneId if known)'
        }
      },
      required: ['sceneName']
    }
  },
  async (args, context) => {
    const { sceneName } = args;
    const { win } = context;
    
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

// Tool: run_macro
registry.register(
  'run_macro',
  {
    description: 'Execute a named macro (sequence of JARVIS tool calls)',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Macro ID (e.g. "going-live") or name'
        }
      },
      required: ['id']
    }
  },
  async (args, context) => {
    const { id } = args;
    const { macroManager } = context;
    
    if (!macroManager) {
      return {
        success: false,
        error: 'Macro manager not available'
      };
    }

    // Try to find macro by ID first, then by phrase/name
    let macro = macroManager.get(id);
    if (!macro) {
      macro = macroManager.findByPhrase(id);
    }

    if (!macro) {
      return {
        success: false,
        error: `Macro '${id}' not found`
      };
    }

    if (!macro.enabled) {
      return {
        success: false,
        error: `Macro '${macro.name}' is disabled`
      };
    }

    // Execute each step in sequence
    const results = [];
    for (let i = 0; i < macro.steps.length; i++) {
      const step = macro.steps[i];
      console.log(`[JARVIS] Executing macro step ${i + 1}/${macro.steps.length}: ${step.tool}`);
      
      try {
        const result = await registry.invoke(step.tool, step.arguments || {});
        results.push({
          step: i + 1,
          tool: step.tool,
          description: step.description,
          success: result.success,
          result: result.result,
          error: result.error
        });

        // Stop on first failure if configured
        if (!result.success && macro.stopOnError !== false) {
          console.error(`[JARVIS] Macro step ${i + 1} failed, stopping execution`);
          break;
        }
      } catch (error) {
        console.error(`[JARVIS] Error executing macro step ${i + 1}:`, error);
        results.push({
          step: i + 1,
          tool: step.tool,
          description: step.description,
          success: false,
          error: error.message
        });
        break;
      }
    }

    const allSucceeded = results.every(r => r.success);
    return {
      success: allSucceeded,
      macro: macro.name,
      steps: results,
      note: allSucceeded 
        ? `Macro '${macro.name}' completed successfully` 
        : `Macro '${macro.name}' completed with errors`
    };
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
    const { twitchClient, twitchChannel } = context;
    
    if (!twitchClient || twitchClient.readyState() !== 'OPEN') {
      return {
        success: false,
        error: 'Twitch client not connected'
      };
    }

    const targetChannel = channel || twitchChannel;
    if (!targetChannel) {
      return {
        success: false,
        error: 'No channel specified and no default configured'
      };
    }

    try {
      await twitchClient.say(targetChannel, text);
      return {
        success: true,
        channel: targetChannel,
        message: text
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
);

// Tool: trigger_button
registry.register(
  'trigger_button',
  {
    description: 'Trigger a VirtualDeck button by label',
    parameters: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Button label to trigger'
        }
      },
      required: ['label']
    }
  },
  async (args, context) => {
    const { label } = args;
    const { triggerButtonFn } = context;
    
    if (!triggerButtonFn) {
      return {
        success: false,
        error: 'Button trigger function not available'
      };
    }

    const triggered = triggerButtonFn(label, 'jarvis-api');
    
    return {
      success: triggered,
      button: label,
      note: triggered ? 'Button triggered' : 'Button trigger failed or debounced'
    };
  }
);

// Tool: get_scenes
registry.register(
  'get_scenes',
  {
    description: 'List available Meld Studio scenes',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  async (args, context) => {
    const { win } = context;
    
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

    return await registry.invoke('discord_send_message', {
      message: embed ? '' : announcement,
      embed,
      channelId
    });
  }
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

module.exports = { registry };
