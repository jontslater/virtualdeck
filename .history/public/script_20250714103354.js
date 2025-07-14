// public/script.js
const { ipcRenderer } = require('electron');

const soundGrid = document.getElementById("sound-grid");
const visualContainer = document.getElementById("visual-container");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.background = "#333";
});

dropZone.addEventListener("dragleave", (e) => {
  dropZone.style.background = "#1a1a1a";
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.background = "#1a1a1a";
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
  }
});

fetch("../config.json")
  .then(res => res.json())
  .then(data => {
    data.buttons.forEach((button, index) => {
      const card = document.createElement("div");
      card.className = "sound-card";
      
      card.innerHTML = `
        <button class="edit-button" onclick="editButton(${index})">Edit</button>
        <div class="sound-type">${button.type}</div>
        <div class="sound-name">${button.label}</div>
        <div class="sound-hotkey">${button.hotkey || 'No hotkey'}</div>
      `;
      
      // Add click handler for the card (but not the edit button)
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('edit-button')) {
          handleTrigger(button);
        }
      });
      
      soundGrid.appendChild(card);
    });
  });

function handleTrigger(button) {
  if (button.type === "audio") {
    const audio = new Audio(button.src);
    audio.play().catch(error => {
      console.error('Audio playback error:', error);
    });
  } else if (button.type === "visual") {
    showVisual(button.src);
  }
}

function showVisual(src) {
  visualContainer.innerHTML = ""; // Clear previous
  const img = document.createElement("img");
  img.src = src;
  visualContainer.appendChild(img);

  setTimeout(() => {
    visualContainer.innerHTML = "";
  }, 4000);
}

ipcRenderer.on('trigger-media', (event, mediaId) => {
  // Find the corresponding config entry
  fetch("../config.json")
    .then(res => res.json())
    .then(data => {
      const button = data.buttons.find(btn =>
        btn.label.toLowerCase().includes(mediaId.toLowerCase())
      );
      if (button) handleTrigger(button);
    });
});



// Add sound card functionality
document.getElementById('add-sound-card').onclick = () => {
  // Clear form for new sound
  document.getElementById('settings-form').reset();
  document.getElementById('hotkey-input').value = '';
  document.getElementById('hotkey-status').textContent = '';
  delete document.getElementById('settings-form').dataset.editingIndex;
  
  // Update modal title
  document.querySelector('#settings-modal h2').textContent = 'Add New Sound';
  
  // Make file input required for new
  document.getElementById('file-input').required = true;

  // Show modal
  document.getElementById('settings-modal').classList.remove('hidden');
};

document.getElementById('close-settings').onclick = () => {
  document.getElementById('settings-modal').classList.add('hidden');
};

document.getElementById('settings-form').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const label = form.label.value.trim();
  const type = form.type.value;
  const hotkey = document.getElementById('hotkey-input').value.trim();
  const fileInput = form.file;
  const isEditing = form.dataset.editingIndex !== undefined;

  if (!label) return alert("Please fill in the label field.");

  // If editing and no new file selected, use existing file
  if (isEditing && !fileInput.files.length) {
    const existingFile = form.dataset.existingFile;
    if (!existingFile) return alert("No existing file found.");

    // Send update without file change
    ipcRenderer.send('add-media', {
      label,
      type,
      hotkey,
      targetPath: existingFile,
      originalPath: existingFile,
      editingIndex: parseInt(form.dataset.editingIndex)
    });
    ipcRenderer.send('refresh-hotkeys');
  } else if (fileInput.files.length) {
    // New file selected
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop();
    const targetPath = `assets/${type === 'audio' ? 'sounds' : 'visuals'}/${label}.${ext}`;

    // Send file path and data to main
    ipcRenderer.send('add-media', {
      label,
      type,
      hotkey,
      targetPath,
      originalPath: file.path,
      editingIndex: isEditing ? parseInt(form.dataset.editingIndex) : undefined
    });
    ipcRenderer.send('refresh-hotkeys');
  } else if (!isEditing) {
    // Only require file selection for new buttons, not when editing
    return alert("Please select a file.");
  }

  document.getElementById('settings-modal').classList.add('hidden');
  setTimeout(() => window.location.reload(), 500); // Reload to update buttons
};

