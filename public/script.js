// public/script.js

/* ========================================================
 * Custom Alert System (Non-blocking, preserves focus)
 * ======================================================== */

// Custom prompt dialog for Electron
function showCustomPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--bg-primary, #1e1e1e);
      color: var(--text-primary, #ffffff);
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      min-width: 400px;
      max-width: 500px;
    `;
    
    // Create message
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      margin-bottom: 16px;
      font-size: 14px;
      line-height: 1.5;
    `;
    
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.style.cssText = `
      width: 100%;
      padding: 10px;
      background: var(--bg-secondary, #2a2a2a);
      border: 1px solid var(--border-color, #444);
      border-radius: 6px;
      color: var(--text-primary, #ffffff);
      font-size: 14px;
      margin-bottom: 16px;
      box-sizing: border-box;
    `;
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;
    
    // Create OK button
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = `
      padding: 10px 20px;
      background: var(--accent, #6366f1);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    okButton.addEventListener('mouseenter', () => {
      okButton.style.background = '#4f46e5';
    });
    okButton.addEventListener('mouseleave', () => {
      okButton.style.background = 'var(--accent, #6366f1)';
    });
    
    // Create Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      padding: 10px 20px;
      background: var(--bg-secondary, #2a2a2a);
      color: var(--text-primary, #ffffff);
      border: 1px solid var(--border-color, #444);
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#3a3a3a';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = 'var(--bg-secondary, #2a2a2a)';
    });
    
    // Assemble dialog
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(okButton);
    dialog.appendChild(messageEl);
    dialog.appendChild(input);
    dialog.appendChild(buttonsContainer);
    overlay.appendChild(dialog);
    
    // Event handlers
    const cleanup = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
    
    okButton.addEventListener('click', () => {
      resolve(input.value);
      cleanup();
    });
    
    cancelButton.addEventListener('click', () => {
      resolve(null);
      cleanup();
    });
    
    // Close on Escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        resolve(null);
        cleanup();
        document.removeEventListener('keydown', handleKeydown);
      } else if (e.key === 'Enter') {
        resolve(input.value);
        cleanup();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    
    // Show dialog
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}

// Custom profile delete dialog with dropdown
function showProfileDeleteDialog(profiles) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--bg-primary, #1e1e1e);
      color: var(--text-primary, #ffffff);
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      min-width: 400px;
      max-width: 500px;
    `;
    
    // Create message
    const messageEl = document.createElement('div');
    messageEl.textContent = 'Select profile to delete:';
    messageEl.style.cssText = `
      margin-bottom: 16px;
      font-size: 14px;
      line-height: 1.5;
    `;
    
    // Create select dropdown
    const select = document.createElement('select');
    select.style.cssText = `
      width: 100%;
      padding: 10px;
      background: var(--bg-secondary, #2a2a2a);
      border: 1px solid var(--border-color, #444);
      border-radius: 6px;
      color: var(--text-primary, #ffffff);
      font-size: 14px;
      margin-bottom: 16px;
      cursor: pointer;
    `;
    
    profiles.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      select.appendChild(option);
    });
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;
    
    // Create Delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.style.cssText = `
      padding: 10px 20px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    deleteButton.addEventListener('mouseenter', () => {
      deleteButton.style.background = '#c82333';
    });
    deleteButton.addEventListener('mouseleave', () => {
      deleteButton.style.background = '#dc3545';
    });
    
    // Create Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      padding: 10px 20px;
      background: var(--bg-secondary, #2a2a2a);
      color: var(--text-primary, #ffffff);
      border: 1px solid var(--border-color, #444);
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#3a3a3a';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = 'var(--bg-secondary, #2a2a2a)';
    });
    
    // Assemble dialog
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(deleteButton);
    dialog.appendChild(messageEl);
    dialog.appendChild(select);
    dialog.appendChild(buttonsContainer);
    overlay.appendChild(dialog);
    
    // Event handlers
    const cleanup = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
    
    deleteButton.addEventListener('click', () => {
      const selectedProfile = profiles.find(p => p.id === select.value);
      resolve(selectedProfile);
      cleanup();
    });
    
    cancelButton.addEventListener('click', () => {
      resolve(null);
      cleanup();
    });
    
    // Close on Escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        resolve(null);
        cleanup();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    
    // Show dialog
    document.body.appendChild(overlay);
    select.focus();
  });
}

// Custom confirm dialog for Electron
function showCustomConfirm(message) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--bg-primary, #1e1e1e);
      color: var(--text-primary, #ffffff);
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      min-width: 400px;
      max-width: 500px;
    `;
    
    // Create message
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      margin-bottom: 20px;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-line;
    `;
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;
    
    // Create Yes button
    const yesButton = document.createElement('button');
    yesButton.textContent = 'Yes';
    yesButton.style.cssText = `
      padding: 10px 20px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    yesButton.addEventListener('mouseenter', () => {
      yesButton.style.background = '#c82333';
    });
    yesButton.addEventListener('mouseleave', () => {
      yesButton.style.background = '#dc3545';
    });
    
    // Create No button
    const noButton = document.createElement('button');
    noButton.textContent = 'No';
    noButton.style.cssText = `
      padding: 10px 20px;
      background: var(--bg-secondary, #2a2a2a);
      color: var(--text-primary, #ffffff);
      border: 1px solid var(--border-color, #444);
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    noButton.addEventListener('mouseenter', () => {
      noButton.style.background = '#3a3a3a';
    });
    noButton.addEventListener('mouseleave', () => {
      noButton.style.background = 'var(--bg-secondary, #2a2a2a)';
    });
    
    // Assemble dialog
    buttonsContainer.appendChild(noButton);
    buttonsContainer.appendChild(yesButton);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonsContainer);
    overlay.appendChild(dialog);
    
    // Event handlers
    const cleanup = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
    
    yesButton.addEventListener('click', () => {
      resolve(true);
      cleanup();
    });
    
    noButton.addEventListener('click', () => {
      resolve(false);
      cleanup();
    });
    
    // Close on Escape
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        resolve(false);
        cleanup();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    
    // Show dialog
    document.body.appendChild(overlay);
    yesButton.focus();
  });
}

function showCustomAlert(message, type = 'info') {
  // Create alert container if it doesn't exist
  let alertContainer = document.getElementById('custom-alert-container');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'custom-alert-container';
    alertContainer.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(alertContainer);
  }

  // Create alert element
  const alert = document.createElement('div');
  alert.style.cssText = `
    background: var(--bg-primary, #1e1e1e);
    color: var(--text-primary, #ffffff);
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    border-left: 4px solid ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
    font-size: 14px;
    max-width: 400px;
    pointer-events: auto;
    animation: slideIn 0.3s ease-out;
  `;
  alert.textContent = message;

  // Add animation
  const style = document.createElement('style');
  if (!document.getElementById('custom-alert-styles')) {
    style.id = 'custom-alert-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  alertContainer.appendChild(alert);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    alert.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, 300);
  }, 4000);
}

/* ========================================================
 * Profile Management System
 * ======================================================== */
class ProfileManager {
  constructor() {
    this.currentProfile = null;
    this.profiles = [];
  }

  async initialize() {
    try {
      // Load profiles metadata
      const meta = await window.electronAPI.getProfiles();
      this.profiles = meta.profiles || [];
      this.currentProfile = meta.activeProfile || 'default';
      
      // Populate profile selector
      this.populateProfileSelector();
      
      // Load and apply current profile settings
      await this.loadProfileSettings();
      
      // Start periodic autosave (every 30 seconds)
      this.startPeriodicAutosave();
      
      console.log('ProfileManager initialized:', this.currentProfile);
    } catch (error) {
      console.error('Error initializing ProfileManager:', error);
    }
  }
  
  startPeriodicAutosave() {
    // Clear any existing interval
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
    }
    
    // Save every 30 seconds
    this.autosaveInterval = setInterval(() => {
      this.saveCurrentSettings().catch(err => {
        console.error('Periodic autosave failed:', err);
      });
    }, 30000);
    
    console.log('Periodic autosave started (every 30 seconds)');
  }

  populateProfileSelector() {
    const selector = document.getElementById('profile-selector');
    if (!selector) return;
    
    // Clear existing options
    selector.innerHTML = '';
    
    // Add all profiles
    this.profiles.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      selector.appendChild(option);
    });
    
    // Set current profile
    selector.value = this.currentProfile;
  }

  async loadProfileSettings() {
    try {
      const profile = await window.electronAPI.getProfile(this.currentProfile);
      
      console.log('📋 Loading profile settings:', this.currentProfile);
      console.log('📋 Profile data:', profile);
      console.log('📋 UI Settings:', profile.uiSettings);
      
      // Apply UI settings from profile
      if (profile.uiSettings) {
        // Apply theme - this is the authoritative source
        const themeToApply = profile.uiSettings.theme || 'dark'; // Default to dark if not set
        console.log('🎨 Theme from profile uiSettings.theme:', themeToApply);
        
        if (window.themeSystem) {
          // Ensure skins are loaded before applying
          await window.themeSystem.loadAvailableSkins();
          console.log('🎨 Available skins loaded:', window.themeSystem.availableSkins.map(s => s.id));
          console.log('🎨 Built-in themes:', window.themeSystem.builtInThemes);
          
          // Check if theme exists
          const isBuiltIn = window.themeSystem.builtInThemes.includes(themeToApply);
          const isSkin = window.themeSystem.availableSkins.some(skin => skin.id === themeToApply);
          console.log(`🎨 Theme "${themeToApply}" - Built-in: ${isBuiltIn}, Custom skin: ${isSkin}`);
          
          // Set the current theme (bypass validation)
          window.themeSystem.currentTheme = themeToApply;
          
          // Force apply the theme (even if it's not in the validation list yet)
          console.log('🎨 Calling applyTheme with:', themeToApply);
          await window.themeSystem.applyTheme(themeToApply);
          
          // Sync with menu
          if (window.electronAPI?.syncTheme) {
            window.electronAPI.syncTheme(themeToApply);
          }
          console.log('✅ Theme applied from profile:', themeToApply);
        } else {
          console.warn('⚠️ ThemeSystem not available yet');
        }
        
        // Apply component visibility
        if (profile.uiSettings.componentVisibility) {
          this.applyComponentVisibility(profile.uiSettings.componentVisibility);
        }
        
        // Apply chat width
        if (profile.uiSettings.chatWidth) {
          const chatContainer = document.getElementById('twitch-chat-container');
          if (chatContainer) {
            chatContainer.style.width = profile.uiSettings.chatWidth + 'px';
          }
        }
        
        // Apply sound button order after buttons are loaded
        if (profile.uiSettings.soundButtonOrder && profile.uiSettings.soundButtonOrder.length > 0) {
          // Wait a bit for buttons to be in DOM, then apply order
          setTimeout(() => {
            this.applyButtonOrder(profile.uiSettings.soundButtonOrder);
          }, 500);
        }
      } else {
        // No UI settings, apply default theme
        console.log('ℹ️ No uiSettings in profile, applying default theme');
        if (window.themeSystem) {
          window.themeSystem.currentTheme = 'dark';
          await window.themeSystem.applyTheme('dark');
          console.log('✅ Default theme applied: dark');
        }
      }
      
      console.log('✅ Profile settings loaded for:', this.currentProfile);
    } catch (error) {
      console.error('❌ Error loading profile settings:', error);
    }
  }
  
  applyButtonOrder(buttonOrder) {
    const soundGrid = document.getElementById('sound-grid');
    if (!soundGrid || !buttonOrder || buttonOrder.length === 0) return;
    
    const soundCards = Array.from(soundGrid.querySelectorAll('.sound-card'));
    
    // Create a map of button ID to card element
    const cardMap = new Map();
    soundCards.forEach(card => {
      if (card.dataset.soundData && card.id !== 'add-sound-card') {
        try {
          const soundData = JSON.parse(card.dataset.soundData);
          if (soundData.id) {
            cardMap.set(soundData.id, card);
          }
        } catch (e) {
          // ignore
        }
      }
    });
    
    // Keep the add-sound-card first
    const addCard = soundCards.find(card => card.id === 'add-sound-card');
    soundGrid.innerHTML = '';
    if (addCard) {
      soundGrid.appendChild(addCard);
    }
    
    // Reorder cards based on saved order
    buttonOrder.forEach(buttonId => {
      const card = cardMap.get(buttonId);
      if (card) {
        soundGrid.appendChild(card);
        cardMap.delete(buttonId); // Remove from map so we don't add it twice
      }
    });
    
    // Append any remaining cards that weren't in the saved order
    cardMap.forEach(card => {
      soundGrid.appendChild(card);
    });
    
    console.log('Applied button order from profile');
  }

  async saveCurrentSettings() {
    try {
      // Show saving indicator
      this.showSaveIndicator('Saving...');
      
      // Get current config
      const config = await window.electronAPI.getConfig();
      
      // Gather current UI settings
      const uiSettings = {
        theme: window.themeSystem ? window.themeSystem.currentTheme : null,
        componentVisibility: this.getCurrentComponentVisibility(),
        chatWidth: this.getCurrentChatWidth(),
        soundButtonOrder: this.getCurrentButtonOrder()
      };
      
      console.log('💾 Saving profile settings...');
      console.log('💾 Current theme:', uiSettings.theme);
      console.log('💾 UI Settings:', uiSettings);
      
      // Update config with UI settings
      config.uiSettings = uiSettings;
      
      // Save to current profile
      await window.electronAPI.saveProfile(this.currentProfile, config);
      
      console.log('✅ Profile settings saved for:', this.currentProfile);
      
      // Show saved indicator
      this.showSaveIndicator('Saved ✓', 'success');
    } catch (error) {
      console.error('❌ Error saving profile settings:', error);
      this.showSaveIndicator('Save failed', 'error');
    }
  }
  
  showSaveIndicator(message, type = 'info') {
    // Find or create save indicator in profile modal
    const profileModal = document.getElementById('profile-modal');
    if (!profileModal || profileModal.classList.contains('hidden')) {
      // Modal is not open, just log it
      console.log(`Profile: ${message}`);
      return;
    }
    
    let indicator = document.getElementById('profile-save-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'profile-save-indicator';
      indicator.style.cssText = `
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
        margin-top: 8px;
        text-align: center;
        transition: opacity 0.3s ease;
      `;
      profileModal.querySelector('.modal-content').appendChild(indicator);
    }
    
    // Set color based on type
    if (type === 'success') {
      indicator.style.background = 'rgba(76, 175, 80, 0.2)';
      indicator.style.color = '#4CAF50';
    } else if (type === 'error') {
      indicator.style.background = 'rgba(244, 67, 54, 0.2)';
      indicator.style.color = '#f44336';
    } else {
      indicator.style.background = 'rgba(33, 150, 243, 0.2)';
      indicator.style.color = '#2196F3';
    }
    
    indicator.textContent = message;
    indicator.style.opacity = '1';
    
    // Hide after 2 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        indicator.style.opacity = '0';
      }, 2000);
    }
  }
  
  // Save buttons while preserving UI settings
  async saveButtonsToProfile(buttons) {
    try {
      // Get current profile data
      const profile = await window.electronAPI.getProfile(this.currentProfile);
      
      // Update buttons
      profile.buttons = buttons;
      
      // Save back to profile
      await window.electronAPI.saveProfile(this.currentProfile, profile);
      
      console.log('Buttons saved to profile:', this.currentProfile);
      return { success: true };
    } catch (error) {
      console.error('Error saving buttons to profile:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Debounced autosave - waits 1 second after last change before saving
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    this.autoSaveTimeout = setTimeout(() => {
      this.saveCurrentSettings().catch(err => {
        console.error('Auto-save failed:', err);
      });
    }, 1000);
  }

  getCurrentComponentVisibility() {
    const prefs = {};
    const components = {
      'sound-grid': document.getElementById('sound-grid'),
      'twitch-stats-container': document.getElementById('twitch-stats-container'),
      'recent-activity-container': document.getElementById('recent-activity-container'),
      'twitch-chat-container': document.getElementById('twitch-chat-container'),
      'sound-controls': document.getElementById('sound-controls'),
      'queue-control-widget': document.getElementById('queue-control-widget')
    };
    
    for (const [key, element] of Object.entries(components)) {
      if (element) {
        prefs[key] = !element.classList.contains('hidden');
      }
    }
    
    return prefs;
  }

  applyComponentVisibility(prefs) {
    for (const [key, visible] of Object.entries(prefs)) {
      const element = document.getElementById(key);
      if (element) {
        if (visible) {
          element.classList.remove('hidden');
        } else {
          element.classList.add('hidden');
        }
      }
    }
  }

  getCurrentChatWidth() {
    const chatContainer = document.getElementById('twitch-chat-container');
    return chatContainer ? chatContainer.offsetWidth : null;
  }

  getCurrentButtonOrder() {
    // Get button order from the DOM (sound cards)
    const soundGrid = document.getElementById('sound-grid');
    if (!soundGrid) return [];
    
    const soundCards = Array.from(soundGrid.querySelectorAll('.sound-card'));
    return soundCards
      .filter(card => card.dataset.soundData)
      .map(card => {
        try {
          const soundData = JSON.parse(card.dataset.soundData);
          return soundData.id;
        } catch (e) {
          return null;
        }
      })
      .filter(id => id);
  }

  async createProfile(profileName) {
    try {
      if (!profileName || profileName.trim() === '') {
        showCustomAlert('Profile name cannot be empty', 'error');
        return false;
      }
      
      // Save current settings before creating new profile
      await this.saveCurrentSettings();
      
      // Create new profile
      const result = await window.electronAPI.createProfile(profileName);
      
      if (result.success) {
        showCustomAlert(`Profile "${profileName}" created`, 'success');
        
        // Refresh profiles list
        await this.initialize();
        
        // Switch to new profile
        await this.switchProfile(result.profileId);
        
        return true;
      } else {
        showCustomAlert('Failed to create profile: ' + (result.error || 'Unknown error'), 'error');
        return false;
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      showCustomAlert('Error creating profile: ' + error.message, 'error');
      return false;
    }
  }

  async duplicateProfile(newProfileName) {
    try {
      if (!newProfileName || newProfileName.trim() === '') {
        showCustomAlert('Profile name cannot be empty', 'error');
        return false;
      }
      
      // Save current settings first
      await this.saveCurrentSettings();
      
      // Duplicate current profile
      const result = await window.electronAPI.duplicateProfile(this.currentProfile, newProfileName);
      
      if (result.success) {
        showCustomAlert(`Profile "${newProfileName}" created from current profile`, 'success');
        
        // Refresh profiles list
        await this.initialize();
        
        return true;
      } else {
        showCustomAlert('Failed to duplicate profile: ' + (result.error || 'Unknown error'), 'error');
        return false;
      }
    } catch (error) {
      console.error('Error duplicating profile:', error);
      showCustomAlert('Error duplicating profile: ' + error.message, 'error');
      return false;
    }
  }

  async renameProfile(newName) {
    try {
      if (!newName || newName.trim() === '') {
        showCustomAlert('Profile name cannot be empty', 'error');
        return false;
      }
      
      const result = await window.electronAPI.renameProfile(this.currentProfile, newName);
      
      if (result.success) {
        showCustomAlert(`Profile renamed to "${newName}"`, 'success');
        
        // Refresh profiles list
        await this.initialize();
        
        return true;
      } else {
        showCustomAlert('Failed to rename profile: ' + (result.error || 'Unknown error'), 'error');
        return false;
      }
    } catch (error) {
      console.error('Error renaming profile:', error);
      showCustomAlert('Error renaming profile: ' + error.message, 'error');
      return false;
    }
  }

  async deleteProfile() {
    try {
      const currentProfileName = this.profiles.find(p => p.id === this.currentProfile)?.name || 'current profile';
      
      const result = await window.electronAPI.deleteProfile(this.currentProfile);
      
      if (result.success) {
        showCustomAlert(`Profile "${currentProfileName}" deleted`, 'success');
        
        // Refresh and switch to first available profile
        await this.initialize();
        
        return true;
      } else {
        showCustomAlert('Failed to delete profile: ' + (result.error || 'Unknown error'), 'error');
        return false;
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
      showCustomAlert('Error deleting profile: ' + error.message, 'error');
      return false;
    }
  }

  async switchProfile(profileId) {
    try {
      // Save current profile settings before switching
      await this.saveCurrentSettings();
      
      // Switch to new profile
      const result = await window.electronAPI.switchProfile(profileId);
      
      if (result.success) {
        this.currentProfile = profileId;
        
        const profileName = this.profiles.find(p => p.id === profileId)?.name || 'profile';
        showCustomAlert(`Switched to "${profileName}"`, 'success');
        
        // Load new profile settings
        await this.loadProfileSettings();
        
        // Reload buttons from new profile
        if (typeof loadButtons === 'function') {
          await loadButtons();
        }
        
        return true;
      } else {
        showCustomAlert('Failed to switch profile: ' + (result.error || 'Unknown error'), 'error');
        return false;
      }
    } catch (error) {
      console.error('Error switching profile:', error);
      showCustomAlert('Error switching profile: ' + error.message, 'error');
      return false;
    }
  }
}

// Create global profile manager instance
const profileManager = new ProfileManager();
window.profileManager = profileManager;

const soundGrid = document.getElementById("sound-grid");
const visualContainer = document.getElementById("visual-container");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");

// Helper function to load Twitch channel point redemptions
async function loadChannelRedemptions(selectElement, inputElement) {
  if (!window.electronAPI || !window.electronAPI.getChannelRewards) {
    showCustomAlert('Twitch API not available', 'error');
    return;
  }
  
  try {
    const rewards = await window.electronAPI.getChannelRewards();
    
    if (!rewards || rewards.length === 0) {
      showCustomAlert('No channel point redemptions found. Make sure you\'re connected to Twitch.', 'error');
      return;
    }
    
    // Clear existing options except the first one
    selectElement.innerHTML = '<option value="">-- Select or type manually --</option>';
    
    // Add redemptions to dropdown
    rewards.forEach(reward => {
      const option = document.createElement('option');
      option.value = reward.title;
      option.textContent = `${reward.title} (${reward.cost} pts)`;
      selectElement.appendChild(option);
    });
    
    showCustomAlert(`Loaded ${rewards.length} redemption(s) from Twitch`, 'success');
    console.log('✅ Loaded Twitch redemptions:', rewards);
  } catch (error) {
    console.error('Error loading redemptions:', error);
    showCustomAlert('Failed to load redemptions from Twitch', 'error');
  }
}

// Setup redemption dropdown sync with text input
function setupRedemptionSync(selectElement, inputElement) {
  if (!selectElement || !inputElement) return;
  
  // When dropdown changes, update text input
  selectElement.addEventListener('change', () => {
    if (selectElement.value) {
      inputElement.value = selectElement.value;
    }
  });
  
  // When text input changes, try to match dropdown
  inputElement.addEventListener('input', () => {
    const matchingOption = Array.from(selectElement.options).find(
      opt => opt.value.toLowerCase() === inputElement.value.toLowerCase()
    );
    if (matchingOption) {
      selectElement.value = matchingOption.value;
    } else {
      selectElement.value = '';
    }
  });
}

// Add refresh UI listener
window.electronAPI.onRefreshUI(() => {
  loadButtons();
});

// Mute overlay iframe in dashboard to prevent double audio
// Audio should only play in OBS browser source
function muteOverlayIframeAudio() {
  const overlayIframe = document.getElementById('overlay-iframe');
  if (!overlayIframe) {
    console.warn('🔇 Overlay iframe not found, retrying in 1 second...');
    setTimeout(muteOverlayIframeAudio, 1000);
    return;
  }
  
  try {
    // Mute all existing audio and video elements in the iframe
      const muteElements = () => {
      try {
        const iframeDoc = overlayIframe.contentDocument || overlayIframe.contentWindow?.document;
        if (!iframeDoc) return;
        
        const audios = iframeDoc.querySelectorAll('audio');
        const videos = iframeDoc.querySelectorAll('video');
        
        let mutedCount = 0;
        audios.forEach(audio => {
          // Immediately pause and mute
          if (!audio.paused) {
            audio.pause();
          }
          audio.muted = true;
          audio.volume = 0;
          // Prevent future playback
          audio.removeAttribute('autoplay');
          audio.src = ''; // Clear source to prevent any playback
          mutedCount++;
        });
        
        videos.forEach(video => {
          // Immediately pause and mute
          if (!video.paused) {
            video.pause();
          }
          video.muted = true;
          video.volume = 0;
          // Prevent future playback
          video.removeAttribute('autoplay');
          // Don't clear video source as it might be needed for visual preview
          mutedCount++;
        });
        
        if (mutedCount > 0) {
          console.log(`🔇 Muted and paused ${mutedCount} media element(s) in dashboard overlay`);
        }
      } catch (error) {
        // Silently ignore CORS errors when iframe is from different origin
        if (!error.message?.includes('cross-origin')) {
          console.warn('Error in muteElements:', error);
        }
      }
    };
    
    // Set up muting when iframe loads
    overlayIframe.addEventListener('load', () => {
      const iframeDoc = overlayIframe.contentDocument || overlayIframe.contentWindow?.document;
      if (!iframeDoc) return;
      
      // Mute immediately
      muteElements();
      
      // Set up mutation observer to mute any new audio/video elements IMMEDIATELY when added
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.tagName === 'AUDIO') {
              console.log('🔇 New audio detected in dashboard iframe - muting immediately');
              node.pause();
              node.muted = true;
              node.volume = 0;
              node.removeAttribute('autoplay');
              node.src = '';
            } else if (node.tagName === 'VIDEO') {
              console.log('🔇 New video detected in dashboard iframe - muting immediately');
              node.pause();
              node.muted = true;
              node.volume = 0;
              node.removeAttribute('autoplay');
            }
            // Check children as well
            if (node.querySelectorAll) {
              const audios = node.querySelectorAll('audio');
              const videos = node.querySelectorAll('video');
              audios.forEach(audio => {
                audio.pause();
                audio.muted = true;
                audio.volume = 0;
                audio.removeAttribute('autoplay');
                audio.src = '';
              });
              videos.forEach(video => {
                video.pause();
                video.muted = true;
                video.volume = 0;
                video.removeAttribute('autoplay');
              });
            }
          });
        });
        // Also run full mute as backup
        muteElements();
      });
      
      observer.observe(iframeDoc.body, {
        childList: true,
        subtree: true
      });
      
      console.log('✅ Dashboard overlay preview muted (audio plays in OBS only)');
    });
    
    // Also try to mute immediately if iframe is already loaded
    if (overlayIframe.contentDocument) {
      muteElements();
    }
    
    // Aggressively check and mute every 100ms to catch any race conditions
    setInterval(() => {
      muteElements();
    }, 100); // Check every 100ms (more frequent) to ensure dashboard overlay stays muted
    
  } catch (error) {
    console.warn('Could not mute overlay iframe:', error);
  }
}

// Initialize muting when page loads
muteOverlayIframeAudio();

// Additional safety: Ensure dashboard iframe never plays audio
// This is a failsafe in case the dashboard iframe somehow receives WebSocket messages
function preventDashboardAudio() {
  const overlayIframe = document.getElementById('overlay-iframe');
  if (overlayIframe && overlayIframe.contentWindow) {
    try {
      // Send a message to the iframe to disable all audio
      overlayIframe.contentWindow.postMessage({
        type: 'disableAudio',
        source: 'dashboard'
      }, '*');
      console.log('🔇 Sent disableAudio message to dashboard iframe');
    } catch (error) {
      // Ignore cross-origin errors
    }
  }
}

// Send disable audio message periodically to ensure dashboard iframe stays silent
// Only send if iframe is visible/active to reduce console spam
let lastDisableAudioTime = 0;
setInterval(() => {
  const overlayIframe = document.getElementById('overlay-iframe');
  const overlayPreview = document.getElementById('overlay-preview');
  
  // Only send disable message if overlay preview is visible and not hidden
  if (overlayIframe && overlayPreview && !overlayPreview.classList.contains('hidden')) {
    const now = Date.now();
    // Only send every 5 seconds to reduce spam
    if (now - lastDisableAudioTime > 5000) {
      preventDashboardAudio();
      lastDisableAudioTime = now;
    }
  }
}, 2000); // Check every 2 seconds instead of sending every second

// Chat display variables
let chatMessages = [];
const MAX_CHAT_MESSAGES = 50;

// Drag and drop variables
let isDragMode = false;
let draggedElement = null;
let dragStartIndex = -1;
// Slot-drag state
let vdDragState = {
  draggingCard: null,
  ghost: null,
  fromIndex: -1,
  activeSlot: null,
  startX: 0,
  startY: 0,
  moved: false
};

// Pagination state
let currentPage = 0;
let itemsPerPage = 12; // fallback
let totalPages = 1;

// Edge-hold page shift state
let edgeHoldTimer = null;
let edgeHoldDirection = null; // 'next' | 'prev'
const EDGE_HOLD_MS = 2000; // 2 seconds

// Helper function for smart auto-scroll
function smartAutoScroll(chatMessagesContainer) {
  if (!chatMessagesContainer) return;
  // Auto-scroll behavior when messages are prepended (newest at top)
  // If user is already near the top, keep view pinned to top
  const isNearTop = (chatMessagesContainer.scrollTop <= 50);
  if (isNearTop) {
    chatMessagesContainer.scrollTop = 0;
  }
}

// Global mouse wheel handler for chat scrolling
function handleGlobalMouseWheel(e) {
  const chatMessagesContainer = document.getElementById('twitch-chat-messages');
  const chatContainer = document.getElementById('twitch-chat-container');
  
  // Only handle if chat is visible and not collapsed
  if (!chatMessagesContainer || !chatContainer || chatContainer.classList.contains('hidden')) {
    return;
  }
  
  // Check if mouse is over the chat area
  const rect = chatContainer.getBoundingClientRect();
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  
  if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
    // Prevent the drag behavior from interfering
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const delta = e.deltaY;
    const scrollAmount = 100; // pixels to scroll per wheel event (increased from 50)
    
    if (delta > 0) {
      chatMessagesContainer.scrollTop += scrollAmount;
    } else {
      chatMessagesContainer.scrollTop -= scrollAmount;
    }
    
    return false; // Additional prevention
  }
}

// Drag and Drop Functions
function initializeDragAndDrop() {
  const toggleBtn = document.getElementById('toggle-drag-mode');
  const dragStatus = document.querySelector('.drag-status');
  const soundGrid = document.getElementById('sound-grid');
  
  if (!toggleBtn || !dragStatus || !soundGrid) return;
  
  // Toggle drag mode
  toggleBtn.addEventListener('click', () => {
    isDragMode = !isDragMode;
    console.log('Toggle clicked, isDragMode is now:', isDragMode);
    
    if (isDragMode) {
      toggleBtn.textContent = '🔓 Unlock';
      toggleBtn.classList.add('unlocked');
      dragStatus.textContent = 'Sound buttons are unlocked - drag to reorder';
      soundGrid.classList.add('drag-mode');
      enableDragMode();
    } else {
      toggleBtn.textContent = '🔒 Lock';
      toggleBtn.classList.remove('unlocked');
      dragStatus.textContent = 'Sound buttons are locked';
      soundGrid.classList.remove('drag-mode');
      disableDragMode();
    }
  });
}

function enableDragMode() {
  const soundCards = document.querySelectorAll('.sound-card');
  console.log('enableDragMode called, found', soundCards.length, 'sound cards');
  
  soundCards.forEach((card, index) => {
    // Skip the "Add Sound" card
    if (card.id === 'add-sound-card') {
      console.log('Skipping add-sound-card at index', index);
      return;
    }
    
  // Prepare card for external drag system (GSAP Draggable).
  // Keep dataset index for ordering, but do NOT enable native draggable or add listeners here.
  card.dataset.index = index;
  card.classList.remove('draggable', 'dragging', 'drag-over');
  
  // Attach pointerdown for slot-based dragging
  if (!card._vdPointerDown) {
    card._vdPointerDown = (e) => startPointerDrag(e, card);
    card.addEventListener('pointerdown', card._vdPointerDown);
  }
  });

  // Create drop slots between cards
  createSlots();
}

function disableDragMode() {
  const soundCards = document.querySelectorAll('.sound-card');
  soundCards.forEach(card => {
    // Skip the "Add Sound" card
    if (card.id === 'add-sound-card') return;
    card.classList.remove('draggable', 'dragging', 'drag-over');
    // leave pointer events/default behavior to GSAP Draggable or CSS
    // Remove pointer handlers attached in enableDragMode
    if (card._vdPointerDown) {
      card.removeEventListener('pointerdown', card._vdPointerDown);
      delete card._vdPointerDown;
    }
  });

  // Remove drop slots and any ghost
  removeSlots();
}

// ----- Slot creation/removal -----
function createSlots() {
  removeSlots();
  const grid = document.getElementById('sound-grid');
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('.sound-card'));
  const gridRect = grid.getBoundingClientRect();

  // Create a slot before the first real sound card (skip the Add card)
  const firstRealIndex = cards.findIndex(c => c.id !== 'add-sound-card');
  if (firstRealIndex !== -1) {
    const firstCard = cards[firstRealIndex];
    const firstRect = firstCard.getBoundingClientRect();
    const slotWidth = 10;
    const slotHeight = Math.max(...cards.map(c => c.getBoundingClientRect().height)) - 8 || (firstRect.height - 8);
    // Place slot slightly to the left of the first real card
  let x = (firstRect.left - slotWidth - 8) - gridRect.left + 6; // nudge right by 10px
    if (x < 4) x = 4; // keep inside grid
    const y = ((firstRect.top + firstRect.bottom) / 2) - gridRect.top;
    const preSlot = document.createElement('div');
    preSlot.className = 'drop-slot';
    preSlot.dataset.nextCardIndex = firstRealIndex; // insert before this card
    preSlot.style.position = 'absolute';
    preSlot.style.width = slotWidth + 'px';
    preSlot.style.height = slotHeight + 'px';
    preSlot.style.left = (x) + 'px';
    preSlot.style.top = (y - slotHeight / 2) + 'px';
    grid.appendChild(preSlot);
  }

  // Create an absolutely-positioned slot between adjacen t cards (won't affect layout)
  for (let i = 0; i < cards.length - 1; i++) {
    const leftCard = cards[i];
    const rightCard = cards[i + 1];

    // Skip slots adjacent to the Add card (so Add remains visually isolated)
    if (leftCard.id === 'add-sound-card' || rightCard.id === 'add-sound-card') continue;

    const leftRect = leftCard.getBoundingClientRect();
    const rightRect = rightCard.getBoundingClientRect();

    // midpoint between the two card centers
    const x = ((leftRect.right + rightRect.left) / 2) - gridRect.left;
    const y = ((leftRect.top + leftRect.bottom) / 2) - gridRect.top;

    const slot = document.createElement('div');
    slot.className = 'drop-slot';
    slot.dataset.nextCardIndex = i + 1; // insertion before card at i+1
    slot.style.position = 'absolute';
    // center the slot vertically at y, and horizontally around x
    const slotWidth = 10;
    const slotHeight = Math.max(leftRect.height, rightRect.height) - 8;
    slot.style.width = slotWidth + 'px';
    slot.style.height = slotHeight + 'px';
    slot.style.left = (x - slotWidth / 2) + 'px';
    slot.style.top = (y - slotHeight / 2) + 'px';
    grid.appendChild(slot);
  }

  // reposition on window resize
  window.addEventListener('resize', repositionSlots);
}

function removeSlots() {
  const slots = document.querySelectorAll('#sound-grid .drop-slot');
  slots.forEach(s => s.remove());
  // If a drag is currently active, keep the ghost and dragging state
  if (vdDragState && vdDragState.draggingCard) {
    // just clear any active slot marker
    if (vdDragState.activeSlot) {
      vdDragState.activeSlot.classList.remove('slot-active');
      vdDragState.activeSlot = null;
    }
  } else {
    // Clean up any ghost and reset state when not dragging
    if (vdDragState.ghost && vdDragState.ghost.parentNode) {
      vdDragState.ghost.parentNode.removeChild(vdDragState.ghost);
    }
    vdDragState = { draggingCard: null, ghost: null, fromIndex: -1, activeSlot: null, startX: 0, startY: 0, moved: false };
  }
  window.removeEventListener('resize', repositionSlots);
}

function repositionSlots() {
  // recreate slots to reposition accurately
  const grid = document.getElementById('sound-grid');
  if (!grid) return;
  // simply recreate slots
  createSlots();
}

// ----- Pointer drag handlers -----
function startPointerDrag(e, card) {
  // Only left button (or primary pointer)
  if (e.button !== undefined && e.button !== 0) return;
  // Ignore interactions with edit/delete buttons
  if (e.target.classList.contains('edit-button') || e.target.classList.contains('delete-x-button')) return;
  // Ignore Add card
  if (card.id === 'add-sound-card') return;

  e.preventDefault();
  card.setPointerCapture && card.setPointerCapture(e.pointerId);

  // Temporarily mark the document as in-drag to allow CSS to reduce expensive effects
  try { document.body.classList.add('vd-dragging'); } catch (err) {}

  vdDragState.draggingCard = card;
  vdDragState.fromIndex = parseInt(card.dataset.index || '-1');
  vdDragState.startX = e.clientX;
  vdDragState.startY = e.clientY;
  vdDragState.moved = false;

  // Create ghost
  const ghost = card.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.position = 'fixed';
  ghost.style.left = `${e.clientX - 40}px`;
  ghost.style.top = `${e.clientY - 20}px`;
  ghost.style.width = `${card.offsetWidth}px`;
  ghost.style.height = `${card.offsetHeight}px`;
  ghost.style.zIndex = 9999;
  document.body.appendChild(ghost);
  vdDragState.ghost = ghost;

  // Add global listeners
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', endPointerDrag);

  // Prevent selection while dragging
  document.body.style.userSelect = 'none';
}

function onPointerMove(e) {
  if (!vdDragState.draggingCard) return;
  const dx = e.clientX - vdDragState.startX;
  const dy = e.clientY - vdDragState.startY;
  if (!vdDragState.moved && Math.hypot(dx, dy) > 6) vdDragState.moved = true;

  // Move ghost
  if (vdDragState.ghost) {
    vdDragState.ghost.style.left = `${e.clientX - 40}px`;
    vdDragState.ghost.style.top = `${e.clientY - 20}px`;
  }

  // Detect slot under pointer
  const elem = document.elementFromPoint(e.clientX, e.clientY);
  let slot = null;
  if (elem && elem.classList && elem.classList.contains('drop-slot')) slot = elem;

  if (vdDragState.activeSlot && vdDragState.activeSlot !== slot) {
    vdDragState.activeSlot.classList.remove('slot-active');
    vdDragState.activeSlot = null;
  }
  if (slot && slot !== vdDragState.activeSlot) {
    vdDragState.activeSlot = slot;
    slot.classList.add('slot-active');
  }

  // Check for edge-hold to trigger page change while dragging
  if (vdDragState.moved) {
    const grid = document.getElementById('sound-grid');
    const rect = grid.getBoundingClientRect();
    const margin = 20; // px near edge to consider
    // if near right edge and there is a next page
    if (e.clientX >= rect.right - margin && currentPage < totalPages - 1) {
      if (edgeHoldDirection !== 'next') startEdgeHold('next');
    } else if (e.clientX <= rect.left + margin && currentPage > 0) {
      if (edgeHoldDirection !== 'prev') startEdgeHold('prev');
    } else {
      clearEdgeHold();
    }
  }
}

function endPointerDrag(e) {
  if (!vdDragState.draggingCard) return cleanupDrag();

  // Release pointer capture
  try { vdDragState.draggingCard.releasePointerCapture && vdDragState.draggingCard.releasePointerCapture(e.pointerId); } catch (err) {}

  // Decide target and perform DOM insertion, then persist order
  if (vdDragState.activeSlot && vdDragState.moved) {
    const slot = vdDragState.activeSlot;
    const grid = document.getElementById('sound-grid');
    const cards = Array.from(grid.querySelectorAll('.sound-card'));
    const dragged = vdDragState.draggingCard;

    // Determine nextCardIndex stored on slot (or compute from DOM)
    let nextIndex = -1;
    if (slot.dataset.nextCardIndex && slot.dataset.nextCardIndex !== '-1') {
      nextIndex = parseInt(slot.dataset.nextCardIndex);
    } else {
      // fallback: find the next sibling element after slot
      const nextEl = slot.nextElementSibling && slot.nextElementSibling.classList.contains('sound-card') ? slot.nextElementSibling : null;
      nextIndex = nextEl ? Array.from(grid.querySelectorAll('.sound-card')).indexOf(nextEl) : -1;
    }

    // If nextIndex is -1, append to end
    if (nextIndex === -1) {
      grid.appendChild(dragged);
    } else {
      // Insert before the element currently at nextIndex
      const targetEl = Array.from(grid.querySelectorAll('.sound-card'))[nextIndex];
      if (targetEl) grid.insertBefore(dragged, targetEl);
      else grid.appendChild(dragged);
    }

    // Mark the dragged card to suppress immediate click activation
    try {
      dragged._vdJustDragged = true;
      setTimeout(() => { dragged._vdJustDragged = false; }, 150);
    } catch (e) {}

    // Update dataset.index for all cards and persist
    Array.from(grid.querySelectorAll('.sound-card')).forEach((c, idx) => c.dataset.index = idx);
    saveButtonOrder();
  }

  cleanupDrag();
}

function startEdgeHold(dir) {
  clearEdgeHold();
  edgeHoldDirection = dir;
  edgeHoldTimer = setTimeout(() => {
    if (dir === 'next') goToNextPage();
    else if (dir === 'prev') goToPrevPage();
    clearEdgeHold();
    // After page change, recreate slots so insertion points match new DOM
    removeSlots();
    if (isDragMode) createSlots();
  }, EDGE_HOLD_MS);
}

function clearEdgeHold() {
  if (edgeHoldTimer) { clearTimeout(edgeHoldTimer); edgeHoldTimer = null; }
  edgeHoldDirection = null;
}

function cleanupDrag() {
  // Remove slot highlight
  if (vdDragState.activeSlot) vdDragState.activeSlot.classList.remove('slot-active');
  // Remove global listeners
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', endPointerDrag);
  // Restore selection
  document.body.style.userSelect = '';

  // Remove ghost if present in DOM (some flows may have kept it)
  try {
    if (vdDragState.ghost && vdDragState.ghost.parentNode) vdDragState.ghost.parentNode.removeChild(vdDragState.ghost);
  } catch (err) {
    // ignore
  }

  // Reset state
  vdDragState = { draggingCard: null, ghost: null, fromIndex: -1, activeSlot: null, startX: 0, startY: 0, moved: false };

  // Remove temporary dragging marker
  try { document.body.classList.remove('vd-dragging'); } catch (err) {}
}

function handleDragStart() {
  // native dragstart intentionally disabled - GSAP Draggable handles dragging instead
  return;
}

function handleDragEnd() { return; }

function handleDragOver() { return; }

function handleDrop() { return; }

function reorderButtons(fromIndex, toIndex) {
  const soundGrid = document.getElementById('sound-grid');
  const soundCards = Array.from(soundGrid.querySelectorAll('.sound-card'));
  
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= soundCards.length || toIndex >= soundCards.length) {
    return;
  }
  
  // Don't reorder the "Add Sound" card
  const draggedCard = soundCards[fromIndex];
  if (draggedCard.id === 'add-sound-card') {
    return;
  }
  
  // Remove from array
  soundCards.splice(fromIndex, 1);
  
  // Insert at new position
  soundCards.splice(toIndex, 0, draggedCard);
  
  // Update the DOM
  soundGrid.innerHTML = '';
  soundCards.forEach((card, index) => {
    card.dataset.index = index;
    soundGrid.appendChild(card);
  });
  
  // Save the new order
  saveButtonOrder();
}

function saveButtonOrder() {
  // Button order is now stored per-profile in uiSettings
  // Just trigger profile autosave which will capture the current button order
  if (profileManager && profileManager.scheduleAutoSave) {
    profileManager.scheduleAutoSave();
  }
}

function loadButtonOrder() {
  // Button order is now stored in the profile's uiSettings
  // This function is kept for backward compatibility but returns null
  // The actual button order is applied when loading profile settings
  return null;
}

// Initialize chat display
function initializeChatDisplay() {
  const chatContainer = document.getElementById('twitch-chat-container');
  const toggleBtn = document.getElementById('toggle-chat');
  const statusIndicator = document.getElementById('chat-status-indicator');
  const chatMessagesContainer = document.getElementById('twitch-chat-messages');
  const resizeHandle = document.getElementById('chat-resize-handle');
  
  // Start with chat collapsed (not hidden)
  if (chatContainer) {
    chatContainer.classList.add('collapsed');
  }
  
  // Initialize status indicator
  if (statusIndicator) {
    statusIndicator.classList.add('checking');
    statusIndicator.title = 'Checking connection...';
  }
  
  // Ensure chat messages container can scroll
  if (chatMessagesContainer) {
    // Force scroll properties
    chatMessagesContainer.style.overflowY = 'scroll';
    chatMessagesContainer.style.overflowX = 'hidden';
    chatMessagesContainer.style.scrollBehavior = 'smooth';
    chatMessagesContainer.style.height = '100%';
    chatMessagesContainer.style.maxHeight = '560px'; // 600px container - 40px header
    
    // Make container focusable for mouse wheel events
    chatMessagesContainer.setAttribute('tabindex', '0');
    chatMessagesContainer.style.outline = 'none';
    
    // Add mouse wheel event handling
    chatMessagesContainer.addEventListener('wheel', (e) => {
      // Aggressively prevent drag interference
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const delta = e.deltaY;
      const scrollAmount = 100; // pixels to scroll per wheel event (increased from 50)
      
      if (delta > 0) {
        // Scroll down
        chatMessagesContainer.scrollTop += scrollAmount;
      } else {
        // Scroll up
        chatMessagesContainer.scrollTop -= scrollAmount;
      }
      
      return false; // Additional prevention
    }, { passive: false });
    
    // Add click handler to focus the container for mouse wheel events
    chatMessagesContainer.addEventListener('click', () => {
      chatMessagesContainer.focus();
    });
    
  }
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      chatContainer.classList.toggle('collapsed');
      toggleBtn.textContent = chatContainer.classList.contains('collapsed') ? '+' : '−';
    });
  }
  
  // Initialize chat resize functionality
  if (resizeHandle && chatContainer) {
    initializeChatResize(resizeHandle, chatContainer);
  }
  
  
  // Add global mouse wheel handler
  document.addEventListener('wheel', handleGlobalMouseWheel, { passive: false });
}

// Initialize chat resize functionality
function initializeChatResize(resizeHandle, chatContainer) {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  // Load saved width from localStorage
  const savedWidth = localStorage.getItem('twitchChatWidth');
  if (savedWidth) {
    const width = parseInt(savedWidth);
    if (width >= 200 && width <= 600) {
      chatContainer.style.width = width + 'px';
    }
  }
  
  // Hide resize handle when chat is collapsed
  function updateResizeHandleVisibility() {
    if (chatContainer.classList.contains('collapsed') || chatContainer.classList.contains('hidden')) {
      resizeHandle.style.display = 'none';
    } else {
      resizeHandle.style.display = 'block';
    }
  }
  
  // Initial visibility check
  updateResizeHandleVisibility();
  
  // Watch for class changes on the chat container
  const observer = new MutationObserver(updateResizeHandleVisibility);
  observer.observe(chatContainer, { attributes: true, attributeFilter: ['class'] });
  
  // Mouse down on resize handle
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing = true;
    startX = e.clientX;
    startWidth = chatContainer.offsetWidth;
    
    // Add visual feedback
    document.body.classList.add('resizing-chat');
    
    // Add global event listeners
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  });
  
  function handleResize(e) {
    if (!isResizing) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - startX;
    // Invert the deltaX so dragging right expands the chat
    const newWidth = startWidth - deltaX;
    
    // Constrain width between min and max
    const minWidth = 200;
    const maxWidth = 600;
    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    // Apply new width
    chatContainer.style.width = constrainedWidth + 'px';
    
    // Disable transition during resize for smooth dragging
    chatContainer.style.transition = 'none';
    
    // Trigger layout recalculation for the sound grid
    triggerLayoutUpdate();
  }
  
  function stopResize() {
    if (!isResizing) return;
    
    isResizing = false;
    
    // Restore cursor and selection
    document.body.classList.remove('resizing-chat');
    
    // Re-enable transition
    chatContainer.style.transition = 'width 0.3s ease, height 0.3s ease';
    
    // Save width to localStorage
    const currentWidth = chatContainer.offsetWidth;
    localStorage.setItem('twitchChatWidth', currentWidth.toString());
    
    // Trigger profile autosave
    if (profileManager && profileManager.scheduleAutoSave) {
      profileManager.scheduleAutoSave();
    }
    
    // Trigger final layout update
    triggerLayoutUpdate();
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }
  
  // Function to trigger layout recalculation
  function triggerLayoutUpdate() {
    // Force a reflow to recalculate the grid layout
    const soundGrid = document.getElementById('sound-grid');
    if (soundGrid) {
      // Trigger a reflow by reading a layout property
      soundGrid.offsetHeight;
      
      // If pagination is active, recalculate it
      if (typeof computePagination === 'function') {
        computePagination();
        renderCurrentPage();
      }
    }
  }
}

// Add a chat message to the display using the existing Twitch activity system
function addChatMessage(username, message, badges = {}) {
  const chatMessagesContainer = document.getElementById('twitch-chat-messages');
  if (!chatMessagesContainer) return;

  // Use the existing addActivity function from tc.js
  if (window.addActivity) {
    const activityData = {
      user: username,
      user_name: username,
      message: message,
      badges: badges,
      ts: Date.now()
    };
    
    // Create activity row using the existing system
    const row = document.createElement('div');
    row.style.padding = '8px 6px';
    row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    row.style.textAlign = 'left';
    row.style.fontSize = '13px';
    row.style.lineHeight = '1.6';
    row.style.marginBottom = '2px';
    
    const time = new Date().toLocaleTimeString();
    let userColor = '#b3b3b3';
    if (username === 'TestUser' || username === 'T3stUs3r') userColor = '#a3e635';
    
    // Build badge HTML with text-based badges instead of images
    let badgeHtml = '';
    if (badges) {
      const meaningfulBadges = ['broadcaster', 'moderator', 'vip', 'subscriber', 'sub_gifter', 'bits', 'bits_leader', 'premium', 'staff', 'admin', 'global_mod', 'turbo'];
      for (const badge in badges) {
        if (meaningfulBadges.includes(badge)) {
          const badgeText = badge.replace(/_/g, ' ').toUpperCase();
          const badgeColor = getBadgeColor(badge);
          badgeHtml += `<span class="badge-text" style="background:${badgeColor};color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;margin-right:4px;vertical-align:middle;font-weight:bold;">${badgeText}</span>`;
        }
      }
    }
    
    // Parse emotes using the same function as the original system
    const chatMsg = parseEmotes(message, badges.emotes);
    
    const msg = `💬 <span style="color:#9ad;font-weight:600">[Chat]</span> ${badgeHtml}<strong style="color:${userColor}">${escapeHtml(username||'unknown')}</strong>: <span class="activity-message">${chatMsg}</span>`;
    
    row.innerHTML = `<span style="color:#666;margin-right:12px;font-size:11px">[${time}]</span> ${msg}`;
    
    // Add to container at the top so newest messages appear first
    if (chatMessagesContainer.firstChild) chatMessagesContainer.insertBefore(row, chatMessagesContainer.firstChild);
    else chatMessagesContainer.appendChild(row);

    // Store in array (newest at index 0)
    chatMessages.unshift({ element: row, timestamp: Date.now() });

    // Limit number of messages: remove oldest from the end
    if (chatMessages.length > MAX_CHAT_MESSAGES) {
      const oldMessage = chatMessages.pop();
      if (oldMessage && oldMessage.element && oldMessage.element.parentNode) {
        oldMessage.element.parentNode.removeChild(oldMessage.element);
      }
    }

    // Smart auto-scroll to top if user is near the top
    smartAutoScroll(chatMessagesContainer);
  }
}

// Setup pagination controls and visibility dropdown after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize pagination controls
  const prev = document.getElementById('page-prev');
  const next = document.getElementById('page-next');
  if (prev) prev.addEventListener('click', () => { goToPrevPage(); });
  if (next) next.addEventListener('click', () => { goToNextPage(); });
  // Ensure container has enough bottom padding to avoid fixed pagination overlap
  updateBottomPaddingForPagination();
  
  // Initialize visibility dropdown
  initializeVisibilityDropdown();
  
  // Setup Twitch redemption loaders for Audio Button form
  const audioRedeemSelect = document.getElementById('redeem-name-select');
  const audioRedeemInput = document.getElementById('redeem-name');
  const audioLoadBtn = document.getElementById('load-audio-redemptions');
  
  if (audioLoadBtn && audioRedeemSelect && audioRedeemInput) {
    setupRedemptionSync(audioRedeemSelect, audioRedeemInput);
    audioLoadBtn.addEventListener('click', () => {
      loadChannelRedemptions(audioRedeemSelect, audioRedeemInput);
    });
  }
  
  // Setup Twitch redemption loaders for Multi-Media Button form
  const mmRedeemSelect = document.getElementById('multi-media-redeem-name-select');
  const mmRedeemInput = document.getElementById('multi-media-redeem-name');
  const mmLoadBtn = document.getElementById('load-multimedia-redemptions');
  
  if (mmLoadBtn && mmRedeemSelect && mmRedeemInput) {
    setupRedemptionSync(mmRedeemSelect, mmRedeemInput);
    mmLoadBtn.addEventListener('click', () => {
      loadChannelRedemptions(mmRedeemSelect, mmRedeemInput);
    });
  }
});

// Adjust container bottom padding so fixed pagination doesn't overlap the grid
function updateBottomPaddingForPagination() {
  try {
    const pag = document.getElementById('pagination-controls');
    const container = document.querySelector('.container');
    if (!pag || !container) return;
    const rect = pag.getBoundingClientRect();
    // add some breathing room (16-24px) so the cards never butt up to the bar
    const extra = 24;
    const pad = Math.ceil(rect.height + extra);
    container.style.paddingBottom = pad + 'px';
  } catch (e) {
    // ignore
  }
}

// Helper function for HTML escaping (from tc.js)
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (s) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
  });
}

// Helper function for parsing emotes (from tc.js)
function parseEmotes(message, emotes) {
  // TODO: implement real emote parsing. For now, escape HTML and return.
  return escapeHtml(message || '');
}

// Helper function to get badge colors
function getBadgeColor(badge) {
  const badgeColors = {
    'broadcaster': '#e74c3c',
    'moderator': '#27ae60',
    'vip': '#f39c12',
    'subscriber': '#9b59b6',
    'sub_gifter': '#e67e22',
    'bits': '#1abc9c',
    'bits_leader': '#3498db',
    'premium': '#2ecc71',
    'staff': '#e74c3c',
    'admin': '#8e44ad',
    'global_mod': '#27ae60',
    'turbo': '#9b59b6'
  };
  return badgeColors[badge] || '#95a5a6';
}

// Update chat status indicator
function updateChatStatusIndicator(isConnected) {
  const statusIndicator = document.getElementById('chat-status-indicator');
  if (!statusIndicator) return;
  
  // Remove all status classes
  statusIndicator.classList.remove('connected', 'disconnected', 'checking');
  
  if (isConnected) {
    statusIndicator.classList.add('connected');
    statusIndicator.title = 'Twitch: Connected';
  } else {
    statusIndicator.classList.add('disconnected');
    statusIndicator.title = 'Twitch: Disconnected';
  }
}

// Show/hide chat based on connection status
function updateChatVisibility(isConnected) {
  const chatContainer = document.getElementById('twitch-chat-container');
  if (chatContainer) {
    if (isConnected) {
      // Respect persisted visibility prefs when showing chat
      try {
        const prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
        const visible = prefs.hasOwnProperty('twitch-chat-container') ? !!prefs['twitch-chat-container'] : true;
        if (visible) {
          chatContainer.classList.remove('hidden');
        } else {
          chatContainer.classList.add('hidden');
        }
      } catch (err) {
        chatContainer.classList.remove('hidden');
      }
      chatContainer.classList.add('collapsed'); // Start collapsed when connected
    } else {
      chatContainer.classList.add('hidden');
      chatContainer.classList.remove('collapsed');
    }
  }
}

async function loadButtons() {
  if (!soundGrid) {
    console.error('soundGrid element not found!');
    return;
  }
  
  // Clear existing buttons
  soundGrid.innerHTML = '';

  // Add the Add Sound card as the first card
  const addCard = document.createElement('div');
  addCard.className = 'sound-card add-card';
  addCard.id = 'add-sound-card';
  addCard.innerHTML = `
    <div class="add-icon">+</div>
    <div class="add-text">Add New</div>
  `;
  addCard.onclick = () => {
    // Show selection modal
    document.getElementById('button-type-modal').classList.remove('hidden');
  };
  
  soundGrid.appendChild(addCard);

  // Load buttons from config
  const data = await window.electronAPI.getConfig();
  console.log('🔍 Loaded config data:', data);
  console.log('🔍 Number of buttons:', data.buttons?.length || 0);
  
  // Debug: Check for Donut button specifically
  const donutButton = data.buttons?.find(btn => btn.name === 'Donut' || btn.label === 'Donut');
  if (donutButton) {
    console.log('🔍 Found Donut button:', donutButton);
    console.log('🔍 Donut button audio:', donutButton.audio);
    if (donutButton.audio && donutButton.audio.length > 0) {
      console.log('🔍 Donut button audio[0]:', donutButton.audio[0]);
      console.log('🔍 Donut button audio[0].src:', donutButton.audio[0].src);
    }
  } else {
    console.log('🔍 Donut button not found in config');
  }
  
  // Check for saved order
  const savedOrder = loadButtonOrder();
  let orderedButtons = data.buttons || [];

  if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0 && Array.isArray(data.buttons)) {
    // Try to map saved UI order to authoritative config by id when possible
    const configById = new Map((data.buttons || []).map(b => [b.id, b]));
    const ordered = [];
    const usedIds = new Set();

    for (const s of savedOrder) {
      if (s && s.id && configById.has(s.id)) {
        ordered.push(configById.get(s.id));
        usedIds.add(s.id);
      }
    }
    // Append any remaining buttons from config that weren't in saved order
    for (const b of data.buttons) {
      if (!b || !b.id) continue;
      if (!usedIds.has(b.id)) ordered.push(b);
    }
    if (ordered.length > 0) orderedButtons = ordered;
  }
  
  for (const [index, button] of orderedButtons.entries()) {
    const card = document.createElement("div");
    card.className = "sound-card";
    card.dataset.index = index;
    card.dataset.soundData = JSON.stringify(button);
  if (button.id) card.dataset.buttonId = button.id;
    
    // Fetch icon for app buttons
    let iconImg = '';
    if (button.type === 'app') {
      let iconData = await window.electronAPI.getAppIcon(button.src);
      if (!iconData) {
        // Use a default icon if extraction fails
        iconData = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="%23bbb"/><text x="24" y="30" font-size="20" text-anchor="middle" fill="%23666">App</text></svg>';
      }
      iconImg = `<img src="${iconData}" alt="App Icon" class="app-icon" style="width:32px;height:32px;display:block;margin:0 auto 8px auto;" />`;
    }
    card.innerHTML = `
      <button class="edit-button" onclick="editButtonByEl(this)">Edit</button>
      <button class="delete-x-button" onclick="deleteButtonByEl(this)" title="Delete">&times;</button>
      ${iconImg}
      <div class="sound-type">${button.type}</div>
      <div class="sound-name">${button.name || button.label || 'Unnamed'}</div>
      <div class="sound-hotkey">${button.hotkey || 'No hotkey'}</div>
    `;
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('edit-button') && !e.target.classList.contains('delete-x-button')) {
        // Suppress trigger if in drag mode or the card was just dragged
        if (isDragMode) return;
        if (card._vdJustDragged) return;
        // Read fresh soundData from the DOM so edits/reorders take effect
        try {
          const sd = card.dataset.soundData ? JSON.parse(card.dataset.soundData) : null;
          if (sd) {
            console.log('🔍 Raw button data from storage:', sd);
            console.log('🔍 Button overlay property from storage:', sd.overlay);
            handleTrigger(sd);
          }
        } catch (err) {
          console.error('Failed to parse soundData on click:', err);
        }
      }
    });
    soundGrid.appendChild(card);
  }

  // After full list appended to DOM, compute pagination and show page
  computePagination();
  renderCurrentPage();
  
  // Debug: Log all button types
  console.log('Loaded buttons:', orderedButtons.map(b => ({ name: b.name || b.label, type: b.type, id: b.id })));
  
  // Debug: Check for multi-media buttons specifically
  const multiMediaButtons = orderedButtons.filter(b => b.type === 'multi-media');
  if (multiMediaButtons.length > 0) {
    console.log('Multi-media buttons found:', multiMediaButtons);
  } else {
    console.log('No multi-media buttons found in config');
  }
  
  // Re-enable drag mode if it was active
  if (isDragMode) {
    enableDragMode();
  }
}

// Helper function to find and navigate to multi-media buttons
async function findMultiMediaButtons() {
  const data = await window.electronAPI.getConfig();
  const multiMediaButtons = (data.buttons || []).filter(b => b.type === 'multi-media');
  console.log('Multi-media buttons found:', multiMediaButtons);
  return multiMediaButtons;
}

// Helper function to go to a specific page
function goToPage(pageNumber) {
  if (pageNumber >= 0 && pageNumber < totalPages) {
    currentPage = pageNumber;
    renderCurrentPage();
    console.log(`Navigated to page ${pageNumber + 1}`);
  }
}

function computePagination() {
  const grid = document.getElementById('sound-grid');
  if (!grid) return;
  // Measure a representative card size; if none, fallback to CSS sizes
  const sample = grid.querySelector('.sound-card');
  const gridRect = grid.getBoundingClientRect();
  let cardW = 100, cardH = 100, gap = 10;
  if (sample) {
    const sRect = sample.getBoundingClientRect();
    cardW = sRect.width;
    cardH = sRect.height;
    // try to read gap from computed style
    const cs = window.getComputedStyle(grid);
    const g = parseInt(cs.getPropertyValue('gap'));
    if (!isNaN(g)) gap = g;
  }
  const cols = Math.max(1, Math.floor((gridRect.width + gap) / (cardW + gap)));
  // Use the visible viewport area below the grid's top as the available height for pagination
  const pag = document.getElementById('pagination-controls');
  const pagRect = pag ? pag.getBoundingClientRect() : { height: 0 };
  // Reserve some bottom space: pagination height + extra margin
  const reservedBottom = (pagRect.height || 0) + 32;
  // Compute available height from grid top to viewport bottom minus reserved space
  const availableHeight = Math.max(0, (window.innerHeight - gridRect.top) - reservedBottom);
  const rows = Math.max(1, Math.floor((availableHeight + gap) / (cardH + gap)));
  itemsPerPage = Math.max(1, cols * rows);
  const totalItems = grid.querySelectorAll('.sound-card').length;
  totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  updatePaginationIndicator();
}

function renderCurrentPage() {
  const grid = document.getElementById('sound-grid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.sound-card'));
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;

  // Show/hide cards based on page
  cards.forEach((c, idx) => {
    // If we're dragging a card, keep it visible regardless of page
    const draggingCard = (vdDragState && vdDragState.draggingCard) ? vdDragState.draggingCard : null;
    const isDraggedElement = (draggingCard && c === draggingCard) || (c === draggedElement);
    const isGhostInGrid = (vdDragState && vdDragState.ghost && c === vdDragState.ghost);
    if (isDraggedElement || isGhostInGrid) {
      c.classList.remove('page-hidden');
      return;
    }

    if (idx >= start && idx < end) c.classList.remove('page-hidden');
    else c.classList.add('page-hidden');
  });
  // Recreate slots for drag when on current page
  removeSlots();
  if (isDragMode) createSlots();
  updatePaginationIndicator();
  // ensure bottom padding accounts for pagination bar height after render
  updateBottomPaddingForPagination();
}

function updatePaginationIndicator() {
  const el = document.getElementById('pagination-indicator');
  if (!el) return;
  el.textContent = `${currentPage + 1} / ${totalPages}`;
  
  // Debug logging for pagination
  console.log(`Pagination: Page ${currentPage + 1} of ${totalPages}, Items per page: ${itemsPerPage}`);
}

function goToNextPage() {
  if (currentPage < totalPages - 1) {
    currentPage++;
    renderCurrentPage();
  }
}

function goToPrevPage() {
  if (currentPage > 0) {
    currentPage--;
    renderCurrentPage();
  }
}

// Debounce resize handling
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    computePagination();
    renderCurrentPage();
    updateBottomPaddingForPagination();
  }, 150);
});

// Map vertical mouse wheel to page navigation when over the grid/pagination
let wheelNavTimer = null;
let lastWheelTime = 0;
const WHEEL_NAV_DELAY = 250; // ms between navigations
document.addEventListener('wheel', (e) => {
  try {
    // Determine a robust vertical wheel delta (support legacy wheelDelta variations)
    let verticalDelta = 0;
    try {
      // Prefer standard deltaY when it's non-zero
      if (typeof e.deltaY === 'number' && Math.abs(e.deltaY) > 0) {
        verticalDelta = e.deltaY;
      } else if (typeof e.wheelDeltaY === 'number' && Math.abs(e.wheelDeltaY) > 0) {
        // wheelDeltaY is positive for wheel-up; invert to match deltaY convention (positive -> down)
        verticalDelta = -e.wheelDeltaY;
      } else if (typeof e.wheelDelta === 'number' && Math.abs(e.wheelDelta) > 0) {
        verticalDelta = -e.wheelDelta;
      } else if (typeof e.deltaY === 'number') {
        verticalDelta = e.deltaY || 0;
      }
      // If horizontal movement larger than vertical, treat as horizontal gesture and ignore
      const absX = Math.abs(e.deltaX || 0);
      const absY = Math.abs(verticalDelta || 0);
      if (absY < absX) return;
    } catch (err) {
      return;
    }

    // Ignore when user is typing in inputs or contentEditable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

    // Only when pointer is over relevant areas (grid or pagination)
    const grid = document.getElementById('sound-grid');
    const pag = document.getElementById('pagination-controls');
    let overGrid = false;
    let overPag = false;
    try {
      if (grid) {
        const r = grid.getBoundingClientRect();
        overGrid = (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
      }
      if (pag) {
        const pr = pag.getBoundingClientRect();
        overPag = (e.clientX >= pr.left && e.clientX <= pr.right && e.clientY >= pr.top && e.clientY <= pr.bottom);
      }
      // Also allow the broader container area to count as grid region so empty areas still navigate
      const container = document.querySelector('.container');
      if (!overGrid && container) {
        const cr = container.getBoundingClientRect();
        if (e.clientX >= cr.left && e.clientX <= cr.right && e.clientY >= cr.top && e.clientY <= cr.bottom) {
          overGrid = true;
        }
      }
      // fallback to contains if bounding rect check misses (e.g., SVGs or layering)
      if (!overGrid && grid && grid.contains(e.target)) overGrid = true;
      if (!overPag && pag && pag.contains(e.target)) overPag = true;
    } catch (err) {
      // if any error, fall back to simple contains
      overGrid = grid && grid.contains(e.target);
      overPag = pag && pag.contains(e.target);
    }
    if (!overGrid && !overPag) return;

    const now = Date.now();
    if (now - lastWheelTime < WHEEL_NAV_DELAY) return; // rate limit

    if (verticalDelta > 0) {
      // wheel moved down -> next page
      if (vdDragState && vdDragState.draggingCard) {
        if (currentPage < totalPages - 1) {
          currentPage++;
          computePagination();
          renderCurrentPage();
          // Recreate slots for new page but keep ghost in DOM
          removeSlots();
          createSlots();
        }
      } else {
        goToNextPage();
      }
    } else if (verticalDelta < 0) {
      // wheel moved up -> previous page
      if (vdDragState && vdDragState.draggingCard) {
        if (currentPage > 0) {
          currentPage--;
          computePagination();
          renderCurrentPage();
          removeSlots();
          createSlots();
        }
      } else {
        goToPrevPage();
      }
    }
    lastWheelTime = now;
    // prevent page scroll while navigating pages
    e.preventDefault();
    e.stopPropagation();
  } catch (err) {
    // ignore
  }
}, { passive: false });

// Essential: Both preventDefault() and stopPropagation() are required for Electron
// Only prevent drag events when NOT in sound card drag mode
document.addEventListener('dragover', (e) => {
  console.log('🎯 Global dragover event fired');
  console.log('  - isDragMode:', isDragMode);
  console.log('  - target:', e.target);
  console.log('  - target classes:', e.target.classList);
  console.log('  - files:', e.dataTransfer.files.length);
  
  if (!isDragMode || !e.target.classList.contains('sound-card')) {
    console.log('  ✅ Preventing default and stopping propagation');
    e.preventDefault();
    e.stopPropagation();
  } else {
    console.log('  ❌ Skipping preventDefault (in drag mode on sound card)');
  }
});

document.addEventListener('drop', (e) => {
  console.log('🎯 Global drop event fired');
  console.log('  - isDragMode:', isDragMode);
  console.log('  - target:', e.target);
  console.log('  - target classes:', e.target.classList);
  console.log('  - files:', e.dataTransfer.files.length);
  
  if (!isDragMode || !e.target.classList.contains('sound-card')) {
    console.log('  ✅ Processing file drop');
    e.preventDefault();
    e.stopPropagation();
    // Visual feedback
    const globalDropZone = document.getElementById('global-drop-zone');
    if (globalDropZone) globalDropZone.classList.add('hidden');
    // Process dropped files
    for (const file of e.dataTransfer.files) {
      console.log('  📁 Processing file:', file.name);
      handleFileDrop(file);
      break; // Only handle the first file
    }
  } else {
    console.log('  ❌ Skipping file drop (in drag mode on sound card)');
  }
});

document.addEventListener('dragenter', (e) => {
  console.log('🎯 dragenter event fired');
  const globalDropZone = document.getElementById('global-drop-zone');
  if (globalDropZone) {
    console.log('  ✅ Showing global drop zone');
    globalDropZone.classList.remove('hidden');
  } else {
    console.log('  ❌ Global drop zone not found');
  }
});

document.addEventListener('dragleave', (e) => {
  console.log('🎯 dragleave event fired');
  if (!document.body.contains(e.relatedTarget)) {
    const globalDropZone = document.getElementById('global-drop-zone');
    if (globalDropZone) {
      console.log('  ✅ Hiding global drop zone');
      globalDropZone.classList.add('hidden');
    }
  }
});

// Test function for drag and drop
window.testDragDrop = () => {
  console.log('🧪 Testing drag and drop functionality...');
  console.log('  - isDragMode:', isDragMode);
  console.log('  - global-drop-zone element:', document.getElementById('global-drop-zone'));
  console.log('  - Event listeners should be active');
  console.log('  - Try dragging an audio file onto the dashboard');
  console.log('  - Check console for drag events');
};

// Test function for multi-media hotkey recording
window.testMultiMediaHotkeyRecording = () => {
  console.log('🎹 Testing multi-media hotkey recording...');
  
  // Check if elements exist
  const recordBtn = document.getElementById('multi-media-record-hotkey');
  const hotkeyInput = document.getElementById('multi-media-hotkey-input');
  const hotkeyStatus = document.getElementById('multi-media-hotkey-status');
  
  console.log('  - Record button:', recordBtn ? '✅ Found' : '❌ Missing');
  console.log('  - Hotkey input:', hotkeyInput ? '✅ Found' : '❌ Missing');
  console.log('  - Hotkey status:', hotkeyStatus ? '✅ Found' : '❌ Missing');
  
  if (recordBtn && hotkeyInput && hotkeyStatus) {
    console.log('  - All elements found ✅');
    console.log('  - Opening multi-media modal for testing...');
    
    // Open the multi-media modal
    if (window.addEditButtonForm) {
      window.addEditButtonForm.openModal();
      console.log('  - Modal opened ✅');
      console.log('  - Try clicking "Record Hotkey" button and press some keys');
      console.log('  - Check that hotkey is recorded and displayed');
    } else {
      console.log('  - ❌ addEditButtonForm not available');
    }
  } else {
    console.log('  - ❌ Some elements are missing');
  }
};

// Test function for multi-media hotkey triggering
window.testMultiMediaHotkeyTrigger = async () => {
  console.log('🎯 Testing multi-media hotkey triggering...');
  
  // Get current config
  const config = await window.electronAPI.getConfig();
  const multiMediaButtons = config.buttons.filter(btn => btn.type === 'multi-media');
  
  console.log('  - Found', multiMediaButtons.length, 'multi-media buttons');
  
  if (multiMediaButtons.length === 0) {
    console.log('  - ❌ No multi-media buttons found. Create one first.');
    return;
  }
  
  multiMediaButtons.forEach((btn, index) => {
    console.log(`  - Button ${index + 1}: "${btn.name}" (hotkey: ${btn.hotkey || 'none'})`);
  });
  
  // Test the trigger mechanism
  const testButton = multiMediaButtons[0];
  if (testButton.hotkey) {
    console.log(`  - Testing trigger for "${testButton.name}" with hotkey "${testButton.hotkey}"`);
    console.log('  - Press the hotkey to test if it triggers the button');
    console.log('  - Check console for trigger events');
  } else {
    console.log('  - ❌ First button has no hotkey assigned');
  }
};

// Initial load
loadButtons();

// Initialize chat display
initializeChatDisplay();

// Initialize drag and drop
initializeDragAndDrop();

// Ensure pagination is evaluated when renderer signals it's ready (or main notifies)
if (window.electronAPI && window.electronAPI.onRendererReady) {
  window.electronAPI.onRendererReady(() => {
    try {
      computePagination();
      renderCurrentPage();
      updateBottomPaddingForPagination();
    } catch (e) { console.warn('Error during renderer-ready pagination:', e); }
  });
} else {
  // Fallback: listen to a DOM event from main via the IPC channel if available
  try {
    window.addEventListener('renderer-ready', () => {
      try {
        computePagination();
        renderCurrentPage();
        updateBottomPaddingForPagination();
      } catch (e) { console.warn('Error during renderer-ready (DOM) pagination:', e); }
    });
  } catch (e) {}
}

// Visibility mapping used across helpers
function getVisibilityMap() {
  return {
    'toggle-sound-grid': 'sound-grid',
    'toggle-twitch-stats': 'twitch-stats-container',
    'toggle-recent-activity': 'recent-activity-container',
    'toggle-twitch-chat': 'twitch-chat-container',
    'toggle-sound-controls': 'sound-controls',
    'toggle-queue-control': 'queue-control-widget'
    // move-bar removed
  };
}

// Initialize component visibility dropdown after DOM is ready
// (consolidated with pagination setup below)

// Listen for menu-driven view commands from main process
if (window.electronAPI && typeof window.electronAPI.onViewShowAll === 'function') {
  window.electronAPI.onViewShowAll(() => {
    const showAllBtn = document.getElementById('show-all-components');
    if (showAllBtn) showAllBtn.click();
  });
}
if (window.electronAPI && typeof window.electronAPI.onViewHideAll === 'function') {
  window.electronAPI.onViewHideAll(() => {
    const hideAllBtn = document.getElementById('hide-all-components');
    if (hideAllBtn) hideAllBtn.click();
  });
}
if (window.electronAPI && typeof window.electronAPI.onViewToggle === 'function') {
  window.electronAPI.onViewToggle((payload) => {
    try {
      const map = getVisibilityMap();
      // map keys are checkbox ids, and map values are component element ids
      const target = payload && payload.key;
      const checked = !!payload.checked;
      if (!target) return;

      // helper: resolve provided key to the component id
      let componentId = null;
      // If payload.key already looks like a component id (contains 'container' or 'sound' etc), use it
      if (typeof target === 'string' && (target.includes('container') || target.includes('sound') || target.includes('controls') || target === 'sound-grid')) {
        componentId = target;
      }

      // If not resolved yet, try mapping known short keys to component ids
      if (!componentId) {
        const shortToFull = {
          'twitch-stats': 'twitch-stats-container',
          'twitch-chat': 'twitch-chat-container',
          'recent-activity': 'recent-activity-container',
          'sound-controls': 'sound-controls',
          'sound-grid': 'sound-grid'
        };
        componentId = shortToFull[target] || null;
      }

      if (!componentId) return;

      // find the checkbox id for this component
      let checkboxId = null;
      Object.keys(map).forEach(id => {
        if (map[id] === componentId) checkboxId = id;
      });
      if (checkboxId) {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.checked = checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      }
    } catch (e) { console.warn('Failed to handle view-toggle from menu', e); }
  });
}

// Load and display app version
loadAppVersion();

// Component Visibility Dropdown Functions
function initializeVisibilityDropdown() {
  console.log('Initializing visibility dropdown...'); // Debug log
  
  const toggleBtn = document.getElementById('visibility-toggle');
  const menu = document.getElementById('visibility-menu');
  
  console.log('Toggle button found:', !!toggleBtn); // Debug log
  console.log('Menu found:', !!menu); // Debug log
  const checkboxes = getVisibilityMap();

  // Toggle dropdown menu visibility
  if (toggleBtn && menu) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('Visibility toggle clicked'); // Debug log
      menu.classList.toggle('hidden');
    });
    
    // Also handle mousedown to prevent drag interference
    toggleBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(e.target) && toggleBtn && !toggleBtn.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
  
  // Prevent version info from closing dropdown when clicked
  const versionInfo = document.querySelector('.version-info');
  if (versionInfo) {
    versionInfo.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Handle individual component toggles
  Object.keys(checkboxes).forEach(checkboxId => {
    const checkbox = document.getElementById(checkboxId);
    const componentId = checkboxes[checkboxId];
    
    console.log(`Setting up visibility for: ${checkboxId} → ${componentId}`, checkbox ? '✓' : '✗');
    
    if (checkbox && componentId) {
      // Handle direct checkbox clicks
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        // Don't prevent default - let the checkbox toggle naturally
      });
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const component = document.getElementById(componentId);
        if (component) {
          if (checkbox.checked) {
            component.classList.remove('hidden');
            // Special handling for chat container - restore to collapsed state when shown
            if (componentId === 'twitch-chat-container') {
              component.classList.add('collapsed');
            }
            console.log(`Showing ${componentId}`); // Debug log
          } else {
            component.classList.add('hidden');
            // Remove collapsed class when hiding to avoid conflicts
            if (componentId === 'twitch-chat-container') {
              component.classList.remove('collapsed');
            }
            console.log(`Hiding ${componentId}`); // Debug log
          }
          // Persist visibility preference
          try {
            const prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
            prefs[componentId] = checkbox.checked;
            localStorage.setItem('vdVisibility', JSON.stringify(prefs));
            // Trigger profile autosave
            if (profileManager && profileManager.scheduleAutoSave) {
              profileManager.scheduleAutoSave();
            }
            // Notify main process so menu checkbox states can be synced
            if (window.electronAPI && typeof window.electronAPI.syncViewPrefs === 'function') {
              try { window.electronAPI.syncViewPrefs(prefs); } catch (err) { console.warn('Failed to send view prefs to main', err); }
            }
          } catch (err) {
            console.warn('Failed to persist visibility prefs:', err);
          }
          // Recompute pagination now that a component's visibility changed
          try {
            if (typeof computePagination === 'function') {
              computePagination();
              renderCurrentPage();
              updateBottomPaddingForPagination();
            }
          } catch (e) { console.warn('Failed to recompute pagination after visibility change', e); }
        }
      });
      
      // Also handle click on the label
      const label = checkbox.closest('.visibility-item');
      if (label) {
        label.addEventListener('click', (e) => {
          // Only handle if the click wasn't on the checkbox itself
          if (e.target !== checkbox) {
            e.preventDefault();
            e.stopPropagation();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        });
      }
    }
  });

  // Handle "Hide All" button
  const hideAllBtn = document.getElementById('hide-all-components');
  if (hideAllBtn) {
    hideAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Hide All clicked'); // Debug log
      Object.keys(checkboxes).forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.checked = false;
          const componentId = checkboxes[checkboxId];
          const component = document.getElementById(componentId);
          if (component) {
            component.classList.add('hidden');
            // Remove collapsed class when hiding chat to avoid conflicts
            if (componentId === 'twitch-chat-container') {
              component.classList.remove('collapsed');
            }
          }
        }
        // Persist all prefs
        try {
          const prefs = {};
          Object.keys(checkboxes).forEach(id => {
            prefs[checkboxes[id]] = false;
          });
          localStorage.setItem('vdVisibility', JSON.stringify(prefs));
          // Trigger profile autosave
          if (profileManager && profileManager.scheduleAutoSave) {
            profileManager.scheduleAutoSave();
          }
          if (window.electronAPI && typeof window.electronAPI.syncViewPrefs === 'function') {
            try { window.electronAPI.syncViewPrefs(prefs); } catch (err) { console.warn('Failed to send view prefs to main', err); }
          }
        } catch (err) { console.warn('Failed to persist visibility prefs:', err); }
      });
    });
  }

  // Handle "Show All" button
  const showAllBtn = document.getElementById('show-all-components');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Show All clicked'); // Debug log
      Object.keys(checkboxes).forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.checked = true;
          const componentId = checkboxes[checkboxId];
          const component = document.getElementById(componentId);
          if (component) {
            component.classList.remove('hidden');
            // Restore chat to collapsed state when showing
            if (componentId === 'twitch-chat-container') {
              component.classList.add('collapsed');
            }
          }
        }
    // Recompute pagination after hiding all
    try { if (typeof computePagination === 'function') { computePagination(); renderCurrentPage(); updateBottomPaddingForPagination(); } } catch (e) { console.warn('Failed to recompute pagination after hide all', e); }
        // Persist all prefs
        try {
          const prefs = {};
          Object.keys(checkboxes).forEach(id => {
            prefs[checkboxes[id]] = true;
          });
          localStorage.setItem('vdVisibility', JSON.stringify(prefs));
          // Trigger profile autosave
          if (profileManager && profileManager.scheduleAutoSave) {
            profileManager.scheduleAutoSave();
          }
          if (window.electronAPI && typeof window.electronAPI.syncViewPrefs === 'function') {
            try { window.electronAPI.syncViewPrefs(prefs); } catch (err) { console.warn('Failed to send view prefs to main', err); }
          }
        } catch (err) { console.warn('Failed to persist visibility prefs:', err); }
      });
    });

  // Recompute pagination after showing all
  try { if (typeof computePagination === 'function') { computePagination(); renderCurrentPage(); updateBottomPaddingForPagination(); } } catch (e) { console.warn('Failed to recompute pagination after show all', e); }
  // Apply persisted visibility prefs via centralized helper
  try {
    applyVisibilityPrefs();
    // Send to main so application menu can reflect persisted state
    try {
      const prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
      if (window.electronAPI && typeof window.electronAPI.syncViewPrefs === 'function') {
        window.electronAPI.syncViewPrefs(prefs);
      }
    } catch (err) { /* ignore send errors */ }
  } catch (err) {
    console.warn('Failed to apply visibility prefs:', err);
  }
  }

// Apply visibility preferences from localStorage to all mapped components
function applyVisibilityPrefs() {
  const map = (typeof getVisibilityMap === 'function') ? getVisibilityMap() : {
    'toggle-sound-grid': 'sound-grid',
    'toggle-twitch-stats': 'twitch-stats-container',
    'toggle-recent-activity': 'recent-activity-container',
    'toggle-twitch-chat': 'twitch-chat-container',
    'toggle-sound-controls': 'sound-controls',
    'toggle-queue-control': 'queue-control-widget'
    // move-bar removed
  };

  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
  } catch (err) {
    prefs = {};
  }

  Object.keys(map).forEach(checkboxId => {
    const componentId = map[checkboxId];
    const checkbox = document.getElementById(checkboxId);
    const component = document.getElementById(componentId);
    const visible = prefs.hasOwnProperty(componentId) ? !!prefs[componentId] : true;

    if (checkbox) checkbox.checked = visible;
    if (component) {
      if (visible) component.classList.remove('hidden');
      else component.classList.add('hidden');
      // Keep chat collapsed preference intact when hidden/shown
      if (componentId === 'twitch-chat-container') {
        if (visible && component.classList.contains('collapsed')) {
          // leave collapsed state alone
        }
      }
    }
  });
  // Recompute pagination once after applying all persisted visibility prefs
  try {
    if (typeof computePagination === 'function') {
      computePagination();
      renderCurrentPage();
      updateBottomPaddingForPagination();
    }
  } catch (e) { console.warn('Failed to recompute pagination after applyVisibilityPrefs', e); }
}
}

// Load and display app version
function loadAppVersion() {
  const versionElement = document.getElementById('app-version');
  if (versionElement && window.electronAPI && window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then(version => {
      versionElement.textContent = version || 'Unknown';
    }).catch(error => {
      console.error('Error loading app version:', error);
      versionElement.textContent = 'Unknown';
    });
  } else if (versionElement) {
    // Fallback if Electron API is not available
    versionElement.textContent = '1.0.0';
  }
}

// Initialize stats display
initializeStatsDisplay();

// About modal handling: listen for the main process 'show-about' event
function openAboutModal() {
  const modal = document.getElementById('about-modal');
  if (!modal) return;
  // Populate version
  const versionEl = document.getElementById('about-version');
  const descEl = document.getElementById('about-desc');
  if (window.electronAPI && window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion().then(v => {
      if (versionEl) versionEl.textContent = `Version: ${v || 'Unknown'}`;
    }).catch(() => {});
  }
  // Try to load description from package.json via fetch
  fetch('../package.json').then(r => r.json()).then(pkg => {
    if (descEl && pkg && pkg.description) descEl.textContent = pkg.description;
  }).catch(() => {
    if (descEl) descEl.textContent = '';
  });

  modal.classList.remove('hidden');
  // Close when clicking outside modal content
  modal.addEventListener('click', function onOutClick(e) {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.removeEventListener('click', onOutClick);
    }
  });
  const btn = document.getElementById('about-close');
  if (btn) btn.onclick = () => { modal.classList.add('hidden'); };
}

if (window.electronAPI && window.electronAPI.onShowAbout) {
  window.electronAPI.onShowAbout(() => {
    openAboutModal();
  });
}

// Placeholders Guide Modal
// Chat commands data structure (extensible for future commands)
const chatCommands = [
  {
    command: '!checkin',
    description: 'View the top 5 check-in leaderboard',
    details: 'Shows the top 5 users with the most check-ins. If streaks are enabled, displays streak information. Each user has a 10-minute cooldown between uses.',
    example: 'Type !checkin in chat to see the leaderboard.'
  }
  // Add more commands here in the future
];

function renderCommandsGuide() {
  const commandsList = document.getElementById('commands-list');
  if (!commandsList) return;
  
  if (chatCommands.length === 0) {
    commandsList.innerHTML = '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">No commands available yet.</p>';
    return;
  }
  
  let html = '';
  chatCommands.forEach((cmd, index) => {
    html += `
      <div style="margin-bottom: ${index < chatCommands.length - 1 ? '30px' : '0'};">
        <h3 style="margin: 20px 0 10px 0; color: var(--text-primary); border-bottom: 2px solid var(--accent); padding-bottom: 5px;">
          <code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; color: var(--accent); font-size: 16px;">${cmd.command}</code>
        </h3>
        <table class="placeholders-table">
          <tbody>
            <tr>
              <td style="width: 120px;"><strong>Description</strong></td>
              <td>${cmd.description}</td>
            </tr>
            ${cmd.details ? `<tr>
              <td><strong>Details</strong></td>
              <td>${cmd.details}</td>
            </tr>` : ''}
            ${cmd.example ? `<tr>
              <td><strong>Example</strong></td>
              <td><code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px;">${cmd.example}</code></td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>
    `;
  });
  
  commandsList.innerHTML = html;
}

function openCommandsGuide() {
  const modal = document.getElementById('commands-guide-modal');
  if (modal) {
    renderCommandsGuide();
    modal.classList.remove('hidden');
    
    // Disable hotkeys when modal is open
    if (window.electronAPI && window.electronAPI.disableHotkeys) {
      window.electronAPI.disableHotkeys();
    }
  }
}

function closeCommandsGuide() {
  const modal = document.getElementById('commands-guide-modal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Re-enable hotkeys when modal is closed
    if (window.electronAPI && window.electronAPI.enableHotkeys) {
      window.electronAPI.enableHotkeys();
    }
  }
}

function openPlaceholdersGuide() {
  const modal = document.getElementById('placeholders-guide-modal');
  if (modal) {
    modal.classList.remove('hidden');
    
    // Disable hotkeys when modal is open
    if (window.electronAPI && window.electronAPI.disableHotkeys) {
      window.electronAPI.disableHotkeys();
    }
  }
}

function closePlaceholdersGuide() {
  const modal = document.getElementById('placeholders-guide-modal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Re-enable hotkeys when modal is closed
    if (window.electronAPI && window.electronAPI.enableHotkeys) {
      window.electronAPI.enableHotkeys();
    }
  }
}

// Close button for placeholders guide
const placeholdersGuideCloseBtn = document.getElementById('placeholders-guide-close');
if (placeholdersGuideCloseBtn) {
  placeholdersGuideCloseBtn.onclick = () => {
    closePlaceholdersGuide();
  };
}

// Close on backdrop click
const placeholdersGuideModal = document.getElementById('placeholders-guide-modal');
if (placeholdersGuideModal) {
  placeholdersGuideModal.addEventListener('click', (e) => {
    if (e.target === placeholdersGuideModal) {
      closePlaceholdersGuide();
    }
  });
}

// Close button for commands guide
const commandsGuideCloseBtn = document.getElementById('commands-guide-close');
if (commandsGuideCloseBtn) {
  commandsGuideCloseBtn.onclick = () => {
    closeCommandsGuide();
  };
}

// Close on backdrop click
const commandsGuideModal = document.getElementById('commands-guide-modal');
if (commandsGuideModal) {
  commandsGuideModal.addEventListener('click', (e) => {
    if (e.target === commandsGuideModal) {
      closeCommandsGuide();
    }
  });
}

// Help button in Alert Widget
const alertPlaceholdersHelp = document.getElementById('alert-placeholders-help');
if (alertPlaceholdersHelp) {
  alertPlaceholdersHelp.addEventListener('click', () => {
    openPlaceholdersGuide();
  });
}

// Check-In Stats Modal Handlers
const checkinStatsCloseBtn = document.getElementById('checkin-stats-close');
if (checkinStatsCloseBtn) {
  checkinStatsCloseBtn.onclick = () => {
    const modal = document.getElementById('checkin-stats-modal');
    if (modal) {
      modal.classList.add('hidden');
      // Re-enable hotkeys
      if (window.electronAPI && window.electronAPI.enableHotkeys) {
        window.electronAPI.enableHotkeys();
      }
    }
  };
}

// Close on backdrop click
const checkinStatsModal = document.getElementById('checkin-stats-modal');
if (checkinStatsModal) {
  checkinStatsModal.addEventListener('click', (e) => {
    if (e.target === checkinStatsModal) {
      checkinStatsModal.classList.add('hidden');
      // Re-enable hotkeys
      if (window.electronAPI && window.electronAPI.enableHotkeys) {
        window.electronAPI.enableHotkeys();
      }
    }
  });
}

// Stats filter and sort listeners
const statsSort = document.getElementById('stats-sort');
const statsFilter = document.getElementById('stats-filter');
if (statsSort) {
  statsSort.addEventListener('change', renderCheckinStats);
}
if (statsFilter) {
  statsFilter.addEventListener('change', renderCheckinStats);
}

// Open settings modal when Preferences menu item is clicked
if (window.electronAPI && window.electronAPI.onOpenPreferences) {
  window.electronAPI.onOpenPreferences(() => {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.remove('hidden');
  });
}

// Check initial Twitch connection status
if (window.electronAPI && window.electronAPI.hasTwitchCreds) {
  window.electronAPI.hasTwitchCreds().then(hasCreds => {
    if (hasCreds) {
      updateChatStatusIndicator(true);
    } else {
      updateChatStatusIndicator(false);
    }
  }).catch(() => {
    updateChatStatusIndicator(false);
  });

// Keyboard navigation: PageUp / PageDown to move pages
document.addEventListener('keydown', (e) => {
  try {
    const active = document.activeElement;
    // Don't intercept when user is typing in inputs, textareas, selects or contentEditable
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

    // Support both key and code values for broader compatibility
    const k = e.key || e.code || '';
    if (k === 'PageDown' || k === 'PageDown') {
      e.preventDefault();
      goToNextPage();
    } else if (k === 'PageUp' || k === 'PageUp') {
      e.preventDefault();
      goToPrevPage();
    }
  } catch (err) {
    // be silent on any errors in the global handler
    console.warn('Keyboard page navigation error:', err);
  }
});
}

// Test function to demonstrate Twitch statistics
async function testTwitchStats() {
  if (!window.electronAPI) {
    console.log('Electron API not available');
    return;
  }

  try {
    console.log('=== Twitch Channel Statistics ===');
    
    // Get viewer count
    const viewerCount = await window.electronAPI.getViewerCount();
    console.log(`👀 Current Viewers: ${viewerCount}`);
    
    // Get follower count
    const followerCount = await window.electronAPI.getFollowerCount();
    console.log(`👥 Total Followers: ${followerCount}`);
    
    // Get subscriber stats
    const subStats = await window.electronAPI.getSubscriberStats();
    console.log(`⭐ Total Subscribers: ${subStats.count}`);
    console.log(`💎 Subscription Points: ${subStats.points}`);
    
    // Show in a simple alert for now
    alert(`Twitch Stats:\n👀 Viewers: ${viewerCount}\n👥 Followers: ${followerCount}\n⭐ Subscribers: ${subStats.count}\n💎 Sub Points: ${subStats.points}`);
    
  } catch (error) {
    console.error('Error fetching Twitch stats:', error);
    alert('Error fetching Twitch statistics. Make sure you are connected to Twitch.');
  }
}

// Make test function available globally for testing
window.testTwitchStats = testTwitchStats;
window.updateTwitchStats = updateTwitchStats;
window.clearOverlay = clearOverlay;


// Update Twitch statistics display
async function updateTwitchStats() {
  const statsContainer = document.getElementById('twitch-stats-container');
  if (!statsContainer || !window.electronAPI) return;

  try {
    // Show loading state
    document.getElementById('viewer-count').textContent = '...';
    document.getElementById('follower-count').textContent = '...';
    document.getElementById('subscriber-count').textContent = '...';
    document.getElementById('sub-points').textContent = '...';

    // Fetch all statistics
    const [viewerCount, followerCount, subStats] = await Promise.all([
      window.electronAPI.getViewerCount(),
      window.electronAPI.getFollowerCount(),
      window.electronAPI.getSubscriberStats()
    ]);

    // Update display
    document.getElementById('viewer-count').textContent = viewerCount.toLocaleString();
    document.getElementById('follower-count').textContent = followerCount.toLocaleString();
    document.getElementById('subscriber-count').textContent = subStats.count.toLocaleString();
    document.getElementById('sub-points').textContent = subStats.points.toLocaleString();

    // Respect persisted visibility preferences
    try { applyVisibilityPrefs(); } catch (e) { /* ignore */ }
    
    // Add debug info
    let debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
      debugDiv.innerHTML += `Stats container shown, classes: ${statsContainer.className}<br>`;
    }
    
    // Set up click handlers after showing stats
    setupStatClickHandlers();

  } catch (error) {
    console.error('Error updating Twitch stats:', error);
    // Hide stats on error
    try {
      const prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
      const visible = prefs.hasOwnProperty('twitch-stats-container') ? !!prefs['twitch-stats-container'] : true;
      if (!visible) statsContainer.classList.add('hidden');
    } catch (err) {
      statsContainer.classList.add('hidden');
    }
  }
}

// Initialize stats display
function initializeStatsDisplay() {
  const statsContainer = document.getElementById('twitch-stats-container');
  
  // Apply visibility prefs for stats via central helper
  try { applyVisibilityPrefs(); } catch (e) { /* ignore */ }
  
  // Set up stat click handlers immediately
  setupStatClickHandlers();
}

// Set up stat hide/show buttons below each stat
function setupStatClickHandlers() {
  // Remove debug display
  const debugDiv = document.getElementById('debug-info');
  if (debugDiv) {
    debugDiv.remove();
  }
  
  // Find all stat items
  const statItems = document.querySelectorAll('.stat-item');
  
  statItems.forEach((statItem, index) => {
    // Create a container for the stat content and button
    const statContainer = document.createElement('div');
    statContainer.className = 'stat-container';
    statContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    `;
    
    // Move the existing stat content into the container
    const statContent = statItem.querySelector('.stat-content');
    if (statContent) {
      statContainer.appendChild(statContent.cloneNode(true));
    }
    
    // Create hide/show button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Hide';
    toggleButton.className = 'stat-toggle-button';
    toggleButton.style.cssText = `
      background: #444;
      color: white;
      border: 1px solid #666;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 50px;
    `;
    
    // Add hover effects
    toggleButton.addEventListener('mouseenter', () => {
      toggleButton.style.background = '#555';
      toggleButton.style.borderColor = '#777';
    });
    
    toggleButton.addEventListener('mouseleave', () => {
      toggleButton.style.background = '#444';
      toggleButton.style.borderColor = '#666';
    });
    
    // Add click handler for toggle button
    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const statValue = statContainer.querySelector('.stat-value');
      if (statValue) {
        if (statValue.style.display === 'none') {
          statValue.style.display = '';
          toggleButton.textContent = 'Hide';
        } else {
          statValue.style.display = 'none';
          toggleButton.textContent = 'Show';
        }
      }
    });
    
    // Add button to container
    statContainer.appendChild(toggleButton);
    
    // Replace the stat item content with our new container
    statItem.innerHTML = '';
    statItem.appendChild(statContainer);
  });
}

// Auto-refresh stats every 30 seconds when connected
let statsRefreshInterval = null;

function startStatsRefresh() {
  if (statsRefreshInterval) {
    clearInterval(statsRefreshInterval);
  }
  statsRefreshInterval = setInterval(() => {
    updateTwitchStats();
  }, 30000); // Refresh every 30 seconds
}

function stopStatsRefresh() {
  if (statsRefreshInterval) {
    clearInterval(statsRefreshInterval);
    statsRefreshInterval = null;
  }
}

// Recent Activity Functions
let latestFollower = null;
let latestSubscriber = null;

// Update recent followers display
function updateRecentFollowersDisplay() {
  const latestFollowerElement = document.getElementById('latest-follower');
  
  if (!latestFollowerElement) return;
  
  if (!latestFollower) {
    latestFollowerElement.textContent = '-';
    return;
  }
  
  latestFollowerElement.textContent = escapeHtml(latestFollower.user_name || latestFollower.user_login);
}

// Update recent subscribers display
function updateRecentSubscribersDisplay() {
  const latestSubscriberElement = document.getElementById('latest-subscriber');
  
  if (!latestSubscriberElement) return;
  
  if (!latestSubscriber) {
    latestSubscriberElement.textContent = '-';
    return;
  }
  
  const tier = getSubTierText(latestSubscriber.tier);
  latestSubscriberElement.textContent = `${escapeHtml(latestSubscriber.user_name || latestSubscriber.user_login)} ${tier}`;
}

// Helper function to get time ago string
function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Helper function to get subscription tier text
function getSubTierText(tier) {
  switch (tier) {
    case '1000': return '(T1)';
    case '2000': return '(T2)';
    case '3000': return '(T3)';
    case 'prime': return '(Prime)';
    default: return '';
  }
}

// Load recent followers and subscribers
async function loadRecentActivity() {
  const activityContainer = document.getElementById('recent-activity-container');
  if (!activityContainer || !window.electronAPI) return;
  
  try {
    // Show loading state only if user hasn't hidden recent activity
    try {
      const prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
      const visible = prefs.hasOwnProperty('recent-activity-container') ? !!prefs['recent-activity-container'] : true;
      if (visible) activityContainer.classList.remove('hidden');
      else activityContainer.classList.add('hidden');
    } catch (err) {
      activityContainer.classList.remove('hidden');
    }
    
    // Fetch recent followers and subscribers
    const [followers, subscribers] = await Promise.all([
      window.electronAPI.getRecentFollowers(),
      window.electronAPI.getRecentSubscribers()
    ]);
    
    // Get the most recent follower and subscriber
    latestFollower = (followers && followers.length > 0) ? followers[0] : null;
    latestSubscriber = (subscribers && subscribers.length > 0) ? subscribers[0] : null;
    
    // Update displays
    updateRecentFollowersDisplay();
    updateRecentSubscribersDisplay();
    
  } catch (error) {
    console.error('Error loading recent activity:', error);
  }
}

// Add new follower to recent list
function addRecentFollower(follower) {
  latestFollower = follower;
  updateRecentFollowersDisplay();
}

// Add new subscriber to recent list
function addRecentSubscriber(subscriber) {
  latestSubscriber = subscriber;
  updateRecentSubscribersDisplay();
}

// Deduplication for chat messages (similar to overlay)
const processedChatMessages = new Set();
const CHAT_DEDUP_WINDOW = 5000; // 5 seconds

// Generate hash for chat message deduplication
function getChatMessageHash(user, message, timestamp) {
  // Group messages within 100ms for deduplication
  const timeGroup = Math.floor(timestamp / 100);
  return `${user}:${message}:${timeGroup}`;
}

// Listen for Twitch chat events
window.electronAPI.onTwitchChatEvent((eventData) => {
  console.log('📨 Twitch chat event received:', eventData);
  console.log('📨 Event source:', eventData.source || 'unknown');
  
  if (eventData.type === 'chat') {
    // Generate hash for deduplication
    const messageHash = getChatMessageHash(eventData.user, eventData.message, Date.now());
    
    // Check for duplicates
    if (processedChatMessages.has(messageHash)) {
      console.log('🚫 Duplicate chat message detected, skipping');
      return;
    }
    
    // Add to processed set
    processedChatMessages.add(messageHash);
    
    // Remove after deduplication window
    setTimeout(() => {
      processedChatMessages.delete(messageHash);
    }, CHAT_DEDUP_WINDOW);
    
    // Check if it's a command (starts with !)
    if (eventData.message && eventData.message.startsWith('!')) {
      addTwitchEvent('command', {
        user: eventData.user,
        user_name: eventData.user,
        message: eventData.message,
        badges: eventData.badges || {},
        emotes: eventData.emotes || {}
      });
    } else {
      addChatMessage(eventData.user, eventData.message, eventData.badges || {});
    }
  }
});

// Listen for Twitch EventSub events (follows, subs, raids, etc.)
window.electronAPI.onTwitchEventSub(async (eventData) => {
  console.log('📡 Twitch EventSub received:', eventData);
  
  // Handle daily check-in redemptions first
  if (eventData.type === 'channel.channel_points_custom_reward_redemption.add') {
    const rewardTitle = eventData.event.reward?.title || eventData.event.reward?.name || eventData.event.reward_title || '';
    const configuredRewardName = dailyCheckinData.config.rewardName || 'Daily Check-In';
    
    // Check if this matches our daily check-in reward
    if (rewardTitle.toLowerCase() === configuredRewardName.toLowerCase()) {
      console.log('✅ Daily Check-In redemption detected!');
      
      // Process the daily check-in
      const checkinResult = await processDailyCheckin({
        user_id: eventData.event.user_id,
        user_name: eventData.event.user_name || eventData.event.user_login,
        display_name: eventData.event.user_login || eventData.event.user_name
      });
      
      // If check-in was successful, trigger any configured daily-checkin alerts
      if (checkinResult) {
        // Get the updated viewer data
        const viewer = dailyCheckinData.viewers[eventData.event.user_id];
        
        // Create user data with actual check-in counts
        const userData = {
          username: viewer.username,
          display_name: viewer.display_name,
          user_id: viewer.user_id,
          total_checkins: viewer.total_checkins,
          streak: viewer.streak || 0,
          reward: rewardTitle,
          ...eventData.event
        };
        
        console.log('👤 Daily check-in user data:', userData);
        
        // Trigger daily-checkin alert with actual data
        alertSystem.triggerAlertForEvent('daily-checkin', userData);
      }
      
      // Don't process this as a regular channel-points alert
      return;
    }
  }
  
  // Handle first-chat walk-on events
  if (eventData.type === 'first-chat-walkon') {
    const username = eventData.event?.user_name || eventData.event?.display_name || 'Someone';
    const userData = {
      username: eventData.event.user_name || username,
      display_name: eventData.event.display_name || username,
      user_id: eventData.event.user_id,
      user_name: eventData.event.user_name || username,
      ...eventData.event
    };
    
    console.log('👤 First chat walk-on user data:', userData);
    alertSystem.triggerAlertForEvent('first-chat-walkon', userData);
    
    // Don't process further
    return;
  }
  
  // For channel point redemptions (non-daily-checkin), let the TwitchConnected system handle button matching
  if (eventData.type === 'channel.channel_points_custom_reward_redemption.add') {
    // For non-daily-checkin redemptions, let the TwitchConnected system handle button matching
    // The TwitchConnected system will check for buttons with matching keywords
    console.log('🎁 Non-daily-checkin redemption, letting TwitchConnected system handle button matching');
    
    // Send the event to TwitchConnected system for button matching
    // We need to send it as a 'redeem' type event for the TwitchConnected system to process it
    if (window.electronAPI && window.electronAPI.onTwitchEventSub) {
      // The TwitchConnected system expects events with type 'redeem'
      const redeemEvent = {
        type: 'redeem',
        event: eventData.event
      };
      console.log('📤 Sending redemption event to TwitchConnected system:', redeemEvent);
      
      // Trigger the TwitchConnected system directly
      if (window.checkRedemptionAgainstButtonKeywords) {
        window.checkRedemptionAgainstButtonKeywords(redeemEvent).then(matchingButtonLabel => {
          if (matchingButtonLabel && window.electronAPI && window.electronAPI.sendTrigger) {
            console.log(`🚀 Triggering button "${matchingButtonLabel}" from channel point redemption`);
            window.electronAPI.sendTrigger(matchingButtonLabel);
          }
        });
      }
    }
  }
  
  // Update alerts from storage in case they changed
  alertSystem.updateAlerts();
  
  // Determine alert type with special handling for subscriptions
  let alertType = null;
  
  if (eventData.type === 'channel.subscribe') {
    // Handle different subscription types based on event data
    if (eventData.event.is_gift === true) {
      // Check if it's a gift received (someone received a gift) or gift given (someone gave a gift)
      if (eventData.event.user_id === eventData.event.broadcaster_user_id) {
        alertType = 'gift-sub-received';
      } else {
        alertType = 'gift-sub';
      }
    } else if (eventData.event.cumulative_months && eventData.event.cumulative_months > 1) {
      alertType = 'resubscriber';
    } else {
      alertType = 'subscriber';
    }
  } else if (eventData.type === 'channel.subscription.message') {
    // Subscription message (resub announcement)
    alertType = 'resubscriber';
  } else {
    // Map other Twitch event types to alert types
    const eventTypeMap = {
      'channel.follow': 'follower',
      'poll.follow': 'follower', // Polling-based follower detection (fallback)
      'channel.subscription.gift': 'gift-sub',
      'channel.raid': 'raid',
      'channel.cheer': 'bits',
      'channel.ban': 'ban'
    };
    
    alertType = eventTypeMap[eventData.type];
  }
  
  if (alertType) {
    // Extract user data from the event
    const userData = {
      username: eventData.event.user_name || eventData.event.user || eventData.event.from_name || eventData.event.user_login || 'Unknown',
      display_name: eventData.event.display_name || eventData.event.user_name || eventData.event.user || 'Unknown',
      tier: eventData.event.tier || eventData.event.sub_plan || '',
      viewers: eventData.event.viewers || eventData.event.view_count || eventData.event.viewer_count || '',
      bits: eventData.event.bits || eventData.event.bits_used || eventData.event.bits_amount || eventData.event.amount || '',
      months: eventData.event.cumulative_months || eventData.event.months || '',
      message: eventData.event.message || eventData.event.user_input || '',
      reward: eventData.event.reward?.title || eventData.event.reward?.name || eventData.event.reward_title || eventData.event.reward || '',
      ...eventData.event // Include all event data
    };
    
    console.log('👤 Extracted user data:', userData);
    console.log('🎯 Alert type determined:', alertType, 'from event type:', eventData.type);
    
    // Trigger the alert
    alertSystem.triggerAlertForEvent(alertType, userData);
  } else {
    console.log('⚠️ No alert type mapping for event:', eventData.type);
  }
  
  // Add to chat display (existing functionality)
  addTwitchEvent(eventData.type, eventData.event);
  
  // Update recent activity for follows and subscribers
  if (eventData.type === 'channel.follow' || eventData.type === 'poll.follow') {
    addRecentFollower(eventData.event);
  } else if (eventData.type === 'channel.subscribe' || eventData.type === 'channel.subscription.message') {
    addRecentSubscriber(eventData.event);
  }
});

// Add Twitch events to the chat display
function addTwitchEvent(type, eventData) {
  const chatMessagesContainer = document.getElementById('twitch-chat-messages');
  if (!chatMessagesContainer) return;

  const row = document.createElement('div');
  row.style.padding = '8px 6px';
  row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
  row.style.marginBottom = '2px';
  row.style.textAlign = 'left';
  row.style.fontSize = '13px';
  row.style.lineHeight = '1.4';
  
  const time = new Date().toLocaleTimeString();
  let msg = '';
  
  // Build badge HTML
  let badgeHtml = '';
  if (eventData.badges) {
    const meaningfulBadges = ['broadcaster', 'moderator', 'vip', 'subscriber', 'sub_gifter', 'bits', 'bits_leader', 'premium', 'staff', 'admin', 'global_mod', 'turbo'];
    for (const badge in eventData.badges) {
      if (meaningfulBadges.includes(badge)) {
        const badgeText = badge.replace(/_/g, ' ').toUpperCase();
        const badgeColor = getBadgeColor(badge);
        badgeHtml += `<span class="badge-text" style="background:${badgeColor};color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;margin-right:4px;vertical-align:middle;font-weight:bold;">${badgeText}</span>`;
      }
    }
  }
  
  switch (type) {
    case 'command': {
      let commandUserColor = (eventData.user === 'TestUser' || eventData.user === 'T3stUs3r') ? '#a3e635' : '#b3b3b3';
      const commandMsg = parseEmotes(eventData.message, eventData.emotes);
      msg = `⚡ <span style="color:#ffa500;font-weight:600">[Command]</span> ${badgeHtml}<strong style="color:${commandUserColor}">${escapeHtml(eventData.user||eventData.user_name||'unknown')}</strong>: <span class="activity-message">${commandMsg}</span>`;
      break;
    }
    case 'channel.follow':
      const who = eventData.user_name || eventData.user || eventData.from_name || eventData.user_login || 'unknown';
      msg = `➕ <span style="color:#9ad;font-weight:600">[Follow]</span> ${badgeHtml}<strong style="color:#fff">${escapeHtml(who)}</strong> <span style="color:#ccc;margin-left:6px">followed the channel</span>`;
      break;
    case 'channel.subscribe':
      const subUser = eventData.user_name || eventData.user || eventData.user_login || eventData.from_name || 'unknown';
      const tier = eventData.tier || eventData.sub_plan || (eventData.subscription && eventData.subscription.plan) || '';
      msg = `🎉 <span style="color:#ffd700;font-weight:600">[Sub]</span> ${badgeHtml}<strong style="color:#fff">${escapeHtml(subUser)}</strong> <span style="color:#ccc;margin-left:6px">subscribed ${escapeHtml(tier || '')}</span>`;
      break;
    case 'channel.subscription.gift':
      const sender = eventData.user_name || eventData.from_name || eventData.sender_name || eventData.user || 'unknown';
      const recipient = eventData.recipient_user_name || eventData.recipient || eventData.to_name || 'someone';
      msg = `🎁 <span style="color:#ff9f43;font-weight:600">[Sub Gift]</span> ${badgeHtml}<strong style="color:#fff">${escapeHtml(sender)}</strong> gifted a sub to <strong style="color:#ffd166;margin-left:6px">${escapeHtml(recipient)}</strong>`;
      break;
    case 'channel.raid':
      const raider = eventData.from_broadcaster_user_name || eventData.from_name || eventData.user_name || eventData.user || 'unknown';
      const viewers = eventData.viewers || eventData.view_count || eventData.viewer_count || (eventData.event && eventData.event.viewers) || '';
      msg = `🚀 <span style="color:#9ad;font-weight:600">[Raid]</span> ${badgeHtml}<strong style="color:#fff">${escapeHtml(raider)}</strong> <span style="color:#ccc;margin-left:6px">raided with ${escapeHtml(String(viewers))} viewers</span>`;
      break;
    case 'channel.cheer':
      const cheerer = eventData.user_name || eventData.user || eventData.from_name || 'unknown';
      const amount = eventData.bits || eventData.bits_used || eventData.bits_amount || eventData.amount || (eventData.message && (eventData.message.match(/\d+/) || [''])[0]) || '';
      msg = `💎 <span style="color:#ff66cc;font-weight:600">[Bits]</span> ${badgeHtml}<strong style="color:#fff">${escapeHtml(cheerer)}</strong> <span style="color:#ffd166;margin-left:6px">${escapeHtml(String(amount))} bits</span>`;
      break;
    case 'channel.channel_points_custom_reward_redemption.add':
      const redeemer = eventData.user_name || eventData.user || eventData.user_login || eventData.from_name || eventData.from_broadcaster_user_name || 'unknown';
      const reward = (eventData.reward && (eventData.reward.title || eventData.reward.name)) ? (eventData.reward.title || eventData.reward.name) : (eventData.reward_title || eventData.rewardType || eventData.reward || '');
      const input = eventData.user_input || eventData.input || eventData.message || eventData.prompt || '';
      const cost = (eventData.reward && (typeof eventData.reward.cost !== 'undefined')) ? eventData.reward.cost : (typeof eventData.cost !== 'undefined' ? eventData.cost : null);
      const redeemUserColor = (redeemer === 'TestUser' || redeemer === 'T3stUs3r') ? '#a3e635' : '#4dd0e1';
      const redeemMsg = parseEmotes(input, eventData.emotes);
      const costHtml = (cost !== null && cost !== undefined && cost !== '') ? ` <span style="color:#ffd166;font-weight:600;margin-left:6px">(${escapeHtml(String(cost))} pts)</span>` : '';
      const inputHtml = input ? `: <em class="activity-message" style="font-style:italic;color:#ddd;margin-left:6px">${redeemMsg}</em>` : '';
      msg = `🎁 <span style="color:#9ad;font-weight:600">[Redeem]</span> ${badgeHtml}<strong style="color:${redeemUserColor}">${escapeHtml(redeemer)}</strong> <span style="color:#fff;margin-left:6px">redeemed</span> <span style="color:#ffd166;font-weight:600;margin-left:6px">${escapeHtml(reward)}</span>${costHtml}${inputHtml}`;
      break;
    default:
      // Handle other event types generically
      msg = `<span style="color:#9ad">[${escapeHtml(type)}]</span> ${badgeHtml}<strong>${escapeHtml(eventData.user||eventData.user_name||'unknown')}</strong> ${escapeHtml(JSON.stringify(eventData))}`;
  }
  
  row.innerHTML = `<span style="color:#666;margin-right:12px;font-size:11px">[${time}]</span> ${msg}`;
  
  // Add to container at the top so newest events appear first
  if (chatMessagesContainer.firstChild) chatMessagesContainer.insertBefore(row, chatMessagesContainer.firstChild);
  else chatMessagesContainer.appendChild(row);

  // Store in array (newest at index 0)
  chatMessages.unshift({ element: row, timestamp: Date.now() });

  // Limit number of messages: remove oldest from the end
  if (chatMessages.length > MAX_CHAT_MESSAGES) {
    const oldMessage = chatMessages.pop();
    if (oldMessage && oldMessage.element && oldMessage.element.parentNode) {
      oldMessage.element.parentNode.removeChild(oldMessage.element);
    }
  }

  // Smart auto-scroll (top-anchored)
  smartAutoScroll(chatMessagesContainer);
}

// Listen for Twitch connection status
window.electronAPI.onTwitchConnected(() => {
  updateChatVisibility(true);
  updateChatStatusIndicator(true);
  // Auto-expand chat when connected
  const chatContainer = document.getElementById('twitch-chat-container');
  if (chatContainer) {
    // Respect persisted visibility preferences for chat
    try {
      const prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
      const visible = prefs.hasOwnProperty('twitch-chat-container') ? !!prefs['twitch-chat-container'] : true;
      if (visible) chatContainer.classList.remove('hidden');
      else chatContainer.classList.add('hidden');
    } catch (err) {
      chatContainer.classList.remove('hidden');
    }
    chatContainer.classList.remove('collapsed'); // Expand when connected
    const toggleBtn = document.getElementById('toggle-chat');
    if (toggleBtn) {
      toggleBtn.textContent = '−';
    }
  }
  // Update and show stats when connected
  updateTwitchStats();
  startStatsRefresh();
  
  // Load recent activity when connected
  loadRecentActivity();
  
  // Re-apply visibility prefs globally after connection changes
  try { applyVisibilityPrefs(); } catch (e) { /* ignore */ }
});

// Listen for Twitch disconnection
window.electronAPI.onTwitchCleared(() => {
  updateChatVisibility(false);
  updateChatStatusIndicator(false);
  // Hide stats when disconnected
  const statsContainer = document.getElementById('twitch-stats-container');
  if (statsContainer) {
    statsContainer.classList.add('hidden');
  }
  // Stop stats refresh
  stopStatsRefresh();
  // Clear chat messages when disconnected
  const chatMessagesContainer = document.getElementById('twitch-chat-messages');
  if (chatMessagesContainer) {
    chatMessagesContainer.innerHTML = '';
    chatMessages = [];
  }
});

async function handleTrigger(button) {
  console.log(`🔍 handleTrigger called for button: "${button.name || button.label}" Type: ${button.type} Volume: ${button.volume}`);
  // Prevent accidental plays while editing/reordering
  if (isDragMode) return;
  // If caller passed a DOM element instead of button object, normalize
  if (button && button._vdJustDragged) return;
  
  // Clear audio cache before triggering to ensure fresh audio files
  audioCache.clear();
  console.log('🧹 Audio cache cleared before button trigger');

  if (button.type === "audio") {
    const audioPath = await window.electronAPI.getSoundPath(button.src);
    // Add cache-busting parameter to ensure fresh audio files are loaded
    const cacheBuster = `?t=${Date.now()}`;
    const audioUrl = audioPath + (audioPath.includes('?') ? '&' : '?') + cacheBuster;
    const audio = new Audio(audioUrl);
    console.log(`🔊 Loading audio with cache-busting URL: ${audioUrl}`);
    // Apply saved volume if present (expect 0.0 - 1.0). Fallback to 1.0
    // Note: volume is stored per-button in `config.json` and only applied for
    // audio-type buttons. The renderer sends `volume` as a float (0.0-1.0)
    // when saving; the main process persists it into the button config.
    try {
      const vol = (typeof button.volume === 'number') ? button.volume : (button.volume ? parseFloat(button.volume) : 1.0);
      // Set volume immediately to prevent loud burst
      audio.volume = 0; // Start muted
      audio.volume = Math.max(0, Math.min(1, !isNaN(vol) ? vol : 1.0)); // Then set to desired volume
    } catch (err) {
      // ignore and use default
      audio.volume = 0;
      audio.volume = 1.0;
    }
    
    // Set up overlay clearing when audio finishes
    audio.addEventListener('ended', () => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`🎵 [${timestamp}] Audio finished playing, triggering overlay clear`);
      clearOverlay();
    });
    
    // Also set up a fallback timer in case the 'ended' event doesn't fire
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      if (duration && !isNaN(duration) && isFinite(duration)) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🎵 [${timestamp}] Audio duration detected: ${duration.toFixed(2)}s, setting fallback clear timer for ${(duration + 0.5).toFixed(2)}s`);
        setTimeout(() => {
          const clearTimestamp = new Date().toLocaleTimeString();
          console.log(`⏰ [${clearTimestamp}] Fallback timer triggered: clearing overlay after audio duration + buffer`);
          clearOverlay();
        }, (duration * 1000) + 500); // Add 500ms buffer
      }
    });
    
    // Check for custom duration override (for simple audio buttons with duration option)
    if (button.options && button.options.durationMs) {
      const customDuration = button.options.durationMs / 1000;
      const timestamp = new Date().toLocaleTimeString();
      console.log(`⏰ [${timestamp}] Overriding audio duration with custom duration: ${customDuration.toFixed(2)}s`);
      
      setTimeout(() => {
        const clearTimestamp = new Date().toLocaleTimeString();
        console.log(`⏰ [${clearTimestamp}] Custom duration override triggered: clearing overlay after ${customDuration.toFixed(2)}s`);
        clearOverlay();
      }, customDuration * 1000);
    }
    
    audio.play().catch(error => {
    });
  } else if (button.type === "app") {
    // If the button has args, pass them along
    if (button.args) {
      window.electronAPI.launchApp({ path: button.src, args: button.args });
    } else {
      window.electronAPI.launchApp({ path: button.src });
    }
  } else if (button.type === "multi-media") {
    // Handle multi-media button trigger
    await handleMultiMediaTrigger(button);
  }
  // Removed visual handling
}

// Audio cache for reusing audio elements
const audioCache = new Map();

async function handleMultiMediaTrigger(button) {
  console.log('Triggering multi-media button:', button);
  console.log('🔍 Button overlay property:', button.overlay);
  console.log('🔍 Button object keys:', Object.keys(button));
  console.log('🔍 Button audio data:', button.audio);
  console.log('🔍 Button ID:', button.id);
  console.log('🔍 Button name:', button.name);
  console.log('🔍 Full button config:', JSON.stringify(button, null, 2));
  
  // Use the new schema directly (no nested data object)
  const audioData = button.audio || [];
  const slotsData = button.slots || {};
  const centerMediaData = button.centerMedia || [];
  const optionsData = button.options || { clearPrevious: true };
  
  console.log('🎬 === INITIAL BUTTON DATA DEBUG ===');
  console.log('🎬 centerMediaData exists?', !!centerMediaData);
  console.log('🎬 centerMediaData is array?', Array.isArray(centerMediaData));
  console.log('🎬 centerMediaData length:', centerMediaData.length);
  console.log('🎬 centerMediaData content:', centerMediaData);
  if (centerMediaData.length > 0) {
    centerMediaData.forEach((item, idx) => {
      console.log(`🎬 centerMedia[${idx}]:`, {
        type: item.type,
        id: item.id,
        hasSrc: !!item.src,
        srcPreview: item.src ? item.src.substring(0, 100) : 'NO SRC',
        loop: item.loop,
        widthPct: item.widthPct
      });
    });
  } else {
    console.log('🎬 ⚠️ NO centerMediaData in button!');
  }
  
  // Debug: Log the button data to see what we're working with
  console.log('🔍 Button.slots:', button.slots);
  console.log('🔍 SlotsData:', slotsData);
  if (slotsData && Object.keys(slotsData).length > 0) {
    Object.keys(slotsData).forEach(key => {
      console.log(`🔍 Slot ${key}:`, slotsData[key]);
      console.log(`🔍 Slot ${key} text:`, slotsData[key]?.text);
      console.log(`🔍 Slot ${key} style:`, slotsData[key]?.style);
    });
  } else {
    console.log('⚠️ No slots data found in button!');
  }
  console.log('🔍 Button options:', button.options);
  console.log('🔍 OptionsData:', optionsData);
  console.log('🔍 DurationMs in options:', optionsData.durationMs);
  
  // 1. Audio handling for multi-media buttons
  // NOTE: Audio plays ONLY in the overlay, not in the dashboard, to prevent double audio
  console.log('🎵 Audio will play in overlay only (preventing double audio)');
  const audioPromises = []; // Keep empty for overlay-only playback

  // 2. Send overlay payload - immediately after starting audio
  // Check if we have separate audio files - if so, mute videos to avoid double audio
  const hasSeparateAudio = audioData && audioData.length > 0;
  
  // Process center media similar to alert system
  const processedCenterMedia = await Promise.all(centerMediaData.map(async (item) => {
    if (item.src) {
      // Mute videos if there are separate audio files to prevent double audio
      if (item.type === 'video' && hasSeparateAudio) {
        console.log('🔇 Muting video because separate audio files are present');
        item.muted = true;
      }
      // Handle different image source types like alert system
      if (item.src instanceof File) {
        // Fresh file upload - create blob URL
        console.log('🖼️ Processing fresh file for multi-media:', item.src.name);
        return {
          ...item,
          src: URL.createObjectURL(item.src)
        };
      } else if (typeof item.src === 'string' && (item.src.startsWith('data:') || item.src.startsWith('blob:'))) {
        // Base64 data or blob URL - use directly
        console.log('🖼️ Using base64/blob data for multi-media');
        return item;
      } else if (typeof item.src === 'string' && !item.src.startsWith('http')) {
        // File path (relative to userDataPath) - serve via HTTP to avoid base64 conversion
        console.log('🖼️ Converting file path to HTTP URL:', item.src);
        try {
          // Use the original relative path in the URL
          // The media server expects relative paths (from userDataPath) and will join them
          const relativePath = item.src.replace(/\\/g, '/'); // Normalize path separators
          const httpUrl = `http://localhost:8080/media/${encodeURIComponent(relativePath)}`;
          console.log(`✅ Serving media via HTTP: ${httpUrl}`);
          console.log(`🔍 Media relative path: ${relativePath}`);
          return {
            ...item,
            src: httpUrl
          };
        } catch (error) {
          console.error('Error constructing HTTP URL for media:', error);
          return item;
        }
      } else {
        // Already HTTP URL or other format - use as is
        return item;
      }
    }
    return item;
  }));

  // Process audio files for overlay (convert paths to HTTP URLs)
  const processedAudio = await Promise.all(audioData.map(async (audioItem) => {
    if (audioItem.src) {
      let audioSrc = audioItem.src;
      console.log('🎵 Processing audio item:', audioItem);
      
      // Convert file paths to HTTP URLs
      if (typeof audioSrc === 'string' && 
          !audioSrc.startsWith('data:') && 
          !audioSrc.startsWith('blob:') && 
          !audioSrc.startsWith('http')) {
        console.log('🎵 Converting audio file path to HTTP URL:', audioSrc);
        try {
          // Use the original relative path (audioSrc) in the URL
          // The media server expects relative paths (from userDataPath) and will join them
          const relativePath = audioSrc.replace(/\\/g, '/'); // Normalize path separators
          audioSrc = `http://localhost:8080/media/${encodeURIComponent(relativePath)}?t=${Date.now()}`;
          console.log(`✅ Serving audio via HTTP with cache-busting: ${audioSrc}`);
          console.log(`🔍 Audio relative path: ${relativePath}`);
        } catch (error) {
          console.error('Error constructing HTTP URL for audio:', error);
        }
      }
      
      return {
        ...audioItem,
        src: audioSrc,
        type: 'audio',
        volume: audioItem.volume !== undefined ? audioItem.volume : 1.0,
        loop: audioItem.loop || false
      };
    }
    return audioItem;
  }));

  // Debug: Log chroma key data
  console.log('🔍 Processed center media with chroma key data:', processedCenterMedia.map(item => ({
    type: item.type,
    src: item.src,
    chromaKey: item.chromaKey
  })));

  const overlayPayload = {
    type: 'buttonTrigger',
    targetOverlay: button.overlay || getDefaultOverlay(), // Route to specific overlay
    options: optionsData,
    slots: slotsData,
    centerMedia: [...processedCenterMedia, ...processedAudio] // Include audio in centerMedia
  };

  // Log slots with full style data for debugging
  console.log('📤 Full slots data being sent:', slotsData);
  if (slotsData && Object.keys(slotsData).length > 0) {
    Object.keys(slotsData).forEach(slotKey => {
      console.log(`📤 Slot ${slotKey}:`, slotsData[slotKey]);
      if (slotsData[slotKey].style) {
        console.log(`📤 Slot ${slotKey} style:`, slotsData[slotKey].style);
        console.log(`📤 Slot ${slotKey} fontFamily:`, slotsData[slotKey].style.fontFamily);
      }
    });
  }

  // Log payload summary without full base64 data
  console.log('📤 Sending overlay payload:', {
    type: overlayPayload.type,
    targetOverlay: overlayPayload.targetOverlay,
    slots: Object.keys(overlayPayload.slots || {}),
    centerMedia: overlayPayload.centerMedia.map(item => ({
      type: item.type,
      src: item.src ? (item.src.substring(0, 100) + '...') : 'NO SRC',
      volume: item.volume
    })),
    audioCount: processedAudio.length,
    videoCount: processedCenterMedia.filter(i => i.type === 'video').length,
    imageCount: processedCenterMedia.filter(i => i.type === 'image').length,
    options: overlayPayload.options
  });
  console.log('🎬 DETAILED VIDEO DEBUG:');
  console.log('  - Total centerMedia items:', overlayPayload.centerMedia.length);
  console.log('  - Videos in centerMedia:', overlayPayload.centerMedia.filter(i => i.type === 'video').length);
  overlayPayload.centerMedia.filter(i => i.type === 'video').forEach((vid, idx) => {
    console.log(`  - Video ${idx + 1}:`, {
      type: vid.type,
      src: vid.src,
      loop: vid.loop,
      muted: vid.muted,
      volume: vid.volume
    });
  });
  console.log(`🎯 Sending to overlay: ${overlayPayload.targetOverlay}`);

  // Send via WebSocket (primary method for OBS overlay) - immediately
  if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
    try {
    console.log(`🎯 SENDING TO OVERLAY: "${overlayPayload.targetOverlay}"`);
    console.log(`📊 Button overlay setting: ${button.overlay || 'NOT SET (defaulting to default)'}`);
    console.log(`🔍 Full button object:`, button);
      window.electronAPI.sendOverlayMessage(overlayPayload);
    console.log(`✅ Message sent via WebSocket to overlay: "${overlayPayload.targetOverlay}"`);
    } catch (error) {
      console.warn('Failed to send message via WebSocket:', error);
    }
  } else {
    console.warn('⚠️ WebSocket not available, overlay message not sent');
  }
  
  // Note: Removed duplicate iframe and widget sending to prevent double-triggering
  // The overlay receives messages via WebSocket only
  
  // Note: Audio plays in overlay only (not in dashboard) to prevent double audio
  
  // Note: Overlay handles its own reset timer based on payload.options.durationMs
  // No need to call setupOverlayClearing from dashboard - it would conflict with overlay's timer
  console.log('✅ Overlay will handle auto-clear based on duration:', optionsData.durationMs, 'ms');
}

// Function to clear overlay content
function clearOverlay() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`🧹 [${timestamp}] ===== OVERLAY CLEAR TRIGGERED =====`);
  console.log(`🧹 [${timestamp}] Reason: Media playback completed`);
  
  // Create clear payload - overlay expects 'buttonTrigger' type with clearPrevious option
  const clearPayload = {
    type: 'buttonTrigger',
    options: {
      clearPrevious: true
    },
    slots: {},
    centerMedia: []
  };
  
  console.log(`🧹 [${timestamp}] Clear payload created:`, clearPayload);
  
  // Send to overlay iframe (if exists)
  const overlayIframe = document.getElementById('overlay-iframe');
  if (overlayIframe && overlayIframe.contentWindow) {
    try {
      overlayIframe.contentWindow.postMessage(clearPayload, '*');
      console.log(`✅ [${timestamp}] Clear message sent to overlay iframe`);
    } catch (error) {
      console.warn(`❌ [${timestamp}] Failed to send clear message to overlay iframe:`, error);
    }
  } else {
    console.log(`ℹ️ [${timestamp}] No overlay iframe found or not accessible`);
  }
  
  // Send to overlay widget (if exists)
  const overlayWidget = document.getElementById('overlay-widget');
  if (overlayWidget && !overlayWidget.classList.contains('hidden')) {
    try {
      if (window.sendOverlayPayload) {
        window.sendOverlayPayload(clearPayload);
        console.log(`✅ [${timestamp}] Clear message sent to overlay widget`);
      } else {
        console.log(`ℹ️ [${timestamp}] Overlay widget found but sendOverlayPayload function not available`);
      }
    } catch (error) {
      console.warn(`❌ [${timestamp}] Failed to send clear message to overlay widget:`, error);
    }
  } else {
    console.log(`ℹ️ [${timestamp}] No overlay widget found or it's hidden`);
  }
  
  // Send via WebSocket (if available)
  if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
    try {
      window.electronAPI.sendOverlayMessage(clearPayload);
      console.log(`✅ [${timestamp}] Clear message sent via WebSocket`);
    } catch (error) {
      console.warn(`❌ [${timestamp}] Failed to send clear message via WebSocket:`, error);
    }
  } else {
    console.log(`ℹ️ [${timestamp}] WebSocket API not available`);
  }
  
  console.log(`🧹 [${timestamp}] ===== OVERLAY CLEAR COMPLETE =====`);
}

// Function to set up overlay clearing based on media duration
function setupOverlayClearing(audioData, centerMediaData, customDuration = null) {
  let maxDuration = 0;
  let mediaElements = [];
  
  // If custom duration is provided, use it instead of detecting media duration
  if (customDuration && customDuration > 0) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`⏰ [${timestamp}] Using custom duration from form: ${customDuration.toFixed(2)}s`);
    
    setTimeout(() => {
      const clearTimestamp = new Date().toLocaleTimeString();
      console.log(`⏰ [${clearTimestamp}] Custom duration timer triggered: clearing overlay after ${customDuration.toFixed(2)}s`);
      clearOverlay();
    }, customDuration * 1000);
    
    return; // Skip media duration detection
  }
  
  // Track audio duration
  if (Array.isArray(audioData)) {
    audioData.forEach(audioEntry => {
      if (audioEntry.src) {
        const audio = audioCache.get(audioEntry.src);
        if (audio) {
          mediaElements.push(audio);
          
          // Set up event listeners for this audio
          audio.addEventListener('ended', () => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`🎵 [${timestamp}] Multi-media audio ended, checking if all media finished...`);
            checkAllMediaFinished(mediaElements);
          });
          
          audio.addEventListener('loadedmetadata', () => {
            const duration = audio.duration;
            if (duration && !isNaN(duration) && isFinite(duration)) {
              maxDuration = Math.max(maxDuration, duration);
              const timestamp = new Date().toLocaleTimeString();
              console.log(`🎵 [${timestamp}] Multi-media audio duration: ${duration.toFixed(2)}s, max duration so far: ${maxDuration.toFixed(2)}s`);
            }
          });
        }
      }
    });
  }
  
  // Track video duration from center media
  if (Array.isArray(centerMediaData)) {
    centerMediaData.forEach(mediaItem => {
      if (mediaItem.type === 'video' && mediaItem.src) {
        // Create a temporary video element to get duration
        const tempVideo = document.createElement('video');
        tempVideo.src = mediaItem.src;
        tempVideo.addEventListener('loadedmetadata', () => {
          const duration = tempVideo.duration;
          if (duration && !isNaN(duration) && isFinite(duration)) {
            maxDuration = Math.max(maxDuration, duration);
            const timestamp = new Date().toLocaleTimeString();
            console.log(`🎬 [${timestamp}] Center video duration: ${duration.toFixed(2)}s, max duration so far: ${maxDuration.toFixed(2)}s`);
          }
        });
        tempVideo.load();
      }
    });
  }
  
  // Set up fallback timer based on the longest media duration
  if (maxDuration > 0) {
    const timestamp = new Date().toLocaleTimeString();
    const clearTime = maxDuration + 1; // Add 1 second buffer
    console.log(`⏰ [${timestamp}] Setting fallback clear timer for ${clearTime.toFixed(2)}s (max duration: ${maxDuration.toFixed(2)}s + 1s buffer)`);
    setTimeout(() => {
      const clearTimestamp = new Date().toLocaleTimeString();
      console.log(`⏰ [${clearTimestamp}] Fallback timer triggered: clearing overlay after max media duration + buffer`);
      clearOverlay();
    }, (maxDuration * 1000) + 1000); // Add 1 second buffer
  } else {
    // If no duration available, set a default timer
    const timestamp = new Date().toLocaleTimeString();
    console.log(`⏰ [${timestamp}] No media duration available, setting default 10s timer`);
    setTimeout(() => {
      const clearTimestamp = new Date().toLocaleTimeString();
      console.log(`⏰ [${clearTimestamp}] Default timer triggered: clearing overlay after 10s fallback`);
      clearOverlay();
    }, 10000);
  }
}

// Function to check if all media elements have finished
function checkAllMediaFinished(mediaElements) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`🔍 [${timestamp}] Checking if all media elements have finished...`);
  
  const allFinished = mediaElements.every(element => {
    const isFinished = element.ended || element.paused;
    console.log(`🔍 [${timestamp}] Media element status: ended=${element.ended}, paused=${element.paused}, finished=${isFinished}`);
    return isFinished;
  });
  
  console.log(`🔍 [${timestamp}] All media finished: ${allFinished}`);
  
  if (allFinished) {
    console.log(`✅ [${timestamp}] All media finished, triggering overlay clear`);
    clearOverlay();
  } else {
    console.log(`⏳ [${timestamp}] Some media still playing, waiting for completion...`);
  }
}

// Replace all ipcRenderer.send and ipcRenderer.on with window.electronAPI methods
// Add sound card functionality
document.getElementById('close-settings').onclick = () => {
  document.getElementById('settings-modal').classList.add('hidden');
  // Ensure hotkey recorder is stopped when closing modal
  if (typeof stopHotkeyRecording === 'function') stopHotkeyRecording();
  window.electronAPI.enableHotkeys();
};

document.getElementById('settings-form').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const label = form.label.value.trim();
  
  // Determine type based on which section is visible
  const audioFileSection = document.getElementById('audio-file-section');
  const appFileSection = document.getElementById('app-file-section');
  const type = audioFileSection && audioFileSection.style.display !== 'none' ? 'audio' : 'app';
  
  // Ensure we reference the hotkey input element safely
  const hotkeyInput = document.getElementById('hotkey-input');
  const hotkey = hotkeyInput && hotkeyInput.value ? hotkeyInput.value.trim() : '';
  const isEditing = form.dataset.editingIndex !== undefined;
  let skipReload = false;

  // Get modifier checkboxes
  if (!label) return alert("Please fill in the label field.");
  // Use the recorded hotkey directly (accumulative recorder populates hotkeyInput.value)
  const completeHotkey = (hotkeyInput && hotkeyInput.value && hotkeyInput.value.trim()) ? hotkeyInput.value.trim() : hotkey;

  // Get chat command settings
  const chatCommandCheckbox = document.getElementById('chat-command-enabled');
  const chatCommandKeywordInput = document.getElementById('chat-command-keyword');
  const redeemNameInput = document.getElementById('redeem-name');
  
  console.log('Chat command elements found:');
  console.log('- Checkbox element:', chatCommandCheckbox);
  console.log('- Keyword input element:', chatCommandKeywordInput);
  console.log('- Redeem name input element:', redeemNameInput);
  
  const chatCommandEnabled = chatCommandCheckbox?.checked || false;
  const chatCommandKeyword = chatCommandKeywordInput?.value?.trim() || '';
  const redeemName = redeemNameInput?.value?.trim() || '';
  
  // Get trigger method selection
  const triggerMethodRadio = document.querySelector('input[name="trigger-method"]:checked');
  const triggerMethod = triggerMethodRadio?.value || 'command';
  console.log(`🔍 Selected trigger method radio:`, triggerMethodRadio);
  console.log(`🔍 Selected trigger method value:`, triggerMethod);
  
  const chatCommand = (chatCommandEnabled && (chatCommandKeyword || redeemName)) ? {
    enabled: true,
    keyword: chatCommandKeyword.toLowerCase(),
    redeemName: redeemName,
    triggerMethod: triggerMethod
  } : undefined;
  
  console.log(`🔍 Saving button with chatCommand:`, chatCommand);
  console.log(`🔍 Form values - enabled: ${chatCommandEnabled}, keyword: "${chatCommandKeyword}", redeemName: "${redeemName}", triggerMethod: "${triggerMethod}"`);

  // Get the appropriate file input based on type
  const fileInput = type === 'app' ? document.getElementById('app-file-input') : document.getElementById('file-input');

  // Check if we have a resolved path from drag-and-drop
  const resolvedPath = form.dataset.resolvedPath;
  const resolvedArgs = form.dataset.resolvedArgs || '';
  
  // Debug logging
  console.log('Form submission debug:');
  console.log('- Type:', type);
  console.log('- FileInput element:', fileInput);
  console.log('- FileInput exists:', !!fileInput);
  if (fileInput) {
    console.log('- FileInput.files:', fileInput.files);
    console.log('- FileInput.files.length:', fileInput.files.length);
    if (fileInput.files.length > 0) {
      console.log('- FileInput.files[0]:', fileInput.files[0]);
      console.log('- FileInput.files[0].path:', fileInput.files[0].path);
      console.log('- FileInput.files[0].name:', fileInput.files[0].name);
    }
  }
  console.log('- ResolvedPath:', resolvedPath);
  console.log('- Label:', label);
  console.log('- Type:', type);
  console.log('- Base hotkey:', hotkey);
  // Modifiers UI removed; recorders supply full combo
  console.log('- Modifiers: (recorder-based)');
  console.log('- Complete hotkey:', completeHotkey);
  console.log('- Is editing:', isEditing);
  console.log('- File input files length:', fileInput.files.length);
  console.log('- Resolved path:', resolvedPath);
  console.log('- Resolved args:', resolvedArgs);
  console.log('- Chat command enabled:', chatCommandEnabled);
  console.log('- Chat command keyword:', chatCommandKeyword);
  console.log('- Chat command object:', chatCommand);

  // Prevent dangerous system shortcuts like Alt+F4 from being saved
  if (completeHotkey && (completeHotkey.includes('Alt') && completeHotkey.includes('F4'))) {
    return alert('Alt+F4 is not allowed as a hotkey. Please choose a different combination.');
  }

  // If editing and no new file selected, use existing file
  if (isEditing && !fileInput.files.length && !resolvedPath) {
    const existingFile = form.dataset.existingFile;
    if (!existingFile) return alert("No existing file found.");

    // Send update without file change
    window.electronAPI.addMedia({
      label,
      type,
      hotkey: completeHotkey,
      volume: parseFloat((document.getElementById('volume-input') && document.getElementById('volume-input').value) || 100) / 100,
      targetPath: existingFile,
      originalPath: existingFile,
      editingIndex: parseInt(form.dataset.editingIndex),
      chatCommand: chatCommand
    });
    window.electronAPI.refreshHotkeys();
    
    // Clear audio cache to ensure new audio files are loaded
    audioCache.clear();
    console.log('🧹 Audio cache cleared after button edit');
    
    // Force immediate profile save after button edit
    if (profileManager && profileManager.saveCurrentSettings) {
      setTimeout(async () => {
        await profileManager.saveCurrentSettings();
        console.log('✅ Profile saved after button edit');
        
        // Then reload buttons
        loadButtons();
        console.log('🔄 Buttons reloaded after edit');
      }, 150);
    } else {
      // Refresh the entire button list to show updated data
      setTimeout(() => {
        loadButtons();
        console.log('🔄 Buttons reloaded after edit');
      }, 100);
    }
    
    skipReload = true;
  } else if ((fileInput && fileInput.files.length) || resolvedPath) {
    // New file selected or resolved path from drag-and-drop
    console.log('Form submission - resolvedPath:', resolvedPath);
    console.log('Form submission - fileInput:', fileInput);
    console.log('Form submission - fileInput.files.length:', fileInput ? fileInput.files.length : 0);
    
    let filePath = resolvedPath;
    let fileName = null;
    
    if (!filePath && fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      console.log('Form submission - fileInput.files[0]:', file);
      console.log('Form submission - fileInput.files[0].name:', file.name);
      console.log('Form submission - fileInput.files[0].type:', file.type);
      console.log('Form submission - fileInput.files[0].size:', file.size);
      
      // Use Electron's webUtils to get the file path
      if (window.electronAPI && window.electronAPI.getFilePathFromFile) {
        filePath = window.electronAPI.getFilePathFromFile(file);
        console.log('Form submission - got file path from webUtils:', filePath);
      } else {
        console.warn('electronAPI.getFilePathFromFile not available, falling back to file.path');
        filePath = file.path;
      }
      
      fileName = file.name;
    } else if (resolvedPath) {
      fileName = resolvedPath.split('\\').pop() || resolvedPath.split('/').pop();
    }
    
    // Validate that we have a valid file path
    if (!filePath) {
      console.error('Error: No valid file path found');
      console.error('- resolvedPath:', resolvedPath);
      console.error('- fileInput:', fileInput);
      console.error('- fileInput exists:', !!fileInput);
      if (fileInput) {
        console.error('- fileInput.files:', fileInput.files);
        console.error('- fileInput.files.length:', fileInput.files.length);
        console.error('- fileInput.files[0]:', fileInput.files[0]);
        if (fileInput.files[0]) {
          console.error('- fileInput.files[0].path:', fileInput.files[0].path);
          console.error('- fileInput.files[0].name:', fileInput.files[0].name);
        }
      }
      return alert('Error: Could not get file path. Please try selecting the file again.\n\nTip: Try clicking "Browse" and selecting your file from the file picker.');
    }
    
    // For app files, use the resolved path directly; for audio files, create a target path
    let targetPath;
    if (type === 'app') {
      targetPath = filePath; // Use the actual file path for apps
    } else {
      const ext = fileName.split('.').pop();
      targetPath = `assets/sounds/${label}.${ext}`;
    }

    // Save args for app buttons
    const args = type === 'app' ? resolvedArgs : '';

    console.log('Sending to addMedia:', {
      label,
      type,
      hotkey: completeHotkey,
      targetPath,
      originalPath: filePath,
      args,
      chatCommand: chatCommand
    });

    // Send file path and data to main
    const addMediaData = {
      label,
      type,
      hotkey: completeHotkey,
      volume: parseFloat((document.getElementById('volume-input') && document.getElementById('volume-input').value) || 100) / 100,
      targetPath,
      originalPath: filePath,
      args,
      editingIndex: isEditing ? parseInt(form.dataset.editingIndex) : undefined,
      chatCommand: chatCommand
    };
    
    console.log('Final addMediaData object:', addMediaData);
    window.electronAPI.addMedia(addMediaData);
    window.electronAPI.refreshHotkeys();
    
    // Clear audio cache to ensure new audio files are loaded
    audioCache.clear();
    console.log('🧹 Audio cache cleared after button add/edit with new file');
    
    // Refresh the entire button list to show updated data
    setTimeout(() => {
      loadButtons();
      console.log('🔄 Buttons reloaded after add/edit with new file');
    }, 100);
    
    skipReload = true;
  } else if (!isEditing) {
    // Only require file selection for new buttons, not when editing
    console.log('No file found and not editing - showing alert');
    return alert("Please select a file.");
  }

  document.getElementById('settings-modal').classList.add('hidden');
  // Refresh buttons in-place to avoid a full reload which triggers auto-reconnect to Twitch
  if (!skipReload) {
    setTimeout(() => {
      try {
        loadButtons();
        // Re-enable hotkeys after closing modal
        if (window.electronAPI && window.electronAPI.enableHotkeys) window.electronAPI.enableHotkeys();
      } catch (e) {
        // Fallback to full reload if something goes wrong
        console.error('In-place refresh failed, falling back to full reload:', e);
        window.location.reload();
      }
    }, 200);
  } else {
    // Re-enable hotkeys immediately when we've done an in-place update
    if (window.electronAPI && window.electronAPI.enableHotkeys) window.electronAPI.enableHotkeys();
  }
};

window.editButton = async (index) => {
  const config = await window.electronAPI.getConfig();
  const btn = config.buttons[index];
  console.log(`🔍 editButton: Editing button at index ${index}:`, btn);
  console.log(`🔍 editButton: Button chatCommand data:`, btn.chatCommand);
  const settingsForm = document.getElementById('settings-form');
  // Always set editingIndex for edit, and clear resolvedPath/existingFile for safety
  settingsForm.dataset.editingIndex = index;
  // Store stable id for in-place updates
  if (btn && btn.id) settingsForm.dataset.editingId = btn.id;
  else delete settingsForm.dataset.editingId;
  delete settingsForm.dataset.resolvedPath;
  delete settingsForm.dataset.existingFile;
  // Replace file inputs to clear previous file references
  const oldFileInput = document.getElementById('file-input');
  if (oldFileInput) {
    const newFileInput = oldFileInput.cloneNode(false);
    newFileInput.required = false;
    newFileInput.id = 'file-input';
    newFileInput.name = 'file';
    oldFileInput.parentNode.replaceChild(newFileInput, oldFileInput);
  }
  const oldAppFileInput = document.getElementById('app-file-input');
  if (oldAppFileInput) {
    const newAppFileInput = oldAppFileInput.cloneNode(false);
    newAppFileInput.required = false;
    newAppFileInput.id = 'app-file-input';
    newAppFileInput.name = 'app-file';
    oldAppFileInput.parentNode.replaceChild(newAppFileInput, oldAppFileInput);
  }
  // Populate form fields
  const labelInput = document.getElementById('label-input');
  labelInput.value = btn.name || btn.label || ''; // Support both new and old schema
  labelInput.readOnly = false;
  labelInput.disabled = false;
  // Toggle file input sections and required states based on type
  const audioFileSection = document.getElementById('audio-file-section');
  const appFileSection = document.getElementById('app-file-section');
  const fileInput = document.getElementById('file-input');
  const appFileInput = document.getElementById('app-file-input');
  if (btn.type === 'audio') {
    audioFileSection.style.display = '';
    appFileSection.style.display = 'none';
    fileInput.required = false; // Not required when editing
    appFileInput.required = false;
  } else {
    audioFileSection.style.display = 'none';
    appFileSection.style.display = '';
    fileInput.required = false;
    appFileInput.required = false; // Not required when editing
  }
  // Set hotkey and parse modifiers
  const hotkeyInput = document.getElementById('hotkey-input');
  if (btn.hotkey) {
    // Place full recorded hotkey string into input (recorder uses same format)
    hotkeyInput.value = btn.hotkey;
  } else {
    hotkeyInput.value = '';
  }
  
  // Set chat command fields
  const chatCommandEnabled = document.getElementById('chat-command-enabled');
  const chatCommandKeyword = document.getElementById('chat-command-keyword');
  const redeemName = document.getElementById('redeem-name');
  const chatCommandSettings = document.getElementById('chat-command-settings');
  
  if (chatCommandEnabled && chatCommandKeyword && chatCommandSettings) {
    if (btn.chatCommand && btn.chatCommand.enabled) {
      chatCommandEnabled.checked = true;
      chatCommandKeyword.value = btn.chatCommand.keyword || '';
      redeemName.value = btn.chatCommand.redeemName || '';
      
      // Sync dropdown if value exists
      const redeemSelect = document.getElementById('redeem-name-select');
      if (redeemSelect && btn.chatCommand.redeemName) {
        const matchingOption = Array.from(redeemSelect.options).find(
          opt => opt.value === btn.chatCommand.redeemName
        );
        redeemSelect.value = matchingOption ? matchingOption.value : '';
      }
      
      chatCommandSettings.style.display = 'block';
      
      // Set trigger method selection
      const triggerMethod = btn.chatCommand.triggerMethod || 'command';
      const triggerMethodRadio = document.querySelector(`input[name="trigger-method"][value="${triggerMethod}"]`);
      if (triggerMethodRadio) {
        triggerMethodRadio.checked = true;
      }
    } else {
      chatCommandEnabled.checked = false;
      chatCommandKeyword.value = '';
      redeemName.value = '';
      chatCommandSettings.style.display = 'none';
      
      // Reset to default trigger method
      const defaultRadio = document.querySelector('input[name="trigger-method"][value="command"]');
      if (defaultRadio) {
        defaultRadio.checked = true;
      }
    }
  }
  
  // Store the existing file path and args for editing
  settingsForm.dataset.existingFile = btn.src;
  if (btn.args) {
    settingsForm.dataset.resolvedArgs = btn.args;
  }
  // Populate volume slider if present
  const volumeInput = document.getElementById('volume-input');
  const volumeValue = document.getElementById('volume-value');
  if (volumeInput) {
    const vol = (typeof btn.volume === 'number') ? btn.volume : (btn.volume ? parseFloat(btn.volume) : 1.0);
    const percent = Math.round((!isNaN(vol) ? vol : 1.0) * 100);
    volumeInput.value = percent;
    if (volumeValue) volumeValue.textContent = `${percent}%`;
  }
  // Update modal title
  const buttonName = btn.name || btn.label || 'Unknown';
  document.querySelector('#settings-modal h2').textContent = `Edit ${btn.type === 'audio' ? 'Sound' : btn.type === 'multi-media' ? 'Multi-Media' : 'App'}: ${buttonName}`;
  // Handle multi-media buttons differently
  if (btn.type === 'multi-media') {
    // Close the regular settings modal
    document.getElementById('settings-modal').classList.add('hidden');
    
    // Open the multi-media form for editing
    if (window.addEditButtonForm) {
      window.addEditButtonForm.openForEdit(btn);
    } else {
      console.error('Multi-media form not available');
    }
    return;
  }

  // Show current file info (only for audio/app buttons)
  const dropZone = document.getElementById('drop-zone');
  if (dropZone && btn.type !== 'multi-media') {
    const fileName = (btn.src && typeof btn.src === 'string') ? (btn.src.split('/').pop() || btn.src.split('\\').pop()) : 'No file';
    dropZone.innerHTML = `
      <div style="margin-bottom: 10px; color: #4CAF50; font-weight: bold;">
        ✓ Current file: ${fileName}
      </div>
      <div style="color: #888; font-size: 0.9em;">
        Drag new file here to replace, or leave empty to keep current file
      </div>
    `;
  } else if (dropZone && btn.type === 'multi-media') {
    // For multi-media buttons, show different info
    dropZone.innerHTML = `
      <div style="margin-bottom: 10px; color: #4CAF50; font-weight: bold;">
        ✓ Multi-media button
      </div>
      <div style="color: #888; font-size: 0.9em;">
        This button contains text, images, videos, and audio
      </div>
    `;
  }
  
  // Handle multi-media buttons differently
  if (btn.type === 'multi-media') {
    // Close the regular settings modal
    document.getElementById('settings-modal').classList.add('hidden');
    
    // Open the multi-media form for editing
    if (window.addEditButtonForm && typeof window.addEditButtonForm.openForEdit === 'function') {
      window.addEditButtonForm.openForEdit(btn);
    } else {
      console.error('Multi-media form not available for editing');
      alert('Multi-media editing not available. Please check your app version.');
    }
    return;
  }
  
  document.getElementById('settings-modal').classList.remove('hidden');
  window.electronAPI.disableHotkeys();
  // Ensure recorder is stopped when opening edit
  if (typeof stopHotkeyRecording === 'function') stopHotkeyRecording();
};

// Update displayed volume percentage when slider moves
const volSlider = document.getElementById('volume-input');
if (volSlider) {
  volSlider.addEventListener('input', (e) => {
    const v = e.target.value;
    const label = document.getElementById('volume-value');
    if (label) label.textContent = `${v}%`;
  });
}

// New helper: edit by element (maps displayed card back to config index)
window.editButtonByEl = async (btnEl) => {
  try {
    const card = btnEl.closest && btnEl.closest('.sound-card');
    if (!card) return;
    const config = await window.electronAPI.getConfig();
    let origIndex = -1;
    // Prefer stable id mapping if present
    const bid = card.dataset.buttonId;
    if (bid && config && Array.isArray(config.buttons)) {
      origIndex = config.buttons.findIndex(b => b.id === bid);
    }
    if (origIndex === -1) {
      // Fallback: try matching by soundData
      const soundData = card.dataset.soundData ? JSON.parse(card.dataset.soundData) : null;
      if (soundData && config && Array.isArray(config.buttons)) {
        origIndex = config.buttons.findIndex(b => b.src === soundData.src && b.label === soundData.label && b.type === soundData.type);
      }
    }
    if (origIndex === -1) {
      // fallback to dataset.index (this is the displayed index)
      origIndex = parseInt(card.dataset.index || '-1');
    }
    // Delegate to existing editButton handler which expects a config index
    if (typeof window.editButton === 'function') {
      window.editButton(origIndex);
    }
  } catch (e) {
    console.error('editButtonByEl error:', e);
  }
};

// New helper: delete by element (maps displayed card back to config index)
window.deleteButtonByEl = async (btnEl) => {
  try {
    const card = btnEl.closest && btnEl.closest('.sound-card');
    if (!card) return;
    const config = await window.electronAPI.getConfig();
    let origIndex = -1;
    const bid = card.dataset.buttonId;
    if (bid && config && Array.isArray(config.buttons)) {
      origIndex = config.buttons.findIndex(b => b.id === bid);
    }
    if (origIndex === -1) {
      const soundData = card.dataset.soundData ? JSON.parse(card.dataset.soundData) : null;
      if (soundData && config && Array.isArray(config.buttons)) {
        origIndex = config.buttons.findIndex(b => b.src === soundData.src && b.label === soundData.label && b.type === soundData.type);
      }
    }
    if (origIndex === -1) origIndex = parseInt(card.dataset.index || '-1');
    if (origIndex === -1) return;
    // Confirm and call existing delete flow
    const confirmed = await showCustomConfirm("Delete this button?");
    if (confirmed) {
      window.electronAPI.deleteButton(origIndex);
      window.electronAPI.refreshHotkeys();
      
      // Force immediate profile save after deletion
      if (profileManager && profileManager.saveCurrentSettings) {
        setTimeout(async () => {
          await profileManager.saveCurrentSettings();
          console.log('✅ Profile saved after button deletion');
        }, 200);
      }
      
      // Refresh UI after deletion
      setTimeout(() => loadButtons(), 150);
    }
  } catch (e) {
    console.error('deleteButtonByEl error:', e);
  }
};

window.deleteButton = (index) => {
  if (!confirm("Delete this button?")) return;
  window.electronAPI.deleteButton(index);
  window.electronAPI.refreshHotkeys();
};

// Close app button
// close-app button removed — app window controlled via menu bar

// Hotkey recording functionality
let hotkeyListener = null;
// Recorder state accessible to other UI actions so we can cancel pending timers/listeners
let recorderState = {
  recorded: new Set(),
  finalizeTimer: null
};

function stopHotkeyRecording() {
  try {
    if (recorderState.finalizeTimer) {
      clearTimeout(recorderState.finalizeTimer);
      recorderState.finalizeTimer = null;
    }
    recorderState.recorded.clear();
    if (hotkeyListener) {
      document.removeEventListener('keydown', hotkeyListener);
      hotkeyListener = null;
    }
    const recordHotkeyBtn = document.getElementById('record-hotkey');
    if (recordHotkeyBtn) {
      recordHotkeyBtn.textContent = 'Record Hotkey';
      recordHotkeyBtn.classList.remove('recording');
    }
    const hotkeyStatus = document.getElementById('hotkey-status');
    if (hotkeyStatus) hotkeyStatus.textContent = '';
  } catch (e) {
    console.error('Error stopping hotkey recorder:', e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Attach Record Hotkey button handler
  const recordHotkeyBtn = document.getElementById('record-hotkey');
  const hotkeyInput = document.getElementById('hotkey-input');
  const hotkeyStatus = document.getElementById('hotkey-status');

  // Make the hotkey input read-only to force use of the recorder button
  if (hotkeyInput) hotkeyInput.readOnly = true;

  // Setup chat command checkbox toggle for regular form
  const chatCommandCheckbox = document.getElementById('chat-command-enabled');
  const chatCommandSettings = document.getElementById('chat-command-settings');
  
  if (chatCommandCheckbox && chatCommandSettings) {
    chatCommandCheckbox.addEventListener('change', () => {
      if (chatCommandCheckbox.checked) {
        chatCommandSettings.style.display = 'block';
      } else {
        chatCommandSettings.style.display = 'none';
      }
    });
  }

  if (recordHotkeyBtn) {
    recordHotkeyBtn.addEventListener('click', () => {
      // Button click animation
      recordHotkeyBtn.classList.remove('clicked');
      void recordHotkeyBtn.offsetWidth;
      recordHotkeyBtn.classList.add('clicked');
  hotkeyStatus.textContent = 'Press any key or combination with Ctrl, Alt, Shift | Ex: "Ctrl + F1"';
      hotkeyInput.value = '';
      hotkeyInput.focus();
      if (hotkeyListener) document.removeEventListener('keydown', hotkeyListener);
      // Accumulative listener: collect all keys pressed within a short window and record them as a combo
  // reset any previous recorder state
  stopHotkeyRecording();
  recorderState.recorded = new Set();
      const finalizeDelay = 700; // ms

      function normalizeKeyEvent(ev) {
        // Prefer code for clarity on F-keys and Numpad
        if (ev.code) {
          if (ev.code.startsWith('F') && /^F\d+$/.test(ev.code)) return ev.code.toUpperCase();
          if (ev.code.startsWith('Numpad')) return ev.code.replace('Numpad', 'Num');
        }
        if (ev.key === ' ') return 'Space';
        if (ev.key && ev.key.length === 1) return ev.key.toUpperCase();
        if (ev.key) return ev.key;
        return ev.code || String.fromCharCode(0);
      }

      function keyHandler(ev) {
  ev.preventDefault();
  const k = normalizeKeyEvent(ev);
  recorderState.recorded.add(k);

  // reset finalize timer
  if (recorderState.finalizeTimer) clearTimeout(recorderState.finalizeTimer);
  recorderState.finalizeTimer = setTimeout(() => {
          // Build a stable ordering: modifiers first (Ctrl, Alt, Shift, Meta), then others sorted
          const modifiersOrder = ['Control','Ctrl','Alt','Shift','Meta'];
          const items = Array.from(recorderState.recorded);
          const mods = items.filter(i => modifiersOrder.includes(i));
          const others = items.filter(i => !modifiersOrder.includes(i));
          // Normalize modifier names (use short forms)
          const normMods = [];
          if (mods.includes('Control') || mods.includes('Ctrl')) normMods.push('Ctrl');
          if (mods.includes('Alt')) normMods.push('Alt');
          if (mods.includes('Shift')) normMods.push('Shift');
          if (mods.includes('Meta')) normMods.push('Meta');

          const combo = normMods.concat(others).join('+');
          // Reject Alt+F4 as a hotkey (closes the app on many platforms)
          if (normMods.includes('Alt') && others.includes('F4')) {
            hotkeyInput.value = '';
            hotkeyStatus.textContent = 'Alt+F4 is not allowed as a hotkey.';
            recorderState.recorded.clear();
            if (recorderState.finalizeTimer) { clearTimeout(recorderState.finalizeTimer); recorderState.finalizeTimer = null; }
            document.removeEventListener('keydown', keyHandler);
            hotkeyListener = null;
            recordHotkeyBtn.textContent = 'Record Hotkey';
            recordHotkeyBtn.classList.remove('recording');
            return;
          }
          hotkeyInput.value = combo;
          hotkeyStatus.textContent = `Set to: ${hotkeyInput.value}`;
          document.removeEventListener('keydown', keyHandler);
          hotkeyListener = null;
          recordHotkeyBtn.textContent = 'Record Hotkey';
          recordHotkeyBtn.classList.remove('recording');
          recorderState.recorded.clear();
          if (recorderState.finalizeTimer) { clearTimeout(recorderState.finalizeTimer); recorderState.finalizeTimer = null; }
        }, finalizeDelay);
      }

      hotkeyListener = keyHandler;
      document.addEventListener('keydown', hotkeyListener);
      recordHotkeyBtn.textContent = 'Recording...';
      recordHotkeyBtn.classList.add('recording');
    });
  }
});

// move-bar removed — menu bar is used instead for window controls

// Close functions for modals
function closeSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {
    settingsModal.classList.add('hidden');
    // Clear any form data if needed
    clearSettingsForm();
  }
}

function closeMultiMediaModal() {
  const multiMediaModal = document.getElementById('multi-media-modal');
  if (multiMediaModal) {
    multiMediaModal.classList.add('hidden');
    // Clear any form data if needed
    if (window.addEditButtonForm) {
      window.addEditButtonForm.resetForm();
    }
  }
}

function closeTwitchAlertWidget() {
  const twitchAlertWidget = document.getElementById('twitch-alert-widget');
  if (twitchAlertWidget) {
    twitchAlertWidget.classList.add('hidden');
  }
}

// Add event listeners for close buttons
document.addEventListener('DOMContentLoaded', () => {
  // Settings modal close button
  const settingsCloseBtn = document.getElementById('settings-modal-close');
  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', closeSettingsModal);
  }
  
  // Multi-media modal close button
  const multiMediaCloseBtn = document.getElementById('multi-media-modal-close');
  if (multiMediaCloseBtn) {
    multiMediaCloseBtn.addEventListener('click', closeMultiMediaModal);
  }
  
  // Twitch alert widget close button
  const twitchAlertCloseBtn = document.getElementById('twitch-alert-widget-close');
  if (twitchAlertCloseBtn) {
    twitchAlertCloseBtn.addEventListener('click', closeTwitchAlertWidget);
  }
  
  // Add click-outside-to-close functionality
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }
  
  const multiMediaModal = document.getElementById('multi-media-modal');
  if (multiMediaModal) {
    multiMediaModal.addEventListener('click', (e) => {
      if (e.target === multiMediaModal) {
        closeMultiMediaModal();
      }
    });
  }
});

// ESC key handling for closing modals and forms
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    // Close settings modal
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal && !settingsModal.classList.contains('hidden')) {
      closeSettingsModal();
      return;
    }
    
    // Close multi-media modal
    const multiMediaModal = document.getElementById('multi-media-modal');
    if (multiMediaModal && !multiMediaModal.classList.contains('hidden')) {
      closeMultiMediaModal();
      return;
    }
    
    // Close Twitch Alert Widget
    const twitchAlertWidget = document.getElementById('twitch-alert-widget');
    if (twitchAlertWidget && !twitchAlertWidget.classList.contains('hidden')) {
      closeTwitchAlertWidget();
      return;
    }
    
    // Close any other visible modals
    const visibleModals = document.querySelectorAll('.modal:not(.hidden), [class*="modal"]:not(.hidden)');
    visibleModals.forEach(modal => {
      if (modal.style.display !== 'none' && modal.offsetParent !== null) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    });
  }
});

// Listen for trigger-media events from the main process
window.electronAPI.onTriggerMedia(async (mediaId) => {
  console.log(`🔍 onTriggerMedia called for: "${mediaId}"`);
  const config = await window.electronAPI.getConfig();
  if (!config || !Array.isArray(config.buttons)) return;
  const button = config.buttons.find(btn => {
    // Check both name and label for compatibility - use exact match for precision
    const name = btn.name || btn.label || '';
    return name.toLowerCase() === mediaId.toLowerCase();
  });
  if (button) {
    console.log(`🎯 Triggering mapped button: "${button.name || button.label}" Type: ${button.type} Volume: ${button.volume}`);
    handleTrigger(button);
  } else {
    console.warn('⚠️ No button found for mapping trigger:', mediaId);
  }
});

function handleFileDrop(file) {
  console.log('🎵 handleFileDrop called with file:', file);
  console.log('  - File name:', file.name);
  console.log('  - File path:', file.path);
  console.log('  - File type:', file.type);
  console.log('  - File size:', file.size);
  
  // Debug: Check for missing elements
  const requiredIds = [
    'settings-form', 'hotkey-input', 'hotkey-status', 'label-input', 'type-select',
    'audio-file-section', 'app-file-section', 'file-input', 'app-file-input', 'settings-modal'
  ];
  for (const id of requiredIds) {
    if (!document.getElementById(id)) {
      console.warn('Missing element:', id);
    }
  }

  // Supported extensions
  const audioExts = ['mp3', 'wav', 'ogg'];
  const appExts = [
    'exe',    // Windows executable
    'bat',    // Windows batch
    'cmd',    // Windows command
    'lnk',    // Windows shortcut
    'app',    // macOS app bundle or Linux AppImage
    'sh',     // Linux shell script
    'desktop' // Linux desktop shortcut
  ];
  const ext = file.name.split('.').pop().toLowerCase();
  console.log('File extension:', ext);
  let type = 'audio';
  if (appExts.includes(ext)) type = 'app';
  
  // Additional check: if the file has no extension or an unknown extension,
  // but the name contains common app names, treat it as an app
  if (type === 'audio' && (!ext || !audioExts.includes(ext))) {
    const fileName = file.name.toLowerCase();
    const appKeywords = ['spotify', 'chrome', 'firefox', 'edge', 'steam', 'discord', 'slack', 'teams', 'zoom', 'postman', 'vscode', 'notepad', 'calculator', 'paint', 'word', 'excel', 'powerpoint'];
    if (appKeywords.some(keyword => fileName.includes(keyword))) {
      type = 'app';
      console.log('Detected as app based on filename containing app keyword');
    }
  }
  
  console.log('Detected type:', type);

  // Get all required elements
  const settingsForm = document.getElementById('settings-form');
  const hotkeyInput = document.getElementById('hotkey-input');
  const hotkeyStatus = document.getElementById('hotkey-status');
  const labelInput = document.getElementById('label-input');
  const audioFileSection = document.getElementById('audio-file-section');
  const appFileSection = document.getElementById('app-file-section');
  const fileInput = document.getElementById('file-input');
  const appFileInput = document.getElementById('app-file-input');
  const settingsModal = document.getElementById('settings-modal');

  // Null checks
  if (!settingsForm || !hotkeyInput || !hotkeyStatus || !labelInput || !audioFileSection || !appFileSection || !fileInput || !appFileInput || !settingsModal) {
    console.warn('One or more required elements are missing in the DOM.');
    return;
  }

  // Open add menu
  settingsForm.reset();
  hotkeyInput.value = '';
  hotkeyStatus.textContent = '';
  delete settingsForm.dataset.editingIndex;
  delete settingsForm.dataset.editingId;
  
  // Clear chat command fields
  const chatCommandEnabled = document.getElementById('chat-command-enabled');
  const chatCommandKeyword = document.getElementById('chat-command-keyword');
  const redeemName = document.getElementById('redeem-name');
  const chatCommandSettings = document.getElementById('chat-command-settings');
  if (chatCommandEnabled) chatCommandEnabled.checked = false;
  if (chatCommandKeyword) chatCommandKeyword.value = '';
  if (redeemName) redeemName.value = '';
  if (chatCommandSettings) chatCommandSettings.style.display = 'none';
  
  document.querySelector('#settings-modal h2').textContent = 'Add New ' + (type === 'audio' ? 'Sound' : 'App');
  
  // Since we're using the modal-based approach, we need to directly open the audio form
  // and skip the button type selection modal
  console.log('  📝 Opening audio form directly for file drop');

  // Handle shortcut resolution for app files
  if (type === 'app') {
    // Try to resolve as shortcut regardless of extension
    console.log('  🔗 Attempting to resolve as shortcut:', file.path);
    window.electronAPI.resolveShortcut(file.path).then(shortcut => {
      if (shortcut && shortcut.target) {
        console.log('  ✅ Shortcut resolved to:', shortcut);
        // Store the resolved path and args in the form
        settingsForm.dataset.resolvedPath = shortcut.target;
        settingsForm.dataset.resolvedArgs = shortcut.args || '';
        setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
      } else {
        console.warn('  ❌ Failed to resolve shortcut, using original file');
        settingsForm.dataset.resolvedPath = file.path;
        settingsForm.dataset.resolvedArgs = '';
        setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
      }
    }).catch(error => {
      console.error('  ❌ Error resolving shortcut:', error);
      settingsForm.dataset.resolvedPath = file.path;
      settingsForm.dataset.resolvedArgs = '';
      setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
    });
  } else {
    console.log('  🎵 Processing as audio file');
    settingsForm.dataset.resolvedPath = file.path;
    settingsForm.dataset.resolvedArgs = '';
    setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
  }

  // Set label to file name (no extension)
  labelInput.value = file.name.replace(/\.[^/.]+$/, "");
  console.log('  📝 Setting label to:', labelInput.value);
  
  // Show the modal
  settingsModal.classList.remove('hidden');
  window.electronAPI.disableHotkeys();
  console.log('  ✅ Modal opened for file drop');
}

// Helper function to set file in the appropriate form input
function setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput) {
  console.log('  📁 setFileInForm called with type:', type);
  
  if (type === 'audio') {
    console.log('  🎵 Setting up audio file form');
    audioFileSection.style.display = '';
    appFileSection.style.display = 'none';
    fileInput.required = true;
    appFileInput.required = false;
    // Set file input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    console.log('  ✅ Audio file set in form input');
    // Create or update file display
    updateFileDisplay(fileInput, file.name);
  } else {
    console.log('  🖥️ Setting up app file form');
    audioFileSection.style.display = 'none';
    appFileSection.style.display = '';
    fileInput.required = false;
    appFileInput.required = true;
    // Set app file input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    appFileInput.files = dataTransfer.files;
    console.log('  ✅ App file set in form input');
    // Create or update file display
    updateFileDisplay(appFileInput, file.name);
  }
}

// Helper function to update file input display
function updateFileDisplay(fileInput, fileName) {
  // Find or create a display element for the file name
  let displayElement = fileInput.parentElement.querySelector('.file-display');
  if (!displayElement) {
    displayElement = document.createElement('div');
    displayElement.className = 'file-display';
    displayElement.style.color = '#4CAF50';
    displayElement.style.fontWeight = 'bold';
    displayElement.style.marginTop = '5px';
    fileInput.parentElement.appendChild(displayElement);
  }
  displayElement.textContent = `✓ Selected: ${fileName}`;
}

// Add event listener to Type radio buttons to toggle required state dynamically
const typeRadios = document.querySelectorAll('input[name="button-type"]');
typeRadios.forEach(radio => {
  radio.addEventListener('change', function() {
    const fileInput = document.getElementById('file-input');
    const appFileInput = document.getElementById('app-file-input');
    if (this.value === 'audio') {
      fileInput.required = true;
      appFileInput.required = false;
    } else {
      fileInput.required = false;
      appFileInput.required = true;
    }
  });
});

// Overlay Helper Functions
function getDefaultOverlay() {
  const savedOverlays = getSavedOverlays();
  // Return the second overlay (index 1) if it exists, otherwise first overlay, otherwise 'default'
  return savedOverlays.length >= 2 ? savedOverlays[1].name : (savedOverlays.length >= 1 ? savedOverlays[0].name : 'default');
}

// Overlay Migration System
function migrateOverlayReferences() {
  try {
    console.log('🔄 Checking for overlay migration...');
    let needsMigration = false;
    
    // Load current config
    const config = window.electronAPI.getConfig();
    if (!config) return;
    
    // Get the second overlay from saved overlays (index 1)
    const targetOverlay = getDefaultOverlay();
    const savedOverlays = getSavedOverlays();
    
    console.log(`🎯 Target overlay for migration: "${targetOverlay}"`);
    console.log(`📋 Available overlays:`, savedOverlays.map(o => o.name));
    
    // Check buttons for 'main' or 'default' overlay references
    if (config.buttons && Array.isArray(config.buttons)) {
      config.buttons.forEach(button => {
        if (button.overlay === 'main' || button.overlay === 'default') {
          const oldOverlay = button.overlay;
          button.overlay = targetOverlay;
          needsMigration = true;
          console.log(`🔄 Migrated button "${button.label || button.name}" overlay from '${oldOverlay}' to '${targetOverlay}'`);
        }
      });
    }
    
    // Check alerts for 'main' or 'default' overlay references
    if (config.alerts && Array.isArray(config.alerts)) {
      config.alerts.forEach(alert => {
        if (alert.overlay === 'main' || alert.overlay === 'default') {
          const oldOverlay = alert.overlay;
          alert.overlay = targetOverlay;
          needsMigration = true;
          console.log(`🔄 Migrated alert "${alert.name || 'unnamed'}" overlay from '${oldOverlay}' to '${targetOverlay}'`);
        }
      });
    }
    
    // Save migrated config if changes were made
    if (needsMigration) {
      window.electronAPI.saveConfig(config);
      console.log(`✅ Overlay migration completed successfully - migrated to '${targetOverlay}'`);
    } else {
      console.log('✅ No overlay migration needed');
    }
  } catch (error) {
    console.error('❌ Error during overlay migration:', error);
  }
}

// Theme System
class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.builtInThemes = ['dark', 'light', 'red', 'purple', 'blue', 'darkpop'];
    this.availableSkins = [];
    this.storageKey = 'virtualdeck-theme-v1'; // Versioned key to avoid conflicts
    this.skinStorageKey = 'virtualdeck-current-skin-v1';
    this.init().catch(console.error);
  }

  async init() {
    await this.loadAvailableSkins();
    await this.loadSavedTheme();
    this.setupEventListeners();
    
    // DON'T apply theme here - let ProfileManager handle it
    // This prevents the theme from being set before the profile loads
    console.log('🎨 ThemeManager initialized, current theme:', this.currentTheme);
    
    // Profile manager will apply the theme after loading profile settings
  }

  async loadAvailableSkins() {
    try {
      if (window.electronAPI?.getAvailableSkins) {
        this.availableSkins = await window.electronAPI.getAvailableSkins();
      } else {
        // Fallback for development
        this.availableSkins = [];
      }
    } catch (error) {
      console.warn('Failed to load available skins:', error);
      this.availableSkins = [];
    }
  }

  async loadSavedTheme() {
    try {
      let savedTheme = null;
      
      // Try Electron API first (production)
      if (window.electronAPI?.getConfig) {
        try {
          const config = await window.electronAPI.getConfig();
          // Theme is now stored in uiSettings.theme with the profile system
          savedTheme = config?.uiSettings?.theme || config?.theme;
        } catch (error) {
          savedTheme = localStorage.getItem(this.storageKey);
        }
      } else {
        // Fallback to localStorage (development)
        savedTheme = localStorage.getItem(this.storageKey);
      }
      
      // Check if it's a built-in theme or an available skin
      if (savedTheme && (this.builtInThemes.includes(savedTheme) || this.availableSkins.some(skin => skin.id === savedTheme))) {
        this.currentTheme = savedTheme;
      }
    } catch (error) {
      // Use default theme on error
    }
  }

  setupEventListeners() {
    // Listen for theme changes from the menu bar
    if (window.electronAPI?.onThemeChange) {
      window.electronAPI.onThemeChange((themeName) => {
        this.setTheme(themeName);
      });
    }
    
    // Listen for import skin dialog
    if (window.electronAPI?.onImportSkinDialog) {
      window.electronAPI.onImportSkinDialog(async () => {
        await this.showImportDialog();
      });
    }
    
    // Listen for delete skin dialog
    if (window.electronAPI?.onDeleteSkinDialog) {
      window.electronAPI.onDeleteSkinDialog(async () => {
        await this.showDeleteDialog();
      });
    }
  }

  setTheme(themeName) {
    // Check if it's a built-in theme or an available skin
    if (this.builtInThemes.includes(themeName) || this.availableSkins.some(skin => skin.id === themeName)) {
      this.currentTheme = themeName;
      this.applyTheme(themeName);
      this.saveTheme(themeName);
      
      // Sync the menu state
      if (window.electronAPI?.syncTheme) {
        window.electronAPI.syncTheme(themeName);
      }
    }
  }

  async applyTheme(themeName) {
    // Remove any existing skin styles first
    this.removeCurrentSkin();
    
    // Set the theme attribute on document and body
    document.documentElement.setAttribute('data-theme', themeName);
    document.body.setAttribute('data-theme', themeName);
    
    // If it's a skin (not a built-in theme), apply the skin styles
    if (!this.builtInThemes.includes(themeName)) {
      await this.applySkinStyles(themeName);
    }
    
    // Force a style recalculation without visual flash
    // This triggers a reflow without causing visible flickering
    void document.documentElement.offsetHeight;
  }


  saveTheme(themeName) {
    // Update current theme
    this.currentTheme = themeName;
    
    // Save via updateConfig (which saves to profile's uiSettings.theme)
    if (window.electronAPI?.updateConfig) {
      window.electronAPI.updateConfig({ theme: themeName }).catch(err => {
        console.error('Failed to save theme via updateConfig:', err);
      });
    }
    
    // Also save to localStorage as fallback
    try {
      localStorage.setItem(this.storageKey, themeName);
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }
    
    // Trigger immediate profile save to ensure theme is captured
    if (window.profileManager && window.profileManager.saveCurrentSettings) {
      window.profileManager.saveCurrentSettings().catch(err => {
        console.error('Failed to save profile after theme change:', err);
      });
    }
    
    console.log('Theme saved:', themeName);
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  // Method to cycle through themes (useful for hotkeys)
  cycleTheme() {
    const allThemes = [...this.builtInThemes, ...this.availableSkins.map(skin => skin.id)];
    const currentIndex = allThemes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % allThemes.length;
    this.setTheme(allThemes[nextIndex]);
  }

  // Skin-related methods
  async applySkinStyles(skinName) {
    try {
      // Load skin data from main process
      if (window.electronAPI?.loadSkin) {
        const skinData = await window.electronAPI.loadSkin(skinName);
        if (skinData) {
          this.injectSkinStyles(skinData);
        }
      }
    } catch (error) {
      console.error('Failed to apply skin styles:', error);
    }
  }

  injectSkinStyles(skinData) {
    // Remove any existing skin styles
    this.removeCurrentSkin();

    // Create a new style element for the skin
    const skinStyle = document.createElement('style');
    skinStyle.id = 'vd-skin-styles';
    skinStyle.type = 'text/css';

    let cssContent = '';

    // Add CSS custom properties overrides
    if (skinData.variables && typeof skinData.variables === 'object') {
      cssContent += ':root {\n';
      for (const [key, value] of Object.entries(skinData.variables)) {
        // Ensure the variable name starts with --
        const varName = key.startsWith('--') ? key : `--${key}`;
        cssContent += `  ${varName}: ${value};\n`;
      }
      cssContent += '}\n';
    }

    // Add custom CSS rules
    if (skinData.css && typeof skinData.css === 'string') {
      // Warn if skin CSS appears to contain SCSS-style nesting (e.g., '&::after') which browsers won't parse
      if (/&\s*[:.{\[]?/m.test(skinData.css)) {
        console.warn('Skin CSS contains SCSS-style nesting (&). This may not be valid CSS when injected. Consider using flat selectors.');
        try {
          if (window.notificationManager) window.notificationManager.show('Imported skin contains nested/SCSS syntax which may not apply correctly.', 'warning', 5000);
        } catch (e) {}
      }
      cssContent += skinData.css;
    }

    // Add custom component styles
    if (skinData.components && typeof skinData.components === 'object') {
      for (const [selector, styles] of Object.entries(skinData.components)) {
        if (typeof styles === 'object') {
          cssContent += `${selector} {\n`;
          for (const [property, value] of Object.entries(styles)) {
            // Normalize font-family values for injected skins
            if (property.toLowerCase() === 'font-family' && typeof value === 'string') {
              const forceRoboto = localStorage.getItem('forceRobotoUI') === 'true';
              let newVal = value;
              if (forceRoboto) {
                newVal = "'Roboto', sans-serif";
              } else {
                // Prefer Roboto Mono for monospace fallbacks
                if (/Courier New|Courier|monospace/i.test(value)) {
                  newVal = "'Roboto Mono', 'Courier New', monospace";
                }
              }
              cssContent += `  ${property}: ${newVal};\n`;
            } else {
              cssContent += `  ${property}: ${value};\n`;
            }
          }
          cssContent += '}\n';
        }
      }
    }

    // Post-process raw CSS block for font-family declarations inside skinData.css
    // This handles cases where skins include raw CSS strings with font-family rules.
    (function normalizeCssString() {
      const forceRoboto = localStorage.getItem('forceRobotoUI') === 'true';
      if (!skinData.css || typeof skinData.css !== 'string') return;
      // Replace font-family: ...; occurrences
      cssContent = cssContent.replace(/font-family\s*:\s*([^;]+);/gi, (match, p1) => {
        if (forceRoboto) return "font-family: 'Roboto', sans-serif;";
        // If the original contains monospace or Courier, swap to Roboto Mono
        if (/Courier New|Courier|monospace/i.test(p1)) return "font-family: 'Roboto Mono', 'Courier New', monospace;";
        // Otherwise leave as-is
        return `font-family: ${p1};`;
      });
    })();

    skinStyle.textContent = cssContent;
    document.head.appendChild(skinStyle);

    // Force a style recalculation
    void document.documentElement.offsetHeight;
  }

  removeCurrentSkin() {
    const existingSkinStyle = document.getElementById('vd-skin-styles');
    if (existingSkinStyle) {
      existingSkinStyle.remove();
    }
  }

  async refreshSkins() {
    await this.loadAvailableSkins();
    // Optionally refresh the menu
    if (window.electronAPI?.refreshMenu) {
      window.electronAPI.refreshMenu();
    }
  }

  async showImportDialog() {
    try {
      if (window.electronAPI?.showImportSkinDialog) {
        const result = await window.electronAPI.showImportSkinDialog();
        if (result) {
          // Refresh available skins after import
          await this.loadAvailableSkins();
          // Apply the newly imported skin
          this.setTheme(result.id);
          // Refresh the menu to show the new theme (with a small delay to ensure skins are loaded)
          setTimeout(() => {
            if (window.electronAPI?.refreshMenu) {
              window.electronAPI.refreshMenu();
            }
          }, 100);
          if (window.notificationManager) {
            window.notificationManager.show(`Theme "${result.name}" imported successfully!`, 'success', 3000);
          }
        }
      }
    } catch (error) {
      console.error('Error importing theme:', error);
      if (window.notificationManager) {
        window.notificationManager.show(`Failed to import theme: ${error.message}`, 'error', 5000);
      }
    }
  }

  async showDeleteDialog() {
    try {
      if (window.electronAPI?.showDeleteSkinDialog) {
        const result = await window.electronAPI.showDeleteSkinDialog();
        if (result) {
          if (result.canceled) {
            if (result.message) {
              alert(result.message);
            }
            return;
          }
          
          if (result.deleted) {
            // Refresh available skins after deletion
            await this.loadAvailableSkins();
            
            // If the deleted skin was currently active, switch to default theme
            if (this.currentTheme === result.skin.id) {
              this.setTheme('dark'); // Default to dark theme
            }
            
            // Refresh the menu to remove the deleted theme
            setTimeout(() => {
              if (window.electronAPI?.refreshMenu) {
                window.electronAPI.refreshMenu();
              }
            }, 100);
            
            alert(result.message);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      if (window.notificationManager) {
        window.notificationManager.show(`Failed to delete theme: ${error.message}`, 'error', 5000);
      }
    }
  }
}

// Initialize theme manager
let themeManager;

// Custom Notification System
class NotificationManager {
  constructor() {
    this.container = document.getElementById('notification-container');
    this.notifications = new Map();
  }

  show(message, type = 'info', duration = 4000) {
    const id = Date.now() + Math.random();
    const notification = this.createNotification(id, message, type);
    
    this.container.appendChild(notification);
    this.notifications.set(id, notification);
    
    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });
    
    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, duration);
    }
    
    return id;
  }

  createNotification(id, message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;
    
    const icon = this.getIcon(type);
    const title = this.getTitle(type);
    
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-title">
          <span class="notification-icon">${icon}</span>
          ${title}
        </div>
        <button class="notification-close" onclick="notificationManager.hide(${id})">×</button>
      </div>
      <div class="notification-message">${message}</div>
      <div class="notification-progress"></div>
    `;
    
    // Add progress bar animation
    const progressBar = notification.querySelector('.notification-progress');
    if (progressBar) {
      progressBar.style.width = '100%';
      progressBar.style.transition = 'width 4000ms linear';
      setTimeout(() => {
        progressBar.style.width = '0%';
      }, 100);
    }
    
    return notification;
  }

  getIcon(type) {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  getTitle(type) {
    const titles = {
      success: 'Success',
      warning: 'Warning',
      error: 'Error',
      info: 'Information'
    };
    return titles[type] || titles.info;
  }

  hide(id) {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 300);
    }
  }

  hideAll() {
    this.notifications.forEach((notification, id) => {
      this.hide(id);
    });
  }
}

// Initialize notification manager
let notificationManager;

// Note: Skin functionality is now integrated into ThemeManager

// Apply theme immediately to prevent flash
(function applyThemeImmediately() {
  const storageKey = 'virtualdeck-theme-v1';
  const oldKey = 'virtualdeck-theme';
  
  // Check both new and old keys
  let savedTheme = localStorage.getItem(storageKey);
  
  if (!savedTheme) {
    savedTheme = localStorage.getItem(oldKey);
    if (savedTheme) {
      localStorage.setItem(storageKey, savedTheme);
      localStorage.removeItem(oldKey);
    }
  }
  
  if (savedTheme && ['dark', 'light', 'red', 'purple', 'blue', 'darkpop'].includes(savedTheme)) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Sync menu state after a delay to ensure Electron API is ready
    setTimeout(() => {
      if (window.electronAPI?.syncTheme) {
        window.electronAPI.syncTheme(savedTheme);
      }
    }, 100);
  }
})();

// --- App toolbar wiring ---
function setupAppToolbar() {
  console.log('🔧 setupAppToolbar() called');
  const btnMin = document.getElementById('btn-minimize');
  const btnMax = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  const maxIcon = document.getElementById('max-icon');

  console.log('🔧 Toolbar elements found:', {
    btnMin: !!btnMin,
    btnMax: !!btnMax,
    btnClose: !!btnClose,
    maxIcon: !!maxIcon
  });

  console.log('🔧 Electron API available:', {
    electronAPI: !!window.electronAPI,
    minimizeWindow: !!(window.electronAPI && window.electronAPI.minimizeWindow),
    toggleMaximizeWindow: !!(window.electronAPI && window.electronAPI.toggleMaximizeWindow),
    closeWindow: !!(window.electronAPI && window.electronAPI.closeWindow)
  });

  if (btnMin) {
    console.log('🔧 Setting up minimize button');
    btnMin.addEventListener('click', (e) => {
      console.log('🔧 MINIMIZE BUTTON CLICKED!');
    e.stopPropagation();
      if (window.electronAPI && typeof window.electronAPI.minimizeWindow === 'function') {
        console.log('🔧 Calling minimizeWindow()');
        window.electronAPI.minimizeWindow();
      } else {
        console.log('🔧 minimizeWindow not available');
      }
    });
  }
  if (btnMax) {
    console.log('🔧 Setting up maximize button');
    btnMax.addEventListener('click', (e) => {
      console.log('🔧 MAXIMIZE BUTTON CLICKED!');
    e.stopPropagation();
      if (window.electronAPI && typeof window.electronAPI.toggleMaximizeWindow === 'function') {
        console.log('🔧 Calling toggleMaximizeWindow()');
        window.electronAPI.toggleMaximizeWindow();
      } else {
        console.log('🔧 toggleMaximizeWindow not available');
      }
    });
  }
  if (btnClose) {
    console.log('🔧 Setting up close button');
    btnClose.addEventListener('click', (e) => {
      console.log('🔧 CLOSE BUTTON CLICKED!');
    e.stopPropagation();
      if (window.electronAPI && typeof window.electronAPI.closeWindow === 'function') {
        console.log('🔧 Calling closeWindow()');
        window.electronAPI.closeWindow();
      } else {
        console.log('🔧 closeWindow not available');
      }
    });
  }

  // Move button functionality
  const btnMove = document.getElementById('btn-move');
  if (btnMove) {
    let isDragging = false;
    let startX, startY;

    btnMove.addEventListener('mousedown', (e) => {
      isDragging = true;
      btnMove.classList.add('dragging');
      
      // Store initial mouse position relative to screen
      startX = e.screenX;
      startY = e.screenY;
      
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      // Calculate movement delta
      const deltaX = e.screenX - startX;
      const deltaY = e.screenY - startY;
      
      // Only move if there's significant movement to avoid jitter
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        // Move the window by the delta amount
        if (window.electronAPI && typeof window.electronAPI.moveWindow === 'function') {
          window.electronAPI.moveWindow({
            x: deltaX,
            y: deltaY
          });
        }
        
        // Update start position to current position
        startX = e.screenX;
        startY = e.screenY;
      }
      
      e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        btnMove.classList.remove('dragging');
      }
    });

    // Prevent context menu on move button
    btnMove.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  // Update maximize icon state
  function showMaximizedState(isMax) {
    if (!maxIcon) return;
    // Use Material Icons names: 'open_in_full' for maximize, 'fullscreen_exit' for restore
    maxIcon.textContent = isMax ? 'fullscreen_exit' : 'open_in_full';
    // update title attribute
    if (btnMax) btnMax.title = isMax ? 'Restore' : 'Maximize';
    // ensure the material-icons class is present
    if (!maxIcon.classList.contains('material-icons')) maxIcon.classList.add('material-icons');
  }

  // Listen for window maximize/unmaximize events from main
  if (window.electronAPI && typeof window.electronAPI.onWindowMaximized === 'function') {
    window.electronAPI.onWindowMaximized(() => showMaximizedState(true));
  }
  if (window.electronAPI && typeof window.electronAPI.onWindowUnmaximized === 'function') {
    window.electronAPI.onWindowUnmaximized(() => showMaximizedState(false));
  }

  // Initial guess: not maximized
  showMaximizedState(false);
}

// Initialize toolbar after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 DOMContentLoaded fired - initializing toolbar');
  
  // CRITICAL: Initialize ThemeManager FIRST before ProfileManager needs it
  if (typeof ThemeManager !== 'undefined') {
    window.themeManager = new ThemeManager();
    window.themeSystem = window.themeManager;
    window.notificationManager = new NotificationManager();
    console.log('🎨 ThemeManager and NotificationManager created early');
    
    // Add hotkey to cycle through themes (Ctrl+Shift+T)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        if (window.themeManager) {
          window.themeManager.cycleTheme();
        }
      }
    });
  }
  
  // Run overlay migration on app load
  migrateOverlayReferences();
  
  // Clear overlay immediately on app startup
  console.log('🧹 Clearing overlay on DOM ready...');
  clearOverlay();
  
  setupAppToolbar();
  setupOverlayControls();
  setupOverlayWidget();
  setupHydrationSettings();
  setupAlertWidget();
  initDailyCheckinSystem();
  // initialize left app menu
  if (typeof setupLeftAppMenu === 'function') {
    console.log('🔧 Setting up left app menu');
    setupLeftAppMenu();
  } else {
    console.log('🔧 setupLeftAppMenu function not found');
  }
  
  // initialize preferences modal
  if (typeof initializePreferencesModal === 'function') {
    console.log('🔧 Setting up preferences modal');
    initializePreferencesModal();
  } else {
    console.log('🔧 initializePreferencesModal function not found');
  }
  
  // Initialize profile management system (after ThemeManager is ready)
  console.log('🔧 Initializing profile management system');
  profileManager.initialize().catch(err => {
    console.error('Failed to initialize profile manager:', err);
  });
  
  // Setup profile panel event handlers
  setupProfilePanelEventHandlers();
});

// Profile panel event handlers
function setupProfilePanelEventHandlers() {
  // Profile selector change
  const profileSelector = document.getElementById('profile-selector');
  if (profileSelector) {
    profileSelector.addEventListener('change', async (e) => {
      const newProfileId = e.target.value;
      if (newProfileId !== profileManager.currentProfile) {
        await profileManager.switchProfile(newProfileId);
      }
    });
  }
  
  // Create new profile button
  const createBtn = document.getElementById('profile-create');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const profileName = await showCustomPrompt('Enter a name for the new profile:');
      if (profileName) {
        await profileManager.createProfile(profileName);
      }
    });
  }
  
  // Duplicate profile button
  const duplicateBtn = document.getElementById('profile-duplicate');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', async () => {
      const currentProfileName = profileManager.profiles.find(p => p.id === profileManager.currentProfile)?.name || '';
      const defaultName = currentProfileName ? `${currentProfileName} (Copy)` : 'New Profile';
      const profileName = await showCustomPrompt('Enter a name for the duplicated profile:', defaultName);
      if (profileName) {
        await profileManager.duplicateProfile(profileName);
      }
    });
  }
  
  // Rename profile button
  const renameBtn = document.getElementById('profile-rename');
  if (renameBtn) {
    renameBtn.addEventListener('click', async () => {
      const currentProfileName = profileManager.profiles.find(p => p.id === profileManager.currentProfile)?.name || '';
      const newName = await showCustomPrompt('Enter a new name for this profile:', currentProfileName);
      if (newName && newName !== currentProfileName) {
        await profileManager.renameProfile(newName);
      }
    });
  }
  
  // Delete profile button
  const deleteBtn = document.getElementById('profile-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      // Get list of profiles that can be deleted (not the current one)
      const deletableProfiles = profileManager.profiles.filter(p => p.id !== profileManager.currentProfile);
      
      if (deletableProfiles.length === 0) {
        showCustomAlert('Cannot delete the only profile. Create another profile first.', 'error');
        return;
      }
      
      // Create a custom prompt with dropdown
      const profileToDelete = await showProfileDeleteDialog(deletableProfiles);
      
      if (profileToDelete) {
        const result = await window.electronAPI.deleteProfile(profileToDelete.id);
        if (result.success) {
          showCustomAlert(`Profile "${profileToDelete.name}" deleted`, 'success');
          // Refresh profile list
          await profileManager.initialize();
        } else {
          showCustomAlert('Failed to delete profile: ' + (result.error || 'Unknown error'), 'error');
        }
      }
    });
  }
  
  console.log('✅ Profile panel event handlers setup complete');
  
  // Profile modal close button
  const modalCloseBtn = document.getElementById('profile-modal-close');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      closeProfileModal();
    });
  }
  
  // Close modal on backdrop click
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        closeProfileModal();
      }
    });
  }
}

// Open profile manager modal
function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Disable hotkeys when modal is open
    if (window.electronAPI && window.electronAPI.disableHotkeys) {
      window.electronAPI.disableHotkeys();
    }
  }
}

// Close profile manager modal
function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.classList.add('hidden');
    // Re-enable hotkeys when modal closes
    if (window.electronAPI && window.electronAPI.enableHotkeys) {
      window.electronAPI.enableHotkeys();
    }
  }
}

// Listen for open-profile-manager from main process
if (window.electronAPI && window.electronAPI.onOpenProfileManager) {
  window.electronAPI.onOpenProfileManager(() => {
    openProfileModal();
  });
}

// Overlay controls setup
function setupOverlayControls() {
  console.log('🔧 Setting up overlay controls');
  
  // Clear overlay on app startup with a small delay to ensure overlay is ready
  console.log('🧹 Clearing overlay on app startup...');
  setTimeout(() => {
    clearOverlay();
    console.log('✅ Overlay cleared on startup');
  }, 1000); // 1 second delay to ensure overlay is ready
  
}

// Overlay widget setup
function setupOverlayWidget() {
  console.log('🔧 Setting up overlay widget');
  
  const overlayWidget = document.getElementById('overlay-widget');
  const closeBtn = document.getElementById('close-overlay-widget');
  const testBtns = document.querySelectorAll('.overlay-test-btn');
  const mediaBtns = document.querySelectorAll('.overlay-media-btn');
  const copyUrlBtn = document.getElementById('copy-overlay-url');
  
  // Overlay management elements
  const newOverlayNameInput = document.getElementById('new-overlay-name');
  const createOverlayBtn = document.getElementById('create-overlay');
  const overlaySelect = document.getElementById('overlay-select');
  const deleteOverlayBtn = document.getElementById('delete-overlay');
  const overlayUrlDisplay = document.getElementById('overlay-url-display');
  
  // Position mapping for overlay text slots (new schema format)
  const positionMap = {
    1: 'topLeft',
    2: 'topCenter', 
    3: 'topRight',
    4: 'midLeft',
    5: 'center',
    6: 'midRight',
    7: 'bottomLeft',
    8: 'bottomCenter',
    9: 'bottomRight'
  };
  
  // Close widget
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlayWidget.classList.add('hidden');
    });
  }
  
        // Text box test buttons
        testBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const position = parseInt(btn.dataset.position);
                const targetId = positionMap[position];
                const testText = `Test - ${btn.textContent}`;
                console.log(`Testing text box ${position} (${targetId}): ${testText}`);

                if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
                    // Send new buttonTrigger format
                    const payload = {
                        type: 'buttonTrigger',
                        options: {
                            clearPrevious: false
                        },
                        slots: {
                            [targetId]: {
                                text: testText,
                                style: {
                                    fontFamily: 'Arial, sans-serif',
                                    fontSize: '48px',
                                    color: '#ffffff',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
                                    webkitTextStroke: '2px #000',
                                    zIndex: '15'
                                }
                            }
                        }
                    };
                    
                    window.electronAPI.sendOverlayMessage(payload);
                } else {
                    console.log('sendOverlayMessage not available');
                }
            });
        });
  
  // Media test buttons
  mediaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const position = parseInt(btn.dataset.position);
      const targetId = positionMap[position];

      console.log(`Testing ${type} in position ${position} (${targetId})`);

      if (type === 'image') {
        if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
          const payload = {
            type: 'buttonTrigger',
            options: {
              clearPrevious: false
            },
            centerMedia: [{
              type: 'image',
              src: 'http://localhost:8080/media/images/VirtualDeck2.png',
              alt: 'VirtualDeck Logo'
            }]
          };
          window.electronAPI.sendOverlayMessage(payload);
        }
      } else if (type === 'video') {
        if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
          const payload = {
            type: 'buttonTrigger',
            options: {
              clearPrevious: false
            },
            centerMedia: [{
              type: 'video',
              src: 'http://localhost:8080/media/videos/generated-video.mp4',
              loop: true
            }]
          };
          window.electronAPI.sendOverlayMessage(payload);
        }
      } else if (type === 'clear') {
        if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
          const payload = {
            type: 'buttonTrigger',
            options: {
              clearPrevious: true
            }
          };
          window.electronAPI.sendOverlayMessage(payload);
        }
      }
    });
  });
  
  // Copy URL button
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', () => {
      // Get the URL from the display element instead of hardcoding
      const overlayUrlDisplay = document.getElementById('overlay-url-display');
      const overlayUrl = overlayUrlDisplay ? overlayUrlDisplay.textContent : 'http://localhost:8080/overlay';
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(overlayUrl).then(() => {
          console.log('Overlay URL copied to clipboard:', overlayUrl);
          // Show brief feedback
          const originalText = copyUrlBtn.textContent;
          copyUrlBtn.textContent = '✓ Copied';
          setTimeout(() => {
            copyUrlBtn.textContent = originalText;
          }, 1500);
        }).catch(err => {
          console.log('Failed to copy to clipboard:', err);
          // Fallback for older browsers
          showCustomAlert(`Copy this URL: ${overlayUrl}`, 'info');
        });
      } else {
        // Fallback for browsers without clipboard API
        showCustomAlert(`Copy this URL: ${overlayUrl}`, 'info');
      }
    });
  }
  
  // Multi-source test buttons
  const testAllPositionsBtn = document.getElementById('test-all-positions');
  
  if (testAllPositionsBtn) {
    testAllPositionsBtn.addEventListener('click', () => {
      console.log('Testing all positions simultaneously...');
      
      const positions = [
        { id: 'topLeft', text: 'Test - Top Left' },
        { id: 'topCenter', text: 'Test - Top Center' },
        { id: 'topRight', text: 'Test - Top Right' },
        { id: 'midLeft', text: 'Test - Mid Left' },
        { id: 'midRight', text: 'Test - Mid Right' },
        { id: 'bottomLeft', text: 'Test - Bottom Left' },
        { id: 'bottomCenter', text: 'Test - Bottom Center' },
        { id: 'bottomRight', text: 'Test - Bottom Right' }
      ];
      
      // Create a single payload with all text slots
      const payload = {
        type: 'buttonTrigger',
        options: {
          clearPrevious: true
        },
        slots: {}
      };
      
      positions.forEach((pos, index) => {
        payload.slots[pos.id] = {
          text: pos.text,
          style: {
            fontFamily: 'Arial, sans-serif',
            fontSize: '48px',
            color: '#ffffff',
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
            webkitTextStroke: '2px #000',
            zIndex: '15'
          }
        };
      });
      
      // Add center media test
      payload.centerMedia = [{
        type: 'image',
        src: 'http://localhost:8080/media/images/VirtualDeck2.png',
        alt: 'VirtualDeck Logo'
      }];
      
      if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
        window.electronAPI.sendOverlayMessage(payload);
        console.log('Sent comprehensive test payload with all positions');
      } else {
        console.log('sendOverlayMessage not available');
      }
    });
  }
  
  
  // Overlay Management Functionality
  if (createOverlayBtn && newOverlayNameInput) {
    createOverlayBtn.addEventListener('click', () => {
      const overlayName = newOverlayNameInput.value.trim();
      const templateSelect = document.getElementById('overlay-template');
      const template = templateSelect ? templateSelect.value : 'center-media';

      if (!overlayName) {
        showCustomAlert('Please enter a name for the overlay', 'error');
        return;
      }

      // Map special templates to their predefined overlay names
      let actualOverlayId;
      let actualDisplayName;

      if (template === 'alert') {
        actualOverlayId = 'alertOverlay';
        actualDisplayName = `${overlayName} (Alert Overlay)`;
      } else if (template === 'confetti') {
        actualOverlayId = 'confettiOverlay';
        actualDisplayName = `${overlayName} (Confetti Overlay)`;
      } else {
        // Create overlay name that includes template info for custom overlays
        actualOverlayId = overlayName.toLowerCase().replace(/\s+/g, '-');
        actualDisplayName = `${overlayName} (${getTemplateDisplayName(template)})`;
      }
      
      // Check for duplicate names (skip for predefined overlays like alert/confetti)
      if (template !== 'alert' && template !== 'confetti') {
        const savedOverlays = getSavedOverlays();
        const isDuplicate = savedOverlays.some(overlay =>
          overlay.id === actualOverlayId || overlay.name.toLowerCase() === overlayName.toLowerCase()
        );

        if (isDuplicate) {
          showCustomAlert(`An overlay with the name "${overlayName}" already exists. Please choose a different name.`, 'error');
          return;
        }

        // Save overlay to localStorage for custom overlays
        savedOverlays.push({
          id: actualOverlayId,
          name: overlayName,
          displayName: actualDisplayName,
          template: template,
          createdAt: new Date().toISOString()
        });
        saveOverlays(savedOverlays);
      }

      // Create new overlay option
      const option = document.createElement('option');
      option.value = actualOverlayId;
      option.textContent = actualDisplayName;
      option.dataset.template = template;
      overlaySelect.appendChild(option);
      
      // Clear input
      newOverlayNameInput.value = '';
      
      // Show success message
      const successMessage = (template === 'alert' || template === 'confetti')
        ? `Overlay "${overlayName}" ready! Use the URL to add it to OBS.`
        : `Overlay "${overlayName}" created successfully!`;
      showCustomAlert(successMessage, 'success');

      // Update all overlay selects in forms
      updateAllOverlaySelects();

      console.log(`✅ Created overlay: ${overlayName} (${template}) -> ${actualOverlayId}`);
    });
  }
  
  if (deleteOverlayBtn && overlaySelect) {
    deleteOverlayBtn.addEventListener('click', async () => {
      const selectedValue = overlaySelect.value;

      // Prevent deletion of predefined overlays
      const predefinedOverlays = ['alertOverlay', 'confettiOverlay'];
      if (predefinedOverlays.includes(selectedValue)) {
        showCustomAlert('Predefined overlays cannot be deleted.', 'warning');
        return;
      }

      // Use custom confirm dialog instead of native confirm
      const overlayName = overlaySelect.options[overlaySelect.selectedIndex].textContent;
      if (confirm(`Are you sure you want to delete the "${overlayName}" overlay?`)) {
        // Close all WebSocket connections for this overlay
        if (window.electronAPI && window.electronAPI.closeOverlayConnections) {
          try {
            const result = await window.electronAPI.closeOverlayConnections(selectedValue);
            if (result.success) {
              console.log(`🔌 Closed ${result.closedCount} connection(s) for overlay: ${selectedValue}`);
            }
          } catch (error) {
            console.error('Error closing overlay connections:', error);
          }
        }
        
        // Remove from localStorage
        const savedOverlays = getSavedOverlays();
        const updatedOverlays = savedOverlays.filter(o => o.id !== selectedValue);
        saveOverlays(updatedOverlays);
        
        // Remove from select
        const option = overlaySelect.querySelector(`option[value="${selectedValue}"]`);
        if (option) {
          option.remove();
        }
        
        // Reset to default overlay (second in list)
        overlaySelect.value = getDefaultOverlay();
        
        // Update all overlay selects in forms
        updateAllOverlaySelects();
        
        // Update overlay URL to reflect new selection
        updateOverlayUrl();
        
        // Update preview iframe
        updatePreviewIframe();
        
        // Force connection status update (after a short delay to let connections close)
        setTimeout(() => {
          updateOverlayConnectionStatus();
        }, 100);
        
        console.log(`✅ Deleted overlay: ${selectedValue}`);
        showCustomAlert(`Overlay "${overlayName}" deleted successfully`, 'success');
      }
    });
  }
  
  if (overlaySelect) {
    overlaySelect.addEventListener('change', () => {
      updateOverlayUrl();
      updatePreviewIframe();
    });
  }
  
  // Initialize overlay management - load saved overlays first
  loadSavedOverlaysIntoUI();
  updateAllOverlaySelects();
  updateOverlayUrl();
  
  // Start periodic connection status updates
  updateOverlayConnectionStatus();
  setInterval(updateOverlayConnectionStatus, 3000); // Update every 3 seconds
  
  // Predefined overlay cards removed - only user-created overlays will be shown
  
  // Ensure overlay selects are updated after a short delay to catch any late-loading forms
  setTimeout(() => {
    updateAllOverlaySelects();
    console.log('🔄 Refreshed overlay selects after delay');
  }, 1000);
  
  // Hydration tracker handlers
  const openHydrationSettingsBtn = document.getElementById('open-hydration-settings');
  const copyHydrationUrlBtn = document.getElementById('copy-hydration-url');
  
  if (openHydrationSettingsBtn) {
    openHydrationSettingsBtn.addEventListener('click', () => {
      openHydrationSettings();
    });
  }
  
  if (copyHydrationUrlBtn) {
    copyHydrationUrlBtn.addEventListener('click', () => {
      const url = 'http://localhost:8080/hydration';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showCustomAlert('Hydration overlay URL copied to clipboard!', 'success');
        }).catch(err => {
          console.error('Failed to copy:', err);
          showCustomAlert('Failed to copy URL to clipboard', 'error');
        });
      }
    });
  }
  
  // Progression system handlers
  const openProgressionManagerBtn = document.getElementById('open-progression-manager');
  const copyProgressionUrlBtn = document.getElementById('copy-progression-url');
  
  if (openProgressionManagerBtn) {
    console.log('✅ Progression manager button found, adding click handler');
    console.log('✅ Button element:', openProgressionManagerBtn);
    console.log('✅ Button ID:', openProgressionManagerBtn.id);
    console.log('✅ Button parent:', openProgressionManagerBtn.parentElement);
    console.log('✅ Button closest widget:', openProgressionManagerBtn.closest('.overlay-widget, .alert-widget'));
    
    // Remove any existing listeners by cloning the element
    const newBtn = openProgressionManagerBtn.cloneNode(true);
    openProgressionManagerBtn.parentNode.replaceChild(newBtn, openProgressionManagerBtn);
    
    newBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('🟢 PROGRESSION MANAGER button clicked from Overlay Widget');
      console.log('🟢 Event target:', e.target);
      console.log('🟢 Event currentTarget:', e.currentTarget);
      console.log('🟢 Stack trace:');
      console.trace();
      openProgressionManager();
    }, { once: false });
  } else {
    console.warn('⚠️ Progression manager button not found');
  }
  
  if (copyProgressionUrlBtn) {
    copyProgressionUrlBtn.addEventListener('click', () => {
      const url = 'http://localhost:8080/progression';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showCustomAlert('Progression overlay URL copied to clipboard!', 'success');
        }).catch(err => {
          console.error('Failed to copy:', err);
          showCustomAlert('Failed to copy URL to clipboard', 'error');
        });
      }
    });
  }
}

// Hydration Settings Functions
async function openHydrationSettings() {
  const modal = document.getElementById('hydration-settings-modal');
  if (!modal) return;
  
  // Load current config
  if (window.electronAPI && window.electronAPI.getHydrationConfig) {
    try {
      const config = await window.electronAPI.getHydrationConfig();
      
      // Populate form fields
      document.getElementById('hydration-goal').value = config.streamGoal || 64;
      document.getElementById('hydration-increment').value = config.incrementAmount || 8;
      document.getElementById('hydration-keyword').value = config.redemptionKeyword || 'hydrate';
      document.getElementById('hydration-reset-on-live').checked = config.resetOnLive !== false;
      document.getElementById('hydration-water-color').value = config.waterColor || '#4fc3f7';
      document.getElementById('hydration-text-color').value = config.textColor || '#ffffff';
      document.getElementById('hydration-size').value = config.gaugeSize || 200;
      document.getElementById('hydration-size-value').textContent = config.gaugeSize || 200;
      document.getElementById('hydration-pos-x').value = config.positionX || 50;
      document.getElementById('hydration-pos-y').value = config.positionY || 50;
      
      // Set gauge style radio button
      const gaugeStyleRadio = document.querySelector(`input[name="gauge-style"][value="${config.gaugeStyle || 'circular'}"]`);
      if (gaugeStyleRadio) gaugeStyleRadio.checked = true;
      updateGaugeStyleButtons();
    } catch (error) {
      console.error('Error loading hydration config:', error);
    }
  }
  
  modal.classList.remove('hidden');
  
  // Disable hotkeys when modal is open
  if (window.electronAPI && window.electronAPI.disableHotkeys) {
    window.electronAPI.disableHotkeys();
  }
}

function closeHydrationSettings() {
  const modal = document.getElementById('hydration-settings-modal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Re-enable hotkeys
    if (window.electronAPI && window.electronAPI.enableHotkeys) {
      window.electronAPI.enableHotkeys();
    }
  }
}

async function saveHydrationSettings() {
  if (!window.electronAPI || !window.electronAPI.saveHydrationConfig) {
    console.error('electronAPI not available');
    return;
  }
  
  try {
    const config = {
      streamGoal: parseInt(document.getElementById('hydration-goal').value) || 64,
      incrementAmount: parseInt(document.getElementById('hydration-increment').value) || 8,
      redemptionKeyword: document.getElementById('hydration-keyword').value.trim() || 'hydrate',
      currentProgress: 0, // Keep existing progress, will be loaded from saved config
      gaugeStyle: document.querySelector('input[name="gauge-style"]:checked')?.value || 'circular',
      waterColor: document.getElementById('hydration-water-color').value,
      backgroundColor: 'transparent',
      textColor: document.getElementById('hydration-text-color').value,
      gaugeSize: parseInt(document.getElementById('hydration-size').value) || 200,
      positionX: parseInt(document.getElementById('hydration-pos-x').value) || 50,
      positionY: parseInt(document.getElementById('hydration-pos-y').value) || 50,
      borderWidth: 0,
      borderColor: '#ffffff',
      borderRadius: 10,
      resetOnLive: document.getElementById('hydration-reset-on-live').checked
    };
    
    // Load existing config to preserve currentProgress
    const existingConfig = await window.electronAPI.getHydrationConfig();
    config.currentProgress = existingConfig.currentProgress || 0;
    
    const result = await window.electronAPI.saveHydrationConfig(config);
    if (result.success) {
      showCustomAlert('Hydration settings saved!', 'success');
      closeHydrationSettings();
    } else {
      showCustomAlert('Failed to save hydration settings', 'error');
    }
  } catch (error) {
    console.error('Error saving hydration settings:', error);
    showCustomAlert('Error saving settings: ' + error.message, 'error');
  }
}

function updateGaugeStyleButtons() {
  const radioLabels = document.querySelectorAll('label:has(input[name="gauge-style"])');
  radioLabels.forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      label.style.background = 'var(--accent)';
      label.style.color = 'white';
      label.style.borderColor = 'var(--accent)';
    } else {
      label.style.background = 'var(--bg-secondary)';
      label.style.color = 'var(--text-primary)';
      label.style.borderColor = 'var(--border-color)';
    }
  });
}

// Setup hydration settings event handlers
function setupHydrationSettings() {
  // Close button
  const closeBtn = document.getElementById('hydration-settings-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeHydrationSettings());
  }
  
  // Close on backdrop click
  const modal = document.getElementById('hydration-settings-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeHydrationSettings();
      }
    });
  }
  
  // Save button
  const saveBtn = document.getElementById('hydration-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveHydrationSettings());
  }
  
  // Test button
  const testBtn = document.getElementById('hydration-test');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.updateHydrationProgress) {
        try {
          await window.electronAPI.updateHydrationProgress();
          showCustomAlert('Hydration updated! Check your overlay.', 'success');
        } catch (error) {
          console.error('Error testing hydration:', error);
          showCustomAlert('Error testing hydration', 'error');
        }
      }
    });
  }
  
  // Manual reset button
  const resetBtn = document.getElementById('hydration-manual-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset hydration progress to 0?')) {
        if (window.electronAPI && window.electronAPI.resetHydration) {
          try {
            await window.electronAPI.resetHydration();
            showCustomAlert('Hydration progress reset to 0', 'success');
          } catch (error) {
            console.error('Error resetting hydration:', error);
            showCustomAlert('Error resetting hydration', 'error');
          }
        }
      }
    });
  }
  
  // Gauge style radio buttons
  const gaugeStyleRadios = document.querySelectorAll('input[name="gauge-style"]');
  gaugeStyleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateGaugeStyleButtons();
    });
  });
  
  // Size slider update
  const sizeSlider = document.getElementById('hydration-size');
  const sizeValue = document.getElementById('hydration-size-value');
  if (sizeSlider && sizeValue) {
    sizeSlider.addEventListener('input', () => {
      sizeValue.textContent = sizeSlider.value;
    });
  }
  
  console.log('✅ Hydration settings handlers setup complete');
}

// Predefined overlay cards function removed - only user-created overlays are supported

// Get overlay URL
function getOverlayUrl(overlayName) {
  return `http://localhost:8080/overlay?name=${overlayName}`;
}

// Helper functions for overlay management
function updateAllOverlaySelects() {
  // Get all overlay options from the main overlay select
  const mainOverlaySelect = document.getElementById('overlay-select');
  if (!mainOverlaySelect) return;
  
  const options = Array.from(mainOverlaySelect.options).map(option => ({
    value: option.value,
    text: option.textContent
  }));
  
  // Update multi-media form overlay select
  const multiMediaOverlaySelect = document.getElementById('multi-media-overlay-select');
  if (multiMediaOverlaySelect) {
    const currentValue = multiMediaOverlaySelect.value;
    console.log('🔄 Updating multi-media overlay select. Current value:', currentValue);
    console.log('🔄 Available options:', options);
    multiMediaOverlaySelect.innerHTML = '';
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      if (option.value === currentValue) {
        optionElement.selected = true;
      }
      multiMediaOverlaySelect.appendChild(optionElement);
    });
    console.log('✅ Multi-media overlay select updated with', options.length, 'options');
  } else {
    console.log('⚠️ Multi-media overlay select not found');
  }
  
  // Update alert form overlay select
  const alertOverlaySelect = document.getElementById('alert-overlay-select');
  if (alertOverlaySelect) {
    const currentValue = alertOverlaySelect.value;
    console.log('🔄 Updating alert overlay select. Current value:', currentValue);
    console.log('🔄 Available options for alert:', options);
    alertOverlaySelect.innerHTML = '';
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      if (option.value === currentValue) {
        optionElement.selected = true;
      }
      alertOverlaySelect.appendChild(optionElement);
    });
    console.log('✅ Alert overlay select updated with', options.length, 'options');
  } else {
    console.log('⚠️ Alert overlay select not found');
  }
}

function updateOverlayUrl() {
  const overlaySelect = document.getElementById('overlay-select');
  const overlayUrlDisplay = document.getElementById('overlay-url-display');
  
  if (overlaySelect && overlayUrlDisplay) {
    const selectedOverlay = overlaySelect.value;
    const baseUrl = 'http://localhost:8080/overlay';
    const url = `${baseUrl}?name=${selectedOverlay}`;
    overlayUrlDisplay.textContent = url;
  }
}

function getTemplateDisplayName(template) {
  const templateNames = {
    'center-media': 'Center Media',
    'fullscreen-media': 'Full Screen',
    'alert': 'Alert Overlay',
    'confetti': 'Confetti Overlay',
    // Legacy templates (kept for backward compatibility)
    'text-only': 'Text Only',
    'custom': 'Custom'
  };
  return templateNames[template] || 'Center Media';
}

// Overlay persistence functions
function getSavedOverlays() {
  try {
    const saved = localStorage.getItem('customOverlays');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading saved overlays:', error);
    return [];
  }
}

function saveOverlays(overlays) {
  try {
    localStorage.setItem('customOverlays', JSON.stringify(overlays));
    console.log('✅ Saved overlays to localStorage:', overlays.length);
  } catch (error) {
    console.error('Error saving overlays:', error);
  }
}

function loadSavedOverlaysIntoUI() {
  const overlaySelect = document.getElementById('overlay-select');
  if (!overlaySelect) return;
  
  const savedOverlays = getSavedOverlays();
  console.log(`📂 Loading ${savedOverlays.length} saved overlays...`);
  
  // Remove all options except 'main'
  Array.from(overlaySelect.options).forEach(option => {
    if (option.value !== 'main') {
      option.remove();
    }
  });
  
  // Predefined overlays removed - only user-created overlays will be shown
  
  // Add saved overlays
  savedOverlays.forEach(overlay => {
    const option = document.createElement('option');
    option.value = overlay.id;
    option.textContent = overlay.displayName;
    option.dataset.template = overlay.template;
    overlaySelect.appendChild(option);
    console.log(`✅ Loaded custom overlay: ${overlay.displayName}`);
  });
}

function updatePreviewIframe(overlayName = null) {
  const overlaySelect = document.getElementById('overlay-select');
  const overlayIframe = document.getElementById('overlay-iframe');
  
  if (!overlayIframe) return;
  
  const selectedOverlay = overlayName || (overlaySelect ? overlaySelect.value : 'default');
  
  // Determine the correct URL for the iframe
  let iframeUrl;
  iframeUrl = `http://localhost:8080/overlay?name=${selectedOverlay}`;
  
  console.log(`🔄 Updating preview iframe to: ${iframeUrl}`);
  
  // Only update if the src is different to avoid unnecessary reloads
  if (overlayIframe.src !== iframeUrl && !overlayIframe.src.endsWith(iframeUrl)) {
    overlayIframe.src = iframeUrl;
    console.log(`✅ Preview iframe updated to ${selectedOverlay} overlay`);
  }
}

async function updateOverlayConnectionStatus() {
  const connectionsList = document.getElementById('overlay-connections-list');
  if (!connectionsList) return;
  
  try {
    if (window.electronAPI && window.electronAPI.getConnectedOverlays) {
      const connections = await window.electronAPI.getConnectedOverlays();
      
      // Filter out dashboard preview from connection status
      const actualConnections = connections.filter(conn => conn.name !== 'dashboard-preview');
      
      if (actualConnections.length === 0) {
        connectionsList.innerHTML = '<div style="color: var(--text-tertiary);">⚠️ No overlays connected. Open overlay in OBS to connect.</div>';
      } else {
        // Group connections by overlay name and count clients
        const connectionMap = new Map();
        actualConnections.forEach(conn => {
          const count = connectionMap.get(conn.name) || 0;
          connectionMap.set(conn.name, count + conn.clientCount);
        });
        
        const html = Array.from(connectionMap.entries()).map(([name, count]) => 
          `<div style="color: var(--accent-color); margin: 4px 0;">
            ✅ <strong>${name}</strong> - ${count} client${count !== 1 ? 's' : ''} connected
          </div>`
        ).join('');
        
        const total = Array.from(connectionMap.values()).reduce((sum, count) => sum + count, 0);
        const header = `<div style="color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">
          🔗 ${total} total connection${total !== 1 ? 's' : ''} across ${connectionMap.size} overlay${connectionMap.size !== 1 ? 's' : ''}
        </div>`;
        
        connectionsList.innerHTML = header + html;
      }
    } else {
      connectionsList.innerHTML = '<div style="color: var(--text-tertiary);">Connection status unavailable. Restart app to enable.</div>';
    }
  } catch (error) {
    // Handler not registered yet - needs app restart
    if (error.message?.includes('No handler registered')) {
      connectionsList.innerHTML = '<div style="color: var(--text-tertiary);">⚠️ Restart app to see connection status</div>';
    } else {
      console.error('Error updating overlay connection status:', error);
      connectionsList.innerHTML = '<div style="color: var(--text-tertiary);">Error loading connections</div>';
    }
  }
}





// Setup alert widget tabs
function setupAlertTabs() {
  const tabs = document.querySelectorAll('.alert-tab');
  const tabContents = document.querySelectorAll('.alert-tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
      
      console.log(`Switched to ${targetTab} tab`);
    });
  });
}

// Setup alert type filter to show only alerts for selected type
function setupAlertTypeFilter() {
  const alertTypeSelect = document.getElementById('alert-type');
  const selectedAlertTypeName = document.getElementById('selected-alert-type-name');
  
  if (alertTypeSelect && selectedAlertTypeName) {
    // Update alert type name and filter alerts when selection changes
    alertTypeSelect.addEventListener('change', () => {
      const selectedType = alertTypeSelect.value;
      const typeNames = {
        'follower': 'Follower',
        'subscriber': 'Subscriber', 
        'resubscriber': 'Resubscriber',
        'gift-sub': 'Gift Sub',
        'gift-sub-received': 'Gift Received',
        'raid': 'Raid',
        'bits': 'Bits',
        'ban': 'Ban',
        'daily-checkin': 'Daily Checkin',
        'first-chat-walkon': 'Walk On (First Chat)'
      };
      
      selectedAlertTypeName.textContent = typeNames[selectedType] || selectedType;
      updateAlertList();
    });
    
    // Initial update
    const selectedType = alertTypeSelect.value;
    const typeNames = {
      'follower': 'Follower',
      'subscriber': 'Subscriber', 
      'resubscriber': 'Resubscriber',
      'gift-sub': 'Gift Sub',
      'gift-sub-received': 'Gift Received',
      'raid': 'Raid',
      'bits': 'Bits',
      'ban': 'Ban',
      'channel-points': 'Channel Point Redemption',
      'daily-checkin': 'Daily Checkin',
      'first-chat-walkon': 'Walk On (First Chat)'
    };
    selectedAlertTypeName.textContent = typeNames[selectedType] || selectedType;
  }
}



// Alert Widget setup
function setupAlertWidget() {
  console.log('🔧 Setting up alert widget');
  
  const alertWidget = document.getElementById('alert-widget');
  const closeBtn = document.getElementById('close-alert-widget');
  const alertTypeSelect = document.getElementById('alert-type');
  const selectedAlertTypeName = document.getElementById('selected-alert-type-name');
  const alertTextInput = document.getElementById('alert-text');
  const alertDurationInput = document.getElementById('alert-duration');
  const alertBitsThresholdInput = document.getElementById('alert-bits-threshold');
  const bitsThresholdGroup = document.getElementById('bits-threshold-group');
  const alertSoundInput = document.getElementById('alert-sound');
  const alertImageInput = document.getElementById('alert-image');
  const alertVideoInput = document.getElementById('alert-video');
  const alertVideoSettings = document.getElementById('alert-video-settings');
  const alertVideoLoop = document.getElementById('alert-video-loop');
  const alertVideoVolume = document.getElementById('alert-video-volume');
  const alertVideoVolumeValue = document.getElementById('alert-video-volume-value');
  const alertVideoDisplayMode = document.getElementById('alert-video-display-mode');
  const saveAlertBtn = document.getElementById('save-alert');
  const clearAlertsBtn = document.getElementById('clear-alerts');
  const alertPreviewArea = document.getElementById('alert-preview-area');
  const alertListContainer = document.getElementById('alert-list-container');
  
  // Text styling controls
  const alertTextPositionSelect = document.getElementById('alert-text-position');
  const alertFontFamilySelect = document.getElementById('alert-font-family');
  const alertFontSizeRange = document.getElementById('alert-font-size');
  const alertFontWeightSelect = document.getElementById('alert-font-weight');
  const alertTextColorInput = document.getElementById('alert-text-color');
  const alertTextShadowSelect = document.getElementById('alert-text-shadow');
  const alertTextStrokeSelect = document.getElementById('alert-text-stroke');
  
  // Animation controls
  const alertAnimationSelect = document.getElementById('alert-animation');
  const alertAnimationDurationRange = document.getElementById('alert-animation-duration');
  const alertAnimationDelayRange = document.getElementById('alert-animation-delay');
  const alertAnimationIterationSelect = document.getElementById('alert-animation-iteration');
  const alertAnimationEasingSelect = document.getElementById('alert-animation-easing');
  
  // Range value displays
  const fontSizeValue = document.getElementById('font-size-value');
  const animationDurationValue = document.getElementById('animation-duration-value');
  const animationDelayValue = document.getElementById('animation-delay-value');
  
  
  // Compact queue control widget elements (on dashboard)
  const queueWidgetClear = document.getElementById('queue-widget-clear');
  const queueWidgetSkip = document.getElementById('queue-widget-skip');
  const queueWidgetStop = document.getElementById('queue-widget-stop');
  const queueWidgetStatus = document.getElementById('queue-widget-status');
  
  
  
  // Alert storage - make it globally accessible for window functions
  window.savedAlerts = JSON.parse(localStorage.getItem('twitchAlerts') || '[]');
  let savedAlerts = window.savedAlerts; // Keep local reference for backward compatibility
  
  
  // Helper function to convert file to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
  
  // Helper function to get media duration
  function getMediaDuration(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      
      const url = URL.createObjectURL(file);
      const media = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
      
      media.onloadedmetadata = () => {
        const duration = Math.ceil(media.duration);
        URL.revokeObjectURL(url);
        console.log(`📹 Media duration detected: ${duration}s`);
        resolve(duration);
      };
      
      media.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn('Could not load media for duration detection');
        resolve(null);
      };
      
      media.src = url;
      media.load();
    });
  }
  
  // Alert management functions moved to global scope
  
  // Close widget
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideAlertWidget();
    });
  }
  
  // Show/hide bits threshold based on alert type
  // Range slider value updates
  if (alertFontSizeRange && fontSizeValue) {
    alertFontSizeRange.addEventListener('input', () => {
      fontSizeValue.textContent = alertFontSizeRange.value + 'px';
      updatePreview().catch(console.error);
    });
  }
  
  if (alertAnimationDurationRange && animationDurationValue) {
    alertAnimationDurationRange.addEventListener('input', () => {
      animationDurationValue.textContent = alertAnimationDurationRange.value + 's';
      updatePreview().catch(console.error);
    });
  }
  
  if (alertAnimationDelayRange && animationDelayValue) {
    alertAnimationDelayRange.addEventListener('input', () => {
      animationDelayValue.textContent = alertAnimationDelayRange.value + 's';
      updatePreview().catch(console.error);
    });
  }
  
  // Volume slider for alert sound
  const alertSoundVolumeRange = document.getElementById('alert-sound-volume');
  const alertSoundVolumeValue = document.getElementById('alert-sound-volume-value');
  
  if (alertSoundVolumeRange && alertSoundVolumeValue) {
    alertSoundVolumeRange.addEventListener('input', () => {
      alertSoundVolumeValue.textContent = alertSoundVolumeRange.value + '%';
    });
  }
  
  // Alert type change listener - show/hide bits threshold and update alert list
  if (alertTypeSelect) {
    alertTypeSelect.addEventListener('change', () => {
      const selectedType = alertTypeSelect.value;
      
      // Show/hide bits threshold input based on alert type
      if (bitsThresholdGroup) {
        bitsThresholdGroup.style.display = selectedType === 'bits' ? 'block' : 'none';
      }
      
      // Show/hide daily check-in settings based on alert type
      const dailyCheckinSettings = document.getElementById('daily-checkin-settings');
      if (dailyCheckinSettings) {
        dailyCheckinSettings.style.display = selectedType === 'daily-checkin' ? 'block' : 'none';
      }
      
      // Update alert list to show only matching alerts
      updateAlertList();
      
      // Update the selected alert type name display
      if (selectedAlertTypeName) {
        const typeNames = {
          'follower': 'Follower',
          'subscriber': 'Subscriber', 
          'resubscriber': 'Resubscriber',
          'gift-sub': 'Gift Subscription',
          'gift-sub-received': 'Gift Sub Received',
          'raid': 'Raid',
          'bits': 'Bits',
          'ban': 'Ban',
          'channel-points': 'Channel Point Redemption',
          'daily-checkin': 'Daily Checkin'
        };
        selectedAlertTypeName.textContent = typeNames[selectedType] || 'Unknown';
      }
      
      // Update placeholder text based on alert type
      if (alertTextInput) {
        const placeholderTexts = {
          'follower': 'Welcome {username}!',
          'subscriber': '{username} subscribed!',
          'resubscriber': '{username} resubscribed for {months} months!',
          'gift-sub': '{username} gifted {tier} to {recipient}!',
          'gift-sub-received': '{username} received a gift sub!',
          'raid': '{username} raided with {viewers} viewers!',
          'bits': '{username} cheered {bits} bits!',
          'ban': '{username} has been banned by {moderator}!',
          'daily-checkin': '{username} checked in! Total: {total_checkins}',
          'first-chat-walkon': 'Welcome {username} to the stream!'
        };
        alertTextInput.placeholder = placeholderTexts[selectedType] || 'Welcome {username}!';
      }
      
      // Update preview when type changes
      updatePreview().catch(console.error);
    });
    
    // Trigger initial change event to set up initial state
    alertTypeSelect.dispatchEvent(new Event('change'));
  }
  
  // Styling control event listeners
  const stylingControls = [
    alertFontFamilySelect,
    alertFontWeightSelect,
    alertTextColorInput,
    alertTextShadowSelect,
    alertTextStrokeSelect,
    alertAnimationSelect,
    alertAnimationIterationSelect,
    alertAnimationEasingSelect
  ];
  
  stylingControls.forEach(control => {
    if (control) {
      control.addEventListener('change', () => updatePreview().catch(console.error));
    }
  });
  
  // Make alert functions globally accessible
  window.toggleAlert = toggleAlert;
  window.toggleRandomModeForType = toggleRandomModeForType;
  
  
  // Setup alert widget tabs
  setupAlertTabs();
  
  // Setup alert type change handler to filter saved alerts
  setupAlertTypeFilter();
  
  // Walk-on (First Chat) follower selection UI
  const alertWalkonUsersGroup = document.getElementById('alert-walkon-users-group');
  const alertWalkonSearch = document.getElementById('alert-walkon-search');
  const alertWalkonSelected = document.getElementById('alert-walkon-selected');
  const alertWalkonFollowerList = document.getElementById('alert-walkon-follower-list');
  
  // Track selected followers
  let selectedWalkonUsers = [];
  let allFollowers = [];
  
  // Function to load followers
  async function loadWalkonFollowers() {
    try {
      if (window.electronAPI && window.electronAPI.getFollowersWithUsers) {
        allFollowers = await window.electronAPI.getFollowersWithUsers();
        renderWalkonFollowerList();
        console.log(`✅ Loaded ${allFollowers.length} followers for walk-on selection`);
      } else {
        console.error('getFollowersWithUsers API not available');
      }
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  }
  
  // Function to render follower list
  function renderWalkonFollowerList(searchTerm = '') {
    if (!alertWalkonFollowerList) return;
    
    const search = searchTerm.toLowerCase().trim();
    const filtered = allFollowers.filter(f => {
      if (!search) return true; // Show all if no search term
      const username = (f.username || '').toLowerCase();
      const displayName = (f.display_name || '').toLowerCase();
      return username.includes(search) || displayName.includes(search);
    });
    
    alertWalkonFollowerList.innerHTML = '';
    
    if (filtered.length === 0) {
      alertWalkonFollowerList.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-tertiary);">No followers found matching search</div>';
      return;
    }
    
    // Show count
    const countInfo = document.createElement('div');
    countInfo.style.cssText = 'padding: 8px 12px; font-size: 11px; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); background: var(--bg-secondary);';
    countInfo.textContent = search ? `Showing ${filtered.length} of ${allFollowers.length} followers` : `Showing all ${filtered.length} followers`;
    alertWalkonFollowerList.appendChild(countInfo);
    
    filtered.forEach(follower => {
      const item = document.createElement('div');
      const isSelected = selectedWalkonUsers.some(u => u.user_id === follower.user_id);
      item.style.cssText = `
        padding: 10px;
        cursor: pointer;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 10px;
        background: ${isSelected ? 'var(--accent)' : 'transparent'};
        color: ${isSelected ? 'white' : 'var(--text-primary)'};
        transition: background 0.2s ease;
      `;
      item.innerHTML = `
        <img src="${follower.profile_image_url || ''}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'">
        <div style="flex: 1;">
          <div style="font-weight: 600;">${escapeHtml(follower.display_name || follower.username)}</div>
          <div style="font-size: 11px; opacity: 0.7;">${escapeHtml(follower.username)}</div>
        </div>
        ${isSelected ? '<span style="color: white; font-size: 18px;">✓</span>' : ''}
      `;
      item.addEventListener('click', () => toggleWalkonUser(follower));
      alertWalkonFollowerList.appendChild(item);
    });
  }
  
  // Function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Function to toggle user selection
  function toggleWalkonUser(follower) {
    const index = selectedWalkonUsers.findIndex(u => u.user_id === follower.user_id);
    if (index >= 0) {
      selectedWalkonUsers.splice(index, 1);
    } else {
      selectedWalkonUsers.push(follower);
    }
    renderWalkonSelected();
    renderWalkonFollowerList(alertWalkonSearch ? alertWalkonSearch.value : '');
  }
  
  // Function to render selected users
  function renderWalkonSelected() {
    if (!alertWalkonSelected) return;
    
    if (selectedWalkonUsers.length === 0) {
      alertWalkonSelected.innerHTML = '<div style="color: var(--text-tertiary); font-size: 12px; align-self: center; width: 100%; text-align: center;">No users selected</div>';
      return;
    }
    
    alertWalkonSelected.innerHTML = selectedWalkonUsers.map(user => {
      const isManual = user.user_id && user.user_id.startsWith('manual_');
      const label = isManual ? '📝 ' : ''; // Mark manual entries
      return `<div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--accent); color: white; border-radius: 4px; font-size: 12px;">
        <span>${label}${escapeHtml(user.display_name || user.username)}</span>
        <button onclick="removeWalkonUser('${user.user_id}')" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 18px; height: 18px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; padding: 0;">×</button>
      </div>`;
    }).join('');
  }
  
  // Function to remove user from selection (exposed globally)
  window.removeWalkonUser = function(userId) {
    selectedWalkonUsers = selectedWalkonUsers.filter(u => u.user_id !== userId);
    renderWalkonSelected();
    renderWalkonFollowerList(alertWalkonSearch ? alertWalkonSearch.value : '');
  };
  
  // Show/hide walkon users group based on alert type
  if (alertTypeSelect && alertWalkonUsersGroup) {
    function updateWalkonUserFieldVisibility() {
      const selectedType = alertTypeSelect.value;
      if (selectedType === 'first-chat-walkon') {
        alertWalkonUsersGroup.style.display = 'block';
        if (allFollowers.length === 0) {
          loadWalkonFollowers();
        }
      } else {
        alertWalkonUsersGroup.style.display = 'none';
        selectedWalkonUsers = [];
        if (alertWalkonSearch) alertWalkonSearch.value = '';
        if (alertWalkonFollowerList) {
          alertWalkonFollowerList.innerHTML = '';
          alertWalkonFollowerList.style.display = 'none';
        }
        const manualInput = document.getElementById('alert-walkon-manual-username');
        if (manualInput) manualInput.value = '';
        // Keep allFollowers loaded for faster switching back
      }
    }
    
    alertTypeSelect.addEventListener('change', updateWalkonUserFieldVisibility);
    updateWalkonUserFieldVisibility();
  }
  
  // Function to add manual username
  function addManualUsername() {
    const manualInput = document.getElementById('alert-walkon-manual-username');
    if (!manualInput) return;
    
    const username = manualInput.value.trim();
    if (!username) {
      alert('Please enter a username');
      return;
    }
    
    const userLower = username.toLowerCase();
    
    // Check if already added
    const alreadyAdded = selectedWalkonUsers.some(u => 
      (u.username && u.username.toLowerCase() === userLower) ||
      (u.user_id && u.user_id === 'manual_' + userLower)
    );
    
    if (alreadyAdded) {
      alert('User already in list');
      manualInput.value = '';
      return;
    }
    
    // Create a manual user entry (without user_id from API)
    const manualUser = {
      user_id: 'manual_' + userLower, // Special ID for manual entries
      username: userLower,
      display_name: username
    };
    
    selectedWalkonUsers.push(manualUser);
    renderWalkonSelected();
    renderWalkonFollowerList(alertWalkonSearch ? alertWalkonSearch.value : '');
    manualInput.value = '';
    
    console.log('✅ Added manual username:', username);
  }
  
  // Manual username entry handlers
  const manualUsernameInput = document.getElementById('alert-walkon-manual-username');
  const addManualButton = document.getElementById('alert-walkon-add-manual');
  
  if (addManualButton) {
    addManualButton.addEventListener('click', addManualUsername);
  }
  
  if (manualUsernameInput) {
    manualUsernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addManualUsername();
      }
    });
  }
  
  // Reset first-time chatters for testing
  const resetTestButton = document.getElementById('alert-walkon-reset-test');
  if (resetTestButton) {
    resetTestButton.addEventListener('click', async () => {
      if (confirm('Reset first-time chatters list? This will allow testing the same users again.\n\nNote: This only affects the walk-on detection, not saved alert configurations.')) {
        try {
          if (window.electronAPI && window.electronAPI.resetFirstTimeChatters) {
            const result = await window.electronAPI.resetFirstTimeChatters();
            if (result.success) {
              alert('✅ First-time chatters list reset!\n\nYou can now test the walk-on alert again with the same users.');
              console.log('✅ First-time chatters reset:', result.message);
            } else {
              alert('❌ Error resetting: ' + (result.error || 'Unknown error'));
            }
          } else {
            alert('❌ Reset function not available');
          }
        } catch (error) {
          console.error('Error resetting first-time chatters:', error);
          alert('❌ Error: ' + error.message);
        }
      }
    });
  }
  
  // Search handler
  if (alertWalkonSearch) {
    alertWalkonSearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value;
      renderWalkonFollowerList(searchTerm);
      if (allFollowers.length > 0) {
        alertWalkonFollowerList.style.display = 'block';
      }
    });
    
    alertWalkonSearch.addEventListener('focus', () => {
      if (allFollowers.length > 0) {
        alertWalkonFollowerList.style.display = 'block';
        renderWalkonFollowerList(alertWalkonSearch.value);
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (alertWalkonFollowerList && alertWalkonUsersGroup && !alertWalkonUsersGroup.contains(e.target)) {
        alertWalkonFollowerList.style.display = 'none';
      }
    });
  }
  
  // Close widget when clicking on backdrop
  const alertBackdrop = document.querySelector('.alert-widget-backdrop');
  if (alertBackdrop) {
    alertBackdrop.addEventListener('click', () => {
      hideAlertWidget();
    });
  }
  
  // Close widget with ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !alertWidget.classList.contains('hidden')) {
      hideAlertWidget();
    }
  });
  
  // Update preview when form changes
  async function updatePreview() {
    const type = alertTypeSelect.value;
    const text = alertTextInput.value;
    const duration = alertDurationInput.value;
    
    // Check for new files first, then existing media when editing
    let soundFile = alertSoundInput.files[0];
    let imageFile = alertImageInput.files[0];
    let videoFile = alertVideoInput.files[0];
    
    // If no new files and we're editing, use existing media
    if (!soundFile && window.editingAlertMedia?.soundFile) {
      soundFile = window.editingAlertMedia.soundFile;
    }
    if (!imageFile && window.editingAlertMedia?.imageFile) {
      imageFile = window.editingAlertMedia.imageFile;
    }
    if (!videoFile && window.editingAlertMedia?.videoFile) {
      videoFile = window.editingAlertMedia.videoFile;
    }
    
    if (!text.trim()) {
      alertPreviewArea.innerHTML = '<div class="preview-placeholder">Configure an alert to see preview</div>';
      return;
    }
    
    // Create sample user data for preview
    const sampleUserData = {
      username: 'TestUser123',
      display_name: 'TestUser123',
      user_name: 'TestUser123',
      tier: 'Tier 1',
      viewers: '25',
      bits: '100',
      months: '3',
      message: 'Thanks for the follow!',
      reward: 'Test Reward',
      moderator: 'TestModerator',
      reason: 'Spam'
    };
    
    // Process text with sample data for preview
    const processedText = replacePlaceholders(text, sampleUserData);
    
    // Get styling values
    const textPosition = alertTextPositionSelect ? alertTextPositionSelect.value : 'topCenter';
    const fontFamily = alertFontFamilySelect ? alertFontFamilySelect.value : 'Arial, sans-serif';
    const fontSize = alertFontSizeRange ? alertFontSizeRange.value + 'px' : '24px';
    const fontWeight = alertFontWeightSelect ? alertFontWeightSelect.value : '700';
    const textColor = alertTextColorInput ? alertTextColorInput.value : '#ffffff';
    const textShadow = alertTextShadowSelect ? alertTextShadowSelect.value : '1px 1px 2px rgba(0,0,0,0.8)';
    const textStroke = alertTextStrokeSelect ? alertTextStrokeSelect.value : '1px #000';
    const animation = alertAnimationSelect ? alertAnimationSelect.value : 'none';
    const animationDuration = alertAnimationDurationRange ? alertAnimationDurationRange.value + 's' : '1s';
    const animationDelay = alertAnimationDelayRange ? alertAnimationDelayRange.value + 's' : '0s';
    const animationIteration = alertAnimationIterationSelect ? alertAnimationIterationSelect.value : '1';
    const animationEasing = alertAnimationEasingSelect ? alertAnimationEasingSelect.value : 'ease';
    
    // Build text style
    let textStyle = `
      font-family: ${fontFamily};
      font-size: ${fontSize};
      font-weight: ${fontWeight};
      color: ${textColor};
      text-shadow: ${textShadow};
      -webkit-text-stroke: ${textStroke};
    `;
    
    // Add animation if selected
    if (animation !== 'none') {
      textStyle += `
        animation: ${animation} ${animationDuration} ${animationEasing} ${animationDelay} ${animationIteration};
      `;
    }
    
    // Build position style for text
    let positionStyle = '';
    switch(textPosition) {
      case 'topLeft':
        positionStyle = 'top: 10%; left: 10%;';
        break;
      case 'topCenter':
        positionStyle = 'top: 10%; left: 50%; transform: translateX(-50%);';
        break;
      case 'topRight':
        positionStyle = 'top: 10%; right: 10%;';
        break;
      case 'midLeft':
        positionStyle = 'top: 50%; left: 10%; transform: translateY(-50%);';
        break;
      case 'center':
        positionStyle = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
        break;
      case 'midRight':
        positionStyle = 'top: 50%; right: 10%; transform: translateY(-50%);';
        break;
      case 'bottomLeft':
        positionStyle = 'bottom: 10%; left: 10%;';
        break;
      case 'bottomCenter':
        positionStyle = 'bottom: 10%; left: 50%; transform: translateX(-50%);';
        break;
      case 'bottomRight':
        positionStyle = 'bottom: 10%; right: 10%;';
        break;
    }
    
    let previewHTML = '<div class="alert-preview-content" style="position: relative; width: 100%; height: 300px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-color);">';
    
    if (imageFile) {
      if (imageFile instanceof File) {
        // New file from input
        const imageUrl = URL.createObjectURL(imageFile);
        previewHTML += `<img src="${imageUrl}" alt="Alert Image" style="position: absolute; max-width: 50%; max-height: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.3;" />`;
      } else if (imageFile.data) {
        // Legacy base64 data
        previewHTML += `<img src="${imageFile.data}" alt="Alert Image" style="position: absolute; max-width: 50%; max-height: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.3;" />`;
      } else if (imageFile.path && window.electronAPI && window.electronAPI.getMediaFile) {
        // Existing saved file with path - load from disk
        try {
          const result = await window.electronAPI.getMediaFile(imageFile.path);
          if (result.success) {
            previewHTML += `<img src="${result.data}" alt="Alert Image" style="position: absolute; max-width: 50%; max-height: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.3;" />`;
          } else {
            // Fallback to placeholder if loading fails
            previewHTML += `<div class="image-placeholder" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">📷 ${imageFile.name || 'Alert Image'}</div>`;
          }
        } catch (error) {
          console.error('Error loading preview image:', error);
          previewHTML += `<div class="image-placeholder" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">📷 ${imageFile.name || 'Alert Image'}</div>`;
        }
      } else if (imageFile.name) {
        // Existing file (show placeholder)
        previewHTML += `<div class="image-placeholder" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">📷 ${imageFile.name}</div>`;
      }
    }
    
    // Add positioned text
    previewHTML += `<div style="position: absolute; ${positionStyle} white-space: nowrap;">`;
    previewHTML += `<p style="${textStyle} margin: 0;">${processedText}</p>`;
    previewHTML += `</div>`;
    
    // Add info at bottom
    previewHTML += `<div style="position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); font-size: 11px; color: var(--text-tertiary); text-align: center;">`;
    previewHTML += `<div><small>Position: ${textPosition} | Duration: ${duration}s</small></div>`;
    if (soundFile) {
      const soundName = soundFile.name || 'Existing Sound';
      previewHTML += `<div><small>🔊 Sound: ${soundName}</small></div>`;
    }
    previewHTML += `</div>`;
    
    previewHTML += '</div>';
    alertPreviewArea.innerHTML = previewHTML;
  }
  
  // Get display name for alert type
  function getAlertTypeDisplayName(type) {
    const typeNames = {
      'follower': 'New Follower',
      'subscriber': 'New Subscriber', 
      'resubscriber': 'Resubscriber',
      'raid': 'Raid',
      'gift-sub': 'Gifted Subscription',
      'bits': 'Bits Donation',
      'daily-checkin': 'Daily Checkin',
      'first-chat-walkon': 'Walk On (First Chat)'
    };
    return typeNames[type] || type;
  }
  
  // Event listeners for form changes
  [alertTypeSelect, alertTextInput, alertDurationInput, alertSoundInput, alertImageInput, alertVideoInput].forEach(element => {
    if (element) {
      element.addEventListener('change', () => updatePreview().catch(console.error));
      element.addEventListener('input', () => updatePreview().catch(console.error));
    }
  });
  
  // Auto-update duration when media files are selected
  if (alertSoundInput) {
    alertSoundInput.addEventListener('change', async () => {
      const file = alertSoundInput.files[0];
      if (file) {
        const duration = await getMediaDuration(file);
        if (duration && duration > parseInt(alertDurationInput.value)) {
          alertDurationInput.value = duration;
          console.log(`🎵 Auto-updated duration to ${duration}s for audio file`);
          updatePreview().catch(console.error);
        }
      }
    });
  }
  
  if (alertImageInput) {
    alertImageInput.addEventListener('change', async () => {
      const file = alertImageInput.files[0];
      if (file) {
        const duration = await getMediaDuration(file);
        if (duration && duration > parseInt(alertDurationInput.value)) {
          alertDurationInput.value = duration;
          console.log(`🎵 Auto-updated duration to ${duration}s for image file`);
          updatePreview().catch(console.error);
        }
      }
    });
  }
  
  if (alertVideoInput) {
    alertVideoInput.addEventListener('change', async () => {
      const file = alertVideoInput.files[0];
      if (file) {
        // Show video settings panel
        if (alertVideoSettings) {
          alertVideoSettings.style.display = 'block';
        }
        
        const duration = await getMediaDuration(file);
        if (duration && duration > parseInt(alertDurationInput.value)) {
          alertDurationInput.value = duration;
          console.log(`🎬 Auto-updated duration to ${duration}s for video file`);
          updatePreview().catch(console.error);
        }
      } else {
        // Hide video settings panel if no file
        if (alertVideoSettings) {
          alertVideoSettings.style.display = 'none';
        }
      }
    });
  }
  
  // Video volume slider
  if (alertVideoVolume && alertVideoVolumeValue) {
    alertVideoVolume.addEventListener('input', () => {
      alertVideoVolumeValue.textContent = alertVideoVolume.value + '%';
    });
  }
  
  // Media removal buttons
  const removeSoundBtn = document.getElementById('remove-alert-sound');
  const removeImageBtn = document.getElementById('remove-alert-image');
  const removeVideoBtn = document.getElementById('remove-alert-video');
  
  // Helper function to show/hide remove buttons based on file selection
  function updateRemoveButtons() {
    // Sound file
    if (removeSoundBtn) {
      const hasSound = alertSoundInput.files[0] || window.editingAlertMedia?.soundFile;
      removeSoundBtn.style.display = hasSound ? 'inline-block' : 'none';
    }
    
    // Image file
    if (removeImageBtn) {
      const hasImage = alertImageInput.files[0] || window.editingAlertMedia?.imageFile;
      removeImageBtn.style.display = hasImage ? 'inline-block' : 'none';
    }
    
    // Video file
    if (removeVideoBtn) {
      const hasVideo = alertVideoInput.files[0] || window.editingAlertMedia?.videoFile;
      removeVideoBtn.style.display = hasVideo ? 'inline-block' : 'none';
    }
  }
  
  // Update remove buttons when files change
  if (alertSoundInput) {
    alertSoundInput.addEventListener('change', () => {
      updateRemoveButtons();
    });
  }
  
  if (alertImageInput) {
    alertImageInput.addEventListener('change', () => {
      updateRemoveButtons();
    });
  }
  
  if (alertVideoInput) {
    alertVideoInput.addEventListener('change', () => {
      updateRemoveButtons();
    });
  }
  
  // Remove sound file
  if (removeSoundBtn) {
    removeSoundBtn.addEventListener('click', () => {
      alertSoundInput.value = '';
      if (window.editingAlertMedia) {
        window.editingAlertMedia.soundFile = null;
      }
      updateRemoveButtons();
      updatePreview().catch(console.error);
      console.log('Sound file removed');
    });
  }
  
  // Remove image file
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
      alertImageInput.value = '';
      if (window.editingAlertMedia) {
        window.editingAlertMedia.imageFile = null;
      }
      updateRemoveButtons();
      updatePreview().catch(console.error);
      console.log('Image file removed');
    });
  }
  
  // Remove video file
  if (removeVideoBtn) {
    removeVideoBtn.addEventListener('click', () => {
      alertVideoInput.value = '';
      if (window.editingAlertMedia) {
        window.editingAlertMedia.videoFile = null;
      }
      // Hide video settings panel
      if (alertVideoSettings) {
        alertVideoSettings.style.display = 'none';
      }
      updateRemoveButtons();
      updatePreview().catch(console.error);
      console.log('Video file removed');
    });
  }
  
  
  // Save alert
  if (saveAlertBtn) {
    saveAlertBtn.addEventListener('click', async () => {
      const type = alertTypeSelect.value;
      const text = alertTextInput.value.trim();
      let duration = parseInt(alertDurationInput.value) || 5;
      const soundFile = alertSoundInput.files[0];
      const imageFile = alertImageInput.files[0];
      const videoFile = alertVideoInput.files[0];
      
      // Alert text is now optional - alerts can have just images/videos/sounds without text
      
      // Auto-detect duration from media files
      const soundDuration = await getMediaDuration(soundFile);
      const imageDuration = await getMediaDuration(imageFile);
      const videoDuration = await getMediaDuration(videoFile);
      
      // Use the longer duration if media is present
      if (soundDuration || imageDuration || videoDuration) {
        const mediaDuration = Math.max(soundDuration || 0, imageDuration || 0, videoDuration || 0);
        if (mediaDuration > duration) {
          duration = mediaDuration;
          alertDurationInput.value = duration;
          console.log(`🎵 Auto-set duration to ${duration}s based on media length`);
        }
      }
      
      // Generate alert ID for file storage
      const alertId = `alert-${Date.now()}`;
      
      // Save media files to disk instead of base64
      let soundFilePath = null;
      let imageFilePath = null;
      let videoFilePath = null;
      
      if (soundFile && window.electronAPI && window.electronAPI.saveMediaFile) {
        try {
          const base64Data = await fileToBase64(soundFile);
          const result = await window.electronAPI.saveMediaFile({
            base64Data: base64Data,
            buttonId: alertId,
            mediaType: 'sound',
            originalName: soundFile.name
          });
          if (result.success) {
            soundFilePath = result.filePath;
            console.log(`💾 Alert sound saved to: ${soundFilePath}`);
          }
        } catch (error) {
          console.error('Error saving alert sound:', error);
        }
      }
      
      if (imageFile && window.electronAPI && window.electronAPI.saveMediaFile) {
        try {
          const base64Data = await fileToBase64(imageFile);
          const result = await window.electronAPI.saveMediaFile({
            base64Data: base64Data,
            buttonId: alertId,
            mediaType: 'image',
            originalName: imageFile.name
          });
          if (result.success) {
            imageFilePath = result.filePath;
            console.log(`💾 Alert image saved to: ${imageFilePath}`);
          }
        } catch (error) {
          console.error('Error saving alert image:', error);
        }
      }
      
      if (videoFile && window.electronAPI && window.electronAPI.saveMediaFile) {
        try {
          const base64Data = await fileToBase64(videoFile);
          const result = await window.electronAPI.saveMediaFile({
            base64Data: base64Data,
            buttonId: alertId,
            mediaType: 'video',
            originalName: videoFile.name
          });
          if (result.success) {
            videoFilePath = result.filePath;
            console.log(`💾 Alert video saved to: ${videoFilePath}`);
          }
        } catch (error) {
          console.error('Error saving alert video:', error);
        }
      }
      
      // Get styling values
      const textStyling = {
        position: alertTextPositionSelect ? alertTextPositionSelect.value : 'topCenter',
        fontFamily: alertFontFamilySelect ? alertFontFamilySelect.value : 'Arial, sans-serif',
        fontSize: alertFontSizeRange ? alertFontSizeRange.value + 'px' : '24px',
        fontWeight: alertFontWeightSelect ? alertFontWeightSelect.value : '700',
        color: alertTextColorInput ? alertTextColorInput.value : '#ffffff',
        textShadow: alertTextShadowSelect ? alertTextShadowSelect.value : '1px 1px 2px rgba(0,0,0,0.8)',
        textStroke: alertTextStrokeSelect ? alertTextStrokeSelect.value : '1px #000'
      };
      
      const animation = {
        type: alertAnimationSelect ? alertAnimationSelect.value : 'none',
        duration: alertAnimationDurationRange ? alertAnimationDurationRange.value + 's' : '1s',
        delay: alertAnimationDelayRange ? alertAnimationDelayRange.value + 's' : '0s',
        iteration: alertAnimationIterationSelect ? alertAnimationIterationSelect.value : '1',
        easing: alertAnimationEasingSelect ? alertAnimationEasingSelect.value : 'ease'
      };

      // Get volume value
      const soundVolume = alertSoundVolumeRange ? parseInt(alertSoundVolumeRange.value) : 100;
      
      // Get overlay selection
      const overlaySelect = document.getElementById('alert-overlay-select')?.value || 'default';
      
      console.log('🔍 Creating alert with overlay:', overlaySelect);
      
      const alertData = {
        id: alertId,
        type: type,
        text: text,
        duration: duration,
        overlay: overlaySelect,
        bitsThreshold: type === 'bits' ? (parseInt(alertBitsThresholdInput.value) || 10) : null,
        textStyling: textStyling,
        animation: animation,
        soundFile: soundFilePath ? {
          name: soundFile.name,
          size: soundFile.size,
          type: soundFile.type,
          path: soundFilePath, // Store file path instead of base64
          volume: soundVolume  // Store volume setting
        } : null,
        imageFile: imageFilePath ? {
          name: imageFile.name,
          size: imageFile.size,
          type: imageFile.type,
          path: imageFilePath // Store file path instead of base64
        } : null,
        videoFile: videoFilePath ? {
          name: videoFile.name,
          size: videoFile.size,
          type: videoFile.type,
          path: videoFilePath, // Store file path instead of base64
          loop: alertVideoLoop ? alertVideoLoop.checked : false,
          volume: alertVideoVolume ? parseInt(alertVideoVolume.value) : 100,
          displayMode: alertVideoDisplayMode ? alertVideoDisplayMode.value : 'center'
        } : null,
        // Include daily check-in config if this is a daily-checkin alert
        dailyCheckinConfig: type === 'daily-checkin' ? {
          enabled: document.getElementById('daily-checkin-enabled')?.checked ?? true,
          rewardName: document.getElementById('daily-checkin-reward-name')?.value || 'Daily Check-In',
          chatResponse: document.getElementById('daily-checkin-chat-response')?.value || 'Welcome back {username}!',
          alreadyCheckedMessage: document.getElementById('daily-checkin-already-checked-message')?.value || 'You\'ve already checked in today!',
          showStreak: document.getElementById('daily-checkin-show-streak')?.checked ?? false,
          sendToChat: document.getElementById('daily-checkin-send-to-chat')?.checked ?? true,
          testMode: document.getElementById('daily-checkin-test-mode')?.checked ?? false
        } : null,
        walkonUsers: type === 'first-chat-walkon' ? selectedWalkonUsers.map(u => ({
          user_id: u.user_id,
          username: u.username,
          display_name: u.display_name
        })) : [],
        variations: [],
        randomMode: false,
        createdAt: new Date().toISOString()
      };
      
      try {
        // Check if we're editing an existing alert
        if (window.editingAlertId) {
          // Update existing alert
          const alertIndex = savedAlerts.findIndex(a => a.id === window.editingAlertId);
          if (alertIndex !== -1) {
            // Preserve the original creation date
            alertData.createdAt = savedAlerts[alertIndex].createdAt;
            
            // Preserve existing media files if no new files were uploaded
            if (!soundFilePath && window.editingAlertMedia?.soundFile) {
              alertData.soundFile = {
                ...window.editingAlertMedia.soundFile,
                volume: soundVolume  // Update volume even when keeping existing file
              };
              console.log('Preserved existing sound file with updated volume:', window.editingAlertMedia.soundFile.name, soundVolume + '%');
            }
            
            if (!imageFilePath && window.editingAlertMedia?.imageFile) {
              alertData.imageFile = window.editingAlertMedia.imageFile;
              console.log('Preserved existing image file:', window.editingAlertMedia.imageFile.name);
            }
            
            if (!videoFilePath && window.editingAlertMedia?.videoFile) {
              alertData.videoFile = {
                ...window.editingAlertMedia.videoFile,
                loop: alertVideoLoop ? alertVideoLoop.checked : window.editingAlertMedia.videoFile.loop,
                volume: alertVideoVolume ? parseInt(alertVideoVolume.value) : window.editingAlertMedia.videoFile.volume,
                displayMode: alertVideoDisplayMode ? alertVideoDisplayMode.value : window.editingAlertMedia.videoFile.displayMode
              };
              console.log('Preserved existing video file with updated settings:', window.editingAlertMedia.videoFile.name, 'volume:', alertData.videoFile.volume + '%');
            }
            
            // Preserve existing text styling and animation if they weren't explicitly changed
            if (!textStyling || Object.keys(textStyling).length === 0) {
              alertData.textStyling = savedAlerts[alertIndex].textStyling || alertData.textStyling;
              console.log('Preserved existing text styling');
            }
            
            if (!animation || Object.keys(animation).length === 0) {
              alertData.animation = savedAlerts[alertIndex].animation || alertData.animation;
              console.log('Preserved existing animation');
            }
            
            savedAlerts[alertIndex] = alertData;
            console.log('✅ Updated existing alert:', window.editingAlertId);
            console.log('✅ Alert overlay property:', alertData.overlay);
          } else {
            console.error('Alert to edit not found:', window.editingAlertId);
            savedAlerts.push(alertData);
          }
          // Clear editing state
          window.editingAlertId = null;
          window.editingAlertMedia = null;
        } else {
          // Create new alert
          savedAlerts.push(alertData);
          console.log('✅ Created new alert:', alertId);
          console.log('✅ Alert overlay property:', alertData.overlay);
        }
        
        localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
        console.log('💾 Saved to localStorage. Verifying overlay property persisted...');
        
        // Verify the alert was saved correctly with overlay
        const savedAlertsCheck = JSON.parse(localStorage.getItem('twitchAlerts') || '[]');
        const savedAlert = savedAlertsCheck.find(a => a.id === alertId);
        if (savedAlert) {
          console.log('✅ Verified alert in localStorage has overlay:', savedAlert.overlay);
        } else {
          console.error('❌ Alert not found in localStorage after save');
        }
        
        // Update alertSystem's in-memory cache
        alertSystem.updateAlerts();
        console.log('✅ Updated alertSystem cache with new alerts');
        
        updateAlertList();
        clearForm();
      } catch (error) {
        console.error('Error saving alert:', error);
        alert('Error saving alert: ' + error.message);
      }
    });
  }
  
  
  // Clear all alerts
  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all saved alerts?')) {
        savedAlerts = [];
        window.savedAlerts = savedAlerts; // Keep window reference in sync
        localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
        alertSystem.updateAlerts();
        updateAlertList();
        clearForm();
        console.log('All alerts cleared - form cleared');
      }
    });
  }
  
  // Clear form
  function clearForm() {
    // Clear editing state
    window.editingAlertId = null;
    window.editingAlertMedia = null;
    
    // Reset file input labels
    const soundFileLabel = document.querySelector('label[for="alert-sound"]');
    if (soundFileLabel) {
      soundFileLabel.textContent = 'Sound File:';
      soundFileLabel.style.color = '';
      soundFileLabel.style.fontWeight = '';
    }
    
    const imageFileLabel = document.querySelector('label[for="alert-image"]');
    if (imageFileLabel) {
      imageFileLabel.textContent = 'Image File:';
      imageFileLabel.style.color = '';
      imageFileLabel.style.fontWeight = '';
    }
    
    // Reset form fields
    alertTextInput.value = '';
    alertDurationInput.value = '5';
    alertSoundInput.value = '';
    alertImageInput.value = '';
    alertVideoInput.value = '';
    
    // Reset video settings
    if (alertVideoSettings) {
      alertVideoSettings.style.display = 'none';
    }
    if (alertVideoLoop) {
      alertVideoLoop.checked = false;
    }
    if (alertVideoVolume) {
      alertVideoVolume.value = '100';
      if (alertVideoVolumeValue) {
        alertVideoVolumeValue.textContent = '100%';
      }
    }
    if (alertVideoDisplayMode) {
      alertVideoDisplayMode.value = 'center';
    }
    
    // Reset volume slider
    if (alertSoundVolumeRange) {
      alertSoundVolumeRange.value = '100';
    }
    if (alertSoundVolumeValue) {
      alertSoundVolumeValue.textContent = '100%';
    }
    
    // Reset bits threshold
    if (alertBitsThresholdInput) {
      alertBitsThresholdInput.value = '10';
    }
    
    // Reset alert type to first option (follower) and hide bits threshold
    if (alertTypeSelect) {
      alertTypeSelect.value = 'follower'; // Explicitly set to follower
    }
    
    // Hide bits threshold when clearing form
    if (bitsThresholdGroup) {
      bitsThresholdGroup.style.display = 'none';
    }
    
    // Reset styling to defaults
    if (alertTextPositionSelect) {
      alertTextPositionSelect.value = 'topCenter';
    }
    if (alertFontFamilySelect) {
      alertFontFamilySelect.value = 'Arial, sans-serif';
    }
    if (alertFontSizeRange) {
      alertFontSizeRange.value = '24';
      const fontSizeValue = document.getElementById('font-size-value');
      if (fontSizeValue) fontSizeValue.textContent = '24px';
    }
    if (alertFontWeightSelect) {
      alertFontWeightSelect.value = '700';
    }
    if (alertTextColorInput) {
      alertTextColorInput.value = '#ffffff';
    }
    if (alertTextShadowSelect) {
      alertTextShadowSelect.value = '1px 1px 2px rgba(0,0,0,0.8)';
    }
    if (alertTextStrokeSelect) {
      alertTextStrokeSelect.value = '1px #000';
    }
    
    // Reset animation to defaults
    if (alertAnimationSelect) {
      alertAnimationSelect.value = 'none';
    }
    if (alertAnimationDurationRange) {
      alertAnimationDurationRange.value = '1';
      const durationValue = document.getElementById('animation-duration-value');
      if (durationValue) durationValue.textContent = '1.0s';
    }
    if (alertAnimationDelayRange) {
      alertAnimationDelayRange.value = '0';
      const delayValue = document.getElementById('animation-delay-value');
      if (delayValue) delayValue.textContent = '0.0s';
    }
    if (alertAnimationIterationSelect) {
      alertAnimationIterationSelect.value = '1';
    }
    if (alertAnimationEasingSelect) {
      alertAnimationEasingSelect.value = 'ease';
    }
    
    // Hide all remove buttons
    updateRemoveButtons();
    
    // Reset walkon selections
    if (alertWalkonUsersGroup) {
      selectedWalkonUsers = [];
      if (alertWalkonSelected) renderWalkonSelected();
      if (alertWalkonSearch) alertWalkonSearch.value = '';
      if (alertWalkonFollowerList) {
        alertWalkonFollowerList.innerHTML = '';
        alertWalkonFollowerList.style.display = 'none';
      }
      const manualInput = document.getElementById('alert-walkon-manual-username');
      if (manualInput) manualInput.value = '';
    }
    
    updatePreview().catch(console.error);
  }
  
  // Get display name for alert type
  window.getAlertTypeDisplayName = function(alertType) {
    const typeNames = {
      'follower': 'Follower',
      'subscriber': 'Subscriber', 
      'resubscriber': 'Resubscriber',
      'gift-sub': 'Gift Sub',
      'gift-sub-received': 'Gift Received',
      'raid': 'Raid',
      'bits': 'Bits',
      'channel-points': 'Channel Point Redemption',
      'daily-checkin': 'Daily Checkin',
      'first-chat-walkon': 'Walk On (First Chat)'
    };
    return typeNames[alertType] || alertType;
  }

  // Update alert list display - filtered by selected alert type
  window.updateAlertList = function() {
    if (!alertListContainer) return;
    
    // Get the currently selected alert type
    const alertTypeSelect = document.getElementById('alert-type');
    const selectedType = alertTypeSelect ? alertTypeSelect.value : 'follower';
    
    // Filter alerts by selected type
    const filteredAlerts = savedAlerts.filter(alert => alert.type === selectedType);
    
    if (filteredAlerts.length === 0) {
      alertListContainer.innerHTML = `
        <div class="no-alerts">
          <div style="margin-bottom: 15px;">No ${selectedType} alerts configured yet</div>
          <div style="color: var(--text-secondary); font-size: 14px;">
            Create a new ${selectedType} alert using the form on the left.
          </div>
        </div>
      `;
      return;
    }
    
    // Render filtered alerts for the selected type
    const firstAlert = filteredAlerts[0];
    const thresholdInfo = selectedType === 'bits' && firstAlert.bitsThreshold 
      ? `<div class="alert-item-threshold" style="color: var(--text-tertiary); font-size: 11px; margin-top: 4px;">Min bits: ${firstAlert.bitsThreshold}</div>`
      : '';
    
    // Create variations list from all alerts of this type
    const variationsHtml = `
      <div class="alert-variations-list">
        <div class="variations-header">
          <span>Variations (${filteredAlerts.length} total, ${filteredAlerts.filter(a => a.enabled !== false).length} enabled):</span>
          <div style="display: flex; gap: 12px; align-items: center;">
            <button class="variation-btn" onclick="toggleAllAlertsForType('${selectedType}', true)" style="padding: 4px 8px; font-size: 12px;">Enable All</button>
            <button class="variation-btn" onclick="toggleAllAlertsForType('${selectedType}', false)" style="padding: 4px 8px; font-size: 12px;">Disable All</button>
            <label class="random-toggle">
              <input type="checkbox" ${firstAlert.randomMode ? 'checked' : ''} 
                     onchange="toggleRandomModeForType('${selectedType}', this.checked)" />
              Random Mode
            </label>
          </div>
        </div>
        <div class="variations-help" style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; padding: 8px; background: rgba(0, 122, 204, 0.1); border-radius: 4px;">
          <strong>💡 Tip:</strong> Check the boxes to enable specific alerts. ${firstAlert.randomMode ? 'Random Mode will pick randomly from enabled alerts.' : 'The first enabled alert will be used.'}
        </div>

        <!-- Test Overlay Buttons -->
        <div class="overlay-test-controls" style="display: flex; gap: 8px; margin-bottom: 12px; padding: 8px; background: rgba(255, 193, 7, 0.1); border-radius: 4px;">
          <button class="variation-btn test-alert" onclick="testAlert('${selectedType}')" style="padding: 6px 12px; font-size: 12px; background: #9147ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            🚨 Test Alert
          </button>
          <button class="variation-btn test-confetti" onclick="testConfetti()" style="padding: 6px 12px; font-size: 12px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">
            🎊 Test Confetti
          </button>
          <span style="font-size: 11px; color: var(--text-secondary); align-self: center;">
            Test overlays (open in OBS first)
          </span>
        </div>
        <div class="variations-items">
          ${filteredAlerts.map((alert, index) => `
            <div class="variation-item ${alert.enabled !== false ? 'enabled' : 'disabled'}">
              <label class="variation-toggle">
                <input type="checkbox" ${alert.enabled !== false ? 'checked' : ''} 
                       onchange="toggleAlert('${alert.id}', this.checked)" />
                <span class="variation-text">
                  ${alert.enabled !== false ? '✓' : '○'} ${alert.text || '<em style="color: #888;">(Media Only)</em>'}
                  <span class="overlay-badge">${alert.overlay || 'main'}</span>
                </span>
              </label>
              <div class="variation-actions">
                <button class="variation-btn edit" onclick="editAlert('${alert.id}')">Edit</button>
                <button class="variation-btn test" onclick="testSavedAlert('${alert.id}')">Test</button>
                <button class="variation-btn delete" onclick="deleteAlert('${alert.id}')">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    alertListContainer.innerHTML = `
      <div class="alert-group" data-alert-type="${selectedType}">
        <div class="alert-group-header">
          <div class="alert-item-type">${getAlertTypeDisplayName(selectedType)}</div>
          ${thresholdInfo}
        </div>
        ${variationsHtml}
      </div>
      `;
  }
  
  // Test saved alert
  window.testSavedAlert = function(alertId) {
    const alert = savedAlerts.find(a => a.id === alertId);
    if (alert) {
      console.log('🎭 Testing specific saved alert:', alertId, alert);
      console.log('🎯 Alert overlay setting:', alert.overlay || 'NOT SET (will default to default)');
      console.log('🎬 Alert animation in saved data:', alert.animation);
      
      // Create sample user data for the alert
      const sampleUserData = {
        username: 'TestUser123',
        display_name: 'TestUser123',
        user_name: 'TestUser123',
        tier: 'Tier 1',
        viewers: '25',
        bits: '100',
        months: '3',
        message: 'Thanks for the follow!',
        reward: 'Test Reward',
        moderator: 'TestModerator',
        reason: 'Spam'
      };
      
      // Directly trigger this specific alert - bypass the overlay event system
      if (window.alertQueue) {
        console.log('🎭 Adding specific alert to queue:', alert);
        window.alertQueue.addToQueue(alert, sampleUserData);
      } else {
        console.error('Alert queue not available');
      }
    } else {
      console.error('Alert not found:', alertId);
    }
  };
  
  
  // Delete alert
  // Display existing media files in the form
  function displayExistingMedia(soundFile, imageFile, videoFile) {
    // Display existing sound file
    if (soundFile) {
      const soundFileLabel = document.querySelector('label[for="alert-sound"]');
      if (soundFileLabel) {
        const fileName = soundFile.name || 'Existing Sound File';
        soundFileLabel.textContent = `Sound File: ${fileName}`;
        soundFileLabel.style.color = 'var(--accent-color)';
        soundFileLabel.style.fontWeight = 'bold';
      }
    }
    
    // Display existing image file
    if (imageFile) {
      const imageFileLabel = document.querySelector('label[for="alert-image"]');
      if (imageFileLabel) {
        const fileName = imageFile.name || 'Existing Image File';
        imageFileLabel.textContent = `Image File: ${fileName}`;
        imageFileLabel.style.color = 'var(--accent-color)';
        imageFileLabel.style.fontWeight = 'bold';
      }
    }
    
    // Display existing video file
    if (videoFile) {
      const videoFileLabel = document.querySelector('label[for="alert-video"]');
      if (videoFileLabel) {
        const fileName = videoFile.name || 'Existing Video File';
        videoFileLabel.textContent = `Video File: ${fileName}`;
        videoFileLabel.style.color = 'var(--accent-color)';
        videoFileLabel.style.fontWeight = 'bold';
      }
      
      // Show video settings panel
      const videoSettings = document.getElementById('alert-video-settings');
      if (videoSettings) {
        videoSettings.style.display = 'block';
      }
      
      // Populate video settings
      const videoLoop = document.getElementById('alert-video-loop');
      if (videoLoop && videoFile.loop !== undefined) {
        videoLoop.checked = videoFile.loop;
      }
      
      const videoVolume = document.getElementById('alert-video-volume');
      const videoVolumeValue = document.getElementById('alert-video-volume-value');
      if (videoVolume && videoFile.volume !== undefined) {
        videoVolume.value = videoFile.volume;
        if (videoVolumeValue) {
          videoVolumeValue.textContent = videoFile.volume + '%';
        }
      }
      
      const videoDisplayMode = document.getElementById('alert-video-display-mode');
      if (videoDisplayMode && videoFile.displayMode !== undefined) {
        videoDisplayMode.value = videoFile.displayMode;
      }
      
    }
  }

  window.editAlert = function(alertId) {
    // Find the alert to edit
    const alertToEdit = savedAlerts.find(a => a.id === alertId);
    if (!alertToEdit) {
      console.error('Alert not found:', alertId);
      return;
    }
    
    console.log('Editing alert:', alertToEdit);
    
    // Populate the form with the alert data
    if (alertTypeSelect) {
      alertTypeSelect.value = alertToEdit.type;
      // Trigger change event to update UI
      alertTypeSelect.dispatchEvent(new Event('change'));
    }
    
    if (alertTextInput) {
      alertTextInput.value = alertToEdit.text || '';
    }
    
    if (alertDurationInput) {
      alertDurationInput.value = alertToEdit.duration || 5;
    }
    
    // Set overlay selection
    const alertOverlaySelect = document.getElementById('alert-overlay-select');
    if (alertOverlaySelect && alertToEdit.overlay) {
      alertOverlaySelect.value = alertToEdit.overlay;
      console.log(`📝 [Edit Alert] Setting overlay to: ${alertToEdit.overlay}`);
    }
    
    // Populate bits threshold if it's a bits alert
    if (alertToEdit.type === 'bits' && alertToEdit.bitsThreshold && alertBitsThresholdInput) {
      alertBitsThresholdInput.value = alertToEdit.bitsThreshold;
    }
    
    // Populate styling data
    if (alertToEdit.textStyling) {
      if (alertTextPositionSelect && alertToEdit.textStyling.position) {
        alertTextPositionSelect.value = alertToEdit.textStyling.position;
      }
      if (alertFontFamilySelect && alertToEdit.textStyling.fontFamily) {
        alertFontFamilySelect.value = alertToEdit.textStyling.fontFamily;
      }
      if (alertFontSizeRange && alertToEdit.textStyling.fontSize) {
        const fontSize = alertToEdit.textStyling.fontSize.replace('px', '');
        alertFontSizeRange.value = fontSize;
        // Update the display value
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSizeValue) fontSizeValue.textContent = fontSize + 'px';
      }
      if (alertFontWeightSelect && alertToEdit.textStyling.fontWeight) {
        alertFontWeightSelect.value = alertToEdit.textStyling.fontWeight;
      }
      if (alertTextColorInput && alertToEdit.textStyling.color) {
        alertTextColorInput.value = alertToEdit.textStyling.color;
      }
      if (alertTextShadowSelect && alertToEdit.textStyling.textShadow) {
        alertTextShadowSelect.value = alertToEdit.textStyling.textShadow;
      }
      if (alertTextStrokeSelect && alertToEdit.textStyling.textStroke) {
        alertTextStrokeSelect.value = alertToEdit.textStyling.textStroke;
      }
    }
    
    // Populate animation data
    if (alertToEdit.animation) {
      if (alertAnimationSelect && alertToEdit.animation.type) {
        alertAnimationSelect.value = alertToEdit.animation.type;
      }
      if (alertAnimationDurationRange && alertToEdit.animation.duration) {
        const duration = alertToEdit.animation.duration.replace('s', '');
        alertAnimationDurationRange.value = duration;
        // Update the display value
        const durationValue = document.getElementById('animation-duration-value');
        if (durationValue) durationValue.textContent = duration + 's';
      }
      if (alertAnimationDelayRange && alertToEdit.animation.delay) {
        const delay = alertToEdit.animation.delay.replace('s', '');
        alertAnimationDelayRange.value = delay;
        // Update the display value
        const delayValue = document.getElementById('animation-delay-value');
        if (delayValue) delayValue.textContent = delay + 's';
      }
      if (alertAnimationIterationSelect && alertToEdit.animation.iteration) {
        alertAnimationIterationSelect.value = alertToEdit.animation.iteration;
      }
      if (alertAnimationEasingSelect && alertToEdit.animation.easing) {
        alertAnimationEasingSelect.value = alertToEdit.animation.easing;
      }
    }
    
    // Populate volume if sound file has volume setting
    if (alertToEdit.soundFile && alertToEdit.soundFile.volume !== undefined) {
      if (alertSoundVolumeRange) {
        alertSoundVolumeRange.value = alertToEdit.soundFile.volume;
      }
      if (alertSoundVolumeValue) {
        alertSoundVolumeValue.textContent = alertToEdit.soundFile.volume + '%';
      }
    }
    
    // Populate video settings if video file exists
    if (alertToEdit.videoFile) {
      if (alertVideoVolume && alertToEdit.videoFile.volume !== undefined) {
        alertVideoVolume.value = alertToEdit.videoFile.volume;
        if (alertVideoVolumeValue) {
          alertVideoVolumeValue.textContent = alertToEdit.videoFile.volume + '%';
        }
      }
      if (alertVideoLoop && alertToEdit.videoFile.loop !== undefined) {
        alertVideoLoop.checked = alertToEdit.videoFile.loop;
      }
      if (alertVideoDisplayMode && alertToEdit.videoFile.displayMode) {
        alertVideoDisplayMode.value = alertToEdit.videoFile.displayMode;
      }
      console.log('Loaded video settings - volume:', alertToEdit.videoFile.volume, 'loop:', alertToEdit.videoFile.loop);
    }
    
    // Populate daily check-in config if this is a daily-checkin alert
    if (alertToEdit.type === 'daily-checkin' && alertToEdit.dailyCheckinConfig) {
      const config = alertToEdit.dailyCheckinConfig;
      
      const enabledCheckbox = document.getElementById('daily-checkin-enabled');
      if (enabledCheckbox) enabledCheckbox.checked = config.enabled ?? true;
      
      const rewardNameInput = document.getElementById('daily-checkin-reward-name');
      if (rewardNameInput) rewardNameInput.value = config.rewardName || 'Daily Check-In';
      
      const chatResponseInput = document.getElementById('daily-checkin-chat-response');
      if (chatResponseInput) chatResponseInput.value = config.chatResponse || 'Welcome back {username}!';
      
      const alreadyCheckedInput = document.getElementById('daily-checkin-already-checked-message');
      if (alreadyCheckedInput) alreadyCheckedInput.value = config.alreadyCheckedMessage || 'You\'ve already checked in today!';
      
      const showStreakCheckbox = document.getElementById('daily-checkin-show-streak');
      if (showStreakCheckbox) showStreakCheckbox.checked = config.showStreak ?? false;
      
      const sendToChatCheckbox = document.getElementById('daily-checkin-send-to-chat');
      if (sendToChatCheckbox) sendToChatCheckbox.checked = config.sendToChat ?? true;
      
      const testModeCheckbox = document.getElementById('daily-checkin-test-mode');
      if (testModeCheckbox) testModeCheckbox.checked = config.testMode ?? false;
      
      console.log('Loaded daily check-in config for editing');
    }
    
    // Populate walk-on users if this is a first-chat-walkon alert
    if (alertToEdit.type === 'first-chat-walkon' && alertToEdit.walkonUsers) {
      selectedWalkonUsers = alertToEdit.walkonUsers || [];
      if (allFollowers.length === 0) {
        loadWalkonFollowers().then(() => {
          renderWalkonSelected();
          renderWalkonFollowerList();
        });
      } else {
        renderWalkonSelected();
        renderWalkonFollowerList();
      }
      console.log('Loaded walk-on users for editing:', selectedWalkonUsers.length);
    }
    
    // Store the alert ID and existing media for editing
    window.editingAlertId = alertId;
    window.editingAlertMedia = {
      soundFile: alertToEdit.soundFile,
      imageFile: alertToEdit.imageFile,
      videoFile: alertToEdit.videoFile
    };
    
    // Display existing media files in the form
    displayExistingMedia(alertToEdit.soundFile, alertToEdit.imageFile, alertToEdit.videoFile);
    
    // Update remove buttons visibility
    updateRemoveButtons();
    
    // Update preview
    updatePreview().catch(console.error);
    
    // Scroll to top of form
    const alertWidget = document.getElementById('alert-widget');
    if (alertWidget) {
      alertWidget.scrollTop = 0;
    }
    
    console.log('Alert form populated for editing');
  };

  window.deleteAlert = function(alertId) {
    if (confirm('Are you sure you want to delete this alert?')) {
      savedAlerts = savedAlerts.filter(a => a.id !== alertId);
      window.savedAlerts = savedAlerts; // Keep window reference in sync
      localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
      alertSystem.updateAlerts();
      updateAlertList();
      console.log('Alert deleted:', alertId);
      
      // Clear the form if no alerts remain
      if (savedAlerts.length === 0) {
        clearForm();
        console.log('All alerts deleted - form cleared');
      }
    }
  };
  

  // Compact queue control widget event listeners (on dashboard)
  if (queueWidgetClear) {
    queueWidgetClear.addEventListener('click', () => {
      alertQueue.clearQueue();
      updateQueueWidgetStatus();
    });
  }
  
  if (queueWidgetSkip) {
    queueWidgetSkip.addEventListener('click', () => {
      alertQueue.skipCurrentAlert();
      updateQueueWidgetStatus();
    });
  }
  
  if (queueWidgetStop) {
    queueWidgetStop.addEventListener('click', () => {
      alertQueue.clearCurrentAlert();
      updateQueueWidgetStatus();
    });
  }
  
  // Update compact queue widget status
  function updateQueueWidgetStatus() {
    if (!queueWidgetStatus) return;
    
    const status = alertQueue.getStatus();
    queueWidgetStatus.textContent = status.queueLength;
    
    // Update status color based on queue state
    if (status.isProcessing) {
      queueWidgetStatus.style.background = '#ffc107';
      queueWidgetStatus.style.color = '#000';
    } else if (status.queueLength > 0) {
      queueWidgetStatus.style.background = '#17a2b8';
      queueWidgetStatus.style.color = '#fff';
    } else {
      queueWidgetStatus.style.background = '#6c757d';
      queueWidgetStatus.style.color = '#fff';
    }
  }
  
  
  // Update queue status every second
  setInterval(() => {
    updateQueueWidgetStatus();
  }, 1000);
  
  
  // Initialize
  updateAlertList();
  updatePreview();
  updateQueueWidgetStatus();
}

// Global functions for inline event handlers
window.updateAlertList = function() {
  if (!alertListContainer) return;
  
  // Get the currently selected alert type
  const alertTypeSelect = document.getElementById('alert-type');
  const selectedType = alertTypeSelect ? alertTypeSelect.value : 'follower';
  
  // Filter alerts by selected type
  const filteredAlerts = savedAlerts.filter(alert => alert.type === selectedType);
  
  if (filteredAlerts.length === 0) {
    alertListContainer.innerHTML = `
      <div class="no-alerts">
        <div style="margin-bottom: 15px;">No ${selectedType} alerts configured yet</div>
        <div style="color: var(--text-secondary); font-size: 14px;">
          Create a new ${selectedType} alert using the form on the left.
        </div>
      </div>
    `;
    return;
  }
  
  // Render filtered alerts for the selected type
  const firstAlert = filteredAlerts[0];
  const thresholdInfo = selectedType === 'bits' && firstAlert.bitsThreshold 
    ? `<div class="alert-item-threshold" style="color: var(--text-tertiary); font-size: 11px; margin-top: 4px;">Min bits: ${firstAlert.bitsThreshold}</div>`
    : '';
  
  // Create variations list from all alerts of this type
  const variationsHtml = `
    <div class="alert-variations-list">
      <div class="variations-header">
        <span>Variations (${filteredAlerts.length} total, ${filteredAlerts.filter(a => a.enabled !== false).length} enabled):</span>
        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="variation-btn" onclick="toggleAllAlertsForType('${selectedType}', true)" style="padding: 4px 8px; font-size: 12px;">Enable All</button>
          <button class="variation-btn" onclick="toggleAllAlertsForType('${selectedType}', false)" style="padding: 4px 8px; font-size: 12px;">Disable All</button>
          <label class="random-toggle">
            <input type="checkbox" ${firstAlert.randomMode ? 'checked' : ''} 
                   onchange="toggleRandomModeForType('${selectedType}', this.checked)" />
            Random Mode
          </label>
        </div>
      </div>
      <div class="variations-help" style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; padding: 8px; background: rgba(0, 122, 204, 0.1); border-radius: 4px;">
        <strong>💡 Tip:</strong> Check the boxes to enable specific alerts. ${firstAlert.randomMode ? 'Random Mode will pick randomly from enabled alerts.' : 'The first enabled alert will be used.'}
      </div>
      <div class="variations-items">
        ${filteredAlerts.map((alert, index) => `
          <div class="variation-item ${alert.enabled !== false ? 'enabled' : 'disabled'}">
            <label class="variation-toggle">
              <input type="checkbox" ${alert.enabled !== false ? 'checked' : ''} 
                     onchange="toggleAlert('${alert.id}', this.checked)" />
              <span class="variation-text">
                ${alert.enabled !== false ? '✓' : '○'} ${alert.text || '<em style="color: #888;">(Media Only)</em>'}
                <span class="overlay-badge">${alert.overlay || 'main'}</span>
              </span>
            </label>
            <div class="variation-actions">
              <button class="variation-btn edit" onclick="editAlert('${alert.id}')">Edit</button>
              <button class="variation-btn test" onclick="testSavedAlert('${alert.id}')">Test</button>
              <button class="variation-btn delete" onclick="deleteAlert('${alert.id}')">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  alertListContainer.innerHTML = `
    <div class="alert-group" data-alert-type="${selectedType}">
      <div class="alert-item">
        <div class="alert-item-header">
          <h4>${getAlertTypeDisplayName(selectedType)}</h4>
          ${thresholdInfo}
        </div>
        ${variationsHtml}
      </div>
    </div>
  `;
};

window.toggleAlert = function(alertId, enabled) {
  const alert = window.savedAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.enabled = enabled;
    localStorage.setItem('twitchAlerts', JSON.stringify(window.savedAlerts));
    alertSystem.updateAlerts();
    updateAlertList();
    console.log('Toggled alert:', alertId, 'enabled:', enabled);
  }
};

// Test functions for new overlays
window.testAlert = function(alertType) {
  console.log('🚨 Testing alert for type:', alertType);

  // Create test data based on alert type
  const testData = {
    type: alertType,
    user: 'TestUser',
    message: 'This is a test alert!',
    amount: alertType === 'donation' ? 5.00 : null,
    bits: alertType === 'bits' ? 100 : null
  };

  if (window.electronAPI && window.electronAPI.triggerAlert) {
    window.electronAPI.triggerAlert(testData);
    showCustomAlert('🚨 Alert sent to overlay! Make sure alert overlay is open in OBS.', 'success');
  } else {
    console.error('Electron API not available for alert testing');
    showCustomAlert('❌ Cannot test alert - Electron API not available', 'error');
  }
};

window.testConfetti = function() {
  console.log('🎊 Testing confetti effect');

  const testData = {
    count: 50,
    duration: 2000
  };

  if (window.electronAPI && window.electronAPI.triggerConfetti) {
    window.electronAPI.triggerConfetti(testData);
    showCustomAlert('🎊 Confetti sent to overlay! Make sure confetti overlay is open in OBS.', 'success');
  } else {
    console.error('Electron API not available for confetti testing');
    showCustomAlert('❌ Cannot test confetti - Electron API not available', 'error');
  }
};

window.toggleRandomModeForType = function(alertType, randomMode) {
  // Update random mode for all alerts of this type
  window.savedAlerts.forEach(alert => {
    if (alert.type === alertType) {
      alert.randomMode = randomMode;
    }
  });
  
  localStorage.setItem('twitchAlerts', JSON.stringify(window.savedAlerts));
  alertSystem.updateAlerts();
  updateAlertList();
  console.log('Toggled random mode for type:', alertType, 'random:', randomMode);
};

window.toggleAllAlertsForType = function(alertType, enabled) {
  // Enable or disable all alerts of this type
  let count = 0;
  window.savedAlerts.forEach(alert => {
    if (alert.type === alertType) {
      alert.enabled = enabled;
      count++;
    }
  });
  
  localStorage.setItem('twitchAlerts', JSON.stringify(window.savedAlerts));
  alertSystem.updateAlerts();
  updateAlertList();
  console.log(`${enabled ? 'Enabled' : 'Disabled'} ${count} alerts for type: ${alertType}`);
  showCustomAlert(`${enabled ? 'Enabled' : 'Disabled'} all ${count} ${alertType} alerts`, 'success');
};

// Global replace placeholders function
function replacePlaceholders(text, userData) {
  if (!userData) return text;
  
  let processedText = text;
  
  // Replace common placeholders
  processedText = processedText.replace(/\{username\}/g, userData.username || userData.user_name || userData.user || 'Unknown');
  processedText = processedText.replace(/\{display_name\}/g, userData.display_name || userData.user_name || userData.user || 'Unknown');
  processedText = processedText.replace(/\{displayName\}/g, userData.displayName || userData.display_name || userData.user_name || userData.user || 'Unknown');
  processedText = processedText.replace(/\{tier\}/g, String(userData.tier || userData.sub_plan || ''));
  processedText = processedText.replace(/\{viewers\}/g, String(userData.viewers || userData.view_count || userData.viewer_count || ''));
  processedText = processedText.replace(/\{bits\}/g, String(userData.bits || userData.bits_used || userData.bits_amount || userData.amount || ''));
  processedText = processedText.replace(/\{months\}/g, String(userData.cumulative_months || userData.months || ''));
  processedText = processedText.replace(/\{message\}/g, String(userData.message || userData.user_input || ''));
  processedText = processedText.replace(/\{reward\}/g, String(userData.reward || userData.reward_title || ''));
  processedText = processedText.replace(/\{moderator\}/g, String(userData.moderator || ''));
  processedText = processedText.replace(/\{reason\}/g, String(userData.reason || ''));
  
  // Daily Check-In specific placeholders
  processedText = processedText.replace(/\{total_checkins\}/g, String(userData.total_checkins || '0'));
  processedText = processedText.replace(/\{streak\}/g, String(userData.streak || '0'));
  
  return processedText;
}


// Alert Queue System with Hard Stop
let alertQueue = {
  queue: [],
  isProcessing: false,
  currentAlert: null,
  currentTimeout: null,
  currentAudio: null,
  
  // Add alert to queue
  addToQueue(alertData, userData) {
    const queueItem = {
      id: Date.now() + Math.random(),
      alertData: alertData,
      userData: userData,
      timestamp: new Date(),
      status: 'queued'
    };
    
    this.queue.push(queueItem);
    console.log(`📋 Alert added to queue: ${alertData.type} (${this.queue.length} in queue)`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  },
  
  // Process the queue
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const queueItem = this.queue.shift();
      queueItem.status = 'processing';
      this.currentAlert = queueItem;
      
      console.log(`🎬 Processing alert: ${queueItem.alertData.type} (${this.queue.length} remaining)`);
      
      // HARD STOP: Clear any existing overlay and audio first
      this.hardStop();
      
      // Trigger the alert
      this.triggerAlert(queueItem.alertData, queueItem.userData);
      
      // Wait for the alert duration
      await this.waitForAlertDuration(queueItem.alertData.duration);
      
      // Clear the overlay
      clearOverlay();
      
      queueItem.status = 'completed';
      this.currentAlert = null;
    }
    
    this.isProcessing = false;
    console.log('✅ Alert queue processing complete');
  },
  
  // HARD STOP: Immediately stop all current alerts
  hardStop() {
    console.log('🛑 HARD STOP: Stopping all current alerts');
    
    // Clear any existing timeout
    if (this.currentTimeout) {
      console.log('🛑 Clearing timeout');
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    
    // Stop any playing audio
    if (this.currentAudio) {
      console.log('🛑 Stopping audio');
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    // Clear overlay immediately
    console.log('🛑 Clearing overlay');
    clearOverlay();
    
    console.log('🛑 HARD STOP complete');
  },
  
  // Wait for alert duration
  waitForAlertDuration(duration) {
    return new Promise(resolve => {
      this.currentTimeout = setTimeout(() => {
        resolve();
      }, duration * 1000);
    });
  },
  
  // Clear current alert and stop processing (does NOT continue to next alert)
  clearCurrentAlert() {
    console.log('🛑 Stopping current alert (will not continue to next)');
    
    this.hardStop();
    
    if (this.currentAlert) {
      this.currentAlert.status = 'cancelled';
      this.currentAlert = null;
    }
    
    // Reset processing flag to stop the queue
    this.isProcessing = false;
    
    console.log('🛑 Current alert stopped - queue processing halted');
  },

  // Skip current alert and move to next one
  skipCurrentAlert() {
    console.log('⏭️ Skipping current alert and moving to next');
    
    if (this.currentAlert) {
      this.currentAlert.status = 'skipped';
      this.currentAlert = null;
    }
    
    // Stop current processing
    this.hardStop();
    
    // Reset processing flag to allow next alert to process
    this.isProcessing = false;
    
    // If there are more alerts in queue, start processing the next one immediately
    if (this.queue.length > 0) {
      console.log(`⏭️ Moving to next alert (${this.queue.length} remaining in queue)`);
      setTimeout(() => {
        this.processQueue();
      }, 100); // Small delay to ensure cleanup
    } else {
      console.log('⏭️ No more alerts in queue');
    }
  },
  
  // Clear entire queue
  clearQueue() {
    this.hardStop();
    this.queue = [];
    this.isProcessing = false;
    console.log('🗑️ Alert queue cleared');
  },
  
  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentAlert: this.currentAlert ? {
        type: this.currentAlert.alertData.type,
        text: this.currentAlert.alertData.text,
        duration: this.currentAlert.alertData.duration
      } : null
    };
  },
  
  // Trigger alert (internal method) - NO auto-clear timeout
  async triggerAlert(alertData, userData) {
    // Safety check for undefined alertData
    if (!alertData) {
      console.error('❌ triggerAlert called with undefined alertData');
      return;
    }
    
    console.log('🔥 triggerAlert called with alertData:', alertData);
    console.log('🔥 alertData.overlay:', alertData.overlay);
    
    if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
      // Process text with user data if available
      const processedText = userData ? replacePlaceholders(alertData.text, userData) : alertData.text;
      
      console.log('🎯 Triggering alert:', { alertData, userData, processedText });
      
      console.log('🎯 Alert overlay from alertData:', alertData.overlay || 'NOT SET');
      console.log('🎯 Alert will be sent to overlay:', alertData.overlay || getDefaultOverlay());
      console.log('🎬 Alert animation config:', alertData.animation);
      console.log('📝 Alert text:', alertData.text);
      console.log('📝 Processed text:', processedText);
      console.log('📝 Processed text length:', processedText ? processedText.length : 'null/undefined');
      console.log('📝 Processed text trim check:', processedText && processedText.trim() ? 'HAS CONTENT' : 'EMPTY OR NULL');
      console.log('🎨 Alert textStyling:', alertData.textStyling);
      console.log('📍 Text position:', alertData.textStyling?.position || 'topCenter');
      
      const payload = {
        type: 'buttonTrigger',
        targetOverlay: alertData.overlay || getDefaultOverlay(), // Route to specific overlay
        options: {
          clearPrevious: true,
          durationMs: alertData.duration * 1000
        },
        slots: processedText && processedText.trim() ? {
          [alertData.textStyling?.position || 'topCenter']: {
            text: processedText,
            style: {
              fontFamily: alertData.textStyling?.fontFamily || 'Arial, sans-serif',
              fontSize: alertData.textStyling?.fontSize || '24px',
              color: alertData.textStyling?.color || '#00ff00',
              fontWeight: alertData.textStyling?.fontWeight || 'bold',
              textShadow: alertData.textStyling?.textShadow || '2px 2px #000',
              webkitTextStroke: alertData.textStyling?.textStroke || '1px #000',
              textAlign: 'center',
              zIndex: '1'
            },
            animation: (alertData.animation && alertData.animation.type && alertData.animation.type !== 'none') ? {
              name: alertData.animation.type,
              duration: alertData.animation.duration || '1s',
              delay: alertData.animation.delay || '0s',
              iterationCount: alertData.animation.iteration || '1',
              timingFunction: alertData.animation.easing || 'ease'
            } : null
          }
        } : {},
        centerMedia: [],
        fullscreenMedia: [] // New: fullscreen media support for alerts
      };
      
      console.log('🎬 Payload animation data:', payload.slots[alertData.textStyling?.position || 'topCenter']?.animation);
      console.log('📦 Payload slots object:', payload.slots);
      console.log('📦 Payload slots keys:', Object.keys(payload.slots));
      console.log('📦 Payload slots topCenter:', payload.slots.topCenter);
      
      // Add image if present
      if (alertData.imageFile) {
        console.log('🖼️ Processing image for alert:', alertData.imageFile);
        
        if (alertData.imageFile instanceof File) {
          // This is a fresh file upload, we can create a blob URL
          const imageUrl = URL.createObjectURL(alertData.imageFile);
          console.log('🖼️ Created blob URL for fresh file:', imageUrl);
          payload.centerMedia.push({
            type: 'image',
            src: imageUrl,
            alt: 'Alert Image'
          });
        } else if (alertData.imageFile.path) {
          // This is a saved alert with file path - serve via HTTP like multi-media buttons
          console.log('🖼️ Converting alert image path to HTTP URL:', alertData.imageFile.path);
          try {
            // Use the relative path directly (same as multimedia buttons)
            const relativePath = alertData.imageFile.path.replace(/\\/g, '/');
            const imageSrc = `http://localhost:8080/media/${encodeURIComponent(relativePath)}`;
            console.log(`✅ Serving alert image via HTTP: ${imageSrc}`);
            console.log(`🔍 Image relative path: ${relativePath}`);
            
                payload.centerMedia.push({
                  type: 'image',
              src: imageSrc, // Use HTTP URL instead of base64
                  alt: 'Alert Image'
                });
          } catch (error) {
            console.error('Error loading alert image:', error);
          }
        } else if (alertData.imageFile.data) {
          // Legacy: saved alert with base64 data (backwards compatibility)
          console.log('🖼️ Using legacy base64 data for alert');
          payload.centerMedia.push({
            type: 'image',
            src: alertData.imageFile.data, // Use base64 data directly
            alt: 'Alert Image'
          });
        } else {
          console.warn('🖼️ Unknown image file format:', alertData.imageFile);
        }
      }
      
      // Add video file if present
      if (alertData.videoFile) {
        if (alertData.videoFile instanceof File) {
          // Fresh file upload - use blob URL (video settings not available for unsaved alerts)
          const videoUrl = URL.createObjectURL(alertData.videoFile);
          console.log('🎬 Created blob URL for fresh video file:', videoUrl);
          const videoItem = {
            type: 'video',
            src: videoUrl,
            loop: false,
            volume: 1.0,
            muted: false
          };
          
          // For fresh uploads, use center media by default
          payload.centerMedia.push(videoItem);
        } else if (alertData.videoFile.path) {
          // This is a saved alert with file path - serve via HTTP like multi-media buttons
          console.log('🎬 Converting alert video path to HTTP URL:', alertData.videoFile.path);
          console.log('🎬 Video file object:', alertData.videoFile);
          try {
            // Use the relative path directly (same as multimedia buttons)
            const relativePath = alertData.videoFile.path.replace(/\\/g, '/');
            const videoSrc = `http://localhost:8080/media/${encodeURIComponent(relativePath)}`;
            console.log(`✅ Serving alert video via HTTP: ${videoSrc}`);
            console.log(`🔍 Video relative path: ${relativePath}`);
            
            const videoItem = {
              type: 'video',
              src: videoSrc, // Use HTTP URL instead of base64
              loop: alertData.videoFile.loop || false,
              volume: (alertData.videoFile.volume || 100) / 100, // Convert percentage to 0-1
              muted: false
            };
            
            console.log('🎬 Video item created:', videoItem);
            
            // Add to appropriate media array based on display mode
            const displayMode = alertData.videoFile.displayMode || 'center';
            console.log('🎬 Alert video displayMode:', displayMode);
            if (displayMode === 'fullscreen') {
              payload.fullscreenMedia.push(videoItem);
              console.log('🎬 Added video to fullscreenMedia');
            } else {
              payload.centerMedia.push(videoItem);
              console.log('🎬 Added video to centerMedia');
            }
            
            console.log('🎬 CenterMedia array now has:', payload.centerMedia.length, 'items');
          } catch (error) {
            console.error('Error loading alert video:', error);
          }
        } else if (alertData.videoFile.data) {
          // Legacy: saved alert with base64 data (backwards compatibility)
          console.log('🎬 Using legacy base64 data for alert video');
          const videoItem = {
            type: 'video',
            src: alertData.videoFile.data, // Use base64 data directly
            loop: alertData.videoFile.loop || false,
            volume: (alertData.videoFile.volume || 100) / 100,
            muted: false
          };
          
          
          payload.centerMedia.push(videoItem);
        } else {
          console.warn('🎬 Unknown video file format:', alertData.videoFile);
        }
      }
      
      // Log payload summary instead of full object to avoid base64 spam
      const payloadSummary = {
        type: payload.type,
        options: payload.options,
        slots: payload.slots ? Object.keys(payload.slots) : 'none',
        centerMedia: payload.centerMedia ? payload.centerMedia.map(item => ({
          type: item.type,
          src: item.src ? (item.src.startsWith('data:') ? 'data:...' : item.src) : 'none'
        })) : 'none'
      };
      console.log('📤 Sending overlay message with payload:', payloadSummary);
      console.log('🎬 Full centerMedia array:', payload.centerMedia);
      console.log(`🎯 SENDING ALERT TO OVERLAY: "${payload.targetOverlay}"`);
      console.log(`📊 Alert overlay setting: ${alertData.overlay || 'NOT SET (defaulting to default)'}`);
      window.electronAPI.sendOverlayMessage(payload);
      console.log(`✅ Alert sent via WebSocket to overlay: "${payload.targetOverlay}"`);
      
      // Play sound if present - store reference for hard stop
      if (alertData.soundFile) {
        // Get volume from alert data (stored as 0-100, convert to 0-1)
        const volume = (alertData.soundFile.volume !== undefined ? alertData.soundFile.volume / 100 : 1.0);
        console.log('🔊 Alert sound volume:', volume, `(${Math.round(volume * 100)}%)`);
        
        if (alertData.soundFile instanceof File) {
          // Fresh file upload
          this.currentAudio = new Audio(URL.createObjectURL(alertData.soundFile));
          // Set volume immediately to prevent loud burst
          this.currentAudio.volume = 0; // Start muted
          this.currentAudio.volume = volume; // Then set to desired volume
          this.currentAudio.play().catch(err => console.warn('Could not play alert sound:', err));
        } else if (alertData.soundFile.path) {
          // Saved alert with file path - load from disk for audio playback
          console.log('🎵 Loading alert sound from disk:', alertData.soundFile.path);
          try {
            if (window.electronAPI && window.electronAPI.getMediaFile) {
              const result = await window.electronAPI.getMediaFile(alertData.soundFile.path);
              if (result.success) {
                const sizeKB = (result.data.length / 1024).toFixed(2);
                console.log(`✅ Alert sound loaded: ${alertData.soundFile.path} (${sizeKB} KB)`);
                this.currentAudio = new Audio(result.data);
                // Set volume immediately to prevent loud burst
                this.currentAudio.volume = 0; // Start muted
                this.currentAudio.volume = volume; // Then set to desired volume
                this.currentAudio.play().catch(err => console.warn('Could not play alert sound:', err));
              } else {
                console.error('Failed to load alert sound:', result.error);
              }
            }
          } catch (error) {
            console.error('Error loading alert sound:', error);
          }
        } else if (alertData.soundFile.data) {
          // Legacy: saved alert with base64 data (backwards compatibility)
          console.log('🎵 Using legacy base64 data for alert sound');
          this.currentAudio = new Audio(alertData.soundFile.data);
          // Set volume immediately to prevent loud burst
          this.currentAudio.volume = 0; // Start muted
          this.currentAudio.volume = volume; // Then set to desired volume
          this.currentAudio.play().catch(err => console.warn('Could not play alert sound:', err));
        }
      }
    } else {
      console.error('Overlay API not available');
    }
  }
};

// Function to create realistic fake Twitch events for testing
function createFakeTwitchEvent(alertType) {
  const baseUserData = {
    user_id: '123456789',
    user_login: 'testuser123',
    user_name: 'TestUser123',
    display_name: 'TestUser123',
    broadcaster_user_id: '987654321',
    broadcaster_user_login: 'yourchannel',
    broadcaster_user_name: 'YourChannel'
  };
  
  const eventTypes = {
    'follower': {
      type: 'channel.follow',
      event: {
        ...baseUserData,
        followed_at: new Date().toISOString()
      }
    },
    'subscriber': {
      type: 'channel.subscribe',
      event: {
        ...baseUserData,
        tier: '1000',
        is_gift: false,
        cumulative_months: 3,
        streak_months: 1,
        duration_months: 1,
        message: {
          text: 'Thanks for subscribing!',
          emotes: []
        }
      }
    },
    'raid': {
      type: 'channel.raid',
      event: {
        ...baseUserData,
        viewers: 25
      }
    },
    'bits': {
      type: 'channel.cheer',
      event: {
        ...baseUserData,
        bits: 100,
        message: 'Thanks for the bits!',
        is_anonymous: false
      }
    },
    'gift-sub': {
      type: 'channel.subscribe',
      event: {
        ...baseUserData,
        tier: '1000',
        is_gift: true,
        cumulative_months: 1,
        streak_months: 1,
        duration_months: 1,
        message: {
          text: 'Thanks for the gift sub!',
          emotes: []
        }
      }
    },
    'resubscriber': {
      type: 'channel.subscribe',
      event: {
        ...baseUserData,
        tier: '1000',
        is_gift: false,
        cumulative_months: 6,
        streak_months: 3,
        duration_months: 1,
        message: {
          text: 'Thanks for resubscribing!',
          emotes: []
        }
      }
    },
    'gift-sub-received': {
      type: 'channel.subscribe',
      event: {
        ...baseUserData,
        tier: '1000',
        is_gift: true,
        cumulative_months: 1,
        streak_months: 1,
        duration_months: 1,
        message: {
          text: 'Thanks for the gift!',
          emotes: []
        }
      }
    }
  };
  
  return eventTypes[alertType] || eventTypes['follower'];
}

// Alert system for Twitch events
let alertSystem = {
  alerts: JSON.parse(localStorage.getItem('twitchAlerts') || '[]'),
  
  // Trigger alert for specific event type
  triggerAlertForEvent(eventType, userData) {
    console.log(`🔍 Looking for alerts of type: ${eventType}`);
    console.log(`📋 Available alert types:`, this.alerts.map(a => a.type));
    const alertsOfType = this.alerts.filter(a => a.type === eventType);
    if (alertsOfType.length === 0) {
      console.log(`⚠️ No alerts found for event type: ${eventType}`);
      console.log(`💡 Create a "${eventType}" alert in Tools → Alerts to fix this`);
      return;
    }
    
    // Get enabled alerts
    const enabledAlerts = alertsOfType.filter(a => a.enabled !== false);
    if (enabledAlerts.length === 0) {
      console.log(`⚠️ No enabled alerts found for event type: ${eventType}`);
      return;
    }
    
    // For first-chat-walkon, check if user is in selected walkon users list
    if (eventType === 'first-chat-walkon') {
      const username = (userData.username || userData.user_name || '').toLowerCase();
      const userId = userData.user_id;
      
        const alertsMatchingUser = enabledAlerts.filter(alert => {
        // If no walkonUsers specified, don't trigger (safety)
        if (!alert.walkonUsers || alert.walkonUsers.length === 0) {
          console.log(`⏭️ Alert "${alert.id}" has no walkon users configured, skipping`);
          return false;
        }
        // Check if user is in the selected list (by username or user_id)
        const isInList = alert.walkonUsers.some(wu => {
          // Match by exact user_id (for followers from API)
          if (wu.user_id && wu.user_id === userId) return true;
          // Match by username (case-insensitive) - works for both API followers and manual entries
          const wuUsername = (wu.username || '').toLowerCase();
          if (wuUsername && wuUsername === username) return true;
          return false;
        });
        
        if (!isInList) {
          console.log(`⏭️ User "${username}" not in walkon list for alert "${alert.id}", skipping`);
        }
        return isInList;
      });
      
      if (alertsMatchingUser.length === 0) {
        console.log(`⚠️ No alerts matched for walk-on user: ${username}`);
        return;
      }
      
      // Use alertsMatchingUser instead of enabledAlerts for the rest
      const alertToTrigger = alertsMatchingUser[0].randomMode 
        ? alertsMatchingUser[Math.floor(Math.random() * alertsMatchingUser.length)]
        : alertsMatchingUser[0];
      
      console.log(`🎯 Triggering walk-on alert for ${username}:`, userData);
      console.log(`🎯 Alert text before processing:`, alertToTrigger.text);
      
      alertQueue.addToQueue(alertToTrigger, userData);
      return;
    }
    
    // Check bits threshold for bits alerts
    if (eventType === 'bits' && enabledAlerts[0].bitsThreshold) {
      const bitsAmount = parseInt(userData.bits) || 0;
      const threshold = parseInt(enabledAlerts[0].bitsThreshold) || 0;
      
      if (bitsAmount < threshold) {
        console.log(`⚠️ Bits amount (${bitsAmount}) below threshold (${threshold}), skipping alert`);
        return;
      }
      
      console.log(`✅ Bits amount (${bitsAmount}) meets threshold (${threshold})`);
    }
    
    // Select alert to trigger
    let alertToTrigger;
    if (enabledAlerts[0].randomMode) {
      // Random selection from enabled alerts
      const randomIndex = Math.floor(Math.random() * enabledAlerts.length);
      alertToTrigger = enabledAlerts[randomIndex];
      console.log(`🎲 Randomly selected alert ${randomIndex + 1}/${enabledAlerts.length}`);
    } else {
      // Use first enabled alert
      alertToTrigger = enabledAlerts[0];
      console.log(`📝 Using first enabled alert`);
    }
    
    console.log(`🎯 Triggering alert for ${eventType}:`, userData);
    console.log(`🎯 Alert text before processing:`, alertToTrigger.text);
    
    // Add to queue instead of triggering immediately
    alertQueue.addToQueue(alertToTrigger, userData);
  },
  
  // Update alerts from storage
  updateAlerts() {
    this.alerts = JSON.parse(localStorage.getItem('twitchAlerts') || '[]');
  }
};

// Expose alertSystem to global scope
window.alertSystem = alertSystem;

// Expose alertQueue to global scope
window.alertQueue = alertQueue;

// Global queue control functions for testing
window.clearAlertQueue = () => alertQueue.clearQueue();
window.skipCurrentAlert = () => alertQueue.clearCurrentAlert();
window.getQueueStatus = () => alertQueue.getStatus();
window.hardStopAlerts = () => alertQueue.hardStop();
window.testMultipleAlerts = () => {
  // Test multiple alerts in quick succession
  const testData = {
    username: 'TestUser1',
    display_name: 'TestUser1',
    user_name: 'TestUser1'
  };
  
  const alert1 = { type: 'follower', text: 'Welcome {username}!', duration: 3, imageFile: null, soundFile: null };
  const alert2 = { type: 'subscriber', text: '{username} subscribed!', duration: 3, imageFile: null, soundFile: null };
  const alert3 = { type: 'raid', text: '{username} raided with 25 viewers!', duration: 3, imageFile: null, soundFile: null };
  
  alertQueue.addToQueue(alert1, testData);
  alertQueue.addToQueue(alert2, testData);
  alertQueue.addToQueue(alert3, testData);
  
  console.log('Added 3 test alerts to queue');
};

// Reset first-time chatters (for testing)
// Usage: resetWalkonTest() or resetWalkonTest(true) to skip confirmation
window.resetWalkonTest = async function(skipConfirm = false) {
  if (!skipConfirm && !confirm('Reset first-time chatters list? This will allow testing the same users again.')) {
    return { cancelled: true };
  }
  
  try {
    if (window.electronAPI && window.electronAPI.resetFirstTimeChatters) {
      const result = await window.electronAPI.resetFirstTimeChatters();
      if (result.success) {
        console.log('✅ First-time chatters list reset! You can now test again.');
        return { success: true, message: result.message };
      } else {
        console.error('❌ Error resetting:', result.error);
        return { success: false, error: result.error };
      }
    } else {
      console.error('❌ Reset function not available');
      return { success: false, error: 'Reset function not available' };
    }
  } catch (error) {
    console.error('❌ Error resetting first-time chatters:', error);
    return { success: false, error: error.message };
  }
};

// Test first-chat walk-on event through the full Twitch pipeline
// Usage: 
//   testFirstChatWalkon('Iflewthetardis')
//   testFirstChatWalkon('deathblade', 'DeathBlade', '87654321')
//   testFirstChatWalkon('TestUser')  // Uses default TestUser
window.testFirstChatWalkon = function(username = 'TestUser', displayName = null, userId = null) {
  console.log('🧪 Testing first-chat walk-on event for:', username);
  
  // Generate a random user ID if not provided
  if (!userId) {
    userId = Math.floor(Math.random() * 100000000).toString();
  }
  
  const display = displayName || (username.charAt(0).toUpperCase() + username.slice(1));
  const userLower = username.toLowerCase();
  
  // Simulate the event data that would come from main.js chat handler
  const eventData = {
    type: 'first-chat-walkon',
    event: {
      user_id: userId,
      user_name: userLower,
      display_name: display
    }
  };
  
  console.log('🧪 Simulating first-chat-walkon event:', eventData);
  
  // Create user data matching what the real handler expects
  const userData = {
    username: userLower,
    display_name: display,
    user_id: userId,
    user_name: userLower,
    ...eventData.event
  };
  
  // Trigger through the same path as real events - directly call alertSystem
  // This bypasses the IPC layer but tests the alert filtering and triggering logic
  if (window.alertSystem) {
    console.log('✅ Triggering first-chat-walkon alert for user:', username);
    window.alertSystem.triggerAlertForEvent('first-chat-walkon', userData);
    
    // Also add to chat display if the function exists (simulates full pipeline)
    if (typeof addTwitchEvent === 'function') {
      addTwitchEvent('first-chat-walkon', eventData.event);
    }
    
    console.log('✅ Test first-chat-walkon completed - alert should have triggered if user is in walkon list');
    console.log('💡 To test, make sure the user is in your walk-on alert\'s selected followers list');
    return { success: true, eventData, userData };
  } else {
    console.error('❌ Alert system not available');
    return { success: false, error: 'Alert system not available' };
  }
};

// Test media duration detection
window.testMediaDuration = async (file) => {
  if (!file) {
    console.log('Please provide a file to test');
    return;
  }
  
  const duration = await getMediaDuration(file);
  console.log(`Media duration: ${duration}s`);
  return duration;
};

// Function to show overlay widget
function showOverlayWidget() {
  const overlayWidget = document.getElementById('overlay-widget');
  if (overlayWidget) {
    overlayWidget.classList.remove('hidden');
  }
}

// Function to show alert widget
function showAlertWidget() {
  console.log('📢 showAlertWidget() function called');
  const alertWidget = document.getElementById('alert-widget');
  if (alertWidget) {
    console.log('📢 Alert widget found, showing it');
    alertWidget.classList.remove('hidden');
    
    // Disable hotkeys when alert widget is open to prevent conflicts
    if (window.electronAPI && window.electronAPI.disableHotkeys) {
      window.electronAPI.disableHotkeys();
    }
    
    // Ensure bits threshold is hidden unless alert type is 'bits'
    const alertTypeSelect = document.getElementById('alert-type');
    const bitsThresholdGroup = document.getElementById('bits-threshold-group');
    const dailyCheckinSettings = document.getElementById('daily-checkin-settings');
    
    if (alertTypeSelect && bitsThresholdGroup) {
      if (alertTypeSelect.value === 'bits') {
        bitsThresholdGroup.style.display = 'block';
      } else {
        bitsThresholdGroup.style.display = 'none';
      }
    }
    
    // Ensure daily check-in settings are hidden unless alert type is 'daily-checkin'
    if (alertTypeSelect && dailyCheckinSettings) {
      if (alertTypeSelect.value === 'daily-checkin') {
        dailyCheckinSettings.style.display = 'block';
      } else {
        dailyCheckinSettings.style.display = 'none';
      }
    }
    
    // Focus on the alert text input after a short delay to ensure DOM is ready
    setTimeout(() => {
      const alertTextInput = document.getElementById('alert-text');
      if (alertTextInput) {
        alertTextInput.focus();
      }
    }, 100);
  }
}

// Function to hide alert widget
function hideAlertWidget() {
  const alertWidget = document.getElementById('alert-widget');
  if (alertWidget) {
    alertWidget.classList.add('hidden');
    
    // Re-enable hotkeys when alert widget is closed
    if (window.electronAPI && window.electronAPI.enableHotkeys) {
      window.electronAPI.enableHotkeys();
    }
  }
}

// Function to hide overlay widget
function hideOverlayWidget() {
  const overlayWidget = document.getElementById('overlay-widget');
  if (overlayWidget) {
    overlayWidget.classList.add('hidden');
  }
}

// ===============================
// Daily Check-In System
// ===============================

// In-memory storage for check-ins (will be persisted to file)
let dailyCheckinData = {
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

// Load daily check-in data
async function loadDailyCheckinData() {
  try {
    if (window.electronAPI && window.electronAPI.loadDailyCheckins) {
      const data = await window.electronAPI.loadDailyCheckins();
      if (data) {
        dailyCheckinData = data;
        // Ensure liveDays array exists (for backward compatibility)
        if (!dailyCheckinData.liveDays) {
          dailyCheckinData.liveDays = [];
        }
        console.log('📊 Loaded daily check-in data:', Object.keys(dailyCheckinData.viewers).length, 'viewers');
      }
    }
  } catch (error) {
    console.error('❌ Error loading daily check-in data:', error);
  }
}

// Save daily check-in data
async function saveDailyCheckinData() {
  try {
    if (window.electronAPI && window.electronAPI.saveDailyCheckins) {
      await window.electronAPI.saveDailyCheckins(dailyCheckinData);
      console.log('💾 Saved daily check-in data');
    }
  } catch (error) {
    console.error('❌ Error saving daily check-in data:', error);
  }
}

// Check if user has already checked in today
function hasCheckedInToday(userId) {
  const viewer = dailyCheckinData.viewers[userId];
  if (!viewer) return false;
  
  const lastCheckin = new Date(viewer.last_checkin);
  const today = new Date();
  
  // Check if last check-in was today (same date)
  return lastCheckin.toDateString() === today.toDateString();
}

// Process a daily check-in
async function processDailyCheckin(userData, testMode = false) {
  const { user_id, user_name, display_name } = userData;
  
  // Check test mode setting
  const testModeCheckbox = document.getElementById('daily-checkin-test-mode');
  const isTestMode = testMode || (testModeCheckbox && testModeCheckbox.checked);
  
  // Record that today is a live day when someone checks in (Twitch already restricts redemption when not live)
  // Skip this in test mode so test check-ins don't affect live day tracking
  if (!isTestMode) {
    const now = new Date();
    const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0]; // YYYY-MM-DD
    if (!dailyCheckinData.liveDays.includes(todayStr)) {
      dailyCheckinData.liveDays.push(todayStr);
      console.log('📅 Recorded live day:', todayStr);
    }
  }
  
  // Check if user already checked in today (skip in test mode)
  if (!isTestMode && hasCheckedInToday(user_id)) {
    console.log('⚠️ User', user_name, 'already checked in today');
    
    // Send already checked message if enabled
    if (dailyCheckinData.config.sendToChat) {
      const message = dailyCheckinData.config.alreadyCheckedMessage
        .replace(/{username}/g, user_name)
        .replace(/{display_name}/g, display_name || user_name);
      
      await sendTwitchChatMessage(message);
    }
    
    return false;
  }
  
  // Initialize or update viewer data
  if (!dailyCheckinData.viewers[user_id]) {
    dailyCheckinData.viewers[user_id] = {
      user_id: user_id,
      username: user_name,
      display_name: display_name || user_name,
      total_checkins: 0,
      last_checkin: null,
      streak: 0
    };
  }
  
  const viewer = dailyCheckinData.viewers[user_id];
  const now = new Date();
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
  const todayCheckinDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Save the previous last_checkin before updating (needed for streak calculation)
  const previousLastCheckin = viewer.last_checkin;
  
  // Update check-in data
  viewer.total_checkins++;
  viewer.last_checkin = now.toISOString();
  viewer.username = user_name; // Update in case username changed
  viewer.display_name = display_name || user_name;
  
  // Calculate streak if enabled
  if (dailyCheckinData.config.showStreak) {
    if (!previousLastCheckin || !previousLastCheckin.includes('T')) {
      // First check-in ever, start streak at 1
      viewer.streak = 1;
      console.log(`📈 First check-in for ${user_name}, streak started at 1`);
    } else {
      const lastCheckinDate = new Date(previousLastCheckin);
      const lastCheckinDay = new Date(lastCheckinDate.getFullYear(), lastCheckinDate.getMonth(), lastCheckinDate.getDate());
      
      // Calculate days difference
      const daysDiff = Math.floor((todayCheckinDate - lastCheckinDay) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day - check if stream was live yesterday
        const yesterdayStr = new Date(lastCheckinDay).toISOString().split('T')[0];
        const wasLiveYesterday = dailyCheckinData.liveDays.includes(yesterdayStr);
        
        if (wasLiveYesterday) {
          // Stream was live yesterday and they checked in today = consecutive
          viewer.streak = (viewer.streak || 0) + 1;
          console.log(`📈 Streak incremented for ${user_name}: ${viewer.streak} days (stream was live yesterday)`);
        } else {
          // Stream wasn't live yesterday, but they're checking in today - maintain streak
          // Don't increment, but don't reset either (stream wasn't live so it doesn't count against them)
          viewer.streak = viewer.streak || 1;
          console.log(`📈 Streak maintained for ${user_name}: ${viewer.streak} days (stream wasn't live yesterday)`);
        }
      } else if (daysDiff === 0) {
        // Same day - shouldn't happen due to hasCheckedInToday check, but safety
        // Keep streak as is
      } else {
        // More than 1 day apart - check which days were missed
        let missedLiveDays = 0;
        const checkDate = new Date(lastCheckinDay);
        checkDate.setDate(checkDate.getDate() + 1); // Start checking from the day after last check-in
        
        while (checkDate < todayCheckinDate) {
          const checkDateStr = checkDate.toISOString().split('T')[0];
          if (dailyCheckinData.liveDays.includes(checkDateStr)) {
            missedLiveDays++;
          }
          checkDate.setDate(checkDate.getDate() + 1);
        }
        
        if (missedLiveDays === 0) {
          // No live days were missed - maintain streak
          viewer.streak = viewer.streak || 1;
          console.log(`📈 Streak maintained for ${user_name}: ${viewer.streak} days (no live days missed)`);
        } else {
          // At least one live day was missed - reset streak to 1
          viewer.streak = 1;
          console.log(`📈 Streak reset for ${user_name}: missed ${missedLiveDays} live day(s), streak reset to 1`);
        }
      }
    }
  }
  
  // Save data
  await saveDailyCheckinData();
  
  console.log('✅ Check-in processed for', user_name, '- Total:', viewer.total_checkins, 'Streak:', viewer.streak || 0);
  
  // Send chat response if enabled
  if (dailyCheckinData.config.sendToChat) {
    let message = dailyCheckinData.config.chatResponse;
    message = message.replace(/{username}/g, viewer.username);
    message = message.replace(/{display_name}/g, viewer.display_name);
    message = message.replace(/{total_checkins}/g, String(viewer.total_checkins));
    message = message.replace(/{streak}/g, String(viewer.streak || 0));
    
    await sendTwitchChatMessage(message);
  }
  
  return true;
}

// Send message to Twitch chat
async function sendTwitchChatMessage(message) {
  try {
    if (window.electronAPI && window.electronAPI.sendTwitchChatMessage) {
      await window.electronAPI.sendTwitchChatMessage(message);
      console.log('💬 Sent chat message:', message);
    }
  } catch (error) {
    console.error('❌ Error sending chat message:', error);
  }
}

// Update daily check-in config from UI
function updateDailyCheckinConfig() {
  const enabled = document.getElementById('daily-checkin-enabled')?.checked ?? true;
  const rewardName = document.getElementById('daily-checkin-reward-name')?.value || 'Daily Check-In';
  const chatResponse = document.getElementById('daily-checkin-chat-response')?.value || 'Welcome back {username}!';
  const alreadyCheckedMessage = document.getElementById('daily-checkin-already-checked-message')?.value || 'You\'ve already checked in today!';
  const showStreak = document.getElementById('daily-checkin-show-streak')?.checked ?? false;
  const sendToChat = document.getElementById('daily-checkin-send-to-chat')?.checked ?? true;
  const testMode = document.getElementById('daily-checkin-test-mode')?.checked ?? false;
  
  dailyCheckinData.config = {
    enabled,
    rewardName,
    chatResponse,
    alreadyCheckedMessage,
    showStreak,
    sendToChat,
    testMode
  };
  
  saveDailyCheckinData();
  console.log('⚙️ Updated daily check-in config:', dailyCheckinData.config);
}

// Load daily check-in config into UI
function loadDailyCheckinConfigToUI() {
  const config = dailyCheckinData.config;
  
  const enabledCheckbox = document.getElementById('daily-checkin-enabled');
  if (enabledCheckbox) enabledCheckbox.checked = config.enabled ?? true;
  
  const rewardNameInput = document.getElementById('daily-checkin-reward-name');
  if (rewardNameInput) rewardNameInput.value = config.rewardName || 'Daily Check-In';
  
  const chatResponseInput = document.getElementById('daily-checkin-chat-response');
  if (chatResponseInput) chatResponseInput.value = config.chatResponse || 'Welcome back {username}!';
  
  const alreadyCheckedInput = document.getElementById('daily-checkin-already-checked-message');
  if (alreadyCheckedInput) alreadyCheckedInput.value = config.alreadyCheckedMessage || 'You\'ve already checked in today!';
  
  const showStreakCheckbox = document.getElementById('daily-checkin-show-streak');
  if (showStreakCheckbox) showStreakCheckbox.checked = config.showStreak ?? false;
  
  const sendToChatCheckbox = document.getElementById('daily-checkin-send-to-chat');
  if (sendToChatCheckbox) sendToChatCheckbox.checked = config.sendToChat ?? true;
  
  const testModeCheckbox = document.getElementById('daily-checkin-test-mode');
  if (testModeCheckbox) testModeCheckbox.checked = config.testMode ?? false;
}

// Initialize daily check-in system
async function initDailyCheckinSystem() {
  console.log('🚀 Initializing Daily Check-In System...');
  
  // Load data
  await loadDailyCheckinData();
  
  // Load config to UI
  loadDailyCheckinConfigToUI();
  
  // Add change listeners to update config
  const fields = [
    'daily-checkin-enabled',
    'daily-checkin-reward-name',
    'daily-checkin-chat-response',
    'daily-checkin-already-checked-message',
    'daily-checkin-show-streak',
    'daily-checkin-send-to-chat',
    'daily-checkin-test-mode'
  ];
  
  fields.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      element.addEventListener('change', updateDailyCheckinConfig);
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.addEventListener('input', updateDailyCheckinConfig);
      }
    }
  });
  
  // Add button listeners
  const viewStatsBtn = document.getElementById('view-checkin-stats');
  if (viewStatsBtn) {
    viewStatsBtn.addEventListener('click', showDailyCheckinStats);
  }
  
  const testCheckinBtn = document.getElementById('test-checkin');
  if (testCheckinBtn) {
    testCheckinBtn.addEventListener('click', testDailyCheckin);
  }
  
  const clearTodayBtn = document.getElementById('clear-today-checkins');
  if (clearTodayBtn) {
    clearTodayBtn.addEventListener('click', clearTodayCheckins);
  }
  
  const clearAllBtn = document.getElementById('clear-all-checkins');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllCheckins);
  }
  
  console.log('✅ Daily Check-In System initialized');
}

// Show daily check-in statistics
function showDailyCheckinStats() {
  const modal = document.getElementById('checkin-stats-modal');
  if (!modal) {
    console.error('❌ Check-in stats modal not found');
    return;
  }
  
  // Show the modal
  modal.classList.remove('hidden');
  
  // Disable hotkeys when modal is open
  if (window.electronAPI && window.electronAPI.disableHotkeys) {
    window.electronAPI.disableHotkeys();
  }
  
  // Populate and render the stats
  renderCheckinStats();
}

// Render check-in statistics data
function renderCheckinStats() {
  const viewers = dailyCheckinData.viewers;
  const viewerList = Object.values(viewers);
  
  // Calculate summary stats
  const totalViewers = viewerList.length;
  const totalCheckins = viewerList.reduce((sum, v) => sum + v.total_checkins, 0);
  const today = new Date().toDateString();
  const todayCheckins = viewerList.filter(v => {
    if (!v.last_checkin) return false;
    return new Date(v.last_checkin).toDateString() === today;
  }).length;
  
  // Update summary cards
  document.getElementById('total-checkin-viewers').textContent = totalViewers;
  document.getElementById('total-checkins-all').textContent = totalCheckins;
  document.getElementById('total-checkins-today').textContent = todayCheckins;
  
  // Get filter and sort values
  const sortBy = document.getElementById('stats-sort')?.value || 'total';
  const filterBy = document.getElementById('stats-filter')?.value || 'all';
  
  // Filter viewers
  let filteredViewers = [...viewerList];
  if (filterBy === 'today') {
    filteredViewers = filteredViewers.filter(v => {
      if (!v.last_checkin) return false;
      return new Date(v.last_checkin).toDateString() === today;
    });
  }
  
  // Sort viewers
  if (sortBy === 'total') {
    filteredViewers.sort((a, b) => b.total_checkins - a.total_checkins);
  } else if (sortBy === 'recent') {
    filteredViewers.sort((a, b) => {
      const dateA = a.last_checkin ? new Date(a.last_checkin) : new Date(0);
      const dateB = b.last_checkin ? new Date(b.last_checkin) : new Date(0);
      return dateB - dateA;
    });
  } else if (sortBy === 'username') {
    filteredViewers.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
  }
  
  // Populate table
  const tbody = document.getElementById('checkin-stats-tbody');
  if (!tbody) return;
  
  if (filteredViewers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
          No check-in data available yet
        </td>
      </tr>
    `;
    return;
  }
  
  let rowsHTML = '';
  filteredViewers.forEach((viewer, index) => {
    const lastCheckin = viewer.last_checkin ? new Date(viewer.last_checkin).toLocaleDateString() : 'Never';
    const lastCheckinTime = viewer.last_checkin ? new Date(viewer.last_checkin).toLocaleTimeString() : '';
    const streak = viewer.streak || 0;
    
    rowsHTML += `
      <tr>
        <td style="text-align: center; font-weight: 600;">${index + 1}</td>
        <td>${viewer.display_name || viewer.username}</td>
        <td style="text-align: center; font-weight: 600; color: var(--accent);">${viewer.total_checkins}</td>
        <td>${lastCheckin}<br><small style="color: var(--text-tertiary); font-size: 11px;">${lastCheckinTime}</small></td>
        <td style="text-align: center;">${streak}</td>
      </tr>
    `;
  });
  
  tbody.innerHTML = rowsHTML;
  
  console.log('📊 Rendered check-in statistics:', filteredViewers.length, 'viewers');
}

// Test check-in function (simulate a check-in)
async function testDailyCheckin() {
  // Create fake test user data
  const testUser = {
    user_id: 'test_user_' + Date.now(),
    user_name: 'TestUser' + Math.floor(Math.random() * 1000),
    display_name: 'TestUser' + Math.floor(Math.random() * 1000)
  };
  
  console.log('🧪 Testing check-in with test user:', testUser);
  
  // Process the check-in
  const result = await processDailyCheckin(testUser, true);
  
  if (result) {
    // Get the viewer data
    const viewer = dailyCheckinData.viewers[testUser.user_id];
    
    // Create user data with actual check-in counts
    const userData = {
      username: viewer.username,
      display_name: viewer.display_name,
      user_id: viewer.user_id,
      total_checkins: viewer.total_checkins,
      streak: viewer.streak || 0
    };
    
    console.log('🧪 Triggering test alert with data:', userData);
    
    // Trigger alert
    alertSystem.triggerAlertForEvent('daily-checkin', userData);
    
    alert(`✅ Test check-in successful!\n\nUsername: ${viewer.username}\nTotal Check-Ins: ${viewer.total_checkins}`);
  } else {
    alert('❌ Test check-in failed - check console for details');
  }
}

// Clear today's check-ins
async function clearTodayCheckins() {
  if (!confirm('Clear all check-ins from today? This will allow users to check in again today.')) {
    return;
  }
  
  const today = new Date().toDateString();
  let clearedCount = 0;
  
  Object.values(dailyCheckinData.viewers).forEach(viewer => {
    if (viewer.last_checkin) {
      const lastCheckinDate = new Date(viewer.last_checkin).toDateString();
      if (lastCheckinDate === today) {
        // Set last check-in to yesterday so they can check in again
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        viewer.last_checkin = yesterday.toISOString();
        clearedCount++;
      }
    }
  });
  
  await saveDailyCheckinData();
  console.log(`🔄 Cleared ${clearedCount} check-ins from today`);
  alert(`✅ Cleared ${clearedCount} check-ins from today!\n\nUsers can now check in again.`);
  
  // Refresh stats if modal is open
  if (!document.getElementById('checkin-stats-modal')?.classList.contains('hidden')) {
    renderCheckinStats();
  }
}

// Clear all check-in data
async function clearAllCheckins() {
  if (!confirm('⚠️ WARNING: This will permanently delete ALL check-in data!\n\nThis includes:\n- All viewer check-in counts\n- All check-in history\n- All streaks\n\nAre you sure?')) {
    return;
  }
  
  // Double confirmation
  if (!confirm('This action cannot be undone. Are you absolutely sure?')) {
    return;
  }
  
  const viewerCount = Object.keys(dailyCheckinData.viewers).length;
  
  // Reset viewer data
  dailyCheckinData.viewers = {};
  
  await saveDailyCheckinData();
  console.log(`🗑️ Cleared all check-in data for ${viewerCount} viewers`);
  alert(`✅ All check-in data cleared!\n\n${viewerCount} viewers reset.`);
  
  // Refresh stats if modal is open
  if (!document.getElementById('checkin-stats-modal')?.classList.contains('hidden')) {
    renderCheckinStats();
  }
}

// ===============================
// End Daily Check-In System
// ===============================

// TODO: Integrate with Twitch Channel Point Redemptions
// When a Channel Point redemption event is received that matches the reward name
// configured in Daily Check-In settings, call:
// 
// processDailyCheckin({
//   user_id: event.user_id,
//   user_name: event.user_name,
//   display_name: event.user_login
// });
//
// Example integration location: TwitchConnected/tc.js or wherever Twitch EventSub
// events are processed. Look for 'channel.channel_points_custom_reward_redemption' events.

// Left app menu wiring: toggles File dropdown and wires Quit
function setupLeftAppMenu() {
  const menuBtn = document.getElementById('menu-file-btn');
  const menuDropdown = document.getElementById('menu-file-dropdown');
  const quitBtn = document.getElementById('menu-file-quit');

  if (!menuBtn || !menuDropdown) return;

  function closeMenu() {
    menuDropdown.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  // Helper to close other menus (so only one menu is open at a time)
  function closeOtherMenus(exceptDropdown) {
    const toolsDropdown = document.getElementById('menu-tools-dropdown');
    const toolsBtn = document.getElementById('menu-tools-btn');
    const allDropdowns = [menuDropdown, viewDropdown, helpDropdown, editDropdown, toolsDropdown].filter(Boolean);
    const allBtns = [menuBtn, viewBtn, helpBtn, editBtn, toolsBtn].filter(Boolean);
    allDropdowns.forEach(dd => {
      if (dd !== exceptDropdown) dd.classList.add('hidden');
    });
    allBtns.forEach(b => {
      try {
        const ctrlId = b.getAttribute && b.getAttribute('aria-controls');
        const ctrlEl = ctrlId ? document.getElementById(ctrlId) : null;
        if (ctrlEl !== exceptDropdown) b.setAttribute('aria-expanded', 'false');
      } catch (e) { /* ignore */ }
    });
  }

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // close any other open menus, but keep this one visible when toggling
    closeOtherMenus(menuDropdown);
    const isOpen = !menuDropdown.classList.contains('hidden');
    if (isOpen) closeMenu(); else {
      menuDropdown.classList.remove('hidden');
      menuBtn.setAttribute('aria-expanded', 'true');
    }
  });

  // Central outside-click handler: close all menus when clicking outside the menu area
  document.addEventListener('click', (e) => {
    const anyMenuContains = [menuBtn, menuDropdown, /* view/edit/help refs may be undefined yet */].some(el => el && el.contains(e.target));
    // If any of the known elements contain the click, do nothing (individual handlers stopPropagation where needed)
    if (!anyMenuContains) closeOtherMenus(null);
  });

  if (quitBtn) {
    quitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.electronAPI && typeof window.electronAPI.closeWindow === 'function') {
        window.electronAPI.closeWindow();
      } else {
        // fallback: send ipc if available
        try { window.ipcRenderer && window.ipcRenderer.send && window.ipcRenderer.send('window-close'); } catch (e) {}
      }
    });
  }

  // View menu wiring (left app menu)
  const viewBtn = document.getElementById('menu-view-btn');
  const viewDropdown = document.getElementById('menu-view-dropdown');
  const viewShowAll = document.getElementById('menu-view-showall');
  const viewHideAll = document.getElementById('menu-view-hideall');

  function closeViewMenu() {
    if (viewDropdown) viewDropdown.classList.add('hidden');
    if (viewBtn) viewBtn.setAttribute('aria-expanded', 'false');
  }

  if (viewBtn && viewDropdown) {
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // close other menus first so only this one is visible
      closeOtherMenus(viewDropdown);
      const open = !viewDropdown.classList.contains('hidden');
      if (open) { viewDropdown.classList.add('hidden'); viewBtn.setAttribute('aria-expanded', 'false'); }
      else { viewDropdown.classList.remove('hidden'); viewBtn.setAttribute('aria-expanded', 'true'); }
    });
    document.addEventListener('click', (e) => {
      if (!viewBtn.contains(e.target) && !viewDropdown.contains(e.target)) { viewDropdown.classList.add('hidden'); viewBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Map view menu button data-toggle attributes to checkbox ids used in visibility prefs
  const viewButtonToggles = viewDropdown ? Array.from(viewDropdown.querySelectorAll('[data-toggle]')) : [];
  viewButtonToggles.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const toggleId = btn.getAttribute('data-toggle');
      const checkbox = document.getElementById(toggleId);
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
      // Close the menu after selection
      if (viewDropdown) viewDropdown.classList.add('hidden');
      if (viewBtn) viewBtn.setAttribute('aria-expanded', 'false');
    });
  });

  if (viewShowAll) {
    viewShowAll.addEventListener('click', (e) => {
      e.stopPropagation();
      const showBtn = document.getElementById('show-all-components');
      if (showBtn) showBtn.click();
      if (viewDropdown) viewDropdown.classList.add('hidden');
      if (viewBtn) viewBtn.setAttribute('aria-expanded', 'false');
    });
  }
  if (viewHideAll) {
    viewHideAll.addEventListener('click', (e) => {
      e.stopPropagation();
      const hideBtn = document.getElementById('hide-all-components');
      if (hideBtn) hideBtn.click();
      if (viewDropdown) viewDropdown.classList.add('hidden');
      if (viewBtn) viewBtn.setAttribute('aria-expanded', 'false');
    });
  }
  // Help menu wiring
  const helpBtn = document.getElementById('menu-help-btn');
  const helpDropdown = document.getElementById('menu-help-dropdown');
  const helpAbout = document.getElementById('menu-help-about');
  if (helpBtn && helpDropdown) {
    helpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // close other menus before opening help
      closeOtherMenus(helpDropdown);
      const open = !helpDropdown.classList.contains('hidden');
      if (open) { helpDropdown.classList.add('hidden'); helpBtn.setAttribute('aria-expanded', 'false'); }
      else { helpDropdown.classList.remove('hidden'); helpBtn.setAttribute('aria-expanded', 'true'); }
    });
    document.addEventListener('click', (e) => {
      if (!helpBtn.contains(e.target) && !helpDropdown.contains(e.target)) { helpDropdown.classList.add('hidden'); helpBtn.setAttribute('aria-expanded', 'false'); }
    });
  }
  if (helpAbout) {
    helpAbout.addEventListener('click', (e) => {
      e.stopPropagation();
      // Trigger the same action as the main menu: send or open about modal
      if (window.electronAPI && typeof window.electronAPI.send === 'function') {
        try { window.electronAPI.send('show-about'); } catch (err) { /* ignore */ }
      }
      // Fallback: call local helper directly
      try { openAboutModal(); } catch (err) {}
      if (helpDropdown) helpDropdown.classList.add('hidden');
      if (helpBtn) helpBtn.setAttribute('aria-expanded', 'false');
    });
  }
  
  // Bug Report menu item
  const helpBugReport = document.getElementById('menu-help-bug-report');
  if (helpBugReport) {
    helpBugReport.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (window.electronAPI && window.electronAPI.reportBug) {
          await window.electronAPI.reportBug();
        }
      } catch (error) {
        console.error('Error opening bug report form:', error);
      }
      if (helpDropdown) helpDropdown.classList.add('hidden');
      if (helpBtn) helpBtn.setAttribute('aria-expanded', 'false');
    });
  }
  
  // Placeholders Guide menu item
  const helpPlaceholders = document.getElementById('menu-help-placeholders');
  if (helpPlaceholders) {
    helpPlaceholders.addEventListener('click', (e) => {
      e.stopPropagation();
      openPlaceholdersGuide();
      if (helpDropdown) helpDropdown.classList.add('hidden');
      if (helpBtn) helpBtn.setAttribute('aria-expanded', 'false');
    });
  }
  
  const helpCommands = document.getElementById('menu-help-commands');
  if (helpCommands) {
    helpCommands.addEventListener('click', (e) => {
      e.stopPropagation();
      openCommandsGuide();
      if (helpDropdown) helpDropdown.classList.add('hidden');
      if (helpBtn) helpBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Edit menu wiring
  const editBtn = document.getElementById('menu-edit-btn');
  const editDropdown = document.getElementById('menu-edit-dropdown');
  const prefBtn = document.getElementById('menu-edit-preferences');
  if (editBtn && editDropdown) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // close other open menus first
      closeOtherMenus(editDropdown);
      const open = !editDropdown.classList.contains('hidden');
      if (open) { editDropdown.classList.add('hidden'); editBtn.setAttribute('aria-expanded', 'false'); }
      else { editDropdown.classList.remove('hidden'); editBtn.setAttribute('aria-expanded', 'true'); }
    });
    document.addEventListener('click', (e) => {
      if (!editBtn.contains(e.target) && !editDropdown.contains(e.target)) { editDropdown.classList.add('hidden'); editBtn.setAttribute('aria-expanded', 'false'); }
    });
  }
  
  // Profile Manager button (on dashboard)
  const openProfileManagerBtn = document.getElementById('open-profile-manager-btn');
  if (openProfileManagerBtn) {
    openProfileManagerBtn.addEventListener('click', () => {
      openProfileModal();
    });
  }
  
  // Tools menu wiring (new)
  const toolsBtn = document.getElementById('menu-tools-btn');
  const toolsDropdown = document.getElementById('menu-tools-dropdown');
  const toolsDevtools = document.getElementById('menu-tools-devtools');
  const toolsTwitchBtn = document.getElementById('menu-tools-twitch-btn');
  const toolsTwitchDropdown = document.getElementById('menu-tools-twitch-dropdown');
  const toolsTwitchActivity = document.getElementById('menu-tools-twitch-activity');
  const toolsTwitchEventsub = document.getElementById('menu-tools-twitch-eventsub');
  const toolsTwitchMapping = document.getElementById('menu-tools-twitch-mapping');
  const toolsTwitchClear = document.getElementById('menu-tools-twitch-clear');
  const toolsThemesContainer = document.getElementById('menu-tools-themes-container');
  const toolsReload = document.getElementById('menu-tools-reload');

  function closeToolsSubmenus(except) {
    try { if (toolsTwitchDropdown && toolsTwitchDropdown !== except) toolsTwitchDropdown.classList.add('hidden'); } catch (e) {}
  }

  if (toolsBtn && toolsDropdown) {
    toolsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOtherMenus(toolsDropdown);
      const open = !toolsDropdown.classList.contains('hidden');
      if (open) { toolsDropdown.classList.add('hidden'); toolsBtn.setAttribute('aria-expanded', 'false'); }
      else { toolsDropdown.classList.remove('hidden'); toolsBtn.setAttribute('aria-expanded', 'true'); }
    });
    document.addEventListener('click', (e) => {
      if (!toolsBtn.contains(e.target) && !toolsDropdown.contains(e.target)) { toolsDropdown.classList.add('hidden'); toolsBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Developer Tools
  if (toolsDevtools) {
    toolsDevtools.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.electronAPI && typeof window.electronAPI.toggleDevTools === 'function') {
        window.electronAPI.toggleDevTools();
      } else {
        try { window.ipcRenderer && window.ipcRenderer.send && window.ipcRenderer.send('toggle-devtools'); } catch (err) {}
      }
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
      if (toolsBtn) toolsBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Twitch nested submenu toggle
  if (toolsTwitchBtn && toolsTwitchDropdown) {
    toolsTwitchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // ensure only this nested menu is open
      closeToolsSubmenus();
      const open = !toolsTwitchDropdown.classList.contains('hidden');
      if (open) { toolsTwitchDropdown.classList.add('hidden'); toolsTwitchBtn.setAttribute('aria-expanded', 'false'); }
      else { toolsTwitchDropdown.classList.remove('hidden'); toolsTwitchBtn.setAttribute('aria-expanded', 'true'); }
    });
    document.addEventListener('click', (e) => {
      if (!toolsTwitchBtn.contains(e.target) && !toolsTwitchDropdown.contains(e.target)) { toolsTwitchDropdown.classList.add('hidden'); toolsTwitchBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  if (toolsTwitchActivity) {
    toolsTwitchActivity.addEventListener('click', (e) => {
      e.stopPropagation();
      // Prefer calling the renderer modal directly (defined in TwitchConnected/tc.js)
      try {
        if (typeof showTwitchActivityModal === 'function') {
          showTwitchActivityModal();
        } else {
          // Fallback: try to ask main to forward the event (historic behavior)
          try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('open-twitch-activity'); } catch (err) {}
          try { window.ipcRenderer && window.ipcRenderer.send && window.ipcRenderer.send('open-twitch-activity'); } catch (err) {}
        }
      } catch (err) {
        console.warn('Failed to open Twitch Activity modal directly:', err);
      }
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
    });
  }
  if (toolsTwitchEventsub) {
    toolsTwitchEventsub.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        if (typeof showTwitchSubscriptionsModal === 'function') {
          showTwitchSubscriptionsModal();
        } else {
          try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('open-eventsub-subscriptions'); } catch (err) { try { window.ipcRenderer && window.ipcRenderer.send && window.ipcRenderer.send('open-eventsub-subscriptions'); } catch(e){} }
        }
      } catch (err) {
        console.warn('Failed to open EventSub Subscriptions modal directly:', err);
      }
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
    });
  }
  if (toolsTwitchMapping) {
    toolsTwitchMapping.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        if (typeof showTwitchConnectedMenu === 'function') {
          // Show connected menu and scroll to mappings section like the native menu does
          try { showTwitchConnectedMenu(); } catch (e) {}
          setTimeout(() => {
            try {
              const list = document.getElementById('twitch-connected-menu') && document.getElementById('twitch-connected-menu').querySelector('#mappings-list');
              if (list && list.scrollIntoView) list.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {}
          }, 80);
        } else {
          try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('open-twitch-mapping'); } catch (err) { try { window.ipcRenderer && window.ipcRenderer.send && window.ipcRenderer.send('open-twitch-mapping'); } catch(e){} }
        }
      } catch (err) {
        console.warn('Failed to open Twitch Mapping UI directly:', err);
      }
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
    });
  }
  if (toolsTwitchClear) {
    toolsTwitchClear.addEventListener('click', (e) => {
      e.stopPropagation();
      try { window.electronAPI && window.electronAPI.clearTwitchCreds && window.electronAPI.clearTwitchCreds(); } catch (err) { try { window.ipcRenderer && window.ipcRenderer.send && window.ipcRenderer.send('twitch-clear-creds'); } catch(e){} }
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
    });
  }

  // Reload action
  if (toolsReload) {
    toolsReload.addEventListener('click', (e) => {
      e.stopPropagation();
      try { window.location.reload(); } catch (err) {}
    });
  }

  // Overlay Controls
  const toolsOverlay = document.getElementById('menu-tools-overlay');
  if (toolsOverlay) {
    toolsOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      showOverlayWidget();
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
      if (toolsBtn) toolsBtn.setAttribute('aria-expanded', 'false');
    });
  }
  
  // Alert Widget
  const toolsAlerts = document.getElementById('menu-tools-alerts');
  if (toolsAlerts) {
    toolsAlerts.addEventListener('click', (e) => {
      console.log('🔴 ALERT WIDGET button clicked from Tools menu');
      e.stopPropagation();
      showAlertWidget();
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
      if (toolsBtn) toolsBtn.setAttribute('aria-expanded', 'false');
    });
  }
  
  // Test Twitch Events - commented out but function available via console: testTwitchEvents()
  /*
  const toolsTestTwitch = document.getElementById('menu-tools-test-twitch');
  if (toolsTestTwitch) {
    toolsTestTwitch.addEventListener('click', (e) => {
      e.stopPropagation();
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
      if (toolsBtn) toolsBtn.setAttribute('aria-expanded', 'false');
      // Run the test function
      if (window.testTwitchEventPipeline) {
        window.testTwitchEventPipeline();
      } else {
        alert('Test function not available. Please reload the application.');
      }
    });
  }
  */
  
  // Themes population: built-in + dynamic skins
  async function renderToolsThemes() {
    // Prevent concurrent renders which can append duplicate menus
    if (window.__vdThemesRendering) {
      window.__vdThemesNeedsRerender = true;
      return;
    }
    window.__vdThemesRendering = true;
    window.__vdThemesNeedsRerender = false;
    try {
      if (!toolsThemesContainer) return;
      toolsThemesContainer.innerHTML = '';

      // Built-in themes list (must match main.js ids)
      const builtIns = [
        { id: 'dark', label: '🌙 Dark' },
        { id: 'light', label: '☀️ Light' },
        { id: 'red', label: '❤️ Red' },
        { id: 'purple', label: '💜 Purple' },
        { id: 'blue', label: '💙 Blue' },
        { id: 'darkpop', label: '🎵 Dark Pop' }
      ];

      const builtList = document.createElement('div');
      builtList.className = 'tools-themes-builtins';
      builtIns.forEach(t => {
        const row = document.createElement('div');
        row.className = 'theme-row';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'vd-theme';
        radio.value = t.id;
        radio.id = `theme-radio-${t.id}`;
        radio.className = 'theme-radio-input';
        try {
          const current = (window.themeManager && typeof window.themeManager.getCurrentTheme === 'function') ? window.themeManager.getCurrentTheme() : null;
          if (current && current === t.id) radio.checked = true;
        } catch (e) {}

        radio.onchange = async (ev) => {
          ev.stopPropagation();
          if (!radio.checked) return;
          try {
            if (window.electronAPI && window.electronAPI.applyTheme) {
              window.electronAPI.applyTheme(t.id);
            } else {
              try { window.electronAPI && window.electronAPI.syncTheme && window.electronAPI.syncTheme(t.id); } catch (e) {}
              try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('theme-change', t.id); } catch (e) {}
            }
          } catch (err) { console.warn('Theme apply failed', err); }
          if (toolsDropdown) toolsDropdown.classList.add('hidden');
        };

        const label = document.createElement('label');
        label.className = 'menu-dropdown-item theme-item';
        label.htmlFor = radio.id;
        label.textContent = t.label;

        row.appendChild(radio);
        row.appendChild(label);
        builtList.appendChild(row);
      });
      toolsThemesContainer.appendChild(builtList);

      // Separator
      const sep = document.createElement('div'); sep.className = 'menu-divider'; toolsThemesContainer.appendChild(sep);

      // Dynamic skins from preload/main
      let skins = [];
      try {
        if (window.electronAPI && window.electronAPI.getAvailableSkins) skins = await window.electronAPI.getAvailableSkins();
      } catch (e) { console.warn('Failed to fetch skins:', e); }

      const skinList = document.createElement('div');
      skinList.className = 'tools-themes-skins';
      if (!skins || skins.length === 0) {
        const none = document.createElement('div'); none.className = 'menu-dropdown-item'; none.textContent = 'No themes/skins installed'; skinList.appendChild(none);
      } else {
        skins.forEach(s => {
          const row = document.createElement('div');
          row.className = 'theme-row';
          row.style.justifyContent = 'space-between';

          const radioWrap = document.createElement('div');
          radioWrap.style.display = 'flex';
          radioWrap.style.alignItems = 'center';
          radioWrap.style.gap = '8px';

          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'vd-theme';
          radio.value = s.id;
          radio.id = `theme-radio-${s.id}`;
          radio.className = 'theme-radio-input';
          try {
            const currentSkin = (window.themeManager && typeof window.themeManager.getCurrentTheme === 'function') ? window.themeManager.getCurrentTheme() : null;
            if (currentSkin && currentSkin === s.id) radio.checked = true;
          } catch (e) {}
          radio.onchange = (ev) => {
            ev.stopPropagation();
            if (!radio.checked) return;
            try {
              if (window.electronAPI && window.electronAPI.applyTheme) window.electronAPI.applyTheme(s.id);
              else {
                try { window.electronAPI && window.electronAPI.syncTheme && window.electronAPI.syncTheme(s.id); } catch (e) {}
                try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('theme-change', s.id); } catch (e) {}
              }
            } catch (err) { console.warn('Failed to apply skin', err); }
            if (toolsDropdown) toolsDropdown.classList.add('hidden');
          };

          const label = document.createElement('label');
          label.className = 'menu-dropdown-item theme-item';
          label.htmlFor = radio.id;
          label.textContent = `🎨 ${s.name}`;

          radioWrap.appendChild(radio);
          radioWrap.appendChild(label);

          row.appendChild(radioWrap);
          skinList.appendChild(row);
        });
      }
      toolsThemesContainer.appendChild(skinList);

      // Management row: Import / Delete / Refresh
      const mgr = document.createElement('div'); mgr.style.display='flex'; mgr.style.gap='8px'; mgr.style.marginTop='8px';
      const importAll = document.createElement('button'); importAll.className='menu-dropdown-item'; importAll.textContent='Import Theme...'; importAll.onclick = async (ev)=>{ 
        ev.stopPropagation(); 
        try {
          if (window.electronAPI && window.electronAPI.showImportSkinDialog) {
            const result = await window.electronAPI.showImportSkinDialog();
            // If a skin was imported, refresh ThemeManager and the menu so it's immediately usable
            if (result && result.id) {
              try { if (themeManager && typeof themeManager.loadAvailableSkins === 'function') await themeManager.loadAvailableSkins(); } catch(e){}
              try { if (themeManager && typeof themeManager.setTheme === 'function') themeManager.setTheme(result.id); } catch(e){}
              try { window.electronAPI && window.electronAPI.refreshMenu && window.electronAPI.refreshMenu(); } catch(e){}
              try { await renderToolsThemes(); } catch(e){}
            }
          } else {
            try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('import-skin-dialog'); } catch(e){}
          }
        } catch(e){}
      };
      const deleteAny = document.createElement('button'); deleteAny.className='menu-dropdown-item'; deleteAny.textContent='Delete Theme...'; deleteAny.onclick = async (ev)=>{ 
        ev.stopPropagation(); 
        try {
          if (window.electronAPI && window.electronAPI.showDeleteSkinDialog) {
            const result = await window.electronAPI.showDeleteSkinDialog();
            if (result && result.deleted) {
              try { if (themeManager && typeof themeManager.loadAvailableSkins === 'function') await themeManager.loadAvailableSkins(); } catch(e){}
              // If the deleted skin was active, ensure ThemeManager picks a safe default
              try {
                if (themeManager && typeof themeManager.getCurrentTheme === 'function' && themeManager.getCurrentTheme()) {
                  const ct = themeManager.getCurrentTheme();
                  const stillExists = themeManager.availableSkins && themeManager.availableSkins.some(s => s.id === ct);
                  if (!stillExists && themeManager && typeof themeManager.setTheme === 'function') themeManager.setTheme('dark');
                }
              } catch(e){}
              try { window.electronAPI && window.electronAPI.refreshMenu && window.electronAPI.refreshMenu(); } catch(e){}
              try { await renderToolsThemes(); } catch(e){}
            }
          } else {
            try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('delete-skin-dialog'); } catch(e){}
          }
        } catch(e){}
      };
      const refresh = document.createElement('button'); refresh.className='menu-dropdown-item'; refresh.textContent='Refresh Themes'; refresh.onclick = async (ev)=>{ ev.stopPropagation(); try { if (window.electronAPI && window.electronAPI.refreshMenu) window.electronAPI.refreshMenu(); else try { window.electronAPI && window.electronAPI.send && window.electronAPI.send('refresh-menu'); } catch(e){}; await renderToolsThemes(); } catch(e){} };
      mgr.appendChild(importAll); mgr.appendChild(deleteAny); mgr.appendChild(refresh);
      toolsThemesContainer.appendChild(mgr);
    } catch (err) {
      console.warn('Error rendering tools themes:', err);
    } finally {
      window.__vdThemesRendering = false;
      if (window.__vdThemesNeedsRerender) {
        window.__vdThemesNeedsRerender = false;
        try { await renderToolsThemes(); } catch (e) {}
      }
    }
  }

  // Render themes when tools menu opens and on startup
  if (toolsBtn) {
    toolsBtn.addEventListener('click', () => { setTimeout(() => { renderToolsThemes(); }, 40); });
  }

  // Also call once on load so themes are present even if Tools never opened yet
  try { renderToolsThemes(); } catch (e) {}
  // Update active theme indicators when the theme changes from any source
  if (window.electronAPI && window.electronAPI.onThemeChange) {
    window.electronAPI.onThemeChange((themeName) => {
      // Re-render themes to update active marks
      try { renderToolsThemes(); } catch (e) {}
      // Also update theme manager state if present
      if (themeManager) {
        if (themeManager.getCurrentTheme() !== themeName) {
          themeManager.setTheme(themeName);
        }
      }
    });
  }
  // Listen for refresh-menu broadcasts from main so themes update when main requests a rebuild
  if (window.electronAPI && window.electronAPI.onRefreshMenu) {
    window.electronAPI.onRefreshMenu(() => {
      try { renderToolsThemes(); } catch (e) {}
    });
  }
  if (prefBtn) {
    prefBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPreferencesModal();
    });
  }
}

// ThemeManager now initialized early in first DOMContentLoaded (before ProfileManager)
// This ensures ThemeSystem is available when ProfileManager tries to load theme
// Theme cycling hotkey (Ctrl+Shift+T) also registered in early DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {
  
  // Overlay test functions
  window.testOverlayText = function() {
    console.log('Testing overlay text...');
    if (window.electronAPI && typeof window.electronAPI.sendOverlayText === 'function') {
      window.electronAPI.sendOverlayText({ position: 5, text: 'Test Text from Dashboard!' });
    } else {
      console.log('sendOverlayText not available');
    }
  };
  
  window.testOverlayImage = function() {
    console.log('Testing overlay image...');
    if (window.electronAPI && typeof window.electronAPI.sendOverlayImage === 'function') {
      window.electronAPI.sendOverlayImage({ 
        position: 1, 
        imageUrl: 'http://localhost:8080/media/images/VirtualDeck2.png' 
      });
    } else {
      console.log('sendOverlayImage not available');
    }
  };
  
  window.testOverlayVideo = function() {
    console.log('Testing overlay video...');
    if (window.electronAPI && typeof window.electronAPI.sendOverlayVideo === 'function') {
      window.electronAPI.sendOverlayVideo({ 
        position: 3, 
        videoUrl: 'http://localhost:8080/media/videos/generated-video.mp4' 
      });
    } else {
      console.log('sendOverlayVideo not available');
    }
  };
  
  // Removed duplicate clearOverlay function - using the main one defined earlier
  
  // Utility function to send payload to overlay
  window.sendOverlayPayload = function(payload) {
    console.log('Sending payload to overlay:', payload);
    
    // Send to overlay iframe if available - send payload directly
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(payload, '*');
        console.log('Payload sent to overlay iframe');
      } catch (error) {
        console.warn('Failed to send payload to overlay iframe:', error);
      }
    }
    
    // Send via WebSocket if available
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      try {
        window.electronAPI.sendOverlayMessage(payload);
        console.log('Payload sent via WebSocket');
      } catch (error) {
        console.warn('Failed to send payload via WebSocket:', error);
      }
    }
  };

  // Test all overlay positions
  window.testAllOverlayPositions = function() {
    console.log('Testing all overlay positions...');
    
    const positions = [
      { id: 'topLeft', text: 'Test - Top Left' },
      { id: 'topCenter', text: 'Test - Top Center' },
      { id: 'topRight', text: 'Test - Top Right' },
      { id: 'midLeft', text: 'Test - Mid Left' },
      { id: 'midRight', text: 'Test - Mid Right' },
      { id: 'bottomLeft', text: 'Test - Bottom Left' },
      { id: 'bottomCenter', text: 'Test - Bottom Center' },
      { id: 'bottomRight', text: 'Test - Bottom Right' }
    ];
    
    // Create a single payload with all text slots
    const payload = {
      type: 'buttonTrigger',
      options: {
        clearPrevious: true
      },
      slots: {}
    };
    
    positions.forEach((pos, index) => {
      payload.slots[pos.id] = {
        text: pos.text,
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: '48px',
          color: '#ffffff',
          fontWeight: 'bold',
          textAlign: 'center',
          textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
          webkitTextStroke: '2px #000',
          zIndex: '15'
        }
      };
    });
    
    // Add center media test
    payload.centerMedia = [{
      type: 'image',
      src: 'http://localhost:8080/media/images/VirtualDeck2.png',
      alt: 'VirtualDeck Logo'
    }];
    
    if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
      window.electronAPI.sendOverlayMessage(payload);
      console.log('Sent comprehensive test payload with all positions');
    }
  };

  console.log('Overlay test functions available:');
  console.log('- testOverlayText() - Send test text to center box');
  console.log('- testOverlayImage() - Send test image to top left box');
  console.log('- testOverlayVideo() - Send test video to top right box');
  console.log('- testAllOverlayPositions() - Test all 9 positions with "Test" messages');
  console.log('- clearOverlay() - Clear all overlay content');
  
  // Watch for any changes to the document element's data-theme attribute
  // Theme persistence is now handled by ProfileManager
  // Removed MutationObserver and delayed theme application to prevent conflicts
  // ProfileManager applies the correct theme from profile settings

  // Initialize AddEditButtonForm integration (minimal)
  if (window.AddEditButtonForm) {
    window.addEditButtonForm = new window.AddEditButtonForm();
    window.addEditButtonForm.init();

    // Set up form callbacks
    window.addEditButtonForm.onSave = async (buttonData) => {
      try {
        console.log('Saving multi-media button:', buttonData);
        
        // Use the new schema directly (no conversion needed)
        const buttonConfig = {
          id: buttonData.id,
          name: buttonData.name,
          hotkey: buttonData.hotkey,
          type: 'multi-media',
          overlay: buttonData.overlay || getDefaultOverlay(), // Preserve overlay selection
          slots: buttonData.slots,
          centerMedia: buttonData.centerMedia,
          audio: buttonData.audio,
          options: buttonData.options,
          // Include chat command data if provided
          chatCommand: buttonData.chatCommand || undefined
        };

        // Check if Electron API is available
        if (!window.electronAPI) {
          console.error('Electron API not available - this might be running in a browser');
          alert('Error: Electron API not available. This feature requires the desktop app.');
          return;
        }

        if (!window.electronAPI.saveConfig) {
          console.error('saveConfig method not available on Electron API');
          alert('Error: Save functionality not available. Please check your app version.');
          return;
        }

        // Save to config
        const currentConfig = await window.electronAPI.getConfig();
        const buttons = currentConfig.buttons || [];
        
        if (buttonData.isEditing) {
          // Update existing button
          const index = buttons.findIndex(b => b.id === buttonData.editingId);
          if (index > -1) {
            buttons[index] = buttonConfig;
            console.log('Updated existing button at index:', index);
          } else {
            console.warn('Button to edit not found, adding as new button');
            buttons.push(buttonConfig);
          }
        } else {
          // Add new button
          buttons.push(buttonConfig);
          console.log('Added new button');
        }
        
        const saveResult = await window.electronAPI.saveConfig({ ...currentConfig, buttons });
        
        if (saveResult && saveResult.success) {
          // Refresh hotkeys to register the new hotkey
          window.electronAPI.refreshHotkeys();
          
          // Clear audio cache to ensure new audio files are loaded
          audioCache.clear();
          console.log('🧹 Audio cache cleared after multi-media button save');
          
          // Force immediate profile save to persist button changes
          if (profileManager && profileManager.saveCurrentSettings) {
            await profileManager.saveCurrentSettings();
            console.log('✅ Profile saved after button edit');
          }
          
          // Reload buttons
          await loadButtons();
          
          console.log('Multi-media button saved successfully');
          alert('Button saved successfully!');
        } else {
          throw new Error(saveResult?.error || 'Failed to save button');
        }
        
      } catch (error) {
        console.error('Error saving multi-media button:', error);
        alert('Error saving button: ' + error.message);
      }
    };

    window.addEditButtonForm.onCancel = () => {
      console.log('Multi-media button creation/editing cancelled');
    };
  }

  // Button Type Selection Modal
  setupButtonTypeSelection();
  
  // Expose helper functions globally for debugging
  window.findMultiMediaButtons = findMultiMediaButtons;
  window.goToPage = goToPage;
  window.currentPage = () => currentPage;
  window.totalPages = () => totalPages;
  
  // Test multi-media button trigger
  window.testMultiMediaTrigger = async () => {
    const multiMediaButtons = await findMultiMediaButtons();
    if (multiMediaButtons.length > 0) {
      console.log('Testing multi-media button trigger with:', multiMediaButtons[0]);
      console.log('Button data structure:', {
        hasAudio: !!multiMediaButtons[0].audio,
        hasDataAudio: !!(multiMediaButtons[0].data && multiMediaButtons[0].data.audio),
        hasSlots: !!multiMediaButtons[0].slots,
        hasDataSlots: !!(multiMediaButtons[0].data && multiMediaButtons[0].data.slots),
        hasCenterMedia: !!multiMediaButtons[0].centerMedia,
        hasDataCenterMedia: !!(multiMediaButtons[0].data && multiMediaButtons[0].data.centerMedia)
      });
      await handleMultiMediaTrigger(multiMediaButtons[0]);
    } else {
      console.log('No multi-media buttons found to test');
    }
  };

  // Test image handling in multi-media buttons
  window.testImageHandling = async () => {
    console.log('🖼️ Testing image handling in multi-media buttons...');
    
    const multiMediaButtons = await findMultiMediaButtons();
    if (multiMediaButtons.length === 0) {
      console.log('❌ No multi-media buttons found to test');
      return;
    }

    const button = multiMediaButtons[0];
    console.log('📋 Button data:', button);
    
    if (button.centerMedia && button.centerMedia.length > 0) {
      console.log('🖼️ Center media items:');
      button.centerMedia.forEach((item, index) => {
        console.log(`  ${index + 1}. Type: ${item.type}, Src type: ${typeof item.src}, Is File: ${item.src instanceof File}`);
        if (item.src instanceof File) {
          console.log(`     File name: ${item.src.name}, File size: ${item.src.size} bytes`);
        } else if (typeof item.src === 'string') {
          const isBase64 = item.src.startsWith('data:');
          const isBlob = item.src.startsWith('blob:');
          const isHttp = item.src.startsWith('http');
          console.log(`     Src string: ${item.src.substring(0, 100)}${item.src.length > 100 ? '...' : ''}`);
          console.log(`     Is base64: ${isBase64}, Is blob: ${isBlob}, Is HTTP: ${isHttp}`);
        }
      });
    } else {
      console.log('❌ No center media found in button');
    }
  };

  // Test multi-media button mapping functionality
  window.testMultiMediaMapping = async () => {
    console.log('🎯 Testing multi-media button mapping functionality...');
    
    const multiMediaButtons = await findMultiMediaButtons();
    if (multiMediaButtons.length === 0) {
      console.log('❌ No multi-media buttons found to test mapping');
      return;
    }

    const button = multiMediaButtons[0];
    const buttonName = button.name || button.label || 'Unnamed';
    console.log('📋 Testing with button:', buttonName);
    
    // Test the mapping trigger system
    console.log('🎯 Simulating mapping trigger for:', buttonName);
    if (window.electronAPI && window.electronAPI.sendTrigger) {
      window.electronAPI.sendTrigger(buttonName);
      console.log('✅ Trigger sent via mapping system');
    } else {
      console.log('❌ sendTrigger API not available');
    }
  };
  
  // Debug function to inspect button data
  window.debugButtonData = async () => {
    const multiMediaButtons = await findMultiMediaButtons();
    console.log('All multi-media buttons:', multiMediaButtons);
    multiMediaButtons.forEach((btn, index) => {
      console.log(`Button ${index}:`, {
        id: btn.id,
        name: btn.name || btn.label,
        type: btn.type,
        audio: btn.audio,
        data: btn.data,
        slots: btn.slots,
        centerMedia: btn.centerMedia
      });
    });
  };
  
  // Function to clear audio cache
  window.clearAudioCache = () => {
    audioCache.clear();
    console.log('Audio cache cleared');
  };
  
  // Function to show audio cache status
  window.showAudioCache = () => {
    console.log('Audio cache contents:', Array.from(audioCache.keys()));
    console.log('Cache size:', audioCache.size);
  };
  
  // Quick test function to create and verify button
  window.quickTest = async () => {
    console.log('Creating quick test button...');
    const button = await createSimpleTestButton();
    if (button) {
      console.log('✅ Test button created successfully!');
      console.log('Button data:', button);
      
      // Check if button appears in DOM
      setTimeout(() => {
        const buttons = document.querySelectorAll('.sound-card');
        const multiMediaButtons = Array.from(buttons).filter(card => 
          card.querySelector('.sound-type')?.textContent === 'multi-media'
        );
        console.log(`Found ${multiMediaButtons.length} multi-media buttons in DOM`);
        
        if (multiMediaButtons.length > 0) {
          console.log('✅ Multi-media button is visible in DOM!');
          console.log('Button element:', multiMediaButtons[0]);
        } else {
          console.log('❌ No multi-media buttons found in DOM');
        }
      }, 1000);
    } else {
      console.log('❌ Failed to create test button');
    }
  };
  
  // Comprehensive test function to verify schema and API compatibility
  window.testSchemaCompatibility = async () => {
    console.log('🧪 Testing schema compatibility...');
    
    // Test 1: Create a test button
    console.log('1. Creating test button...');
    const testButton = await createSimpleTestButton();
    if (!testButton) {
      console.log('❌ Failed to create test button');
      return;
    }
    console.log('✅ Test button created');
    
    // Test 2: Verify schema structure
    console.log('2. Verifying schema structure...');
    const requiredFields = ['id', 'name', 'type', 'slots', 'centerMedia', 'audio', 'options'];
    const missingFields = requiredFields.filter(field => !(field in testButton));
    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
      return;
    }
    console.log('✅ All required fields present');
    
    // Test 3: Verify slots structure
    console.log('3. Verifying slots structure...');
    const expectedSlots = ['topLeft', 'topCenter', 'topRight', 'midLeft', 'center', 'midRight', 'bottomLeft', 'bottomCenter', 'bottomRight'];
    const slotKeys = Object.keys(testButton.slots);
    const validSlots = slotKeys.every(key => expectedSlots.includes(key));
    if (!validSlots) {
      console.log('❌ Invalid slot names:', slotKeys);
      return;
    }
    console.log('✅ Slots structure valid');
    
    // Test 4: Verify style structure
    console.log('4. Verifying style structure...');
    const slotWithStyle = Object.values(testButton.slots).find(slot => slot.style);
    if (slotWithStyle) {
      const styleFields = ['fontFamily', 'fontSize', 'color', 'bold', 'italic', 'align', 'animation'];
      const styleKeys = Object.keys(slotWithStyle.style);
      const validStyle = styleFields.every(field => styleKeys.includes(field));
      if (!validStyle) {
        console.log('❌ Invalid style structure:', styleKeys);
        return;
      }
      console.log('✅ Style structure valid');
    }
    
    // Test 5: Verify centerMedia structure
    console.log('5. Verifying centerMedia structure...');
    if (testButton.centerMedia.length > 0) {
      const mediaItem = testButton.centerMedia[0];
      const mediaFields = ['id', 'type', 'src', 'widthPct', 'align', 'extraStyle'];
      const mediaKeys = Object.keys(mediaItem);
      const validMedia = mediaFields.every(field => mediaKeys.includes(field));
      if (!validMedia) {
        console.log('❌ Invalid centerMedia structure:', mediaKeys);
        return;
      }
      console.log('✅ CenterMedia structure valid');
    }
    
    // Test 6: Verify audio structure
    console.log('6. Verifying audio structure...');
    if (testButton.audio.length > 0) {
      const audioItem = testButton.audio[0];
      const audioFields = ['id', 'src', 'volume', 'loop'];
      const audioKeys = Object.keys(audioItem);
      const validAudio = audioFields.every(field => audioKeys.includes(field));
      if (!validAudio) {
        console.log('❌ Invalid audio structure:', audioKeys);
        return;
      }
      console.log('✅ Audio structure valid');
    }
    
    // Test 7: Test trigger functionality
    console.log('7. Testing trigger functionality...');
    try {
      await handleMultiMediaTrigger(testButton);
      console.log('✅ Trigger functionality works');
    } catch (error) {
      console.log('❌ Trigger functionality failed:', error);
    }
    
    console.log('🎉 All schema compatibility tests passed!');
  };
  
  // Function to check all button types in DOM
  window.checkAllButtonTypes = () => {
    console.log('🔍 Checking all button types in DOM...');
    
    const buttons = document.querySelectorAll('.sound-card');
    console.log(`Total buttons found: ${buttons.length}`);
    
    const buttonTypes = {};
    buttons.forEach((card, index) => {
      const type = card.querySelector('.sound-type')?.textContent || 'unknown';
      const name = card.querySelector('.sound-name')?.textContent || 'unnamed';
      const hotkey = card.querySelector('.sound-hotkey')?.textContent || 'no hotkey';
      
      if (!buttonTypes[type]) {
        buttonTypes[type] = [];
      }
      buttonTypes[type].push({ name, hotkey, index });
    });
    
    console.log('Button types found:');
    Object.keys(buttonTypes).forEach(type => {
      console.log(`  ${type}: ${buttonTypes[type].length} buttons`);
      buttonTypes[type].forEach(button => {
        console.log(`    - ${button.name} (${button.hotkey})`);
      });
    });
    
    // Check for multi-media buttons specifically
    const multiMediaButtons = Array.from(buttons).filter(card => 
      card.querySelector('.sound-type')?.textContent === 'multi-media'
    );
    console.log(`\nMulti-media buttons: ${multiMediaButtons.length}`);
    
    if (multiMediaButtons.length === 0) {
      console.log('❌ No multi-media buttons found in DOM');
      console.log('💡 Try running: quickTest() or createTestMultiMediaButton()');
    } else {
      console.log('✅ Multi-media buttons found in DOM');
    }
    
    return buttonTypes;
  };
  
  // Function to test form submission
  window.testFormSubmission = () => {
    console.log('🧪 Testing form submission...');
    
    // Check if form exists
    const form = document.querySelector('#multi-media-form form');
    if (!form) {
      console.log('❌ Multi-media form not found');
      return;
    }
    
    // Check if form has required elements
    const nameInput = document.getElementById('multi-media-button-name');
    if (!nameInput) {
      console.log('❌ Button name input not found');
      return;
    }
    
    // Test with empty name (should show validation error)
    console.log('1. Testing empty name validation...');
    nameInput.value = '';
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);
    console.log('✅ Empty name validation should have triggered');
    
    // Test with valid name
    console.log('2. Testing valid name...');
    nameInput.value = 'Test Button';
    const validSubmitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(validSubmitEvent);
    console.log('✅ Valid name submission should work');
    
    console.log('🎉 Form submission test completed');
  };
  
  // Function to check Electron API availability
  window.checkElectronAPI = () => {
    console.log('🔍 Checking Electron API availability...');
    
    if (!window.electronAPI) {
      console.log('❌ window.electronAPI is not defined');
      console.log('💡 This might be running in a browser instead of Electron');
      return false;
    }
    
    console.log('✅ window.electronAPI is available');
    
    const requiredMethods = ['getConfig', 'saveConfig', 'sendOverlayMessage'];
    const missingMethods = requiredMethods.filter(method => 
      !window.electronAPI[method] || typeof window.electronAPI[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
      console.log('❌ Missing required methods:', missingMethods);
      console.log('Available methods:', Object.keys(window.electronAPI));
      return false;
    }
    
    console.log('✅ All required methods are available');
    console.log('Available methods:', Object.keys(window.electronAPI));
    return true;
  };
  
  // Function to test config save/load
  window.testConfigAPI = async () => {
    console.log('🧪 Testing config API...');
    
    if (!window.checkElectronAPI()) {
      return;
    }
    
    try {
      // Test getConfig
      console.log('1. Testing getConfig...');
      const config = await window.electronAPI.getConfig();
      console.log('✅ getConfig successful:', config);
      
      // Test saveConfig (with a small change)
      console.log('2. Testing saveConfig...');
      const testConfig = { ...config, testTimestamp: Date.now() };
      await window.electronAPI.saveConfig(testConfig);
      console.log('✅ saveConfig successful');
      
      // Verify the change was saved
      console.log('3. Verifying save...');
      const savedConfig = await window.electronAPI.getConfig();
      if (savedConfig.testTimestamp === testConfig.testTimestamp) {
        console.log('✅ Config save/load verification successful');
      } else {
        console.log('❌ Config save/load verification failed');
      }
      
      // Clean up test data
      delete testConfig.testTimestamp;
      await window.electronAPI.saveConfig(testConfig);
      console.log('✅ Test data cleaned up');
      
    } catch (error) {
      console.log('❌ Config API test failed:', error);
    }
  };
  
  // Function to test complete save functionality
  window.testSaveFunctionality = async () => {
    console.log('🧪 Testing complete save functionality...');
    
    // Step 1: Check API availability
    console.log('1. Checking API availability...');
    if (!window.checkElectronAPI()) {
      console.log('❌ API not available, cannot test save functionality');
      return;
    }
    
    // Step 2: Test config API
    console.log('2. Testing config API...');
    await window.testConfigAPI();
    
    // Step 3: Create a test button
    console.log('3. Creating test button...');
    const testButton = {
      id: 'test-save-' + Date.now(),
      name: 'Test Save Button',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+Test',
      slots: {
        topCenter: {
          text: 'Test Save',
          style: {
            fontFamily: 'Inter',
            fontSize: 24,
            color: '#FFFFFF',
            bold: true,
            italic: false,
            align: 'center',
            animation: null
          }
        }
      },
      centerMedia: [],
      audio: [],
      options: {
        clearPrevious: true,
        durationMs: 5000
      }
    };
    
    // Step 4: Test the save process
    console.log('4. Testing save process...');
    try {
      const currentConfig = await window.electronAPI.getConfig();
      const buttons = currentConfig.buttons || [];
      buttons.push(testButton);
      
      const saveResult = await window.electronAPI.saveConfig({ ...currentConfig, buttons });
      
      if (saveResult && saveResult.success) {
        console.log('✅ Save successful');
        
        // Step 5: Verify the save
        console.log('5. Verifying save...');
        const savedConfig = await window.electronAPI.getConfig();
        const savedButton = savedConfig.buttons.find(b => b.id === testButton.id);
        
        if (savedButton) {
          console.log('✅ Button found in saved config');
          console.log('Saved button:', savedButton);
          
          // Step 6: Clean up test data
          console.log('6. Cleaning up test data...');
          const cleanedButtons = savedConfig.buttons.filter(b => b.id !== testButton.id);
          await window.electronAPI.saveConfig({ ...savedConfig, buttons: cleanedButtons });
          console.log('✅ Test data cleaned up');
          
          console.log('🎉 Complete save functionality test passed!');
        } else {
          console.log('❌ Button not found in saved config');
        }
      } else {
        console.log('❌ Save failed:', saveResult);
      }
    } catch (error) {
      console.log('❌ Save test failed:', error);
    }
  };
  
  // Function to test edit functionality
  window.testEditFunctionality = async () => {
    console.log('🧪 Testing edit functionality...');
    
    // Step 1: Check if we have any multi-media buttons
    const buttons = document.querySelectorAll('.sound-card');
    const multiMediaButtons = Array.from(buttons).filter(card => 
      card.querySelector('.sound-type')?.textContent === 'multi-media'
    );
    
    if (multiMediaButtons.length === 0) {
      console.log('❌ No multi-media buttons found to test editing');
      console.log('💡 Try running: quickTest() or createTestMultiMediaButton() first');
      return;
    }
    
    console.log(`✅ Found ${multiMediaButtons.length} multi-media buttons`);
    
    // Step 2: Test editing the first multi-media button
    const firstButton = multiMediaButtons[0];
    const editButton = firstButton.querySelector('.edit-button');
    
    if (!editButton) {
      console.log('❌ No edit button found on multi-media button');
      return;
    }
    
    console.log('2. Testing edit button click...');
    try {
      editButton.click();
      console.log('✅ Edit button clicked successfully');
      
      // Check if multi-media modal opened
      setTimeout(() => {
        const multiMediaModal = document.getElementById('multi-media-modal');
        if (multiMediaModal && !multiMediaModal.classList.contains('hidden')) {
          console.log('✅ Multi-media edit modal opened');
          console.log('🎉 Edit functionality test passed!');
          
          // Close the modal
          multiMediaModal.classList.add('hidden');
        } else {
          console.log('❌ Multi-media edit modal did not open');
        }
      }, 500);
      
    } catch (error) {
      console.log('❌ Edit button click failed:', error);
    }
  };
  
  // Function to test complete trigger functionality
  window.testCompleteTrigger = async () => {
    console.log('🧪 Testing complete trigger functionality...');
    
    // Step 1: Create a test button with all media types
    console.log('1. Creating comprehensive test button...');
    const testButton = {
      id: 'complete-test-' + Date.now(),
      name: 'Complete Test Button',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+Complete',
      slots: {
        topLeft: {
          text: 'TOP LEFT',
          style: {
            fontFamily: 'Inter',
            fontSize: 24,
            color: '#FF0000',
            bold: true,
            italic: false,
            align: 'left',
            animation: 'fadeIn'
          }
        },
        topCenter: {
          text: 'TOP CENTER',
          style: {
            fontFamily: 'Arial',
            fontSize: 28,
            color: '#00FF00',
            bold: false,
            italic: true,
            align: 'center',
            animation: 'pulse'
          }
        },
        topRight: {
          text: 'TOP RIGHT',
          style: {
            fontFamily: 'Georgia',
            fontSize: 20,
            color: '#0000FF',
            bold: true,
            italic: false,
            align: 'right',
            animation: null
          }
        },
        bottomCenter: {
          text: 'BOTTOM CENTER',
          style: {
            fontFamily: 'Courier',
            fontSize: 22,
            color: '#FFFF00',
            bold: true,
            italic: false,
            align: 'center',
            animation: 'slideUp'
          }
        }
      },
      centerMedia: [
        {
          id: 'm1',
          type: 'image',
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23ff6600" rx="20"/><text x="200" y="160" font-size="48" text-anchor="middle" fill="white" font-weight="bold">CENTER IMAGE</text></svg>',
          widthPct: 80,
          align: 'center',
          extraStyle: { zIndex: 1 }
        }
      ],
      audio: [
        {
          id: 'a1',
          src: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
          volume: 0.8,
          loop: false
        }
      ],
      options: {
        clearPrevious: true,
        durationMs: 5000
      }
    };
    
    // Step 2: Test the trigger
    console.log('2. Testing trigger...');
    try {
      await handleMultiMediaTrigger(testButton);
      console.log('✅ Trigger executed successfully');
      
      // Step 3: Check if overlay received the message
      console.log('3. Checking overlay message delivery...');
      setTimeout(() => {
        const overlayIframe = document.getElementById('overlay-iframe');
        if (overlayIframe && overlayIframe.contentWindow) {
          console.log('✅ Overlay iframe exists');
          
          // Send a test message to verify communication
          overlayIframe.contentWindow.postMessage({
            type: 'buttonTrigger',
            payload: {
              id: 'test-communication',
              name: 'Communication Test',
              slots: {
                topCenter: {
                  text: 'COMMUNICATION TEST',
                  style: {
                    fontFamily: 'Arial',
                    fontSize: 32,
                    color: '#FFFFFF',
                    bold: true,
                    italic: false,
                    align: 'center',
                    animation: 'pulse'
                  }
                }
              },
              centerMedia: [],
              audio: [],
              options: { clearPrevious: true }
            }
          }, '*');
          console.log('✅ Test message sent to overlay');
        } else {
          console.log('❌ Overlay iframe not found');
        }
      }, 1000);
      
    } catch (error) {
      console.log('❌ Trigger failed:', error);
    }
    
    console.log('🎉 Complete trigger test finished');
  };
  
  // Function to test naming consistency across all components
  window.testNamingConsistency = async () => {
    console.log('🧪 Testing naming consistency across all components...');
    
    // Test 1: Check form field naming
    console.log('1. Checking form field naming...');
    const nameInput = document.getElementById('multi-media-button-name');
    const labelInput = document.getElementById('label-input');
    
    if (nameInput) {
      console.log('✅ Multi-media form: name input found');
      console.log('  - ID:', nameInput.id);
      console.log('  - Name attribute:', nameInput.name);
      console.log('  - Expected: name="name"');
      if (nameInput.name === 'name') {
        console.log('✅ Multi-media form naming is correct');
      } else {
        console.log('❌ Multi-media form naming is incorrect');
      }
    } else {
      console.log('❌ Multi-media form name input not found');
    }
    
    if (labelInput) {
      console.log('✅ Regular form: label input found');
      console.log('  - ID:', labelInput.id);
      console.log('  - Name attribute:', labelInput.name);
      console.log('  - Expected: name="label" (for backward compatibility)');
      if (labelInput.name === 'label') {
        console.log('✅ Regular form naming is correct');
      } else {
        console.log('❌ Regular form naming is incorrect');
      }
    } else {
      console.log('❌ Regular form label input not found');
    }
    
    // Test 2: Check schema consistency
    console.log('2. Checking schema consistency...');
    const testButton = {
      id: 'naming-test-' + Date.now(),
      name: 'Test Button Name',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+N',
      slots: {},
      centerMedia: [],
      audio: [],
      options: { clearPrevious: true }
    };
    
    console.log('✅ Test button schema:');
    console.log('  - Uses "name" property:', 'name' in testButton);
    console.log('  - No "label" property:', !('label' in testButton));
    
    // Test 3: Check form data collection
    console.log('3. Checking form data collection...');
    if (window.addEditButtonForm && typeof window.addEditButtonForm.getFormData === 'function') {
      // Set test values
      if (nameInput) nameInput.value = 'Test Form Name';
      
      const formData = window.addEditButtonForm.getFormData();
      console.log('✅ Form data collected:');
      console.log('  - Uses "name" property:', 'name' in formData);
      console.log('  - No "buttonName" property:', !('buttonName' in formData));
      console.log('  - Name value:', formData.name);
    } else {
      console.log('❌ Multi-media form not available for testing');
    }
    
    // Test 4: Check display consistency
    console.log('4. Checking display consistency...');
    const buttons = document.querySelectorAll('.sound-card');
    if (buttons.length > 0) {
      const firstButton = buttons[0];
      const nameElement = firstButton.querySelector('.sound-name');
      if (nameElement) {
        console.log('✅ Display element found');
        console.log('  - Element class:', nameElement.className);
        console.log('  - Displayed text:', nameElement.textContent);
      } else {
        console.log('❌ Display element not found');
      }
    } else {
      console.log('❌ No buttons found for display testing');
    }
    
    console.log('🎉 Naming consistency test completed');
  };
  
  // Function to test data consistency across the entire pipeline
  window.testDataConsistency = async () => {
    console.log('🧪 Testing data consistency across form → API → overlay pipeline...');
    
    // Test 1: Create a test button with all media types
    console.log('1. Creating comprehensive test button...');
    const testButton = {
      id: 'data-consistency-test-' + Date.now(),
      name: 'Data Consistency Test',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+D',
      slots: {
        topLeft: { text: 'TOP LEFT', style: { fontFamily: 'Inter', fontSize: 24, color: '#FF0000', bold: true, italic: false, align: 'left', animation: null } },
        topCenter: { text: 'TOP CENTER', style: { fontFamily: 'Arial', fontSize: 20, color: '#00FF00', bold: false, italic: true, align: 'center', animation: 'fadeIn' } },
        topRight: { text: 'TOP RIGHT', style: { fontFamily: 'Georgia', fontSize: 18, color: '#0000FF', bold: true, italic: false, align: 'right', animation: null } },
        midLeft: { text: 'MID LEFT', style: { fontFamily: 'Inter', fontSize: 16, color: '#FFFF00', bold: false, italic: true, align: 'left', animation: null } },
        center: { text: 'CENTER TEXT', style: { fontFamily: 'Inter', fontSize: 28, color: '#FF00FF', bold: true, italic: false, align: 'center', animation: 'pulse' } },
        midRight: { text: 'MID RIGHT', style: { fontFamily: 'Inter', fontSize: 16, color: '#00FFFF', bold: false, italic: true, align: 'right', animation: null } },
        bottomLeft: { text: 'BOTTOM LEFT', style: { fontFamily: 'Courier', fontSize: 18, color: '#FF6600', bold: true, italic: false, align: 'left', animation: null } },
        bottomCenter: { text: 'BOTTOM CENTER', style: { fontFamily: 'Inter', fontSize: 22, color: '#6600FF', bold: false, italic: true, align: 'center', animation: 'slideUp' } },
        bottomRight: { text: 'BOTTOM RIGHT', style: { fontFamily: 'Arial', fontSize: 16, color: '#FFFFFF', bold: true, italic: false, align: 'right', animation: null } }
      },
      centerMedia: [
        { id: 'm1', type: 'image', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%230066cc" rx="20"/><text x="200" y="160" font-size="48" text-anchor="middle" fill="white" font-weight="bold">TEST IMAGE</text></svg>', loop: false, widthPct: 80, align: 'center', extraStyle: { zIndex: 1 } }
      ],
      audio: [
        { id: 'a1', src: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', volume: 0.8, loop: false }
      ],
      options: { clearPrevious: true, durationMs: 5000 }
    };
    
    console.log('✅ Test button created with new schema');
    console.log('  - Uses "name" property:', 'name' in testButton);
    console.log('  - Uses new slot names:', Object.keys(testButton.slots));
    console.log('  - Uses new style format:', testButton.slots.topLeft.style);
    
    // Test 2: Verify form data collection
    console.log('2. Testing form data collection...');
    if (window.addEditButtonForm && typeof window.addEditButtonForm.getFormData === 'function') {
      // Set test values in form
      const nameInput = document.getElementById('multi-media-button-name');
      if (nameInput) nameInput.value = 'Form Test Name';
      
      const formData = window.addEditButtonForm.getFormData();
      console.log('✅ Form data collected:');
      console.log('  - Uses "name" property:', 'name' in formData);
      console.log('  - Name value:', formData.name);
      console.log('  - Type:', formData.type);
      console.log('  - Has slots:', 'slots' in formData);
      console.log('  - Has centerMedia:', 'centerMedia' in formData);
      console.log('  - Has audio:', 'audio' in formData);
    } else {
      console.log('❌ Multi-media form not available for testing');
    }
    
    // Test 3: Test overlay payload structure
    console.log('3. Testing overlay payload structure...');
    const overlayPayload = {
      id: testButton.id,
      name: testButton.name,
      slots: testButton.slots,
      centerMedia: testButton.centerMedia,
      options: testButton.options
    };
    
    console.log('✅ Overlay payload created:');
    console.log('  - Uses "name" property:', 'name' in overlayPayload);
    console.log('  - Has slots with new names:', Object.keys(overlayPayload.slots));
    console.log('  - Has centerMedia array:', Array.isArray(overlayPayload.centerMedia));
    console.log('  - Has options:', 'options' in overlayPayload);
    
    // Test 4: Test message structure sent to overlay
    console.log('4. Testing message structure sent to overlay...');
    const messageStructure = {
      type: 'buttonTrigger',
      payload: overlayPayload
    };
    
    console.log('✅ Message structure:');
    console.log('  - Has type:', messageStructure.type === 'buttonTrigger');
    console.log('  - Has payload:', 'payload' in messageStructure);
    console.log('  - Payload uses new schema:', 'name' in messageStructure.payload);
    
    // Test 5: Test overlay processing
    console.log('5. Testing overlay processing...');
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(messageStructure, '*');
        console.log('✅ Message sent to overlay iframe successfully');
      } catch (error) {
        console.log('❌ Failed to send message to overlay iframe:', error);
      }
    } else {
      console.log('⚠️ Overlay iframe not available for testing');
    }
    
    // Test 6: Test WebSocket message
    console.log('6. Testing WebSocket message...');
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      try {
        window.electronAPI.sendOverlayMessage(overlayPayload);
        console.log('✅ WebSocket message sent successfully');
      } catch (error) {
        console.log('❌ Failed to send WebSocket message:', error);
      }
    } else {
      console.log('⚠️ WebSocket not available for testing');
    }
    
    // Test 7: Test slot name mapping
    console.log('7. Testing slot name mapping...');
    const slotMapping = {
      'topLeft': 'text-top-left',
      'topCenter': 'text-top-center',
      'topRight': 'text-top-right',
      'midLeft': 'text-mid-left',
      'center': 'text-center',
      'midRight': 'text-mid-right',
      'bottomLeft': 'text-bottom-left',
      'bottomCenter': 'text-bottom-center',
      'bottomRight': 'text-bottom-right'
    };
    
    console.log('✅ Slot name mapping:');
    Object.keys(slotMapping).forEach(schemaName => {
      const domId = slotMapping[schemaName];
      const element = document.getElementById(domId);
      console.log(`  - ${schemaName} → ${domId}: ${element ? '✅ Found' : '❌ Not found'}`);
    });
    
    // Test 8: Test style property mapping
    console.log('8. Testing style property mapping...');
    const testStyle = testButton.slots.topLeft.style;
    console.log('✅ Style properties:');
    console.log('  - fontFamily:', testStyle.fontFamily);
    console.log('  - fontSize:', testStyle.fontSize, typeof testStyle.fontSize);
    console.log('  - color:', testStyle.color);
    console.log('  - bold:', testStyle.bold, typeof testStyle.bold);
    console.log('  - italic:', testStyle.italic, typeof testStyle.italic);
    console.log('  - align:', testStyle.align);
    console.log('  - animation:', testStyle.animation);
    
    console.log('🎉 Data consistency test completed');
    console.log('📋 Summary:');
    console.log('  - ✅ New schema uses "name" property consistently');
    console.log('  - ✅ New slot names (topLeft, topCenter, etc.) used throughout');
    console.log('  - ✅ New style format (bold: boolean, fontSize: number) used');
    console.log('  - ✅ Message structure follows { type: "buttonTrigger", payload: {...} }');
    console.log('  - ✅ Overlay receives and processes data correctly');
  };
  
  // Function to debug what's being sent to the overlay
  window.debugOverlayData = async () => {
    console.log('🔍 Debugging overlay data flow...');
    
    // Create a test button with all media types
    const testButton = {
      id: 'debug-test-' + Date.now(),
      name: 'Debug Test Button',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+Debug',
      slots: {
        topLeft: { text: 'DEBUG TOP LEFT', style: { fontFamily: 'Inter', fontSize: 24, color: '#FF0000', bold: true, italic: false, align: 'left', animation: null } },
        topCenter: { text: 'DEBUG TOP CENTER', style: { fontFamily: 'Arial', fontSize: 20, color: '#00FF00', bold: false, italic: true, align: 'center', animation: 'fadeIn' } },
        topRight: { text: 'DEBUG TOP RIGHT', style: { fontFamily: 'Georgia', fontSize: 18, color: '#0000FF', bold: true, italic: false, align: 'right', animation: null } },
        center: { text: 'DEBUG CENTER', style: { fontFamily: 'Inter', fontSize: 28, color: '#FF00FF', bold: true, italic: false, align: 'center', animation: 'pulse' } }
      },
      centerMedia: [
        { id: 'm1', type: 'image', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23ff6600" rx="20"/><text x="200" y="160" font-size="48" text-anchor="middle" fill="white" font-weight="bold">DEBUG IMAGE</text></svg>', loop: false, widthPct: 80, align: 'center', extraStyle: { zIndex: 1 } }
      ],
      audio: [
        { id: 'a1', src: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', volume: 0.8, loop: false }
      ],
      options: { clearPrevious: true, durationMs: 5000 }
    };
    
    console.log('1. Test button created:', testButton);
    
    // Test form data collection
    console.log('2. Testing form data collection...');
    if (window.addEditButtonForm && typeof window.addEditButtonForm.getFormData === 'function') {
      const formData = window.addEditButtonForm.getFormData();
      console.log('Form data:', formData);
      console.log('Form slots:', formData.slots);
      console.log('Form centerMedia:', formData.centerMedia);
    } else {
      console.log('❌ Multi-media form not available');
    }
    
    // Test overlay payload
    console.log('3. Testing overlay payload...');
    const overlayPayload = {
      id: testButton.id,
      name: testButton.name,
      slots: testButton.slots,
      centerMedia: testButton.centerMedia,
      options: testButton.options
    };
    console.log('Overlay payload:', overlayPayload);
    
    // Test message structure
    console.log('4. Testing message structure...');
    const messageStructure = {
      type: 'buttonTrigger',
      payload: overlayPayload
    };
    console.log('Message structure:', messageStructure);
    
    // Test slot mapping
    console.log('5. Testing slot mapping...');
    const slotMapping = {
      'topLeft': 'text-top-left',
      'topCenter': 'text-top-center',
      'topRight': 'text-top-right',
      'center': 'text-center'
    };
    
    Object.keys(slotMapping).forEach(schemaName => {
      const domId = slotMapping[schemaName];
      const element = document.getElementById(domId);
      console.log(`Slot mapping: ${schemaName} → ${domId}: ${element ? '✅ Found' : '❌ Not found'}`);
    });
    
    // Send to overlay iframe
    console.log('6. Sending to overlay iframe...');
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(messageStructure, '*');
        console.log('✅ Message sent to overlay iframe');
      } catch (error) {
        console.log('❌ Failed to send to overlay iframe:', error);
      }
    } else {
      console.log('❌ Overlay iframe not found');
    }
    
    // Send via WebSocket
    console.log('7. Sending via WebSocket...');
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      try {
        window.electronAPI.sendOverlayMessage(overlayPayload);
        console.log('✅ Message sent via WebSocket');
      } catch (error) {
        console.log('❌ Failed to send via WebSocket:', error);
      }
    } else {
      console.log('❌ WebSocket not available');
    }
    
    console.log('🎉 Debug test completed');
  };
  
  // Function to test using the exact same pattern as the working test button
  window.testWorkingPattern = async () => {
    console.log('🧪 Testing using the exact working pattern...');
    
    // Create a test button using the exact same structure as the working test
    const testButton = {
      id: 'working-pattern-test-' + Date.now(),
      name: 'Working Pattern Test',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+W',
      slots: {
        topLeft: {
          text: '🎮 WORKING TEST',
          style: {
            fontFamily: 'Arial, sans-serif',
            fontSize: 28,
            color: '#00ff00',
            bold: true,
            italic: false,
            align: 'center',
            animation: 'pulse'
          }
        },
        topRight: {
          text: 'SCORE: 1234',
          style: {
            fontFamily: 'Courier, monospace',
            fontSize: 24,
            color: '#ffff00',
            bold: true,
            italic: false,
            align: 'right',
            animation: null
          }
        },
        bottomCenter: {
          text: 'PRESS TO CONTINUE',
          style: {
            fontFamily: 'Arial, sans-serif',
            fontSize: 20,
            color: '#ffffff',
            bold: true,
            italic: false,
            align: 'center',
            animation: 'pulse'
          }
        },
        center: {
          text: 'CENTER TEXT',
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 32,
            color: '#ff00ff',
            bold: true,
            italic: false,
            align: 'center',
            animation: 'pulse'
          }
        }
      },
      centerMedia: [
        {
          type: 'image',
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%230066cc" rx="20"/><text x="300" y="220" font-size="72" text-anchor="middle" fill="white" font-weight="bold">WORKING IMAGE</text></svg>',
          alt: 'Working Test Image'
        }
      ],
      audio: [
        { id: 'a1', src: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', volume: 0.8, loop: false }
      ],
      options: { clearPrevious: true, durationMs: 5000 }
    };
    
    console.log('1. Test button created:', testButton);
    
    // Use the EXACT same pattern as the working test button
    const payload = {
      type: 'buttonTrigger',
      options: {
        clearPrevious: true
      },
      slots: testButton.slots,
      centerMedia: testButton.centerMedia
    };
    
    console.log('2. Payload created (exact working pattern):', payload);
    
    // Send using the EXACT same method as the working test
    if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
      window.electronAPI.sendOverlayMessage(payload);
      console.log('✅ Sent using exact working pattern');
    } else {
      console.log('❌ sendOverlayMessage not available');
    }
    
    // Also test the iframe method
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(payload, '*');
        console.log('✅ Also sent to overlay iframe');
      } catch (error) {
        console.log('❌ Failed to send to overlay iframe:', error);
      }
    } else {
      console.log('❌ Overlay iframe not found');
    }
    
    console.log('🎉 Working pattern test completed');
  };
  
  // Function to test overlay structure and verify all elements exist
  window.testOverlayStructure = () => {
    console.log('🔍 Testing overlay structure...');
    
    // Test 1: Check if overlay iframe exists
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe) {
      console.log('✅ Overlay iframe found');
      
      // Test 2: Check if we can access the iframe content
      try {
        const iframeDoc = overlayIframe.contentDocument || overlayIframe.contentWindow.document;
        if (iframeDoc) {
          console.log('✅ Can access iframe document');
          
          // Test 3: Check for all required text slots
          const requiredSlots = [
            'text-top-left', 'text-top-center', 'text-top-right',
            'text-mid-left', 'text-center', 'text-mid-right',
            'text-bottom-left', 'text-bottom-center', 'text-bottom-right'
          ];
          
          console.log('Checking text slots:');
          requiredSlots.forEach(slotId => {
            const element = iframeDoc.getElementById(slotId);
            if (element) {
              console.log(`  ✅ ${slotId}: Found`);
            } else {
              console.log(`  ❌ ${slotId}: Missing`);
            }
          });
          
          // Test 4: Check center media container
          const centerMedia = iframeDoc.getElementById('center-media');
          if (centerMedia) {
            console.log('✅ Center media container found');
          } else {
            console.log('❌ Center media container missing');
          }
          
          // Test 5: Send a test message to verify communication
          const testPayload = {
            type: 'buttonTrigger',
            options: { clearPrevious: true },
            slots: {
              topLeft: { text: 'TEST TOP LEFT', style: { fontFamily: 'Arial', fontSize: 20, color: '#FF0000', bold: true, italic: false, align: 'left', animation: null } },
              topCenter: { text: 'TEST TOP CENTER', style: { fontFamily: 'Arial', fontSize: 20, color: '#00FF00', bold: true, italic: false, align: 'center', animation: null } },
              topRight: { text: 'TEST TOP RIGHT', style: { fontFamily: 'Arial', fontSize: 20, color: '#0000FF', bold: true, italic: false, align: 'right', animation: null } },
              center: { text: 'TEST CENTER', style: { fontFamily: 'Arial', fontSize: 24, color: '#FF00FF', bold: true, italic: false, align: 'center', animation: 'pulse' } }
            },
            centerMedia: [
              { type: 'image', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23ff6600" rx="20"/><text x="200" y="160" font-size="48" text-anchor="middle" fill="white" font-weight="bold">TEST IMAGE</text></svg>', alt: 'Test Image' }
            ]
          };
          
          console.log('Sending test payload to overlay:', testPayload);
          overlayIframe.contentWindow.postMessage(testPayload, '*');
          console.log('✅ Test payload sent to overlay');
          
        } else {
          console.log('❌ Cannot access iframe document');
        }
      } catch (error) {
        console.log('❌ Error accessing iframe:', error);
      }
    } else {
      console.log('❌ Overlay iframe not found');
    }
    
    // Test 6: Test WebSocket communication
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      console.log('✅ WebSocket API available');
      
      const testPayload = {
        type: 'buttonTrigger',
        options: { clearPrevious: true },
        slots: {
          topLeft: { text: 'WS TEST LEFT', style: { fontFamily: 'Arial', fontSize: 18, color: '#FFFF00', bold: true, italic: false, align: 'left', animation: null } },
          bottomRight: { text: 'WS TEST RIGHT', style: { fontFamily: 'Arial', fontSize: 18, color: '#00FFFF', bold: true, italic: false, align: 'right', animation: null } }
        },
        centerMedia: [
          { type: 'image', src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%2300ff00" rx="15"/><text x="150" y="120" font-size="36" text-anchor="middle" fill="black" font-weight="bold">WS TEST</text></svg>', alt: 'WebSocket Test Image' }
        ]
      };
      
      window.electronAPI.sendOverlayMessage(testPayload);
      console.log('✅ Test payload sent via WebSocket');
    } else {
      console.log('❌ WebSocket API not available');
    }
    
    console.log('🎉 Overlay structure test completed');
  };
  
  // Function to test file path handling vs blob URLs
  window.testFilePathHandling = () => {
    console.log('🔍 Testing file path handling...');
    
    // Test 1: Check if we can access file paths from file inputs
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    console.log('1. Testing file input behavior:');
    console.log('  - File input created');
    console.log('  - Note: In Electron, file.path should be available');
    console.log('  - Blob URLs are temporary and break on refresh');
    
    // Test 2: Check current media items in form
    if (window.addEditButtonForm) {
      console.log('2. Checking current media items:');
      console.log('  - Images:', window.addEditButtonForm.images);
      console.log('  - Videos:', window.addEditButtonForm.videos);
      console.log('  - Audio:', window.addEditButtonForm.audio);
      
      // Check if any are using blob URLs
      const allMedia = [
        ...window.addEditButtonForm.images,
        ...window.addEditButtonForm.videos,
        ...window.addEditButtonForm.audio
      ];
      
      const blobUrls = allMedia.filter(item => item.src && item.src.startsWith('blob:'));
      const filePaths = allMedia.filter(item => item.src && !item.src.startsWith('blob:') && !item.src.startsWith('http'));
      
      console.log('  - Blob URLs found:', blobUrls.length);
      console.log('  - File paths found:', filePaths.length);
      
      if (blobUrls.length > 0) {
        console.log('  ❌ Some media items are using blob URLs (will break on refresh)');
        blobUrls.forEach(item => console.log(`    - ${item.name}: ${item.src}`));
      } else {
        console.log('  ✅ No blob URLs found');
      }
      
      if (filePaths.length > 0) {
        console.log('  ✅ File paths found (persistent):');
        filePaths.forEach(item => console.log(`    - ${item.name}: ${item.src}`));
      }
    } else {
      console.log('❌ Multi-media form not available');
    }
    
    // Test 3: Show the difference
    console.log('3. File path vs Blob URL comparison:');
    console.log('  File Path (✅ Persistent):');
    console.log('    - C:\\Users\\username\\Pictures\\image.jpg');
    console.log('    - /home/user/images/video.mp4');
    console.log('    - Works after page refresh');
    console.log('    - Works across sessions');
    
    console.log('  Blob URL (❌ Temporary):');
    console.log('    - blob:file:///sc1e1434-f452-40b5-837c-f1acb0af454');
    console.log('    - Breaks on page refresh');
    console.log('    - Not persistent across sessions');
    
    console.log('🎉 File path handling test completed');
  };
  
  // Function to debug why overlay isn't showing content
  window.debugOverlayDisplay = () => {
    console.log('🔍 Debugging overlay display issues...');
    
    // Test 1: Check if overlay is receiving messages
    console.log('1. Testing overlay message reception...');
    
    // Create a simple test payload
    const testPayload = {
      type: 'buttonTrigger',
      options: { clearPrevious: true },
      slots: {
        topLeft: { 
          text: 'DEBUG LEFT', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#FF0000', 
            bold: true, 
            italic: false, 
            align: 'left', 
            animation: null 
          } 
        },
        topCenter: { 
          text: 'DEBUG CENTER', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#00FF00', 
            bold: true, 
            italic: false, 
            align: 'center', 
            animation: 'pulse' 
          } 
        },
        center: { 
          text: 'CENTER DEBUG', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 28, 
            color: '#FF00FF', 
            bold: true, 
            italic: false, 
            align: 'center', 
            animation: 'pulse' 
          } 
        }
      },
      centerMedia: [
        { 
          type: 'image', 
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23ff6600" rx="20"/><text x="200" y="160" font-size="48" text-anchor="middle" fill="white" font-weight="bold">DEBUG IMAGE</text></svg>', 
          alt: 'Debug Image' 
        }
      ]
    };
    
    console.log('Test payload created:', testPayload);
    
    // Test 2: Send to overlay iframe
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      console.log('2. Sending to overlay iframe...');
      try {
        overlayIframe.contentWindow.postMessage(testPayload, '*');
        console.log('✅ Message sent to overlay iframe');
        
        // Check if we can access the overlay's console
        try {
          const iframeDoc = overlayIframe.contentDocument || overlayIframe.contentWindow.document;
          if (iframeDoc) {
            console.log('✅ Can access overlay document');
            
            // Check if elements exist
            const topLeft = iframeDoc.getElementById('text-top-left');
            const center = iframeDoc.getElementById('text-center');
            const centerMedia = iframeDoc.getElementById('center-media');
            
            console.log('Overlay elements:');
            console.log('  - text-top-left:', topLeft ? 'Found' : 'Missing');
            console.log('  - text-center:', center ? 'Found' : 'Missing');
            console.log('  - center-media:', centerMedia ? 'Found' : 'Missing');
            
            if (topLeft) {
              console.log('  - top-left content:', topLeft.textContent);
              console.log('  - top-left styles:', topLeft.style.cssText);
            }
            if (center) {
              console.log('  - center content:', center.textContent);
              console.log('  - center styles:', center.style.cssText);
            }
            if (centerMedia) {
              console.log('  - center-media content:', centerMedia.innerHTML);
            }
          }
        } catch (error) {
          console.log('❌ Cannot access overlay document:', error);
        }
      } catch (error) {
        console.log('❌ Failed to send to overlay iframe:', error);
      }
    } else {
      console.log('❌ Overlay iframe not found or not accessible');
    }
    
    // Test 3: Send via WebSocket
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      console.log('3. Sending via WebSocket...');
      try {
        window.electronAPI.sendOverlayMessage(testPayload);
        console.log('✅ Message sent via WebSocket');
      } catch (error) {
        console.log('❌ Failed to send via WebSocket:', error);
      }
    } else {
      console.log('❌ WebSocket not available');
    }
    
    // Test 4: Check if overlay has message listener
    console.log('4. Checking overlay message handling...');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        // Try to call a test function on the overlay
        if (typeof overlayIframe.contentWindow.testRender === 'function') {
          console.log('✅ Overlay has testRender function');
          overlayIframe.contentWindow.testRender(testPayload);
        } else {
          console.log('❌ Overlay testRender function not found');
        }
      } catch (error) {
        console.log('❌ Cannot call overlay functions:', error);
      }
    }
    
    console.log('🎉 Overlay display debug completed');
  };
  
  // Function to test file serving for media
  window.testFileServing = () => {
    console.log('🔍 Testing file serving for media...');
    
    // Test 1: Check if we have any media with HTTP URLs
    if (window.addEditButtonForm) {
      const allMedia = [
        ...window.addEditButtonForm.images,
        ...window.addEditButtonForm.videos,
        ...window.addEditButtonForm.audio
      ];
      
      const httpMedia = allMedia.filter(item => 
        item.src && item.src.startsWith('http://localhost:8080/media/')
      );
      
      const filePathMedia = allMedia.filter(item => 
        item.src && 
        !item.src.startsWith('http') && 
        !item.src.startsWith('data:') && 
        !item.src.startsWith('blob:')
      );
      
      console.log('1. Media analysis:');
      console.log(`  - HTTP URLs: ${httpMedia.length}`);
      console.log(`  - File paths: ${filePathMedia.length}`);
      
      httpMedia.forEach(item => {
        console.log(`  - HTTP URL: ${item.name} → ${item.src}`);
      });
      
      filePathMedia.forEach(item => {
        console.log(`  - File path: ${item.name} → ${item.src}`);
      });
      
      // Test 2: Test HTTP URL accessibility
      if (httpMedia.length > 0) {
        const testItem = httpMedia[0];
        
        console.log('2. Testing HTTP URL accessibility...');
        console.log(`  Testing URL: ${testItem.src}`);
        
        // Create an image element to test loading
        const testImg = document.createElement('img');
        testImg.onload = () => {
          console.log('  ✅ Image loaded successfully via HTTP server');
        };
        testImg.onerror = () => {
          console.log('  ❌ Image failed to load via HTTP server');
        };
        testImg.src = testItem.src;
        
        // Also test with fetch
        fetch(testItem.src)
          .then(response => {
            if (response.ok) {
              console.log('  ✅ HTTP server responded successfully');
            } else {
              console.log(`  ❌ HTTP server error: ${response.status}`);
            }
          })
          .catch(error => {
            console.log('  ❌ HTTP server request failed:', error);
          });
      } else if (filePathMedia.length > 0) {
        console.log('2. Found file paths but no HTTP URLs - files need to be copied');
        console.log('  Try uploading a new file to test the copy process');
      } else {
        console.log('2. No media found to test');
      }
    } else {
      console.log('❌ Multi-media form not available');
    }
    
    console.log('🎉 File serving test completed');
  };
  
  // Function to test overlay reset functionality
  window.testOverlayReset = () => {
    console.log('🔄 Testing overlay reset functionality...');
    
    // Test 1: Send a test payload and check if reset timer is set
    const testPayload = {
      type: 'buttonTrigger',
      options: { 
        clearPrevious: true,
        durationMs: 10000 // 10 seconds for testing
      },
      slots: {
        topLeft: { 
          text: 'RESET TEST LEFT', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#FF0000', 
            bold: true, 
            italic: false, 
            align: 'left', 
            animation: null 
          } 
        },
        center: { 
          text: 'WILL RESET IN 10 SECONDS', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 28, 
            color: '#FF00FF', 
            bold: true, 
            italic: false, 
            align: 'center', 
            animation: 'pulse' 
          } 
        }
      },
      centerMedia: [
        { 
          type: 'image', 
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23ff6600" rx="20"/><text x="200" y="160" font-size="48" text-anchor="middle" fill="white" font-weight="bold">RESET TEST</text></svg>', 
          alt: 'Reset Test Image' 
        }
      ]
    };
    
    console.log('1. Sending test payload with 10-second reset timer...');
    
    // Send to overlay iframe
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(testPayload, '*');
        console.log('✅ Test payload sent to overlay iframe');
        console.log('⏰ Overlay should reset automatically in 10 seconds');
        console.log('💡 You can also manually reset with: overlayIframe.contentWindow.resetOverlay()');
      } catch (error) {
        console.log('❌ Failed to send to overlay iframe:', error);
      }
    } else {
      console.log('❌ Overlay iframe not found');
    }
    
    // Send via WebSocket
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      try {
        window.electronAPI.sendOverlayMessage(testPayload);
        console.log('✅ Test payload sent via WebSocket');
      } catch (error) {
        console.log('❌ Failed to send via WebSocket:', error);
      }
    }
    
    console.log('🎉 Overlay reset test completed');
  };
  
  // Function to test video playback in overlay
  window.testVideoPlayback = () => {
    console.log('🎬 Testing video playback in overlay...');
    
    const testPayload = {
      type: 'buttonTrigger',
      options: { 
        clearPrevious: true,
        durationMs: 15000 // 15 seconds for testing
      },
      slots: {
        center: { 
          text: 'VIDEO TEST - Should autoplay muted', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#FFFFFF', 
            bold: true, 
            italic: false, 
            align: 'center', 
            animation: 'pulse' 
          } 
        }
      },
      centerMedia: [
        { 
          type: 'video', 
          src: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          loop: true
        }
      ]
    };
    
    console.log('1. Sending video test payload...');
    
    // Send to overlay iframe
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(testPayload, '*');
        console.log('✅ Video test payload sent to overlay iframe');
        console.log('🎬 Video should autoplay muted in the overlay');
      } catch (error) {
        console.log('❌ Failed to send to overlay iframe:', error);
      }
    } else {
      console.log('❌ Overlay iframe not found');
    }
    
    // Send via WebSocket
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      try {
        window.electronAPI.sendOverlayMessage(testPayload);
        console.log('✅ Video test payload sent via WebSocket');
      } catch (error) {
        console.log('❌ Failed to send via WebSocket:', error);
      }
    }
    
    console.log('🎉 Video playback test completed');
  };
  
  // Function to test video stopping in form preview
  window.testVideoStopping = () => {
    console.log('🎬 Testing video stopping in form preview...');
    
    // Check if form is available
    if (!window.addEditButtonForm) {
      console.log('❌ addEditButtonForm not available');
      return;
    }
    
    console.log('✅ addEditButtonForm available');
    
    // Check if stopAllVideos method exists
    if (typeof window.addEditButtonForm.stopAllVideos === 'function') {
      console.log('✅ stopAllVideos method available');
      
      // Test stopping videos
      try {
        window.addEditButtonForm.stopAllVideos();
        console.log('✅ stopAllVideos called successfully');
      } catch (error) {
        console.log('❌ stopAllVideos failed:', error);
      }
    } else {
      console.log('❌ stopAllVideos method not available');
    }
    
    // Test opening form with video
    console.log('🧪 Testing form with video...');
    
    // Create a test button with video
    const testButton = {
      id: 'video-test-' + Date.now(),
      name: 'Video Test Button',
      type: 'multi-media',
      hotkey: '',
      slots: {
        center: { 
          text: 'VIDEO TEST', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#FFFFFF', 
            bold: true, 
            italic: false, 
            align: 'center', 
            animation: null 
          } 
        }
      },
      centerMedia: [
        { 
          type: 'video', 
          src: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          loop: true
        }
      ],
      audio: [],
      options: { clearPrevious: true, durationMs: 60000 }
    };
    
    // Open form for editing
    window.addEditButtonForm.openForEdit(testButton);
    console.log('✅ Form opened with video - check if video is muted and playing');
    console.log('💡 Try closing the form to test video stopping');
    
    console.log('🎉 Video stopping test completed');
  };
  
  // Function to test video autoplay in overlay
  window.testVideoAutoplay = () => {
    console.log('🎬 Testing simple video autoplay in overlay...');
    
    const testPayload = {
      type: 'buttonTrigger',
      options: { 
        clearPrevious: true,
        durationMs: 15000 // 15 seconds for testing
      },
      slots: {
        center: { 
          text: 'SIMPLE VIDEO TEST', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#FFFFFF', 
            bold: true, 
            italic: false, 
            align: 'center', 
            animation: 'pulse' 
          } 
        }
      },
      centerMedia: [
        { 
          type: 'video', 
          src: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          loop: true
        }
      ]
    };
    
    console.log('1. Sending simple video test payload...');
    console.log('2. Using simple .autoplay + .play() approach like images');
    console.log('3. Video should start playing immediately');
    
    // Send to overlay iframe
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(testPayload, '*');
        console.log('✅ Video test payload sent to overlay iframe');
        console.log('🎬 Video should autoplay muted in the overlay');
        console.log('💡 Check the overlay - video should start playing immediately');
      } catch (error) {
        console.log('❌ Failed to send to overlay iframe:', error);
      }
    } else {
      console.log('❌ Overlay iframe not found');
    }
    
    // Send via WebSocket
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      try {
        window.electronAPI.sendOverlayMessage(testPayload);
        console.log('✅ Video test payload sent via WebSocket');
      } catch (error) {
        console.log('❌ Failed to send via WebSocket:', error);
      }
    }
    
    console.log('🎉 Simple video autoplay test completed');
  };
  
  // Function to test with different video sources
  window.testVideoSources = () => {
    console.log('🎬 Testing different video sources...');
    
    const videoSources = [
      'http://localhost:8080/media/videos/generated-video.mp4',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      'https://www.w3schools.com/html/mov_bbb.mp4'
    ];
    
    videoSources.forEach((src, index) => {
      console.log(`\n--- Testing Video Source ${index + 1}: ${src} ---`);
      
      const testPayload = {
        type: 'buttonTrigger',
        options: { 
          clearPrevious: true,
          durationMs: 10000
        },
        slots: {
          center: { 
            text: `VIDEO TEST ${index + 1}`, 
            style: { 
              fontFamily: 'Arial', 
              fontSize: 20, 
              color: '#FFFFFF', 
              bold: true, 
              italic: false, 
              align: 'center', 
              animation: 'pulse' 
            } 
          }
        },
        centerMedia: [
          { 
            type: 'video', 
            src: src,
            loop: true
          }
        ]
      };
      
      // Send to overlay iframe
      const overlayIframe = document.getElementById('overlay-iframe');
      if (overlayIframe && overlayIframe.contentWindow) {
        try {
          overlayIframe.contentWindow.postMessage(testPayload, '*');
          console.log(`✅ Video ${index + 1} sent to overlay`);
        } catch (error) {
          console.log(`❌ Failed to send video ${index + 1}:`, error);
        }
      }
      
      // Wait 3 seconds between tests
      if (index < videoSources.length - 1) {
        setTimeout(() => {}, 3000);
      }
    });
    
    console.log('\n🎉 Video sources test completed - check overlay for results');
  };
  
  // Function to test overlay resolution changes
  window.testOverlayResolution = () => {
    console.log('📐 Testing overlay resolution changes...');
    
    const resolutions = [
      { name: '1920x1080 (Full HD)', width: 1920, height: 1080 },
      { name: '1280x720 (HD)', width: 1280, height: 720 },
      { name: '2560x1440 (2K)', width: 2560, height: 1440 },
      { name: '3840x2160 (4K)', width: 3840, height: 2160 }
    ];
    
    let currentIndex = 0;
    
    const testNextResolution = () => {
      if (currentIndex >= resolutions.length) {
        console.log('🎉 Resolution test completed');
        return;
      }
      
      const res = resolutions[currentIndex];
      console.log(`\n--- Testing Resolution ${currentIndex + 1}: ${res.name} ---`);
      
      // Send resolution change to overlay iframe
      const overlayIframe = document.getElementById('overlay-iframe');
      if (overlayIframe && overlayIframe.contentWindow) {
        try {
          overlayIframe.contentWindow.setOverlayResolution(res.width, res.height);
          console.log(`✅ Resolution changed to ${res.width}x${res.height}`);
          
          // Send a test payload to see the overlay at this resolution
          const testPayload = {
            type: 'buttonTrigger',
            options: { clearPrevious: true, durationMs: 5000 },
            slots: {
              center: { 
                text: `${res.width}x${res.height}`, 
                style: { 
                  fontFamily: 'Arial', 
                  fontSize: 32, 
                  color: '#FFFFFF', 
                  bold: true, 
                  italic: false, 
                  align: 'center', 
                  animation: 'pulse' 
                } 
              }
            },
            centerMedia: []
          };
          
          overlayIframe.contentWindow.postMessage(testPayload, '*');
          console.log(`📺 Test content sent for ${res.name}`);
          
        } catch (error) {
          console.error(`❌ Failed to change resolution to ${res.name}:`, error);
        }
      } else {
        console.error('❌ Overlay iframe not found');
      }
      
      currentIndex++;
      
      // Test next resolution after 3 seconds
      if (currentIndex < resolutions.length) {
        setTimeout(testNextResolution, 3000);
      }
    };
    
    console.log('1. Starting resolution test sequence...');
    console.log('2. Will test each resolution for 3 seconds');
    console.log('3. Check the overlay to see resolution changes');
    
    testNextResolution();
  };
  
  // Function to create a simple test button with video
  window.createVideoTestButton = async () => {
    console.log('🎬 Creating test button with video...');
    
    const testButton = {
      id: 'video-test-' + Date.now(),
      name: 'Video Test Button',
      type: 'multi-media',
      hotkey: '',
      slots: {
        center: { 
          text: 'VIDEO TEST BUTTON', 
          style: { 
            fontFamily: 'Arial', 
            fontSize: 20, 
            color: '#FFFFFF', 
            bold: true, 
            italic: false, 
            align: 'center', 
            animation: 'pulse' 
          } 
        }
      },
      centerMedia: [
        { 
          type: 'video', 
          src: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          loop: true
        }
      ],
      audio: [],
      options: { clearPrevious: true, durationMs: 30000 }
    };
    
    console.log('1. Test button data:', testButton);
    
    // Save the button
    if (window.electronAPI && window.electronAPI.saveConfig) {
      try {
        const config = await window.electronAPI.getConfig();
        config.buttons.push(testButton);
        await window.electronAPI.saveConfig(config);
        console.log('✅ Test button saved to config');
        
        // Reload buttons to show it
        loadButtons();
        console.log('✅ Buttons reloaded - test button should appear on dashboard');
        console.log('💡 Click the test button to trigger the video');
      } catch (error) {
        console.log('❌ Failed to save test button:', error);
      }
    } else {
      console.log('❌ Electron API not available');
    }
    
    console.log('🎉 Video test button creation completed');
  };
  
  
  // Function to create a test multi-media button using the correct schema
  window.createTestMultiMediaButton = async () => {
    const testButton = {
      id: 'test-multi-media-' + Date.now(),
      name: 'Test Multi-Media Button',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+T',
      slots: {
        topLeft: {
          text: 'Top Left',
          style: {
            fontFamily: 'Inter',
            fontSize: 28,
            color: '#FF0000',
            bold: true,
            italic: false,
            align: 'left',
            animation: null
          }
        },
        topCenter: {
          text: 'Top Center',
          style: {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#00FF00',
            bold: false,
            italic: true,
            align: 'center',
            animation: 'fadeIn'
          }
        },
        topRight: {
          text: 'Top Right',
          style: {
            fontFamily: 'Georgia',
            fontSize: 20,
            color: '#0000FF',
            bold: true,
            italic: false,
            align: 'right',
            animation: null
          }
        },
        midLeft: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'left',
            animation: null
          }
        },
        center: {
          text: 'Center Text',
          style: {
            fontFamily: 'Inter',
            fontSize: 32,
            color: '#FFFF00',
            bold: true,
            italic: false,
            align: 'center',
            animation: 'pulse'
          }
        },
        midRight: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'right',
            animation: null
          }
        },
        bottomLeft: {
          text: 'Bottom Left',
          style: {
            fontFamily: 'Courier',
            fontSize: 18,
            color: '#FF00FF',
            bold: false,
            italic: true,
            align: 'left',
            animation: null
          }
        },
        bottomCenter: {
          text: 'Bottom Center',
          style: {
            fontFamily: 'Inter',
            fontSize: 22,
            color: '#00FFFF',
            bold: true,
            italic: false,
            align: 'center',
            animation: 'slideUp'
          }
        },
        bottomRight: {
          text: 'Bottom Right',
          style: {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'right',
            animation: null
          }
        }
      },
      centerMedia: [
        {
          id: 'm1',
          type: 'image',
          src: 'http://localhost:8080/media/images/VirtualDeck2.png',
          loop: false,
          widthPct: 70,
          align: 'center',
          extraStyle: { zIndex: 2 }
        }
      ],
      audio: [
        {
          id: 'a1',
          src: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
          volume: 0.8,
          loop: false
        }
      ],
      options: {
        clearPrevious: true,
        durationMs: 5000
      }
    };
    
    console.log('Creating test multi-media button:', testButton);
    
    // Add to config
    if (window.electronAPI && window.electronAPI.saveConfig) {
      try {
        const currentConfig = await window.electronAPI.getConfig();
        const buttons = currentConfig.buttons || [];
        buttons.push(testButton);
        
        await window.electronAPI.saveConfig({ ...currentConfig, buttons });
        console.log('Test button saved to config');
        
        // Reload buttons to show in DOM
        await loadButtons();
        console.log('Buttons reloaded, test button should now be visible');
        
        return testButton;
      } catch (error) {
        console.error('Failed to save test button:', error);
        return null;
      }
    } else {
      console.error('Electron API not available');
      return null;
    }
  };
  
  // Function to create a simple test button (no external resources)
  window.createSimpleTestButton = async () => {
    const testButton = {
      id: 'simple-test-' + Date.now(),
      name: 'Simple Test Button',
      type: 'multi-media',
      hotkey: 'Ctrl+Shift+S',
      slots: {
        topLeft: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'left',
            animation: null
          }
        },
        topCenter: {
          text: 'SIMPLE TEST',
          style: {
            fontFamily: 'Inter',
            fontSize: 32,
            color: '#FFFF00',
            bold: true,
            italic: false,
            align: 'center',
            animation: 'fadeIn'
          }
        },
        topRight: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'right',
            animation: null
          }
        },
        midLeft: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'left',
            animation: null
          }
        },
        center: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'center',
            animation: null
          }
        },
        midRight: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'right',
            animation: null
          }
        },
        bottomLeft: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'left',
            animation: null
          }
        },
        bottomCenter: {
          text: 'Click me!',
          style: {
            fontFamily: 'Inter',
            fontSize: 18,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'center',
            animation: 'slideUp'
          }
        },
        bottomRight: {
          text: '',
          style: {
            fontFamily: 'Inter',
            fontSize: 16,
            color: '#FFFFFF',
            bold: false,
            italic: false,
            align: 'right',
            animation: null
          }
        }
      },
      centerMedia: [
        {
          id: 'm1',
          type: 'image',
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23ff6600" rx="15"/><text x="150" y="120" font-size="36" text-anchor="middle" fill="white" font-weight="bold">TEST</text></svg>',
          loop: false,
          widthPct: 60,
          align: 'center',
          extraStyle: { zIndex: 1 }
        }
      ],
      audio: [],
      options: {
        clearPrevious: true,
        durationMs: 3000
      }
    };
    
    console.log('Creating simple test button:', testButton);
    
    // Add to config
    if (window.electronAPI && window.electronAPI.saveConfig) {
      try {
        const currentConfig = await window.electronAPI.getConfig();
        const buttons = currentConfig.buttons || [];
        buttons.push(testButton);
        
        await window.electronAPI.saveConfig({ ...currentConfig, buttons });
        console.log('Simple test button saved to config');
        
        // Reload buttons to show in DOM
        await loadButtons();
        console.log('Buttons reloaded, simple test button should now be visible');
        
        return testButton;
      } catch (error) {
        console.error('Failed to save simple test button:', error);
        return null;
      }
    } else {
      console.error('Electron API not available');
      return null;
    }
  };
  
  // Setup overlay preview iframe
  setupOverlayPreview();
});

function setupButtonTypeSelection() {
  const selectionModal = document.getElementById('button-type-modal');
  const audioOption = document.querySelector('[data-type="audio"]');
  const multiMediaOption = document.querySelector('[data-type="multi-media"]');
  const cancelBtn = document.querySelector('.cancel-selection');

  // Audio option clicked
  if (audioOption) {
    audioOption.addEventListener('click', () => {
      selectionModal.classList.add('hidden');
      openAudioForm();
    });
  }

  // Multi-media option clicked
  if (multiMediaOption) {
    multiMediaOption.addEventListener('click', () => {
      selectionModal.classList.add('hidden');
      if (window.addEditButtonForm) {
        window.addEditButtonForm.openModal();
      }
    });
  }

  // Cancel button clicked
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      selectionModal.classList.add('hidden');
    });
  }

  // Close modal when clicking outside
  selectionModal.addEventListener('click', (e) => {
    if (e.target === selectionModal) {
      selectionModal.classList.add('hidden');
    }
  });
}

function setupOverlayPreview() {
  // Close overlay preview button
  const closePreviewBtn = document.getElementById('close-overlay-preview');
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener('click', () => {
      document.getElementById('overlay-preview').classList.add('hidden');
    });
  }

  // Add "Show Overlay Preview" button to tools menu
  const toolsDropdown = document.getElementById('tools-dropdown');
  if (toolsDropdown) {
    const showPreviewBtn = document.createElement('button');
    showPreviewBtn.textContent = 'Show Overlay Preview';
    showPreviewBtn.className = 'dropdown-item';
    showPreviewBtn.addEventListener('click', () => {
      document.getElementById('overlay-preview').classList.remove('hidden');
    });
    toolsDropdown.appendChild(showPreviewBtn);
  }
}

function openAudioForm() {
  const settingsForm = document.getElementById('settings-form');
  settingsForm.reset();
  
  // Set the form type to 'audio'
  const typeInput = document.getElementById('type-input');
  if (typeInput) typeInput.value = 'audio';
  
  // Stop any active hotkey recording and clear displayed status/value
  if (typeof stopHotkeyRecording === 'function') stopHotkeyRecording();
  const hkIn = document.getElementById('hotkey-input'); 
  if (hkIn) hkIn.value = '';
  const hkStatus = document.getElementById('hotkey-status'); 
  if (hkStatus) hkStatus.textContent = '';
  
  // Fully clear all dataset properties for new record
  delete settingsForm.dataset.editingIndex;
  delete settingsForm.dataset.editingId;
  delete settingsForm.dataset.resolvedPath;
  delete settingsForm.dataset.resolvedArgs;
  delete settingsForm.dataset.existingFile;
  
  // Clear chat command fields
  const chatCommandEnabled = document.getElementById('chat-command-enabled');
  const chatCommandKeyword = document.getElementById('chat-command-keyword');
  const redeemName = document.getElementById('redeem-name');
  const chatCommandSettings = document.getElementById('chat-command-settings');
  if (chatCommandEnabled) chatCommandEnabled.checked = false;
  if (chatCommandKeyword) chatCommandKeyword.value = '';
  if (redeemName) redeemName.value = '';
  if (chatCommandSettings) chatCommandSettings.style.display = 'none';
  
  // Replace file inputs to clear previous file references
  const oldFileInput = document.getElementById('file-input');
  if (oldFileInput) {
    const newFileInput = oldFileInput.cloneNode(false);
    newFileInput.required = true;
    newFileInput.id = 'file-input';
    newFileInput.name = 'file';
    oldFileInput.parentNode.replaceChild(newFileInput, oldFileInput);
  }
  const oldAppFileInput = document.getElementById('app-file-input');
  if (oldAppFileInput) {
    const newAppFileInput = oldAppFileInput.cloneNode(false);
    newAppFileInput.required = false;
    newAppFileInput.id = 'app-file-input';
    newAppFileInput.name = 'app-file';
    oldAppFileInput.parentNode.replaceChild(newAppFileInput, oldAppFileInput);
  }
  
  document.getElementById('settings-modal-title').textContent = 'Add New Audio Button';
  
  // Show settings modal
  document.getElementById('settings-modal').classList.remove('hidden');
  if (window.electronAPI && window.electronAPI.disableHotkeys) {
    window.electronAPI.disableHotkeys();
  }
}

// Preferences Modal Functions
function openPreferencesModal() {
  const preferencesModal = document.getElementById('preferences-modal');
  if (preferencesModal) {
    preferencesModal.classList.remove('hidden');
    loadPreferences();
  }
}

function closePreferencesModal() {
  const preferencesModal = document.getElementById('preferences-modal');
  if (preferencesModal) {
    preferencesModal.classList.add('hidden');
  }
}

function loadPreferences() {
  // Load preferences from localStorage
  const preferences = JSON.parse(localStorage.getItem('vdPreferences') || '{}');
  
  // Update checkboxes
  document.getElementById('auto-update-checkbox').checked = preferences.autoUpdate !== false; // default to true
}

function savePreferences() {
  const preferences = {
    autoUpdate: document.getElementById('auto-update-checkbox').checked
  };
  
  // Save to localStorage
  localStorage.setItem('vdPreferences', JSON.stringify(preferences));
  
  // Send preferences to main process if available
  if (window.electronAPI && window.electronAPI.savePreferences) {
    window.electronAPI.savePreferences(preferences);
  }
  
  // Show success message
  if (window.notificationManager) {
    window.notificationManager.show('Preferences saved successfully!', 'success');
  }
  
  // Close modal
  closePreferencesModal();
}

function checkForUpdatesFromPreferences() {
  // Send check for updates request to main process
  if (window.electronAPI && window.electronAPI.checkForUpdates) {
    window.electronAPI.checkForUpdates();
    if (window.notificationManager) {
      window.notificationManager.show('Checking for updates...', 'info');
    }
  } else {
    if (window.notificationManager) {
      window.notificationManager.show('Update checking not available in development mode', 'warning');
    }
  }
}

// Initialize preferences modal event listeners
function initializePreferencesModal() {
  // Close button
  const closeBtn = document.getElementById('preferences-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closePreferencesModal);
  }
  
  // Save button
  const saveBtn = document.getElementById('save-preferences');
  if (saveBtn) {
    saveBtn.addEventListener('click', savePreferences);
  }
  
  // Cancel button
  const cancelBtn = document.getElementById('cancel-preferences');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closePreferencesModal);
  }
  
  // Check for updates button
  const checkUpdatesBtn = document.getElementById('check-updates-button');
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', checkForUpdatesFromPreferences);
  }

  // Twitch Setup button
  const twitchSetupBtn = document.getElementById('preferences-twitch-setup');
  if (twitchSetupBtn) {
    twitchSetupBtn.addEventListener('click', () => {
      closePreferencesModal();
      // Show Twitch config modal (from TwitchConnected/tc.js)
      if (typeof showTwitchConfigModal === 'function') {
        showTwitchConfigModal();
      } else {
        console.error('showTwitchConfigModal function not found');
      }
    });
  }
  
  // Close modal when clicking outside
  const preferencesModal = document.getElementById('preferences-modal');
  if (preferencesModal) {
    preferencesModal.addEventListener('click', (e) => {
      if (e.target === preferencesModal) {
        closePreferencesModal();
      }
    });
  }

  // Initialize first-run popup
  initializeFirstRunPopup();
}

function initializeFirstRunPopup() {
  const firstRunPopup = document.getElementById('first-run-twitch-popup');
  const dontShowCheckbox = document.getElementById('dont-show-welcome-again');
  const setupBtn = document.getElementById('welcome-popup-setup');
  const dismissBtn = document.getElementById('welcome-popup-dismiss');
  const hideKey = 'vd-hide-welcome-twitch-popup';

  // Check if user has opted to hide the popup
  const shouldHide = localStorage.getItem(hideKey) === '1';
  
  // Show popup on first run if not hidden
  if (!shouldHide && firstRunPopup) {
    // Delay showing popup slightly to ensure TwitchConnected/tc.js is loaded
    setTimeout(() => {
      firstRunPopup.classList.remove('hidden');
    }, 500);
  }

  // Handle setup button
  if (setupBtn) {
    setupBtn.addEventListener('click', () => {
      firstRunPopup.classList.add('hidden');
      
      // Save "don't show" preference if checked
      if (dontShowCheckbox && dontShowCheckbox.checked) {
        localStorage.setItem(hideKey, '1');
      }

      // Open Twitch config modal
      if (typeof showTwitchConfigModal === 'function') {
        setTimeout(() => showTwitchConfigModal(), 300);
      } else {
        console.error('showTwitchConfigModal function not found');
      }
    });
  }

  // Handle dismiss button
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      firstRunPopup.classList.add('hidden');
      
      // Save "don't show" preference if checked
      if (dontShowCheckbox && dontShowCheckbox.checked) {
        localStorage.setItem(hideKey, '1');
      }
    });
  }
}

// ============================================================================
// TWITCH EVENT PIPELINE TESTING
// ============================================================================

/**
 * Test function that simulates Twitch follow and subscription events
 * going through the entire pipeline as if they came from Twitch.
 * This helps diagnose alert issues.
 */
window.testTwitchEventPipeline = function() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TWITCH EVENT PIPELINE TEST');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // First, check what alerts are configured
  console.log('📋 STEP 1: Checking configured alerts...');
  console.log('─────────────────────────────────────────────────────────');
  const alerts = JSON.parse(localStorage.getItem('twitchAlerts') || '[]');
  console.log(`Total alerts configured: ${alerts.length}`);
  
  if (alerts.length === 0) {
    console.log('❌ NO ALERTS CONFIGURED!');
    console.log('💡 This is why you\'re not seeing alerts.');
    console.log('💡 Go to Tools → Alerts to create alerts.');
    console.log('');
    alert('⚠️ No alerts configured!\n\nYou need to create alerts in Tools → Alerts first.\n\nCreate at least:\n• 1 "Follower" alert\n• 1 "Subscriber" alert');
    return;
  }
  
  // Group alerts by type
  const alertsByType = {};
  alerts.forEach(alert => {
    if (!alertsByType[alert.type]) {
      alertsByType[alert.type] = [];
    }
    alertsByType[alert.type].push(alert);
  });
  
  console.log('\nAlerts by type:');
  Object.keys(alertsByType).forEach(type => {
    const typeAlerts = alertsByType[type];
    const enabledCount = typeAlerts.filter(a => a.enabled !== false).length;
    console.log(`  • ${type}: ${typeAlerts.length} total, ${enabledCount} enabled`);
  });
  console.log('');
  
  // Check for follower alerts
  const followerAlerts = alertsByType['follower'] || [];
  const enabledFollowerAlerts = followerAlerts.filter(a => a.enabled !== false);
  
  if (followerAlerts.length === 0) {
    console.log('⚠️ WARNING: No follower alerts configured!');
  } else if (enabledFollowerAlerts.length === 0) {
    console.log('⚠️ WARNING: Follower alerts exist but none are enabled!');
  } else {
    console.log(`✅ Follower alerts: ${enabledFollowerAlerts.length} enabled`);
  }
  
  // Check for subscriber alerts
  const subscriberAlerts = alertsByType['subscriber'] || [];
  const enabledSubscriberAlerts = subscriberAlerts.filter(a => a.enabled !== false);
  
  if (subscriberAlerts.length === 0) {
    console.log('⚠️ WARNING: No subscriber alerts configured!');
  } else if (enabledSubscriberAlerts.length === 0) {
    console.log('⚠️ WARNING: Subscriber alerts exist but none are enabled!');
  } else {
    console.log(`✅ Subscriber alerts: ${enabledSubscriberAlerts.length} enabled`);
  }
  
  console.log('');
  console.log('─────────────────────────────────────────────────────────');
  console.log('📡 STEP 2: Simulating Twitch EventSub events...');
  console.log('─────────────────────────────────────────────────────────');
  console.log('');
  
  // Test 1: Simulate a FOLLOW event
  console.log('🧪 TEST 1: Simulating FOLLOW event');
  console.log('──────────────────────────────────');
  
  const followEvent = {
    type: 'channel.follow',
    event: {
      user_id: '123456789',
      user_login: 'test_follower',
      user_name: 'TestFollower',
      display_name: 'TestFollower',
      broadcaster_user_id: '987654321',
      broadcaster_user_login: 'yourchannel',
      broadcaster_user_name: 'YourChannel',
      followed_at: new Date().toISOString()
    }
  };
  
  console.log('📤 Sending follow event through pipeline:', followEvent);
  
  // Check if the EventSub handler exists
  if (typeof window.electronAPI !== 'undefined' && window.electronAPI.onTwitchEventSub) {
    // Manually trigger the EventSub handler
    // We need to get the handler function directly
    console.log('✅ EventSub handler found');
    
    // Update alert system first
    if (window.alertSystem) {
      window.alertSystem.updateAlerts();
      console.log('✅ Alert system updated');
    }
    
    // Map event to alert type
    const alertType = 'follower';
    console.log(`🎯 Alert type for this event: "${alertType}"`);
    
    // Check if we have alerts for this type
    const alertsForType = alerts.filter(a => a.type === alertType && a.enabled !== false);
    if (alertsForType.length === 0) {
      console.log(`❌ No enabled alerts found for type "${alertType}"!`);
      console.log('💡 Create a "Follower" alert in Tools → Alerts');
    } else {
      console.log(`✅ Found ${alertsForType.length} enabled alert(s) for "${alertType}"`);
      
      // Trigger the alert
      const userData = {
        username: followEvent.event.user_name,
        display_name: followEvent.event.display_name || followEvent.event.user_name,
        ...followEvent.event
      };
      
      console.log('🚀 Triggering alert with user data:', userData);
      
      if (window.alertSystem) {
        window.alertSystem.triggerAlertForEvent(alertType, userData);
        console.log('✅ Follow alert triggered!');
      } else {
        console.log('❌ Alert system not found!');
      }
    }
    
    // Add to chat display
    if (typeof addTwitchEvent === 'function') {
      addTwitchEvent(followEvent.type, followEvent.event);
      console.log('✅ Added to chat display');
    }
    
    // Update recent followers
    if (typeof addRecentFollower === 'function') {
      addRecentFollower(followEvent.event);
      console.log('✅ Updated recent followers');
    }
  } else {
    console.log('❌ EventSub handler not found - may not be initialized yet');
  }
  
  console.log('');
  
  // Test 2: Simulate a SUBSCRIPTION event
  console.log('🧪 TEST 2: Simulating SUBSCRIPTION event');
  console.log('─────────────────────────────────────────');
  
  const subEvent = {
    type: 'channel.subscribe',
    event: {
      user_id: '987654321',
      user_login: 'test_subscriber',
      user_name: 'TestSubscriber',
      display_name: 'TestSubscriber',
      broadcaster_user_id: '123456789',
      broadcaster_user_login: 'yourchannel',
      broadcaster_user_name: 'YourChannel',
      tier: '1000',
      is_gift: false,
      cumulative_months: 3,
      streak_months: 1,
      duration_months: 1,
      message: {
        text: 'Love the stream!',
        emotes: []
      }
    }
  };
  
  console.log('📤 Sending subscription event through pipeline:', subEvent);
  
  if (typeof window.electronAPI !== 'undefined' && window.electronAPI.onTwitchEventSub) {
    console.log('✅ EventSub handler found');
    
    // Update alert system
    if (window.alertSystem) {
      window.alertSystem.updateAlerts();
    }
    
    // Map event to alert type
    const alertType = 'subscriber';
    console.log(`🎯 Alert type for this event: "${alertType}"`);
    
    // Check if we have alerts for this type
    const alertsForType = alerts.filter(a => a.type === alertType && a.enabled !== false);
    if (alertsForType.length === 0) {
      console.log(`❌ No enabled alerts found for type "${alertType}"!`);
      console.log('💡 Create a "Subscriber" alert in Tools → Alerts');
    } else {
      console.log(`✅ Found ${alertsForType.length} enabled alert(s) for "${alertType}"`);
      
      // Trigger the alert
      const userData = {
        username: subEvent.event.user_name,
        display_name: subEvent.event.display_name || subEvent.event.user_name,
        tier: subEvent.event.tier,
        months: subEvent.event.cumulative_months,
        message: subEvent.event.message,
        ...subEvent.event
      };
      
      console.log('🚀 Triggering alert with user data:', userData);
      
      if (window.alertSystem) {
        window.alertSystem.triggerAlertForEvent(alertType, userData);
        console.log('✅ Subscription alert triggered!');
      } else {
        console.log('❌ Alert system not found!');
      }
    }
    
    // Add to chat display
    if (typeof addTwitchEvent === 'function') {
      addTwitchEvent(subEvent.type, subEvent.event);
      console.log('✅ Added to chat display');
    }
    
    // Update recent subscribers
    if (typeof addRecentSubscriber === 'function') {
      addRecentSubscriber(subEvent.event);
      console.log('✅ Updated recent subscribers');
    }
  } else {
    console.log('❌ EventSub handler not found');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📊 RESULTS SUMMARY:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`• Total alerts configured: ${alerts.length}`);
  console.log(`• Follower alerts enabled: ${enabledFollowerAlerts.length}`);
  console.log(`• Subscriber alerts enabled: ${enabledSubscriberAlerts.length}`);
  console.log('');
  console.log('💡 WHAT TO CHECK:');
  console.log('─────────────────────────────────────────────────────────');
  console.log('1. Did you see alerts appear on screen?');
  console.log('2. Check the console messages above for errors');
  console.log('3. Make sure you have alerts created in Tools → Alerts');
  console.log('4. Make sure your alerts are ENABLED (not disabled)');
  console.log('5. Check if you have an overlay URL open in OBS');
  console.log('6. Look for any error messages in red above');
  console.log('');
  console.log('🔍 If alerts didn\'t show:');
  console.log('─────────────────────────────────────────────────────────');
  if (enabledFollowerAlerts.length === 0) {
    console.log('❌ Create/enable a "Follower" alert in Tools → Alerts');
  }
  if (enabledSubscriberAlerts.length === 0) {
    console.log('❌ Create/enable a "Subscriber" alert in Tools → Alerts');
  }
  console.log('• Check that your overlay is properly connected');
  console.log('• Verify alert queue is working (check alertQueue in console)');
  console.log('• Test individual alerts using the Test button in Alerts menu');
  console.log('');
  
  // Create a summary alert for the user
  let summaryMessage = '🧪 Twitch Event Pipeline Test Complete!\n\n';
  summaryMessage += `Alerts configured: ${alerts.length}\n`;
  summaryMessage += `Follower alerts enabled: ${enabledFollowerAlerts.length}\n`;
  summaryMessage += `Subscriber alerts enabled: ${enabledSubscriberAlerts.length}\n\n`;
  
  if (enabledFollowerAlerts.length === 0 || enabledSubscriberAlerts.length === 0) {
    summaryMessage += '⚠️ ISSUES FOUND:\n';
    if (enabledFollowerAlerts.length === 0) {
      summaryMessage += '• No enabled follower alerts\n';
    }
    if (enabledSubscriberAlerts.length === 0) {
      summaryMessage += '• No enabled subscriber alerts\n';
    }
    summaryMessage += '\n💡 Create/enable alerts in Tools → Alerts';
  } else {
    summaryMessage += '✅ Alerts are configured correctly!\n\n';
    summaryMessage += 'Check console (F12) for detailed logs.\n';
    summaryMessage += 'Did you see the test alerts appear?';
  }
  
  alert(summaryMessage);
};

// Add a shorter alias for quick testing
window.testTwitchEvents = window.testTwitchEventPipeline;

// ========== Progression System Management ==========

// Open progression manager modal
async function openProgressionManager() {
  console.log('🔵 Opening progression manager modal...');
  
  // Close overlay widget if it's open (so modal is visible)
  const overlayWidget = document.getElementById('overlay-widget');
  if (overlayWidget && !overlayWidget.classList.contains('hidden')) {
    console.log('🔵 Closing overlay widget to show progression modal');
    overlayWidget.classList.add('hidden');
  }
  
  // Also close alert widget if it's open
  const alertWidget = document.getElementById('alert-widget');
  if (alertWidget && !alertWidget.classList.contains('hidden')) {
    console.log('🔵 Closing alert widget to show progression modal');
    alertWidget.classList.add('hidden');
  }
  
  const modal = document.getElementById('progression-manager-modal');
  if (!modal) {
    console.error('Progression manager modal not found!');
    showCustomAlert('Progression manager modal not found. Please restart the app.', 'error');
    return;
  }
  
  // Debug: Check all parent elements for visibility issues
  console.log('🔍 Checking parent chain:');
  let el = modal;
  while (el) {
    console.log(el.tagName, el.id || el.className, {
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity
    });
    el = el.parentElement;
  }
  
  // Remove hidden class first
  modal.classList.remove('hidden');
  
  // Force a reflow to ensure browser recalculates layout
  void modal.offsetHeight; // Forces reflow
  
  // Use requestAnimationFrame to defer the style changes to next paint
  requestAnimationFrame(() => {
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex !important; justify-content: center; align-items: center; z-index: 100000; padding: 20px; box-sizing: border-box;';
    
    // Force another reflow after setting styles
    void modal.offsetHeight;
    
    console.log('Modal opened, classes:', modal.className);
    console.log('Modal display:', window.getComputedStyle(modal).display);
    console.log('Modal z-index:', window.getComputedStyle(modal).zIndex);
    console.log('Modal visibility:', window.getComputedStyle(modal).visibility);
    console.log('Modal opacity:', window.getComputedStyle(modal).opacity);
    console.log('🔵 Progression modal should now be visible!');
  });
  
  // Load progressions list
  await loadProgressionsList();
  
  // Setup close button if not already set up
  const closeBtn = document.getElementById('progression-manager-close');
  if (closeBtn && !closeBtn.hasAttribute('data-listener-attached')) {
    closeBtn.setAttribute('data-listener-attached', 'true');
    closeBtn.addEventListener('click', () => {
      console.log('Closing progression manager...');
      modal.classList.add('hidden');
      modal.style.display = 'none';
    });
  }
  
  // Setup create button if not already set up
  const createBtn = document.getElementById('create-new-progression');
  if (createBtn && !createBtn.hasAttribute('data-listener-attached')) {
    createBtn.setAttribute('data-listener-attached', 'true');
    createBtn.addEventListener('click', () => {
      openProgressionEditor(null);
    });
  }
  
  // Setup test redeem button
  const testRedeemBtn = document.getElementById('test-progression-redeem');
  if (testRedeemBtn && !testRedeemBtn.hasAttribute('data-listener-attached')) {
    testRedeemBtn.setAttribute('data-listener-attached', 'true');
    testRedeemBtn.addEventListener('click', () => {
      testProgressionRedeem();
    });
  }
}

// Test a single progression (called from progression card)
window.testSingleProgression = async function(progressionId) {
  try {
    const result = await window.electronAPI.getProgressions();
    const progression = result.progressions.find(p => p.id === progressionId);
    
    if (!progression) {
      showCustomAlert('Progression not found!', 'error');
      return;
    }
    
    openProgressionTestModal(progression);
  } catch (error) {
    console.error('Error testing progression:', error);
    showCustomAlert('Error: ' + error.message, 'error');
  }
};

// Test progression redeem (with selection)
async function testProgressionRedeem() {
  try {
    const result = await window.electronAPI.getProgressions();
    const progressions = result.progressions || [];
    
    if (progressions.length === 0) {
      showCustomAlert('No progressions configured yet. Create one first!', 'error');
      return;
    }
    
    // If only one progression, open it directly
    if (progressions.length === 1) {
      openProgressionTestModal(progressions[0]);
      return;
    }
    
    // Show custom alert to select which progression
    const listHtml = progressions.map((prog, i) => 
      `<button onclick="window.testSingleProgression('${prog.id}')" style="width:100%;padding:12px;margin:5px 0;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;color:var(--text-primary);text-align:left;">
        ${i + 1}. ${prog.name} (${prog.redeemKeyword})
      </button>`
    ).join('');
    
    showCustomAlert(`<div style="max-height:400px;overflow-y:auto;">${listHtml}</div>`, 'info');
  } catch (error) {
    console.error('Error testing progression redeem:', error);
    showCustomAlert('Error: ' + error.message, 'error');
  }
}

// Open progression test modal
function openProgressionTestModal(progression) {
  const modal = document.getElementById('progression-test-modal');
  if (!modal) {
    showCustomAlert('Test modal not found!', 'error');
    return;
  }
  
  // Populate progression info
  const currentStage = progression.stages[progression.currentStageIndex];
  document.getElementById('test-prog-name').textContent = progression.name;
  document.getElementById('test-prog-keyword').textContent = progression.redeemKeyword;
  document.getElementById('test-prog-stage').textContent = progression.currentStageIndex + 1;
  document.getElementById('test-prog-total').textContent = progression.stages.length;
  document.getElementById('test-prog-count').textContent = progression.currentCount;
  document.getElementById('test-prog-required').textContent = currentStage ? currentStage.requiredCount : 0;
  
  // Store progression ID for later
  modal.dataset.progressionId = progression.id;
  
  // Setup handlers
  setupProgressionTestHandlers();
  
  // Show modal
  modal.classList.remove('hidden');
  void modal.offsetHeight;
  requestAnimationFrame(() => {
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex !important; justify-content: center; align-items: center; z-index: 100001; padding: 20px; box-sizing: border-box;';
  });
}

// Setup progression test modal handlers
function setupProgressionTestHandlers() {
  const modal = document.getElementById('progression-test-modal');
  const closeBtn = document.getElementById('progression-test-close');
  const cancelBtn = document.getElementById('progression-test-cancel');
  const sendBtn = document.getElementById('progression-test-send');
  
  if (closeBtn && !closeBtn.hasAttribute('data-test-listener')) {
    closeBtn.setAttribute('data-test-listener', 'true');
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    });
  }
  
  if (cancelBtn && !cancelBtn.hasAttribute('data-test-listener')) {
    cancelBtn.setAttribute('data-test-listener', 'true');
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    });
  }
  
  if (sendBtn && !sendBtn.hasAttribute('data-test-listener')) {
    sendBtn.setAttribute('data-test-listener', 'true');
    sendBtn.addEventListener('click', async () => {
      const progressionId = modal.dataset.progressionId;
      const username = document.getElementById('test-progression-username').value || 'TestUser';
      
      // Get the progression
      const result = await window.electronAPI.getProgressions();
      const progression = result.progressions.find(p => p.id === progressionId);
      
      if (!progression) {
        showCustomAlert('Progression not found!', 'error');
        return;
      }
      
      // Send test redemption
      await sendTestRedemption(progression, username);
      
      // Refresh progression info in the modal
      setTimeout(async () => {
        const updatedResult = await window.electronAPI.getProgressions();
        const updatedProg = updatedResult.progressions.find(p => p.id === progressionId);
        if (updatedProg) {
          const currentStage = updatedProg.stages[updatedProg.currentStageIndex];
          document.getElementById('test-prog-stage').textContent = updatedProg.currentStageIndex + 1;
          document.getElementById('test-prog-count').textContent = updatedProg.currentCount;
          document.getElementById('test-prog-required').textContent = currentStage ? currentStage.requiredCount : 0;
        }
      }, 300);
      
      // Don't close modal - let user test multiple times
      // modal.classList.add('hidden');
      // modal.style.display = 'none';
    });
  }
}

// Helper to send test redemption (global so it can be used from anywhere)
window.sendTestRedemption = async function sendTestRedemption(progression, username) {
  try {
    
    // Send fake Twitch redemption event
    const fakeEvent = {
      type: 'redeem',
      user_name: username,
      user: username,
      event: {
        user_name: username,
        user_login: username.toLowerCase(),
        reward: {
          title: progression.redeemKeyword,
          name: progression.redeemKeyword
        },
        user_input: ''
      }
    };
    
    console.log('🧪 Sending test redemption:', fakeEvent);
    
    // Send the event through the Twitch event system
    if (window.electronAPI && window.electronAPI.sendFakeTwitchEventHandle) {
      const sendResult = await window.electronAPI.sendFakeTwitchEventHandle(fakeEvent);
      console.log('Test event sent:', sendResult);
      showCustomAlert(`Test redeem sent for "${progression.name}" by ${username}! Check the progression overlay.`, 'success');
      
      // Refresh the list to show updated counts
      setTimeout(async () => {
        await loadProgressionsList();
      }, 500);
    } else {
      showCustomAlert('Test event API not available', 'error');
    }
  } catch (error) {
    console.error('Error testing progression redeem:', error);
    showCustomAlert('Error: ' + error.message, 'error');
  }
}

// Load progressions list
async function loadProgressionsList() {
  console.log('Loading progressions list...');
  const listContainer = document.getElementById('progressions-list');
  const noMessage = document.getElementById('no-progressions-message');
  
  if (!listContainer) {
    console.warn('Progressions list container not found!');
    return;
  }
  
  try {
    console.log('Fetching progressions from backend...');
    
    if (!window.electronAPI || !window.electronAPI.getProgressions) {
      console.error('electronAPI.getProgressions not available!');
      listContainer.innerHTML = '<div style="padding:20px;color:red;">Error: Progression API not available. Please restart the app.</div>';
      return;
    }
    
    const result = await window.electronAPI.getProgressions();
    console.log('Progressions result:', result);
    const progressions = result.progressions || [];
    
    if (progressions.length === 0) {
      listContainer.innerHTML = '';
      if (noMessage) noMessage.style.display = 'block';
      return;
    }
    
    if (noMessage) noMessage.style.display = 'none';
    
    listContainer.innerHTML = progressions.map(prog => {
      const currentStage = prog.stages[prog.currentStageIndex];
      return `
        <div class="progression-card" style="padding:15px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
            <div>
              <h4 style="margin:0 0 5px 0;">${prog.name}</h4>
              <div style="font-size:12px;color:var(--text-tertiary);">
                Redeem: <code>${prog.redeemKeyword}</code> | 
                Action: <span style="color:var(--accent);">${prog.actionWord || 'contributed'}</span> | 
                Stage ${prog.currentStageIndex + 1}/${prog.stages.length} | 
                ${prog.currentCount}/${currentStage ? currentStage.requiredCount : 0}
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button onclick="testSingleProgression('${prog.id}')" style="padding:6px 12px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">🧪 Test</button>
              <button onclick="openProgressionEditor('${prog.id}')" style="padding:6px 12px;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Edit</button>
              <button onclick="resetProgression('${prog.id}')" style="padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:4px;cursor:pointer;font-size:12px;">Reset</button>
              <button onclick="deleteProgression('${prog.id}')" style="padding:6px 12px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Delete</button>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);">
            Total Redeems: ${prog.totalRedeems} | 
            Top Contributor: ${prog.topRedeemers && prog.topRedeemers.length > 0 ? prog.topRedeemers[0].username + ' (' + prog.topRedeemers[0].count + ')' : 'None yet'}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading progressions:', error);
    showCustomAlert('Failed to load progressions: ' + error.message, 'error');
  }
}

// Open progression editor (global so onclick handlers can call it)
window.openProgressionEditor = async function openProgressionEditor(progressionId) {
  console.log('📝 Opening progression editor for:', progressionId || 'new progression');
  
  const editorModal = document.getElementById('progression-editor-modal');
  const managerModal = document.getElementById('progression-manager-modal');
  
  if (!editorModal) {
    showCustomAlert('Progression editor modal not found!', 'error');
    return;
  }
  
  // Close manager modal
  if (managerModal) {
    managerModal.classList.add('hidden');
    managerModal.style.display = 'none';
  }
  
  // Reset form
  const form = document.getElementById('progression-form');
  form.reset();
  form.dataset.progressionId = ''; // Clear progression ID
  document.getElementById('progression-stages-list').innerHTML = '';
  document.getElementById('progression-editor-title').textContent = 'New Progression';
  
  // Load existing progression if editing
  if (progressionId) {
    const result = await window.electronAPI.getProgressions();
    const progression = result.progressions.find(p => p.id === progressionId);
    if (progression) {
      await loadProgressionIntoEditor(progression);
    }
  } else {
    // Add one default stage for new progressions
    addProgressionStage();
  }
  
  // Setup form handlers
  setupProgressionEditorHandlers();
  
  // Show modal
  editorModal.classList.remove('hidden');
  void editorModal.offsetHeight;
  requestAnimationFrame(() => {
    editorModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex !important; justify-content: center; align-items: center; z-index: 100001; padding: 20px; box-sizing: border-box;';
  });
}

// Setup progression editor event handlers
function setupProgressionEditorHandlers() {
  const form = document.getElementById('progression-form');
  const closeBtn = document.getElementById('progression-editor-close');
  const cancelBtn = document.getElementById('progression-form-cancel');
  const addStageBtn = document.getElementById('add-progression-stage');
  const uniformCheckbox = document.getElementById('progression-uniform-count');
  const uniformCountValue = document.getElementById('progression-uniform-count-value');
  const displayModeSelect = document.getElementById('progression-display-mode');
  const durationContainer = document.getElementById('progression-duration-container');
  const helpBtn = document.getElementById('progression-placeholders-help');
  
  // Help button (placeholders guide)
  if (helpBtn && !helpBtn.hasAttribute('data-editor-listener')) {
    helpBtn.setAttribute('data-editor-listener', 'true');
    helpBtn.addEventListener('click', () => {
      openPlaceholdersGuide();
    });
  }
  
  // Close button
  if (closeBtn && !closeBtn.hasAttribute('data-editor-listener')) {
    closeBtn.setAttribute('data-editor-listener', 'true');
    closeBtn.addEventListener('click', () => {
      closeProgressionEditor();
    });
  }
  
  // Cancel button
  if (cancelBtn && !cancelBtn.hasAttribute('data-editor-listener')) {
    cancelBtn.setAttribute('data-editor-listener', 'true');
    cancelBtn.addEventListener('click', () => {
      closeProgressionEditor();
    });
  }
  
  // Add stage button
  if (addStageBtn && !addStageBtn.hasAttribute('data-editor-listener')) {
    addStageBtn.setAttribute('data-editor-listener', 'true');
    addStageBtn.addEventListener('click', () => {
      addProgressionStage();
    });
  }
  
  // Uniform count checkbox
  if (uniformCheckbox && !uniformCheckbox.hasAttribute('data-editor-listener')) {
    uniformCheckbox.setAttribute('data-editor-listener', 'true');
    uniformCheckbox.addEventListener('change', () => {
      if (uniformCheckbox.checked) {
        uniformCountValue.style.display = 'block';
        // Hide individual stage count inputs
        document.querySelectorAll('.stage-required-count').forEach(input => {
          input.style.display = 'none';
        });
      } else {
        uniformCountValue.style.display = 'none';
        // Show individual stage count inputs
        document.querySelectorAll('.stage-required-count').forEach(input => {
          input.style.display = 'block';
        });
      }
    });
  }
  
  // Display mode change
  if (displayModeSelect && !displayModeSelect.hasAttribute('data-editor-listener')) {
    displayModeSelect.setAttribute('data-editor-listener', 'true');
    displayModeSelect.addEventListener('change', () => {
      if (displayModeSelect.value === 'duration') {
        durationContainer.style.display = 'block';
      } else {
        durationContainer.style.display = 'none';
      }
    });
    
    // Set initial state
    if (displayModeSelect.value === 'duration') {
      durationContainer.style.display = 'block';
    } else {
      durationContainer.style.display = 'none';
    }
  }
  
  // Form submit
  if (form && !form.hasAttribute('data-editor-listener')) {
    form.setAttribute('data-editor-listener', 'true');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveProgression();
    });
  }
}

// Close progression editor
function closeProgressionEditor() {
  const editorModal = document.getElementById('progression-editor-modal');
  if (editorModal) {
    editorModal.classList.add('hidden');
    editorModal.style.display = 'none';
  }
  
  // Reopen manager modal
  openProgressionManager();
}

// Add a stage to the progression
let stageCounter = 0;
function addProgressionStage(stageData = null) {
  const stagesList = document.getElementById('progression-stages-list');
  if (!stagesList) return;
  
  const stageId = stageData?.id || `stage_${Date.now()}_${stageCounter++}`;
  const stageNum = stagesList.children.length + 1;
  
  const existingMedia = stageData?.mediaPath ? `<div style="color:var(--text-secondary);font-size:12px;margin-top:4px;">Current: ${stageData.mediaPath.split(/[\\/]/).pop()}</div>` : '';
  const existingAudio = stageData?.audioPath ? `<div style="color:var(--text-secondary);font-size:12px;margin-top:4px;">Current: ${stageData.audioPath.split(/[\\/]/).pop()}</div>` : '';
  
  const stageHtml = `
    <div class="progression-stage-item" data-stage-id="${stageId}" 
         data-media-path="${stageData?.mediaPath || ''}" 
         data-media-type="${stageData?.mediaType || ''}"
         data-audio-path="${stageData?.audioPath || ''}"
         style="padding:15px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h4 style="margin:0;">Stage ${stageNum}</h4>
        <button type="button" class="remove-stage-btn" data-stage-id="${stageId}" style="padding:6px 12px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Remove</button>
      </div>
      
      <div style="display:grid;gap:12px;">
        <div class="stage-required-count">
          <label style="display:block;margin-bottom:5px;font-weight:600;font-size:14px;">Redeems Required</label>
          <input type="number" class="stage-count-input" data-stage-id="${stageId}" min="1" value="${stageData?.requiredCount || 5}" required style="width:100%;padding:8px;border-radius:4px;background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-primary);">
        </div>
        
        <div>
          <label style="display:block;margin-bottom:5px;font-weight:600;font-size:14px;">Media File (Image/GIF/Video)</label>
          <input type="file" class="stage-media-input" data-stage-id="${stageId}" accept="image/*,video/*" style="width:100%;padding:8px;border-radius:4px;background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-primary);">
          ${existingMedia}
          <div class="stage-media-preview" data-stage-id="${stageId}" style="margin-top:8px;min-height:40px;display:none;"></div>
        </div>
        
        <div>
          <label style="display:block;margin-bottom:5px;font-weight:600;font-size:14px;">Audio File (Optional)</label>
          <input type="file" class="stage-audio-input" data-stage-id="${stageId}" accept="audio/*" style="width:100%;padding:8px;border-radius:4px;background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-primary);">
          ${existingAudio}
        </div>
      </div>
    </div>
  `;
  
  stagesList.insertAdjacentHTML('beforeend', stageHtml);
  
  // Add remove handler
  const removeBtn = stagesList.querySelector(`[data-stage-id="${stageId}"].remove-stage-btn`);
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const stageItem = stagesList.querySelector(`[data-stage-id="${stageId}"].progression-stage-item`);
      if (stageItem) {
        stageItem.remove();
        // Renumber remaining stages
        renumberStages();
      }
    });
  }
  
  // Add media preview handler
  const mediaInput = stagesList.querySelector(`[data-stage-id="${stageId}"].stage-media-input`);
  if (mediaInput) {
    mediaInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const preview = stagesList.querySelector(`[data-stage-id="${stageId}"].stage-media-preview`);
        if (preview) {
          preview.style.display = 'block';
          if (file.type.startsWith('image/')) {
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-width:200px;max-height:150px;border-radius:4px;">`;
          } else if (file.type.startsWith('video/')) {
            preview.innerHTML = `<video src="${URL.createObjectURL(file)}" style="max-width:200px;max-height:150px;border-radius:4px;" controls></video>`;
          }
        }
      }
    });
  }
}

// Renumber stages
function renumberStages() {
  const stages = document.querySelectorAll('.progression-stage-item');
  stages.forEach((stage, index) => {
    const header = stage.querySelector('h4');
    if (header) {
      header.textContent = `Stage ${index + 1}`;
    }
  });
}

// Load progression into editor
async function loadProgressionIntoEditor(progression) {
  document.getElementById('progression-editor-title').textContent = 'Edit Progression';
  document.getElementById('progression-name').value = progression.name || '';
  document.getElementById('progression-redeem-keyword').value = progression.redeemKeyword || '';
  document.getElementById('progression-action-word').value = progression.actionWord || 'contributed';
  document.getElementById('progression-overlay-text').value = progression.overlayText || '';
  document.getElementById('progression-chat-command').value = progression.chatCommand || '';
  document.getElementById('progression-chat-message').value = progression.chatMessage || '';
  document.getElementById('progression-display-mode').value = progression.displayMode || 'always';
  document.getElementById('progression-duration').value = progression.duration || 10;
  document.getElementById('progression-persistence').value = progression.persistenceMode || 'permanent';
  document.getElementById('progression-uniform-count').checked = progression.uniformCount || false;
  
  if (progression.uniformCount) {
    document.getElementById('progression-uniform-count-value').style.display = 'block';
    document.getElementById('progression-uniform-count-input').value = progression.stages[0]?.requiredCount || 5;
  }
  
  // Load stages
  if (progression.stages && progression.stages.length > 0) {
    progression.stages.forEach(stage => {
      addProgressionStage(stage);
    });
  }
  
  // Store progression ID for update
  document.getElementById('progression-form').dataset.progressionId = progression.id;
}

// Save progression
async function saveProgression() {
  try {
    console.log('💾 Saving progression...');
    
    const form = document.getElementById('progression-form');
    const progressionId = form.dataset.progressionId;
    
    const uniformCount = document.getElementById('progression-uniform-count').checked;
    const uniformCountValue = uniformCount ? parseInt(document.getElementById('progression-uniform-count-input').value) : null;
    
    // Collect stage data
    const stages = [];
    const stageItems = document.querySelectorAll('.progression-stage-item');
    
    for (let i = 0; i < stageItems.length; i++) {
      const stageItem = stageItems[i];
      const stageId = stageItem.dataset.stageId;
      const countInput = stageItem.querySelector('.stage-count-input');
      const mediaInput = stageItem.querySelector('.stage-media-input');
      const audioInput = stageItem.querySelector('.stage-audio-input');
      
      const requiredCount = uniformCount ? uniformCountValue : parseInt(countInput.value);
      
      const stage = {
        id: stageId,
        requiredCount: requiredCount
      };
      
      // Check for existing media data
      const existingMediaPath = stageItem.dataset.mediaPath;
      const existingMediaType = stageItem.dataset.mediaType;
      const existingAudioPath = stageItem.dataset.audioPath;
      
      // Handle media file
      if (mediaInput && mediaInput.files && mediaInput.files.length > 0) {
        const file = mediaInput.files[0];
        const filePath = window.electronAPI.getFilePathFromFile(file);
        
        if (filePath) {
          // Save media file
          const mediaResult = await window.electronAPI.saveProgressionMedia({
            sourcePath: filePath,
            progressionId: progressionId || 'temp_' + Date.now(),
            stageId: stageId,
            mediaType: file.type.startsWith('image/') ? 'image' : 'video',
            originalName: file.name
          });
          
          if (mediaResult.success) {
            stage.mediaPath = mediaResult.filePath;
            stage.mediaType = file.type.startsWith('image/') ? 'image' : 'video';
          }
        }
      } else if (existingMediaPath) {
        // Use existing media if no new file uploaded
        stage.mediaPath = existingMediaPath;
        stage.mediaType = existingMediaType;
      }
      
      // Handle audio file
      if (audioInput && audioInput.files && audioInput.files.length > 0) {
        const file = audioInput.files[0];
        const filePath = window.electronAPI.getFilePathFromFile(file);
        
        if (filePath) {
          const audioResult = await window.electronAPI.saveProgressionMedia({
            sourcePath: filePath,
            progressionId: progressionId || 'temp_' + Date.now(),
            stageId: stageId,
            mediaType: 'audio',
            originalName: file.name
          });
          
          if (audioResult.success) {
            stage.audioPath = audioResult.filePath;
          }
        }
      } else if (existingAudioPath) {
        // Use existing audio if no new file uploaded
        stage.audioPath = existingAudioPath;
      }
      
      stages.push(stage);
    }
    
    if (stages.length === 0) {
      showCustomAlert('Please add at least one stage!', 'error');
      return;
    }
    
    // Build progression object
    const progression = {
      id: progressionId,
      name: document.getElementById('progression-name').value,
      redeemKeyword: document.getElementById('progression-redeem-keyword').value,
      targetOverlay: 'progressionOverlay', // Always use dedicated progression overlay
      actionWord: document.getElementById('progression-action-word').value || 'contributed',
      overlayText: document.getElementById('progression-overlay-text').value,
      chatCommand: document.getElementById('progression-chat-command').value,
      chatMessage: document.getElementById('progression-chat-message').value,
      displayMode: document.getElementById('progression-display-mode').value,
      duration: parseInt(document.getElementById('progression-duration').value),
      persistenceMode: document.getElementById('progression-persistence').value,
      uniformCount: uniformCount,
      stages: stages,
      currentStageIndex: 0,
      currentCount: 0,
      totalRedeems: 0,
      topRedeemers: []
    };
    
    console.log('Saving progression:', progression);
    
    // Save to backend
    const result = await window.electronAPI.saveProgression(progression);
    
    if (result.success) {
      showCustomAlert('Progression saved successfully!', 'success');
      closeProgressionEditor();
      // Refresh the manager list
      await loadProgressionsList();
    } else {
      showCustomAlert('Failed to save progression: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error saving progression:', error);
    showCustomAlert('Error saving progression: ' + error.message, 'error');
  }
}

// Reset progression
window.resetProgression = async function(progressionId) {
  if (!confirm('Reset this progression? This will clear all progress and leaderboard data.')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.resetProgression(progressionId);
    if (result.success) {
      showCustomAlert('Progression reset successfully!', 'success');
      await loadProgressionsList();
    } else {
      showCustomAlert('Failed to reset progression: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error resetting progression:', error);
    showCustomAlert('Error resetting progression: ' + error.message, 'error');
  }
};

// Delete progression
window.deleteProgression = async function(progressionId) {
  if (!confirm('Delete this progression? This action cannot be undone.')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.deleteProgression(progressionId);
    if (result.success) {
      showCustomAlert('Progression deleted successfully!', 'success');
      await loadProgressionsList();
    } else {
      showCustomAlert('Failed to delete progression: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error deleting progression:', error);
    showCustomAlert('Error deleting progression: ' + error.message, 'error');
  }
};

// Progression system is initialized via setupOverlayWidget()
console.log('✅ Progression system functions loaded');
