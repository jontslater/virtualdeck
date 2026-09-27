/**
 * Macro Manager
 * 
 * Manages VirtualDeck macros - sequences of allowlisted JARVIS tool calls
 * triggered by voice phrases or button presses.
 */

const fs = require('fs');
const path = require('path');

class MacroManager {
  constructor(userDataPath) {
    this.macrosPath = path.join(userDataPath, 'macros.json');
    this.macros = new Map();
    this.load();
  }

  /**
   * Load macros from disk
   */
  load() {
    try {
      if (fs.existsSync(this.macrosPath)) {
        const data = JSON.parse(fs.readFileSync(this.macrosPath, 'utf-8'));
        this.macros = new Map(Object.entries(data));
        console.log(`[MacroManager] Loaded ${this.macros.size} macros`);
      } else {
        // Create default macros on first run
        this.createDefaults();
      }
    } catch (error) {
      console.error('[MacroManager] Error loading macros:', error);
      this.macros = new Map();
    }
  }

  /**
   * Save macros to disk
   */
  save() {
    try {
      const data = Object.fromEntries(this.macros);
      fs.writeFileSync(this.macrosPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[MacroManager] Saved ${this.macros.size} macros`);
      return true;
    } catch (error) {
      console.error('[MacroManager] Error saving macros:', error);
      return false;
    }
  }

  /**
   * Create default starter macros
   */
  createDefaults() {
    const goingLiveMacro = {
      name: 'Going Live',
      description: 'Prepare stream for going live with scene change, browser refresh, and Discord notification',
      triggers: {
        phrase: 'raven we are going live',
        button: null // Can be bound to a button later
      },
      steps: [
        {
          tool: 'change_scene',
          arguments: { sceneName: 'Starting Soon' },
          description: 'Switch to Starting Soon scene'
        },
        {
          tool: 'refresh_browser_sources',
          arguments: { waitForSceneName: 'Starting Soon' },
          description: 'Refresh all browser sources in Starting Soon scene'
        },
        {
          tool: 'discord_announce_live',
          arguments: { 
            message: '🔴 Going live now! Come hang out! 🎮',
            includeStreamInfo: true 
          },
          description: 'Post go-live notification to Discord'
        }
      ],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.macros.set('going-live', goingLiveMacro);
    this.save();
    console.log('[MacroManager] Created default macros');
  }

  /**
   * List all macros
   */
  list() {
    return Array.from(this.macros.entries()).map(([id, macro]) => ({
      id,
      ...macro
    }));
  }

  /**
   * Get a specific macro by ID
   */
  get(id) {
    return this.macros.get(id);
  }

  /**
   * Find macro by trigger phrase
   */
  findByPhrase(phrase) {
    const normalized = phrase.toLowerCase().trim();
    for (const [id, macro] of this.macros.entries()) {
      if (macro.enabled && macro.triggers.phrase) {
        const macroPhrase = macro.triggers.phrase.toLowerCase().trim();
        if (macroPhrase === normalized) {
          return { id, ...macro };
        }
      }
    }
    return null;
  }

  /**
   * Find macro by button ID
   */
  findByButton(buttonId) {
    for (const [id, macro] of this.macros.entries()) {
      if (macro.enabled && macro.triggers.button === buttonId) {
        return { id, ...macro };
      }
    }
    return null;
  }

  /**
   * Create or update a macro
   */
  set(id, macro) {
    const existing = this.macros.get(id);
    const now = new Date().toISOString();
    
    const updated = {
      ...macro,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    this.macros.set(id, updated);
    this.save();
    return updated;
  }

  /**
   * Delete a macro
   */
  delete(id) {
    const deleted = this.macros.delete(id);
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  /**
   * Validate macro structure
   */
  validate(macro) {
    const errors = [];

    if (!macro.name || typeof macro.name !== 'string') {
      errors.push('Macro name is required');
    }

    if (!macro.steps || !Array.isArray(macro.steps) || macro.steps.length === 0) {
      errors.push('Macro must have at least one step');
    }

    if (macro.steps) {
      macro.steps.forEach((step, index) => {
        if (!step.tool || typeof step.tool !== 'string') {
          errors.push(`Step ${index + 1}: tool name is required`);
        }
        if (!step.arguments || typeof step.arguments !== 'object') {
          errors.push(`Step ${index + 1}: arguments must be an object`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = MacroManager;