window.editButton = (index) => {
  fetch("../config.json")
    .then(res => res.json())
    .then(config => {
      const btn = config.buttons[index];
      
      // Populate form fields
      document.querySelector('#settings-form [name="label"]').value = btn.label;
      document.querySelector('#settings-form [name="type"]').value = btn.type;
      document.getElementById('hotkey-input').value = btn.hotkey || "";
      
      // Store the existing file path for editing
      document.getElementById('settings-form').dataset.existingFile = btn.src;
      
      // Update modal title
      document.querySelector('#settings-modal h2').textContent = `Edit Sound: ${btn.label}`;
      
      // Show current file info
      const fileInput = document.getElementById('file-input');
      fileInput.required = false; // Not required when editing
      const dropZone = document.getElementById('drop-zone');
      const fileName = btn.src.split('/').pop();
      dropZone.innerHTML = `
        <div style="margin-bottom: 10px; color: #4CAF50; font-weight: bold;">
          ✓ Current file: ${fileName}
        </div>
        <div style="color: #888; font-size: 0.9em;">
          Drag new file here to replace, or leave empty to keep current file
        </div>
      `;
      
      document.getElementById('settings-modal').classList.remove('hidden');
      // mark index to replace
      document.getElementById('settings-form').dataset.editingIndex = index;
    });
};

window.deleteButton = (index) => {
  if (!confirm("Delete this button?")) return;
  ipcRenderer.send('delete-button', index);
  ipcRenderer.send('refresh-hotkeys');
  setTimeout(() => window.location.reload(), 500);
};

// Close app button
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-app');
  if (closeBtn) {
    closeBtn.onclick = () => {
      ipcRenderer.send('close-app');
    };
  }
});

// Hotkey recording functionality
let hotkeyListener = null;

// Wait for DOM to be ready
window.addEventListener('DOMContentLoaded', () => {
  const recordHotkeyBtn = document.getElementById('record-hotkey');
  const hotkeyInput = document.getElementById('hotkey-input');
  const hotkeyStatus = document.getElementById('hotkey-status');

  if (recordHotkeyBtn) {
    recordHotkeyBtn.addEventListener('click', () => {
      // Button click animation
      recordHotkeyBtn.classList.remove('clicked');
      void recordHotkeyBtn.offsetWidth; // force reflow
      recordHotkeyBtn.classList.add('clicked');

      // Show status
      hotkeyStatus.textContent = 'Press any key...';
      hotkeyInput.value = '';
      hotkeyInput.focus();

      // Remove any previous listener
      if (hotkeyListener) document.removeEventListener('keydown', hotkeyListener);

      // Listen for the next keydown
      hotkeyListener = function(e) {
        e.preventDefault();
        console.log('Key pressed:', e.key, 'Code:', e.code, 'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey, 'Alt:', e.altKey);
        
        // Build hotkey string
        const keys = [];
        if (e.ctrlKey) keys.push('Control');
        if (e.shiftKey) keys.push('Shift');
        if (e.altKey) keys.push('Alt');
        if (e.metaKey) keys.push('Meta');
        
        // Handle numpad keys and regular keys
        let keyName = e.key;
        if (e.code.startsWith('Numpad')) {
          // Convert numpad keys to regular number keys
          keyName = e.code.replace('Numpad', '');
          console.log('Numpad detected, converted to:', keyName);
        } else if (e.key.length === 1 && /[0-9]/.test(e.key)) {
          // Ensure single digits are treated as numbers
          keyName = e.key;
        } else if (e.key.startsWith('F') && /^\d+$/.test(e.key.slice(1))) {
          // Function keys like F1, F2, etc.
          keyName = e.key;
        } else if (e.key.length === 1) {
          keyName = e.key.toUpperCase();
        }
        
        // Only add the main key if it's not a pure modifier
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(keyName)) {
          keys.push(keyName);
        }
        
        const hotkeyStr = keys.join('+');
        hotkeyInput.value = hotkeyStr;
        hotkeyStatus.textContent = hotkeyStr ? `Set to: ${hotkeyStr}` : '';
        console.log('Final hotkey string:', hotkeyStr);
        
        // Clean up
        document.removeEventListener('keydown', hotkeyListener);
        hotkeyListener = null;
        recordHotkeyBtn.textContent = 'Record Hotkey';
        recordHotkeyBtn.classList.remove('recording');
      };
      document.addEventListener('keydown', hotkeyListener);
      // Visual feedback
      recordHotkeyBtn.textContent = 'Recording...';
      recordHotkeyBtn.classList.add('recording');
    });
  }
}); 
