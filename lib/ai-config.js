/**
 * AI Configuration Manager
 * 
 * Manages voice and personality settings for Raven AI integration.
 * Handles reading/writing to raven.env and provides API endpoints.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { stripBom } = require('./read-utf8');
const {
  parseAndValidateHostWakeNames,
  getHostWakeNamesFromConfig,
  WAKE_NAMES_REQUIRE_RAVEN_RESTART,
  DEFAULT_WAKE_NAME,
} = require('./wake-names');

// ElevenLabs premade default voices expire 2026-12-31.
const ELEVENLABS_PREMADE_VOICES = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
  { voice_id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde' },
];

class AIConfigManager {
  constructor() {
    this.envPath = null;
  }

  /**
   * Get path to raven.env file in user data directory
   */
  getEnvPath() {
    if (!this.envPath) {
      this.envPath = path.join(app.getPath('userData'), 'raven.env');
    }
    return this.envPath;
  }

  /**
   * Parse .env file content into key-value map
   */
  parseEnv(text) {
    const map = {};
    for (const raw of stripBom(String(text || '')).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      let val = line.slice(eq + 1).trim();
      const hash = val.indexOf(' #');
      if (hash >= 0) val = val.slice(0, hash).trim();
      
      // Unescape the value to handle our escaped format
      map[line.slice(0, eq).trim()] = this.unescapeEnvValue(val);
    }
    return map;
  }

  /**
   * Read current raven.env configuration
   */
  readConfig() {
    try {
      const envPath = this.getEnvPath();
      if (!fs.existsSync(envPath)) {
        return {};
      }
      const content = fs.readFileSync(envPath, 'utf8');
      return this.parseEnv(content);
    } catch (err) {
      console.error('[AI Config] Failed to read raven.env:', err);
      return {};
    }
  }

  /**
   * Escape value for env file (single-line, quote if needed)
   * Handles spaces, newlines, special chars to prevent env corruption
   */
  escapeEnvValue(value) {
    if (typeof value !== 'string') {
      return String(value);
    }
    
    // If value contains newlines, spaces, quotes, #, or =, we need to escape
    const needsQuoting = /[\s\n\r"'#=]/.test(value);
    
    if (!needsQuoting) {
      return value;
    }
    
    // Use JSON-style escaping (newlines become \n, quotes become \", etc.)
    // This makes it a single line and unambiguous
    const escaped = value
      .replace(/\\/g, '\\\\')  // Backslash first
      .replace(/\n/g, '\\n')   // Newlines
      .replace(/\r/g, '\\r')   // Carriage returns
      .replace(/"/g, '\\"')    // Double quotes
      .replace(/\t/g, '\\t');  // Tabs
    
    return `"${escaped}"`;
  }

  /**
   * Unescape value from env file (handles quoted and escaped values)
   */
  unescapeEnvValue(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Unescape special characters
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Write updated configuration to raven.env with proper escaping
   */
  writeConfig(updates) {
    try {
      const envPath = this.getEnvPath();
      let content = '';
      
      if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
      }
      
      const lines = content.split(/\r?\n/);
      const updatedKeys = new Set();
      const result = [];
      
      // Update existing keys
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          result.push(line);
          continue;
        }
        
        const eq = trimmed.indexOf('=');
        if (eq < 1) {
          result.push(line);
          continue;
        }
        
        const key = trimmed.slice(0, eq).trim();
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
          const escapedValue = this.escapeEnvValue(updates[key]);
          result.push(`${key}=${escapedValue}`);
          updatedKeys.add(key);
        } else {
          result.push(line);
        }
      }
      
      // Append new keys
      for (const [key, value] of Object.entries(updates)) {
        if (!updatedKeys.has(key)) {
          const escapedValue = this.escapeEnvValue(value);
          result.push(`${key}=${escapedValue}`);
        }
      }
      
      fs.writeFileSync(envPath, result.join('\n'), 'utf8');
      console.log('[AI Config] Updated raven.env:', Object.keys(updates));
      return true;
    } catch (err) {
      console.error('[AI Config] Failed to write raven.env:', err);
      return false;
    }
  }

  /**
   * Get TTS API key for fetching voices
   */
  getTTSApiKey() {
    const config = this.readConfig();
    return config.TTS_API_KEY || '';
  }

  /**
   * Parsed host wake names from raven.env (HOST_WAKE_NAMES).
   */
  getWakeNames() {
    return getHostWakeNamesFromConfig(this.readConfig());
  }

  /**
   * Validate and persist HOST_WAKE_NAMES (comma-separated, first is primary).
   * @param {string} raw - primary plus optional aliases, comma-separated
   */
  setWakeNames(raw) {
    const parsed = parseAndValidateHostWakeNames(raw);
    if (!parsed.ok) {
      return { success: false, error: parsed.error };
    }
    const ok = this.writeConfig({ HOST_WAKE_NAMES: parsed.envValue });
    if (!ok) {
      return { success: false, error: 'Failed to write raven.env' };
    }
    return {
      success: true,
      names: parsed.names,
      primary: parsed.primary,
      envValue: parsed.envValue,
      requiresRavenRestart: WAKE_NAMES_REQUIRE_RAVEN_RESTART,
    };
  }

  /**
   * Built-in premade ElevenLabs voices (always available in the picker).
   */
  getPremadeElevenLabsVoices() {
    return ELEVENLABS_PREMADE_VOICES.map((voice) => ({ ...voice }));
  }

  /**
   * Merge account voices with premade voices, deduped by voice_id (account wins).
   */
  mergeVoices(accountVoices) {
    const byId = new Map();
    for (const voice of this.getPremadeElevenLabsVoices()) {
      byId.set(voice.voice_id, voice);
    }
    for (const voice of accountVoices || []) {
      if (voice && voice.voice_id) {
        byId.set(voice.voice_id, voice);
      }
    }
    return Array.from(byId.values());
  }

  /**
   * Voices for API/UI: premade voices plus account voices when available.
   */
  async listVoices() {
    const premade = this.getPremadeElevenLabsVoices();
    const result = await this.fetchElevenLabsVoices();
    if (result.success) {
      return {
        success: true,
        voices: this.mergeVoices(result.voices),
      };
    }
    return {
      success: true,
      voices: premade,
      warning: result.error,
    };
  }

  /**
   * Fetch voices from ElevenLabs API
   */
  async fetchElevenLabsVoices() {
    const apiKey = this.getTTSApiKey();
    if (!apiKey) {
      return { success: false, error: 'TTS_API_KEY not configured' };
    }

    try {
      const https = require('https');
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.elevenlabs.io',
          port: 443,
          path: '/v1/voices',
          method: 'GET',
          headers: {
            'xi-api-key': apiKey
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(data);
                resolve({ 
                  success: true, 
                  voices: parsed.voices || []
                });
              } else {
                resolve({ 
                  success: false, 
                  error: `ElevenLabs API returned ${res.statusCode}` 
                });
              }
            } catch (err) {
              resolve({ 
                success: false, 
                error: `Failed to parse response: ${err.message}` 
              });
            }
          });
        });

        req.on('error', (err) => {
          resolve({ 
            success: false, 
            error: `Request failed: ${err.message}` 
          });
        });

        req.end();
      });
    } catch (err) {
      return { 
        success: false, 
        error: err.message 
      };
    }
  }

  /**
   * Set TTS voice ID
   */
  setVoice(voiceId, voiceName) {
    return this.writeConfig({
      TTS_VOICE_ID: voiceId || ''
    });
  }

  /**
   * Set AI personality prompt
   */
  setPersonality(personality, prompt) {
    // Store personality config as JSON comment in raven.env
    const updates = {};
    
    // Store the composed prompt (this is what Raven will use)
    if (prompt) {
      updates.AI_PERSONALITY_PROMPT = prompt;
    }
    
    // Store personality config as JSON for later editing
    // We store it as a comment so it doesn't interfere with env parsing
    const configComment = `# AI_PERSONALITY_CONFIG=${JSON.stringify(personality)}`;
    
    // Read current content and update
    try {
      const envPath = this.getEnvPath();
      let content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const result = [];
      let foundConfigComment = false;
      
      for (const line of lines) {
        if (line.startsWith('# AI_PERSONALITY_CONFIG=')) {
          if (!foundConfigComment) {
            result.push(configComment);
            foundConfigComment = true;
          }
        } else if (line.startsWith('AI_PERSONALITY_PROMPT=')) {
          // Will be added via updates
        } else {
          result.push(line);
        }
      }
      
      if (!foundConfigComment) {
        result.push('');
        result.push('# ===== AI Personality Configuration =====');
        result.push(configComment);
      }
      
      // Now use standard writeConfig to update AI_PERSONALITY_PROMPT
      fs.writeFileSync(envPath, result.join('\n'), 'utf8');
      return this.writeConfig(updates);
    } catch (err) {
      console.error('[AI Config] Failed to set personality:', err);
      return false;
    }
  }

  /**
   * Get saved personality configuration
   */
  getPersonality() {
    try {
      const envPath = this.getEnvPath();
      if (!fs.existsSync(envPath)) {
        return null;
      }
      
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      for (const line of lines) {
        if (line.startsWith('# AI_PERSONALITY_CONFIG=')) {
          const json = line.slice('# AI_PERSONALITY_CONFIG='.length);
          return JSON.parse(json);
        }
      }
      
      return null;
    } catch (err) {
      console.error('[AI Config] Failed to read personality:', err);
      return null;
    }
  }
}

module.exports = {
  AIConfigManager,
  DEFAULT_WAKE_NAME,
  WAKE_NAMES_REQUIRE_RAVEN_RESTART,
};
