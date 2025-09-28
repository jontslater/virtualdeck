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
    // The form content is now in the HTML, just need to set up the text slots
    this.createTextSlotEditors();
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

  handleFileUpload(event, type) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      // Use actual file path for persistence
      const filePath = file.path || file.name; // file.path is available in Electron
      this.addMediaItem(filePath, type, file.name);
    });

    // Clear the input
    event.target.value = '';
  }

  addFromUrl(url, type) {
    if (!url.trim()) return;
    this.addMediaItem(url, type);
  }

  addMediaItem(src, type, name = '') {
    const mediaItem = {
      id: Date.now() + Math.random(),
      type: type,
      src: src,
      name: name || `Media ${Date.now()}`,
      loop: type === 'video' ? false : undefined,
      volume: type === 'audio' ? 100 : undefined,
      widthPct: type === 'image' || type === 'video' ? 100 : undefined
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
            previewHtml = `<img src="${item.src}" class="media-preview" alt="Preview" />`;
          } else if (item.type === 'video') {
            previewHtml = `<div class="media-preview" style="background: #333; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">🎬 VIDEO</div>`;
          }
        } else {
          previewHtml = `<div class="media-preview" style="background: #666; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">🎵</div>`;
        }
      } else {
        previewHtml = `<div class="media-preview" style="background: #333; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">+</div>`;
      }

      mediaItem.innerHTML = `
        ${previewHtml}
        <div class="media-info">
          <input type="text" class="media-url" placeholder="Enter URL or drag file..." value="${item.src}" />
          ${type === 'center' ? `
            <select class="media-type">
              <option value="image" ${item.type === 'image' ? 'selected' : ''}>Image</option>
              <option value="video" ${item.type === 'video' ? 'selected' : ''}>Video</option>
            </select>
            <label><input type="checkbox" class="loop-toggle" ${item.loop ? 'checked' : ''} /> Loop</label>
            <input type="range" class="width-slider" min="10" max="100" value="${item.widthPct}" />
            <span class="width-value">${item.widthPct}%</span>
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
      
      urlInput.addEventListener('input', (e) => {
        item.src = e.target.value;
        this.updatePreview();
        this.renderMediaList(containerId, items, type);
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
      } else {
        const volumeSlider = mediaItem.querySelector('.volume-slider');
        const volumeValue = mediaItem.querySelector('.volume-value');

        volumeSlider.addEventListener('input', (e) => {
          item.volume = parseInt(e.target.value);
          volumeValue.textContent = `${item.volume}%`;
        });
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

  updatePreview() {
    const preview = document.getElementById('button-preview');
    if (!preview) return;

    const payload = this.getFormData();
    preview.innerHTML = this.renderPreview(payload);
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

    this.textSlots.forEach(slotId => {
      const newSlotName = slotMapping[slotId];
      const slotData = payload.slots[newSlotName];
      if (slotData && slotData.text) {
        const slot = document.createElement('div');
        slot.className = 'preview-text-slot';
        slot.textContent = slotData.text;
        
        // Apply styles using new schema format
        if (slotData.style) {
          Object.assign(slot.style, {
            fontFamily: slotData.style.fontFamily || 'Arial, sans-serif',
            fontSize: (typeof slotData.style.fontSize === 'number' ? slotData.style.fontSize + 'px' : slotData.style.fontSize) || '12px',
            color: slotData.style.color || '#ffffff',
            fontWeight: slotData.style.bold ? 'bold' : 'normal',
            fontStyle: slotData.style.italic ? 'italic' : 'normal',
            textAlign: slotData.style.align || 'center',
            zIndex: '1'
          });
        }

        // Map to grid positions
        const gridPositions = {
          'text-top-left': '1,1',
          'text-top-center': '2,1', 
          'text-top-right': '3,1',
          'text-mid-left': '1,2',
          'text-center': '2,2',
          'text-mid-right': '3,2',
          'text-bottom-left': '1,3',
          'text-bottom-center': '2,3',
          'text-bottom-right': '3,3'
        };

        const [col, row] = gridPositions[slotId].split(',').map(Number);
        slot.style.gridColumn = col;
        slot.style.gridRow = row;

        overlay.appendChild(slot);
      }
    });

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
          img.src = mediaItem.src;
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

  getFormData() {
    const name = document.getElementById('multi-media-button-name')?.value || '';
    const hotkey = document.getElementById('multi-media-hotkey-input')?.value || '';
    const durationInput = document.getElementById('multi-media-duration-input');
    const duration = durationInput ? parseInt(durationInput.value) || 60 : 60; // Default 60 seconds

    // Map old slot IDs to new schema slot names
    const slotMapping = {
      'text-top-left': 'topLeft',
      'text-top-center': 'topCenter', 
      'text-top-right': 'topRight',
      'text-mid-left': 'midLeft',
      'text-mid-right': 'midRight',
      'text-bottom-left': 'bottomLeft',
      'text-bottom-center': 'bottomCenter',
      'text-bottom-right': 'bottomRight'
    };

    const slots = {};
    
    // Collect text slot data using new schema
    this.textSlots.forEach(slotId => {
      const editor = document.querySelector(`[data-slot="${slotId}"]`);
      if (editor) {
        const textInput = editor.querySelector('.slot-text-input');
        const text = textInput?.value?.trim();
        
        if (text) {
          const style = {
            fontFamily: editor.querySelector('.font-family')?.value || 'Inter',
            fontSize: parseInt(editor.querySelector('.font-size')?.value) || 16,
            color: editor.querySelector('.text-color')?.value || '#FFFFFF',
            bold: editor.querySelector('.bold-toggle')?.checked || false,
            italic: editor.querySelector('.italic-toggle')?.checked || false,
            align: editor.querySelector('.text-align')?.value || 'center',
            animation: editor.querySelector('.animation')?.value || null
          };

          // Map to new slot name
          const newSlotName = slotMapping[slotId];
          if (newSlotName) {
            slots[newSlotName] = { text, style };
          }
        }
      }
    });

    // Add center slot if it exists
    const centerEditor = document.querySelector(`[data-slot="text-center"]`);
    if (centerEditor) {
      const textInput = centerEditor.querySelector('.slot-text-input');
      const text = textInput?.value?.trim();
      if (text) {
        const style = {
          fontFamily: centerEditor.querySelector('.font-family')?.value || 'Inter',
          fontSize: parseInt(centerEditor.querySelector('.font-size')?.value) || 16,
          color: centerEditor.querySelector('.text-color')?.value || '#FFFFFF',
          bold: centerEditor.querySelector('.bold-toggle')?.checked || false,
          italic: centerEditor.querySelector('.italic-toggle')?.checked || false,
          align: centerEditor.querySelector('.text-align')?.value || 'center',
          animation: centerEditor.querySelector('.animation')?.value || null
        };
        slots.center = { text, style };
      }
    }

    // Combine images and videos for center media using new schema
    const centerMedia = [
      ...this.images.filter(item => item.src).map((item, index) => ({
        id: `m${index + 1}`,
        type: 'image',
        src: item.src,
        alt: item.name || 'Image',
        widthPct: item.widthPct || 100,
        align: 'center',
        extraStyle: { zIndex: index + 1 }
      })),
      ...this.videos.filter(item => item.src).map((item, index) => ({
        id: `v${index + 1}`,
        type: 'video',
        src: item.src,
        loop: item.loop || false,
        widthPct: item.widthPct || 100,
        align: 'center',
        extraStyle: { zIndex: index + 1 }
      }))
    ];

    return {
      id: this.editingId || `multi-media-${Date.now()}`,
      name: name,
      type: 'multi-media',
      hotkey: hotkey,
      slots,
      centerMedia,
      audio: this.audio.filter(item => item.src).map((item, index) => ({
        id: `a${index + 1}`,
        src: item.src,
        volume: (item.volume || 100) / 100, // Convert percentage to 0-1
        loop: item.loop || false
      })),
      options: {
        clearPrevious: true,
        durationMs: duration * 1000 // Convert seconds to milliseconds
      },
      isEditing: this.isEditing,
      editingId: this.editingId
    };
  }

  previewInOverlay() {
    const payload = this.getFormData();
    
    if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
      window.electronAPI.sendOverlayMessage(payload);
      console.log('Preview sent to overlay:', payload);
    } else {
      console.error('Overlay API not available');
    }
  }

  handleMultiMediaSubmit(e) {
    e.preventDefault();
    
    const formData = this.getFormData();
    
    // Validate
    if (!formData.name || !formData.name.trim()) {
      alert('Button name is required');
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

    // Set text slots using new schema
    Object.keys(slotMapping).forEach(newSlotName => {
      const oldSlotId = slotMapping[newSlotName];
      const editor = document.querySelector(`[data-slot="${oldSlotId}"]`);
      if (editor && buttonData.slots && buttonData.slots[newSlotName]) {
        const slotData = buttonData.slots[newSlotName];
        const textInput = editor.querySelector('.slot-text-input');
        if (textInput) textInput.value = slotData.text || '';

        if (slotData.style) {
          const style = slotData.style;
          if (editor.querySelector('.font-family')) editor.querySelector('.font-family').value = style.fontFamily || 'Inter';
          if (editor.querySelector('.font-size')) editor.querySelector('.font-size').value = style.fontSize || 16;
          if (editor.querySelector('.text-color')) editor.querySelector('.text-color').value = style.color || '#FFFFFF';
          if (editor.querySelector('.bold-toggle')) editor.querySelector('.bold-toggle').checked = style.bold || false;
          if (editor.querySelector('.italic-toggle')) editor.querySelector('.italic-toggle').checked = style.italic || false;
          if (editor.querySelector('.text-align')) editor.querySelector('.text-align').value = style.align || 'center';
          if (editor.querySelector('.animation')) {
            const animation = style.animation || 'none';
            editor.querySelector('.animation').value = animation;
          }
        }
      }
    });

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

    // Update preview when any text slot content changes
    this.textSlots.forEach(slotId => {
      const editor = document.querySelector(`[data-slot="${slotId}"]`);
      if (editor) {
        const textInput = editor.querySelector('.slot-text-input');
        if (textInput) {
          textInput.addEventListener('input', () => this.updatePreview());
        }
      }
    });

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
}

// Export for use
window.AddEditButtonForm = AddEditButtonForm;
