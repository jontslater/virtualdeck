/**
 * VTuber Manager
 * 
 * Manages PNGtuber images and VTuber models for the overlay.
 * Handles image uploads, state management, and configuration.
 */

const fs = require('fs');
const path = require('path');

class VTuberManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.vtuberDir = path.join(userDataPath, 'vtuber');
    this.imagesDir = path.join(this.vtuberDir, 'images');
    this.configPath = path.join(this.vtuberDir, 'config.json');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load configuration
    this.config = this.loadConfig();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.vtuberDir)) {
      fs.mkdirSync(this.vtuberDir, { recursive: true });
    }
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('❌ Error loading VTuber config:', err);
    }

    // Default configuration
    return {
      type: 'pngtuber', // 'pngtuber' or 'vtuber'
      states: {
        idle: 'idle.png',
        talking: 'talking.png',
        excited: 'excited.png',
        happy: 'happy.png',
        sad: 'sad.png',
        thinking: 'thinking.png',
        confused: 'confused.png',
      },
      currentState: 'idle',
      position: {
        x: 0,
        y: 0,
        width: 500,
        height: 500,
        anchor: 'center', // 'center', 'top-left', 'bottom-right', etc.
      },
      scale: 1.0,
      opacity: 1.0,
      // For actual VTubers (Live2D, VSeeFace, etc.)
      vtuberConfig: {
        type: null, // 'live2d', 'vseeface', 'iframe', etc.
        url: null, // URL for iframe or API endpoint
        modelPath: null, // Path to Live2D model
      },
    };
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('❌ Error saving VTuber config:', err);
      return false;
    }
  }

  /**
   * Get image path for a state
   */
  getImagePath(state) {
    const filename = this.config.states[state] || this.config.states.idle;
    const imagePath = path.join(this.imagesDir, filename);
    
    // Check if file exists
    if (fs.existsSync(imagePath)) {
      return imagePath;
    }
    
    // Fallback to idle if state image doesn't exist
    const idlePath = path.join(this.imagesDir, this.config.states.idle);
    if (fs.existsSync(idlePath)) {
      return idlePath;
    }
    
    return null;
  }

  /**
   * Get HTTP URL for an image
   */
  getImageUrl(state) {
    const imagePath = this.getImagePath(state);
    if (!imagePath) {
      return null;
    }
    
    // Convert to relative path from userDataPath
    const relativePath = path.relative(this.userDataPath, imagePath);
    return `/media/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * Upload an image for a state
   */
  uploadImage(state, filePath, newFilename) {
    try {
      const filename = newFilename || `${state}.png`;
      const destPath = path.join(this.imagesDir, filename);
      
      // Copy file
      fs.copyFileSync(filePath, destPath);
      
      // Update config
      this.config.states[state] = filename;
      this.saveConfig();
      
      return { success: true, path: destPath, url: this.getImageUrl(state) };
    } catch (err) {
      console.error(`❌ Error uploading image for state ${state}:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Set current state
   */
  setState(state) {
    if (this.config.states[state]) {
      this.config.currentState = state;
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Get current state
   */
  getState() {
    return this.config.currentState || 'idle';
  }

  /**
   * Get all available states
   */
  getStates() {
    return Object.keys(this.config.states || {});
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      ...this.config,
      images: this.getAvailableImages(),
    };
  }

  /**
   * Get list of available images
   */
  getAvailableImages() {
    const images = {};
    const states = this.getStates();
    
    states.forEach(state => {
      const url = this.getImageUrl(state);
      if (url) {
        images[state] = {
          filename: this.config.states[state],
          url: url,
          exists: fs.existsSync(this.getImagePath(state)),
        };
      }
    });
    
    return images;
  }

  /**
   * Update position/size settings
   */
  updatePosition(position) {
    this.config.position = { ...this.config.position, ...position };
    this.saveConfig();
    return true;
  }

  /**
   * Update scale/opacity
   */
  updateDisplay(scale, opacity) {
    if (scale !== undefined) this.config.scale = scale;
    if (opacity !== undefined) this.config.opacity = opacity;
    this.saveConfig();
    return true;
  }

  /**
   * Set VTuber type (for actual VTubers)
   */
  setVTuberType(type, config) {
    this.config.type = 'vtuber';
    this.config.vtuberConfig = {
      ...this.config.vtuberConfig,
      type: type,
      ...config,
    };
    this.saveConfig();
    return true;
  }
}

module.exports = VTuberManager;
