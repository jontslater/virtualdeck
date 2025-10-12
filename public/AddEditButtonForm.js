// AddEditButtonForm - Multi-source button creation and editing component
class AddEditButtonForm {
  constructor() {
    this.isEditing = false;
    this.editingId = null;
    this.textSlots = [
      'text-top-left', 'text-top-center', 'text-top-right',
      'text-mid-left', 'text-mid-right',
      'text-bottom-left', 'text-bottom-center', 'text-bottom-right'
    ];
    this.images = [];
    this.videos = [];
    this.audio = [];
    this.onSave = null;
    this.onCancel = null;
  }

  init() {
    this.setupEventListeners();
    this.createFormContent();
  }

  createFormContent() {
    // The form content is now in the HTML
    this.updatePreview();
  }

  setupTypeSwitching() {
    const radioButtons = document.querySelectorAll('input[name="button-type"]');
    const audioSection = document.getElementById('audio-file-section');
    const appSection = document.getElementById('app-file-section');
    const multiMediaTrigger = document.getElementById('multi-media-form-trigger');
    const fileInput = document.getElementById('file-input');
    const appFileInput = document.getElementById('app-file-input');

    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        
        if (selectedType === 'multi-media') {
          // Show multi-media button, hide others
          if (audioSection) audioSection.classList.add('hidden');
          if (appSection) appSection.classList.add('hidden');
          if (multiMediaTrigger) multiMediaTrigger.classList.remove('hidden');
          
          // Make file inputs not required for multi-media
          if (fileInput) fileInput.required = false;
          if (appFileInput) appFileInput.required = false;
        } else {
          // Show appropriate section, hide multi-media button
          if (multiMediaTrigger) multiMediaTrigger.classList.add('hidden');
          
          if (selectedType === 'audio') {
            if (audioSection) audioSection.classList.remove('hidden');
            if (appSection) appSection.classList.add('hidden');
            if (fileInput) fileInput.required = true;
            if (appFileInput) appFileInput.required = false;
          } else if (selectedType === 'app') {
            if (audioSection) audioSection.classList.add('hidden');
            if (appSection) appSection.classList.remove('hidden');
            if (fileInput) fileInput.required = false;
            if (appFileInput) appFileInput.required = true;
          }
        }
      });
    });
  }

  setupEventListeners() {
    // Multi-media modal form submission
    const multiMediaForm = document.getElementById('multi-media-form');
    if (multiMediaForm) {
      multiMediaForm.addEventListener('submit', (e) => this.handleMultiMediaSubmit(e));
    }

    // Multi-media modal close button
    const modalCloseBtn = document.getElementById('multi-media-modal-close');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeModal());
    }

    // Multi-media modal cancel button
    const cancelBtn = document.getElementById('cancel-multi-media-button');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeModal());
    }

    // Open multi-media modal button
    const openModalBtn = document.getElementById('open-multi-media-form');
    if (openModalBtn) {
      openModalBtn.addEventListener('click', () => this.openModal());
    }

    // Tab switching
    this.setupTabSwitching();

    // File uploads
    this.setupFileUploads();

    // URL inputs
    this.setupUrlInputs();

    // Preview button
    const previewBtn = document.getElementById('preview-in-overlay');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.previewInOverlay());
    }

    // Live preview updates
    this.setupLivePreview();

    // Hotkey recording
    this.setupHotkeyRecording();

    // Chat command toggle
    this.setupChatCommandToggle();
  }

  setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Remove active class from all tabs and contents
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        btn.classList.add('active');
        document.getElementById(`tab-${targetTab}`).classList.add('active');
      });
    });
  }

  setupFileUploads() {
    // Image uploads
    const imageFileInput = document.getElementById('image-file-input');
    const imageUploadZone = document.getElementById('image-upload-zone');
    
    if (imageFileInput && imageUploadZone) {
      imageUploadZone.addEventListener('click', () => imageFileInput.click());
      imageFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'image'));
      
      // Drag and drop
      imageUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadZone.classList.add('dragover');
      });
      imageUploadZone.addEventListener('dragleave', () => {
        imageUploadZone.classList.remove('dragover');
      });
      imageUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadZone.classList.remove('dragover');
        this.handleFileUpload({ target: { files: e.dataTransfer.files } }, 'image');
      });
    }

    // Video uploads
    const videoFileInput = document.getElementById('video-file-input');
    const videoUploadZone = document.getElementById('video-upload-zone');
    
    if (videoFileInput && videoUploadZone) {
      videoUploadZone.addEventListener('click', () => videoFileInput.click());
      videoFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'video'));
      
      // Drag and drop
      videoUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        videoUploadZone.classList.add('dragover');
      });
      videoUploadZone.addEventListener('dragleave', () => {
        videoUploadZone.classList.remove('dragover');
      });
      videoUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        videoUploadZone.classList.remove('dragover');
        this.handleFileUpload({ target: { files: e.dataTransfer.files } }, 'video');
      });
    }

    // Audio uploads
    const audioFileInput = document.getElementById('audio-file-input');
    const audioUploadZone = document.getElementById('audio-upload-zone');
    
    if (audioFileInput && audioUploadZone) {
      audioUploadZone.addEventListener('click', () => audioFileInput.click());
      audioFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'audio'));
      
      // Drag and drop
      audioUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioUploadZone.classList.add('dragover');
      });
      audioUploadZone.addEventListener('dragleave', () => {
        audioUploadZone.classList.remove('dragover');
      });
      audioUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        audioUploadZone.classList.remove('dragover');
        this.handleFileUpload({ target: { files: e.dataTransfer.files } }, 'audio');
      });
    }
  }

  setupUrlInputs() {
    // Image URL
    const addImageUrlBtn = document.getElementById('add-image-url');
    const imageUrlInput = document.getElementById('image-url-input');
    if (addImageUrlBtn && imageUrlInput) {
      addImageUrlBtn.addEventListener('click', () => this.addFromUrl(imageUrlInput.value, 'image'));
      imageUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addFromUrl(imageUrlInput.value, 'image');
      });
    }

    // Video URL
    const addVideoUrlBtn = document.getElementById('add-video-url');
    const videoUrlInput = document.getElementById('video-url-input');
    if (addVideoUrlBtn && videoUrlInput) {
      addVideoUrlBtn.addEventListener('click', () => this.addFromUrl(videoUrlInput.value, 'video'));
      videoUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addFromUrl(videoUrlInput.value, 'video');
      });
    }

    // Audio URL
    const addAudioUrlBtn = document.getElementById('add-audio-url');
    const audioUrlInput = document.getElementById('audio-url-input');
    if (addAudioUrlBtn && audioUrlInput) {
      addAudioUrlBtn.addEventListener('click', () => this.addFromUrl(audioUrlInput.value, 'audio'));
      audioUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addFromUrl(audioUrlInput.value, 'audio');
      });
    }
  }

  createTextSlotEditors() {
    const grid = document.querySelector('.text-slots-grid');
    if (!grid) return;

    grid.innerHTML = '';

    this.textSlots.forEach(slotId => {
      const editor = document.createElement('div');
      editor.className = 'text-slot-editor';
      editor.dataset.slot = slotId;
      
      const label = slotId.replace('text-', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      editor.innerHTML = `
        <label>${label}</label>
        <input type="text" placeholder="Enter text..." class="slot-text-input" />
        <button type="button" class="style-btn">Style</button>
        <div class="style-panel hidden">
          <select class="font-family">
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Courier, monospace">Courier</option>
            <option value="Times, serif">Times</option>
            <option value="Verdana, sans-serif">Verdana</option>
          </select>
          <input type="number" class="font-size" placeholder="Size (px)" min="8" max="72" value="16" />
          <input type="color" class="text-color" value="#ffffff" />
          <div class="style-toggles">
            <label><input type="checkbox" class="bold-toggle" /> Bold</label>
            <label><input type="checkbox" class="italic-toggle" /> Italic</label>
          </div>
          <select class="text-align">
            <option value="left">Left</option>
            <option value="center" selected>Center</option>
            <option value="right">Right</option>
          </select>
          <select class="animation">
            <option value="none">No Animation</option>
            <option value="fade-in">Fade In</option>
            <option value="slide-up">Slide Up</option>
            <option value="pulse">Pulse</option>
          </select>
        </div>
      `;

      // Style button toggle
      const styleBtn = editor.querySelector('.style-btn');
      const stylePanel = editor.querySelector('.style-panel');
      styleBtn.addEventListener('click', () => {
        stylePanel.classList.toggle('hidden');
      });

      // Input change handlers
      const textInput = editor.querySelector('.slot-text-input');
      const styleInputs = editor.querySelectorAll('.style-panel input, .style-panel select');
      
      const updatePreview = () => this.updatePreview();
      textInput.addEventListener('input', updatePreview);
      styleInputs.forEach(input => input.addEventListener('change', updatePreview));

      grid.appendChild(editor);
    });
  }

  async handleFileUpload(event, type) {
    const files = event.target.files;
    console.log(`📁 handleFileUpload called - type: ${type}, files:`, files.length);
    
    if (!files || files.length === 0) return;

    for (const file of files) {
      console.log(`📁 Processing file: ${file.name}, type: ${file.type}`);
      
      // Store the actual File object for proper handling
      this.addMediaItem(file, type, file.name);
      
      // Auto-detect duration for audio/video files
      if (type === 'audio' || type === 'video') {
        console.log(`⏱️ Starting duration detection for ${type} file: ${file.name}`);
        const duration = await this.getMediaDuration(file);
        console.log(`⏱️ Duration detected: ${duration}s`);
        
        if (duration) {
          const durationInput = document.getElementById('multi-media-duration-input');
          console.log(`⏱️ Duration input element found:`, durationInput ? 'YES' : 'NO');
          
          if (durationInput) {
            const currentDuration = parseInt(durationInput.value) || 0;
            console.log(`⏱️ Current duration: ${currentDuration}s, New duration: ${duration}s`);
            
            // Only update if new duration is longer
            if (duration > currentDuration) {
              durationInput.value = duration;
              console.log(`✅ Auto-updated duration to ${duration}s for ${type} file`);
            } else {
              console.log(`⏭️ Skipped update - new duration (${duration}s) is not longer than current (${currentDuration}s)`);
            }
          }
        } else {
          console.log(`⚠️ Could not detect duration for file: ${file.name}`);
        }
      }
    }

    // Clear the input
    event.target.value = '';
  }
  
  // Helper function to get media duration
  getMediaDuration(file) {
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
        console.log(`📹 Media duration detected: ${duration}s for ${file.name}`);
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

  async addFromUrl(url, type) {
    if (!url.trim()) return;
    this.addMediaItem(url, type);
    
    // Auto-detect duration for audio/video URLs
    if (type === 'audio' || type === 'video') {
      const duration = await this.getMediaDurationFromUrl(url, type);
      if (duration) {
        const durationInput = document.getElementById('multi-media-duration-input');
        if (durationInput) {
          const currentDuration = parseInt(durationInput.value) || 0;
          // Only update if new duration is longer
          if (duration > currentDuration) {
            durationInput.value = duration;
            console.log(`🎵 Auto-updated duration to ${duration}s for ${type} URL`);
          }
        }
      }
    }
  }
  
  // Helper function to get media duration from URL
  getMediaDurationFromUrl(url, type) {
    return new Promise((resolve) => {
      const media = document.createElement(type === 'audio' ? 'audio' : 'video');
      
      media.onloadedmetadata = () => {
        const duration = Math.ceil(media.duration);
        console.log(`📹 Media duration detected from URL: ${duration}s`);
        media.src = ''; // Clean up
        resolve(duration);
      };
      
      media.onerror = () => {
        console.warn('Could not load media from URL for duration detection');
        media.src = ''; // Clean up
        resolve(null);
      };
      
      media.src = url;
      media.load();
    });
  }

  addMediaItem(src, type, name = '') {
    const mediaItem = {
      id: Date.now() + Math.random(),
      type: type,
      src: src, // This will be a File object for uploaded files, or URL string for URLs
      name: name || `Media ${Date.now()}`,
      loop: type === 'video' ? false : undefined,
      volume: type === 'audio' ? 100 : undefined,
      widthPct: type === 'image' || type === 'video' ? 100 : undefined,
    };

    if (type === 'image') {
      this.images.push(mediaItem);
      this.renderMediaList('images-list', this.images, 'image');
    } else if (type === 'video') {
      this.videos.push(mediaItem);
      this.renderMediaList('videos-list', this.videos, 'video');
    } else if (type === 'audio') {
      this.audio.push(mediaItem);
      this.renderMediaList('audio-list', this.audio, 'audio');
    }

    this.updatePreview();
  }

  renderMediaList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    items.forEach((item, index) => {
      const mediaItem = document.createElement('div');
      mediaItem.className = 'media-item';
      mediaItem.dataset.id = item.id;

      let previewHtml = '';
      if (item.src) {
        if (type === 'center') {
          if (item.type === 'image') {
            // Handle File objects and URL strings
            const src = item.src instanceof File ? URL.createObjectURL(item.src) : item.src;
            previewHtml = `<img src="${src}" class="media-preview" alt="Preview" />`;
          } else if (item.type === 'video') {
            previewHtml = `<div class="media-preview" style="background: #333; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">🎬 VIDEO</div>`;
          }
        } else {
          previewHtml = `<div class="media-preview" style="background: #666; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">🎵</div>`;
        }
      } else {
        previewHtml = `<div class="media-preview" style="background: #333; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">+</div>`;
      }

      // Display file name for File objects, URL for strings
      const displayValue = item.src instanceof File ? item.name : item.src;
      
      mediaItem.innerHTML = `
        ${previewHtml}
        <div class="media-info">
          <input type="text" class="media-url" placeholder="Enter URL or drag file..." value="${displayValue}" ${item.src instanceof File ? 'readonly' : ''} />
          ${type === 'center' ? `
            <select class="media-type">
              <option value="image" ${item.type === 'image' ? 'selected' : ''}>Image</option>
              <option value="video" ${item.type === 'video' ? 'selected' : ''}>Video</option>
            </select>
            <label><input type="checkbox" class="loop-toggle" ${item.loop ? 'checked' : ''} /> Loop</label>
            <input type="range" class="width-slider" min="10" max="100" value="${item.widthPct}" />
            <span class="width-value">${item.widthPct}%</span>
          ` : type === 'video' ? `
            <label><input type="checkbox" class="loop-toggle" ${item.loop ? 'checked' : ''} /> Loop</label>
          ` : type === 'image' ? `
            <!-- No audio controls for images -->
          ` : `
            <input type="range" class="volume-slider" min="0" max="100" value="${item.volume || 100}" />
            <span class="volume-value">${item.volume || 100}%</span>
          `}
        </div>
        <div class="media-controls">
          <button type="button" class="remove-media">Remove</button>
        </div>
      `;

      // Event listeners
      const urlInput = mediaItem.querySelector('.media-url');
      const removeBtn = mediaItem.querySelector('.remove-media');
      
      // Only allow editing URL if it's not a File object
      urlInput.addEventListener('input', (e) => {
        if (!(item.src instanceof File)) {
          item.src = e.target.value;
          this.updatePreview();
          this.renderMediaList(containerId, items, type);
        }
      });

      if (type === 'center') {
        const typeSelect = mediaItem.querySelector('.media-type');
        const loopToggle = mediaItem.querySelector('.loop-toggle');
        const widthSlider = mediaItem.querySelector('.width-slider');
        const widthValue = mediaItem.querySelector('.width-value');

        typeSelect.addEventListener('change', (e) => {
          item.type = e.target.value;
          this.updatePreview();
          this.renderMediaList(containerId, items, type);
        });

        loopToggle.addEventListener('change', (e) => {
          item.loop = e.target.checked;
        });

        widthSlider.addEventListener('input', (e) => {
          item.widthPct = parseInt(e.target.value);
          widthValue.textContent = `${item.widthPct}%`;
          this.updatePreview();
        });
      } else if (type === 'video') {
        // Video-specific controls
        const loopToggle = mediaItem.querySelector('.loop-toggle');

        if (loopToggle) {
          loopToggle.addEventListener('change', (e) => {
            item.loop = e.target.checked;
          });
        }

      } else if (type === 'image') {
        // Images don't have any additional controls

      } else {
        // Audio controls
        const volumeSlider = mediaItem.querySelector('.volume-slider');
        const volumeValue = mediaItem.querySelector('.volume-value');

        if (volumeSlider && volumeValue) {
          volumeSlider.addEventListener('input', (e) => {
            item.volume = parseInt(e.target.value);
            volumeValue.textContent = `${item.volume}%`;
          });
        }
      }

      removeBtn.addEventListener('click', () => {
        const itemIndex = items.findIndex(i => i.id === item.id);
        if (itemIndex > -1) {
          items.splice(itemIndex, 1);
          this.renderMediaList(containerId, items, type);
          this.updatePreview();
        }
      });

      container.appendChild(mediaItem);
    });
  }

  async updatePreview() {
    const preview = document.getElementById('button-preview');
    if (!preview) return;

    // Debounce preview updates to avoid lag on every keystroke
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
    }
    
    this.previewTimeout = setTimeout(async () => {
      try {
        const payload = await this.getFormData(true); // Pass true to skip file processing for preview
        preview.innerHTML = this.renderPreview(payload);
      } catch (error) {
        preview.innerHTML = `<div class="error">${error.message}</div>`;
      }
    }, 300); // Wait 300ms after user stops typing
  }

  renderPreview(payload) {
    const overlay = document.createElement('div');
    overlay.className = 'preview-overlay';

    // Create text slots using new schema slot names
    const slotMapping = {
      'text-top-left': 'topLeft',
      'text-top-center': 'topCenter', 
      'text-top-right': 'topRight',
      'text-mid-left': 'midLeft',
      'text-mid-right': 'midRight',
      'text-bottom-left': 'bottomLeft',
      'text-bottom-center': 'bottomCenter',
      'text-bottom-right': 'bottomRight',
      'text-center': 'center'
    };

    // Create text slot if text exists
    if (payload.slots && Object.keys(payload.slots).length > 0) {
      const [position, slotData] = Object.entries(payload.slots)[0];
      if (slotData && slotData.text) {
        const slot = document.createElement('div');
        slot.className = 'preview-text-slot';
        slot.textContent = slotData.text;
        
        // Apply global styling options from form
        if (payload.textStyling) {
          Object.assign(slot.style, {
            fontFamily: payload.textStyling.fontFamily || 'Arial, sans-serif',
            fontSize: payload.textStyling.fontSize || '24px',
            fontWeight: payload.textStyling.fontWeight || '700',
            color: payload.textStyling.color || '#ffffff',
            textShadow: payload.textStyling.textShadow || '1px 1px 2px rgba(0,0,0,0.8)',
            webkitTextStroke: payload.textStyling.textStroke || '1px #000',
            textAlign: 'center',
            zIndex: '1'
          });
        }

        // Apply animation if specified
        if (payload.animation && payload.animation.type !== 'none') {
          Object.assign(slot.style, {
            animationName: payload.animation.type,
            animationDuration: payload.animation.duration,
            animationDelay: payload.animation.delay,
            animationIterationCount: payload.animation.iteration,
            animationTimingFunction: payload.animation.easing
          });
        }

        // Map position to grid positions
        const gridPositions = {
          'topLeft': '1,1',
          'topCenter': '2,1', 
          'topRight': '3,1',
          'midLeft': '1,2',
          'center': '2,2',
          'midRight': '3,2',
          'bottomLeft': '1,3',
          'bottomCenter': '2,3',
          'bottomRight': '3,3'
        };

        const [col, row] = (gridPositions[position] || '2,1').split(',').map(Number);
        slot.style.gridColumn = col;
        slot.style.gridRow = row;

        overlay.appendChild(slot);
      }
    }

    // Create center media
    if (payload.centerMedia && payload.centerMedia.length > 0) {
      const centerMedia = document.createElement('div');
      centerMedia.className = 'preview-center-media';
      
      // Render all media items (not just first)
      payload.centerMedia.forEach((mediaItem, index) => {
        const mediaElement = document.createElement('div');
        mediaElement.className = 'preview-media-item';
        mediaElement.style.zIndex = index + 1;
        
        if (mediaItem.type === 'image') {
          const img = document.createElement('img');
          // Handle File objects and URL strings
          img.src = mediaItem.src instanceof File ? URL.createObjectURL(mediaItem.src) : mediaItem.src;
          img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; display: block;';
          img.alt = mediaItem.alt || 'Preview Image';
          mediaElement.appendChild(img);
        } else if (mediaItem.type === 'video') {
          // Just show "VIDEO" text instead of trying to play it
          mediaElement.textContent = '🎬 VIDEO';
          mediaElement.style.cssText = 'display: flex; align-items: center; justify-content: center; background: #333; color: white; font-weight: bold; font-size: 14px;';
        } else {
          mediaElement.textContent = 'Media';
        }
        
        centerMedia.appendChild(mediaElement);
      });

      overlay.appendChild(centerMedia);
    }

    return overlay.outerHTML;
  }

  async getFormData(isPreview = false) {
    const name = document.getElementById('multi-media-button-name')?.value || '';
    const hotkey = document.getElementById('multi-media-hotkey-input')?.value || '';
    const durationInput = document.getElementById('multi-media-duration-input');
    
    // Validate duration is provided and within range
    if (!durationInput || !durationInput.value || durationInput.value.trim() === '') {
      throw new Error('Duration is required');
    }
    
    const duration = parseInt(durationInput.value);
    if (isNaN(duration) || duration < 5 || duration > 300) {
      throw new Error('Duration must be between 5 and 300 seconds');
    }

    // Get global styling options first
    const textStyling = {
      position: document.getElementById('multi-media-text-position')?.value || 'topCenter',
      fontFamily: document.getElementById('multi-media-font-family')?.value || 'Arial, sans-serif',
      fontSize: document.getElementById('multi-media-font-size')?.value + 'px' || '24px',
      fontWeight: document.getElementById('multi-media-font-weight')?.value || '700',
      color: document.getElementById('multi-media-text-color')?.value || '#ffffff',
      textShadow: document.getElementById('multi-media-text-shadow')?.value || '1px 1px 2px rgba(0,0,0,0.8)',
      textStroke: document.getElementById('multi-media-text-stroke')?.value || '1px #000'
    };

    const animation = {
      type: document.getElementById('multi-media-animation')?.value || 'none',
      duration: document.getElementById('multi-media-animation-duration')?.value + 's' || '1s',
      delay: document.getElementById('multi-media-animation-delay')?.value + 's' || '0s',
      iteration: document.getElementById('multi-media-animation-iteration')?.value || '1',
      easing: document.getElementById('multi-media-animation-easing')?.value || 'ease'
    };

    // Get overlay text (single input)
    const overlayTextInput = document.getElementById('multi-media-overlay-text');
    const overlayText = overlayTextInput?.value?.trim();
    
    const slots = {};
    
    // If there's overlay text, add it to the appropriate slot based on position
    if (overlayText) {
      const position = textStyling.position;
      
      // Build style object from global styling
      const style = {
        fontFamily: textStyling.fontFamily,
        fontSize: textStyling.fontSize,
        fontWeight: textStyling.fontWeight,
        color: textStyling.color,
        textShadow: textStyling.textShadow,
        webkitTextStroke: textStyling.textStroke,
        textAlign: 'center',
        zIndex: '1'
      };
      
      slots[position] = {
        text: overlayText,
        style: style,
        animation: animation.type !== 'none' ? {
          name: animation.type,
          duration: animation.duration,
          delay: animation.delay,
          iterationCount: animation.iteration,
          timingFunction: animation.easing
        } : null
      };
    }

    // Helper function to convert File to base64
    const fileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    };

    // Helper function to save media file and get path
    const saveMediaFile = async (file, mediaType, buttonId) => {
      if (!window.electronAPI) {
        console.warn('electronAPI not available, falling back to base64');
        return await fileToBase64(file);
      }

      try {
        // For video files (which can be large), use path-based copying if available
        // This avoids converting large files to base64 in the renderer process
        const isLargeFile = file.size > 10 * 1024 * 1024; // Files larger than 10MB
        const isVideo = mediaType === 'video';
        
        if ((isVideo || isLargeFile) && file.path && window.electronAPI.saveMediaFileByPath) {
          console.log(`Using efficient path-based copy for ${mediaType} file (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          
          const result = await window.electronAPI.saveMediaFileByPath({
            sourcePath: file.path,
            buttonId: buttonId,
            mediaType: mediaType,
            originalName: file.name
          });

          if (result.success) {
            console.log(`Media file copied to: ${result.filePath}`);
            return result.filePath; // Return relative path
          } else {
            console.error('Failed to copy media file:', result.error);
            // Fall through to base64 method
          }
        }
        
        // For smaller files or if path-based method fails, use base64 method
        if (!window.electronAPI.saveMediaFile) {
          console.warn('saveMediaFile API not available, falling back to base64');
          return await fileToBase64(file);
        }
        
        console.log(`Using base64 method for ${mediaType} file (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        const base64Data = await fileToBase64(file);
        const result = await window.electronAPI.saveMediaFile({
          base64Data: base64Data,
          buttonId: buttonId,
          mediaType: mediaType,
          originalName: file.name
        });

        if (result.success) {
          console.log(`Media file saved to: ${result.filePath}`);
          return result.filePath; // Return relative path
        } else {
          console.error('Failed to save media file:', result.error);
          return base64Data; // Fallback to base64
        }
      } catch (error) {
        console.error('Error saving media file:', error);
        const base64Data = await fileToBase64(file);
        return base64Data; // Fallback to base64
      }
    };

    // Generate button ID for media storage
    const buttonId = this.editingId || `multi-media-${Date.now()}`;

    // Process center media - save File objects to disk
    const centerMedia = [];
    
    // Process images
    for (const [index, item] of this.images.entries()) {
      if (item.src) {
        let src = item.src;
        if (item.src instanceof File) {
          if (isPreview) {
            // For preview, just use a placeholder instead of processing the file
            src = 'preview-placeholder';
          } else {
            // Save file to media folder
            src = await saveMediaFile(item.src, 'image', buttonId);
          }
        }
        centerMedia.push({
          id: `m${index + 1}`,
          type: 'image',
          src: src,
          alt: item.name || 'Image',
          widthPct: item.widthPct || 100,
          align: 'center',
          extraStyle: { zIndex: index + 1 }
        });
      }
    }

    // Process videos
    for (const [index, item] of this.videos.entries()) {
      if (item.src) {
        let src = item.src;
        if (item.src instanceof File) {
          if (isPreview) {
            // For preview, just use a placeholder instead of processing the file
            src = 'preview-placeholder';
          } else {
            // Save file to media folder
            src = await saveMediaFile(item.src, 'video', buttonId);
          }
        }
        centerMedia.push({
          id: `v${index + 1}`,
          type: 'video',
          src: src,
          loop: item.loop || false,
          widthPct: item.widthPct || 100,
          align: 'center',
          extraStyle: { zIndex: index + 1 }
        });
      }
    }

    // Get chat command settings
    const chatCommandEnabled = document.getElementById('multi-media-chat-command-enabled')?.checked || false;
    const chatCommandKeyword = document.getElementById('multi-media-chat-command-keyword')?.value?.trim() || '';
    
    // Get trigger method selection
    const triggerMethodRadio = document.querySelector('input[name="multi-media-trigger-method"]:checked');
    const triggerMethod = triggerMethodRadio?.value || 'command';
    console.log(`🔍 AddEditButtonForm selected trigger method radio:`, triggerMethodRadio);
    console.log(`🔍 AddEditButtonForm selected trigger method value:`, triggerMethod);
    
    // Get overlay selection
    const overlaySelect = document.getElementById('multi-media-overlay-select')?.value || 'main';
    console.log('🔍 Overlay select element:', document.getElementById('multi-media-overlay-select'));
    console.log('🔍 Overlay select value:', overlaySelect);

    const buttonData = {
      id: this.editingId || `multi-media-${Date.now()}`,
      name: name,
      type: 'multi-media',
      hotkey: hotkey,
      overlay: overlaySelect,
      slots,
      centerMedia,
      fullscreenMedia: [], // New: fullscreen media support
      textStyling: textStyling,
      animation: animation,
      audio: await Promise.all(this.audio.filter(item => item.src).map(async (item, index) => {
        let src = item.src;
        if (item.src instanceof File) {
          if (isPreview) {
            // For preview, just use a placeholder instead of processing the file
            src = 'preview-placeholder';
          } else {
            // Save file to media folder
            src = await saveMediaFile(item.src, 'audio', buttonId);
          }
        }
        return {
          id: `a${index + 1}`,
          src: src,
          volume: (item.volume || 100) / 100, // Convert percentage to 0-1
          loop: item.loop || false
        };
      })),
      options: {
        clearPrevious: true,
        durationMs: duration * 1000 // Convert seconds to milliseconds
      },
      isEditing: this.isEditing,
      editingId: this.editingId
    };

    // Add chat command data if enabled
    if (chatCommandEnabled && chatCommandKeyword) {
      buttonData.chatCommand = {
        enabled: true,
        keyword: chatCommandKeyword.toLowerCase(),
        triggerMethod: triggerMethod
      };
      console.log(`🔍 AddEditButtonForm saving button with chatCommand:`, buttonData.chatCommand);
    }

    console.log('🔍 Final button data before saving:', buttonData);
    console.log('🔍 Button overlay property:', buttonData.overlay);
    return buttonData;
  }

  async previewInOverlay() {
    try {
      const payload = await this.getFormData(true); // Use preview mode to avoid processing large files
      
      if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
        window.electronAPI.sendOverlayMessage(payload);
        console.log('Preview sent to overlay:', payload);
      } else {
        console.error('Overlay API not available');
      }
    } catch (error) {
      alert(error.message);
    }
  }

  async handleMultiMediaSubmit(e) {
    e.preventDefault();
    
    let formData;
    try {
      formData = await this.getFormData();
      
      // Validate
      if (!formData.name || !formData.name.trim()) {
        alert('Button name is required');
        return;
      }
    } catch (error) {
      alert(error.message);
      return;
    }

    // Stop all videos and hotkey recording before saving
    this.stopAllVideos();
    this.stopMultiMediaHotkeyRecording();

    // Call onSave callback
    if (this.onSave) {
      this.onSave(formData);
    }

    this.closeModal();
  }

  openModal() {
    this.isEditing = false;
    this.editingId = null;
    this.images = [];
    this.videos = [];
    this.audio = [];
    
    // Stop any existing hotkey recording
    this.stopMultiMediaHotkeyRecording();
    
    // Reset form
    const form = document.getElementById('multi-media-form');
    if (form) form.reset();
    
    // Clear text slots
    this.textSlots.forEach(slotId => {
      const editor = document.querySelector(`[data-slot="${slotId}"]`);
      if (editor) {
        const textInput = editor.querySelector('.slot-text-input');
        if (textInput) textInput.value = '';
      }
    });

    // Reset chat command fields
    const chatCommandEnabled = document.getElementById('multi-media-chat-command-enabled');
    const chatCommandKeyword = document.getElementById('multi-media-chat-command-keyword');
    const chatCommandSettings = document.getElementById('multi-media-chat-command-settings');
    
    if (chatCommandEnabled) chatCommandEnabled.checked = false;
    if (chatCommandKeyword) chatCommandKeyword.value = '';
    if (chatCommandSettings) chatCommandSettings.style.display = 'none';

    // Update UI
    document.getElementById('multi-media-modal-title').textContent = 'Create Multi-Media Button';
    this.renderMediaList('images-list', this.images, 'image');
    this.renderMediaList('videos-list', this.videos, 'video');
    this.renderMediaList('audio-list', this.audio, 'audio');
    this.updatePreview();
    
    // Close the main settings modal first
    document.getElementById('settings-modal').classList.add('hidden');
    
    // Show multi-media modal
    document.getElementById('multi-media-modal').classList.remove('hidden');
    if (window.electronAPI && window.electronAPI.disableHotkeys) {
      window.electronAPI.disableHotkeys();
    }
  }

  closeModal() {
    this.stopAllVideos(); // Stop videos when closing modal
    this.stopMultiMediaHotkeyRecording(); // Stop hotkey recording when closing modal
    document.getElementById('multi-media-modal').classList.add('hidden');
    if (window.electronAPI && window.electronAPI.enableHotkeys) {
      window.electronAPI.enableHotkeys();
    }
    
    if (this.onCancel) {
      this.onCancel();
    }
  }

  openForCreate() {
    this.openModal();
  }

  openForEdit(buttonData) {
    this.stopAllVideos(); // Stop any existing videos first
    this.stopMultiMediaHotkeyRecording(); // Stop any existing hotkey recording
    this.isEditing = true;
    this.editingId = buttonData.id;
    
    // Set button name
    const nameInput = document.getElementById('multi-media-button-name');
    if (nameInput) nameInput.value = buttonData.name || '';

    // Set hotkey
    const hotkeyInput = document.getElementById('multi-media-hotkey-input');
    if (hotkeyInput) hotkeyInput.value = buttonData.hotkey || '';
    
    // Set overlay selection
    const overlaySelect = document.getElementById('multi-media-overlay-select');
    if (overlaySelect && buttonData.overlay) {
      overlaySelect.value = buttonData.overlay;
      console.log(`📝 [Edit] Setting overlay to: ${buttonData.overlay}`);
    }

    // Set duration (convert from milliseconds to seconds)
    const durationInput = document.getElementById('multi-media-duration-input');
    if (durationInput && buttonData.options && buttonData.options.durationMs) {
      const durationSeconds = Math.round(buttonData.options.durationMs / 1000);
      durationInput.value = durationSeconds;
      console.log(`📝 [Edit] Setting duration to ${durationSeconds} seconds (from ${buttonData.options.durationMs}ms)`);
    } else if (durationInput) {
      durationInput.value = 60; // Default 60 seconds
      console.log(`📝 [Edit] No duration found, using default 60 seconds`);
    }

    // Set global text styling options
    if (buttonData.textStyling) {
      const textStyling = buttonData.textStyling;
      
      const textPositionSelect = document.getElementById('multi-media-text-position');
      if (textPositionSelect) textPositionSelect.value = textStyling.position || 'topCenter';
      
      const fontFamilySelect = document.getElementById('multi-media-font-family');
      if (fontFamilySelect) fontFamilySelect.value = textStyling.fontFamily || 'Arial, sans-serif';
      
      const fontSizeRange = document.getElementById('multi-media-font-size');
      const fontSizeValue = document.getElementById('multi-media-font-size-value');
      if (fontSizeRange && fontSizeValue) {
        const fontSize = parseInt(textStyling.fontSize?.replace('px', '')) || 24;
        fontSizeRange.value = fontSize;
        fontSizeValue.textContent = fontSize + 'px';
      }
      
      const fontWeightSelect = document.getElementById('multi-media-font-weight');
      if (fontWeightSelect) fontWeightSelect.value = textStyling.fontWeight || '700';
      
      const textColorInput = document.getElementById('multi-media-text-color');
      if (textColorInput) textColorInput.value = textStyling.color || '#ffffff';
      
      const textShadowSelect = document.getElementById('multi-media-text-shadow');
      if (textShadowSelect) textShadowSelect.value = textStyling.textShadow || '1px 1px 2px rgba(0,0,0,0.8)';
      
      const textStrokeSelect = document.getElementById('multi-media-text-stroke');
      if (textStrokeSelect) textStrokeSelect.value = textStyling.textStroke || '1px #000';
    }

    // Set animation options
    if (buttonData.animation) {
      const animation = buttonData.animation;
      
      const animationSelect = document.getElementById('multi-media-animation');
      if (animationSelect) animationSelect.value = animation.type || 'none';
      
      const animationDurationRange = document.getElementById('multi-media-animation-duration');
      const animationDurationValue = document.getElementById('multi-media-animation-duration-value');
      if (animationDurationRange && animationDurationValue) {
        const duration = parseFloat(animation.duration?.replace('s', '')) || 1;
        animationDurationRange.value = duration;
        animationDurationValue.textContent = duration + 's';
      }
      
      const animationDelayRange = document.getElementById('multi-media-animation-delay');
      const animationDelayValue = document.getElementById('multi-media-animation-delay-value');
      if (animationDelayRange && animationDelayValue) {
        const delay = parseFloat(animation.delay?.replace('s', '')) || 0;
        animationDelayRange.value = delay;
        animationDelayValue.textContent = delay + 's';
      }
      
      const animationIterationSelect = document.getElementById('multi-media-animation-iteration');
      if (animationIterationSelect) animationIterationSelect.value = animation.iteration || '1';
      
      const animationEasingSelect = document.getElementById('multi-media-animation-easing');
      if (animationEasingSelect) animationEasingSelect.value = animation.easing || 'ease';
    }

    // Map new schema slot names to old slot IDs for form population
    const slotMapping = {
      'topLeft': 'text-top-left',
      'topCenter': 'text-top-center',
      'topRight': 'text-top-right',
      'midLeft': 'text-mid-left',
      'midRight': 'text-mid-right',
      'bottomLeft': 'text-bottom-left',
      'bottomCenter': 'text-bottom-center',
      'bottomRight': 'text-bottom-right',
      'center': 'text-center'
    };

    // Set overlay text from the first available slot
    const overlayTextInput = document.getElementById('multi-media-overlay-text');
    if (overlayTextInput && buttonData.slots) {
      // Find the first slot with text
      const slotWithText = Object.values(buttonData.slots).find(slot => slot && slot.text);
      if (slotWithText) {
        overlayTextInput.value = slotWithText.text || '';
      }
    }

    // Set chat command settings
    const chatCommandEnabled = document.getElementById('multi-media-chat-command-enabled');
    const chatCommandKeyword = document.getElementById('multi-media-chat-command-keyword');
    const chatCommandSettings = document.getElementById('multi-media-chat-command-settings');
    
    if (chatCommandEnabled && chatCommandKeyword && chatCommandSettings) {
      if (buttonData.chatCommand && buttonData.chatCommand.enabled) {
        chatCommandEnabled.checked = true;
        chatCommandKeyword.value = buttonData.chatCommand.keyword || '';
        chatCommandSettings.style.display = 'block';
        
        // Set trigger method selection
        const triggerMethod = buttonData.chatCommand.triggerMethod || 'command';
        const triggerMethodRadio = document.querySelector(`input[name="multi-media-trigger-method"][value="${triggerMethod}"]`);
        if (triggerMethodRadio) {
          triggerMethodRadio.checked = true;
        }
      } else {
        chatCommandEnabled.checked = false;
        chatCommandKeyword.value = '';
        chatCommandSettings.style.display = 'none';
        
        // Reset to default trigger method
        const defaultRadio = document.querySelector('input[name="multi-media-trigger-method"][value="command"]');
        if (defaultRadio) {
          defaultRadio.checked = true;
        }
      }
    }

    // Set media - separate images and videos from centerMedia using new schema
    this.images = (buttonData.centerMedia || []).filter(item => item.type === 'image').map(item => ({
      id: Date.now() + Math.random(),
      type: 'image',
      src: item.src,
      name: item.alt || 'Image',
      widthPct: item.widthPct || 100
    }));
    
    this.videos = (buttonData.centerMedia || []).filter(item => item.type === 'video').map(item => ({
      id: Date.now() + Math.random(),
      type: 'video',
      src: item.src,
      name: 'Video',
      loop: item.loop || false,
      widthPct: item.widthPct || 100
    }));
    
    this.audio = (buttonData.audio || []).map(item => ({
      id: Date.now() + Math.random(),
      type: 'audio',
      src: item.src,
      name: 'Audio',
      volume: (item.volume || 1.0) * 100 // Convert 0-1 to percentage for form
    }));

    // Update UI
    document.getElementById('multi-media-modal-title').textContent = `Edit Button: ${buttonData.name}`;
    this.renderMediaList('images-list', this.images, 'image');
    this.renderMediaList('videos-list', this.videos, 'video');
    this.renderMediaList('audio-list', this.audio, 'audio');
    this.updatePreview();
    
    // Close the main settings modal first (if it's open)
    document.getElementById('settings-modal').classList.add('hidden');
    
    // Show multi-media modal
    document.getElementById('multi-media-modal').classList.remove('hidden');
    if (window.electronAPI && window.electronAPI.disableHotkeys) {
      window.electronAPI.disableHotkeys();
    }
  }

  // Stop all videos in preview
  stopAllVideos() {
    const modal = document.getElementById('multi-media-modal');
    if (modal) {
      const videos = modal.querySelectorAll('video');
      videos.forEach(video => {
        video.pause();
        video.currentTime = 0;
      });
      console.log('Stopped all preview videos');
    }
  }

  close() {
    this.stopAllVideos(); // Stop videos when closing
    this.closeModal();
  }

  setupLivePreview() {
    // Update preview when button name changes
    const nameInput = document.getElementById('multi-media-button-name');
    if (nameInput) {
      nameInput.addEventListener('input', () => this.updatePreview());
    }

    // Update preview when hotkey changes
    const hotkeyInput = document.getElementById('multi-media-hotkey-input');
    if (hotkeyInput) {
      hotkeyInput.addEventListener('input', () => this.updatePreview());
    }

    // Update preview when overlay text changes
    const overlayTextInput = document.getElementById('multi-media-overlay-text');
    if (overlayTextInput) {
      overlayTextInput.addEventListener('input', () => this.updatePreview());
    }

    // Update preview when any style changes
    document.addEventListener('change', (e) => {
      if (e.target.closest('.style-panel')) {
        this.updatePreview();
      }
    });

    // Update preview when media items change
    document.addEventListener('input', (e) => {
      if (e.target.closest('.media-item') || e.target.closest('.media-list')) {
        this.updatePreview();
      }
    });

    // Update preview when styling controls change
    const stylingControls = [
      'multi-media-text-position',
      'multi-media-font-family',
      'multi-media-font-size',
      'multi-media-font-weight',
      'multi-media-text-color',
      'multi-media-text-shadow',
      'multi-media-text-stroke',
      'multi-media-animation',
      'multi-media-animation-duration',
      'multi-media-animation-delay',
      'multi-media-animation-iteration',
      'multi-media-animation-easing'
    ];

    stylingControls.forEach(controlId => {
      const control = document.getElementById(controlId);
      if (control) {
        control.addEventListener('change', () => this.updatePreview());
        control.addEventListener('input', () => this.updatePreview());
      }
    });

    // Update range slider value displays
    const fontSizeRange = document.getElementById('multi-media-font-size');
    const fontSizeValue = document.getElementById('multi-media-font-size-value');
    if (fontSizeRange && fontSizeValue) {
      fontSizeRange.addEventListener('input', () => {
        fontSizeValue.textContent = fontSizeRange.value + 'px';
      });
    }

    const animationDurationRange = document.getElementById('multi-media-animation-duration');
    const animationDurationValue = document.getElementById('multi-media-animation-duration-value');
    if (animationDurationRange && animationDurationValue) {
      animationDurationRange.addEventListener('input', () => {
        animationDurationValue.textContent = animationDurationRange.value + 's';
      });
    }

    const animationDelayRange = document.getElementById('multi-media-animation-delay');
    const animationDelayValue = document.getElementById('multi-media-animation-delay-value');
    if (animationDelayRange && animationDelayValue) {
      animationDelayRange.addEventListener('input', () => {
        animationDelayValue.textContent = animationDelayRange.value + 's';
      });
    }
  }

  setupHotkeyRecording() {
    const recordBtn = document.getElementById('multi-media-record-hotkey');
    const hotkeyInput = document.getElementById('multi-media-hotkey-input');
    const hotkeyStatus = document.getElementById('multi-media-hotkey-status');

    if (!recordBtn || !hotkeyInput || !hotkeyStatus) {
      console.warn('Multi-media hotkey elements not found');
      return;
    }

    // Make the hotkey input read-only to force use of the recorder button
    hotkeyInput.readOnly = true;

    // Multi-media specific hotkey recording state
    this.multiMediaRecorderState = {
      recorded: new Set(),
      finalizeTimer: null,
      hotkeyListener: null
    };

    recordBtn.addEventListener('click', () => {
      // Button click animation
      recordBtn.classList.remove('clicked');
      void recordBtn.offsetWidth;
      recordBtn.classList.add('clicked');
      
      hotkeyStatus.textContent = 'Press any key or combination with Ctrl, Alt, Shift | Ex: "Ctrl + F1"';
      hotkeyInput.value = '';
      hotkeyInput.focus();
      
      // Stop any existing recording
      this.stopMultiMediaHotkeyRecording();
      
      // Reset recorder state
      this.multiMediaRecorderState.recorded = new Set();
      const finalizeDelay = 700; // ms

      const normalizeKeyEvent = (ev) => {
        // Prefer code for clarity on F-keys and Numpad
        if (ev.code) {
          if (ev.code.startsWith('F') && /^F\d+$/.test(ev.code)) return ev.code.toUpperCase();
          if (ev.code.startsWith('Numpad')) return ev.code.replace('Numpad', 'Num');
        }
        if (ev.key === ' ') return 'Space';
        if (ev.key && ev.key.length === 1) return ev.key.toUpperCase();
        if (ev.key) return ev.key;
        return ev.code || String.fromCharCode(0);
      };

      const keyHandler = (ev) => {
        ev.preventDefault();
        const k = normalizeKeyEvent(ev);
        this.multiMediaRecorderState.recorded.add(k);

        // Reset finalize timer
        if (this.multiMediaRecorderState.finalizeTimer) {
          clearTimeout(this.multiMediaRecorderState.finalizeTimer);
        }
        
        this.multiMediaRecorderState.finalizeTimer = setTimeout(() => {
          // Build a stable ordering: modifiers first (Ctrl, Alt, Shift, Meta), then others sorted
          const modifiersOrder = ['Control','Ctrl','Alt','Shift','Meta'];
          const items = Array.from(this.multiMediaRecorderState.recorded);
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
            this.multiMediaRecorderState.recorded.clear();
            this.stopMultiMediaHotkeyRecording();
            return;
          }
          
          hotkeyInput.value = combo;
          hotkeyStatus.textContent = `Set to: ${hotkeyInput.value}`;
          this.stopMultiMediaHotkeyRecording();
        }, finalizeDelay);
      };

      this.multiMediaRecorderState.hotkeyListener = keyHandler;
      document.addEventListener('keydown', keyHandler);
      recordBtn.textContent = 'Recording...';
      recordBtn.classList.add('recording');
    });
  }

  stopMultiMediaHotkeyRecording() {
    try {
      if (this.multiMediaRecorderState.finalizeTimer) {
        clearTimeout(this.multiMediaRecorderState.finalizeTimer);
        this.multiMediaRecorderState.finalizeTimer = null;
      }
      this.multiMediaRecorderState.recorded.clear();
      
      if (this.multiMediaRecorderState.hotkeyListener) {
        document.removeEventListener('keydown', this.multiMediaRecorderState.hotkeyListener);
        this.multiMediaRecorderState.hotkeyListener = null;
      }
      
      const recordBtn = document.getElementById('multi-media-record-hotkey');
      if (recordBtn) {
        recordBtn.textContent = 'Record Hotkey';
        recordBtn.classList.remove('recording');
      }
      
      const hotkeyStatus = document.getElementById('multi-media-hotkey-status');
      if (hotkeyStatus && !hotkeyStatus.textContent.includes('Set to:')) {
        hotkeyStatus.textContent = '';
      }
    } catch (e) {
      console.error('Error stopping multi-media hotkey recorder:', e);
    }
  }

  setupChatCommandToggle() {
    const checkbox = document.getElementById('multi-media-chat-command-enabled');
    const settings = document.getElementById('multi-media-chat-command-settings');
    
    if (checkbox && settings) {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          settings.style.display = 'block';
        } else {
          settings.style.display = 'none';
        }
      });
    }
  }
}

// Export for use
window.AddEditButtonForm = AddEditButtonForm;
