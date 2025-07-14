// public/script.js

const soundGrid = document.getElementById("sound-grid");
const visualContainer = document.getElementById("visual-container");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");

// Add refresh UI listener
window.electronAPI.onRefreshUI(() => {
  loadButtons();
});

async function loadButtons() {
  // Clear existing buttons
  soundGrid.innerHTML = '';

  // Add the Add Sound card as the first card
  const addCard = document.createElement('div');
  addCard.className = 'sound-card add-card';
  addCard.id = 'add-sound-card';
  addCard.innerHTML = `
    <div class="add-icon">+</div>
    <div class="add-text">Add Sound</div>
  `;
  addCard.onclick = () => {
    document.getElementById('settings-form').reset();
    document.getElementById('hotkey-input').value = '';
    document.getElementById('hotkey-status').textContent = '';
    delete document.getElementById('settings-form').dataset.editingIndex;
    document.querySelector('#settings-modal h2').textContent = 'Add New Sound';
    document.getElementById('file-input').required = true;
    document.getElementById('settings-modal').classList.remove('hidden');
    window.electronAPI.disableHotkeys();
  };
  soundGrid.appendChild(addCard);

  // Load buttons from config
  const data = await window.electronAPI.getConfig();
  data.buttons.forEach((button, index) => {
    const card = document.createElement("div");
    card.className = "sound-card";
    card.innerHTML = `
      <button class="edit-button" onclick="editButton(${index})">Edit</button>
      <div class="sound-type">${button.type}</div>
      <div class="sound-name">${button.label}</div>
      <div class="sound-hotkey">${button.hotkey || 'No hotkey'}</div>
      <button class="delete-bottom-button" onclick="deleteButton(${index})" title="Delete">Delete</button>
    `;
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('edit-button') && !e.target.classList.contains('delete-bottom-button')) {
        handleTrigger(button);
      }
    });
    soundGrid.appendChild(card);
  });
}

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

// Initial load
loadButtons();

async function handleTrigger(button) {
  if (button.type === "audio") {
    const audioPath = await window.electronAPI.getSoundPath(button.src);
    const audio = new Audio(audioPath);
    audio.play().catch(error => {
    });
  }
  // Removed visual handling
}

// Replace all ipcRenderer.send and ipcRenderer.on with window.electronAPI methods
// Add sound card functionality
document.getElementById('close-settings').onclick = () => {
  document.getElementById('settings-modal').classList.add('hidden');
  window.electronAPI.enableHotkeys();
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
    window.electronAPI.addMedia({
      label,
      type,
      hotkey,
      targetPath: existingFile,
      originalPath: existingFile,
      editingIndex: parseInt(form.dataset.editingIndex)
    });
    window.electronAPI.refreshHotkeys();
  } else if (fileInput.files.length) {
    // New file selected
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop();
    const targetPath = `assets/${type === 'audio' ? 'sounds' : 'visuals'}/${label}.${ext}`;

    // Send file path and data to main
    window.electronAPI.addMedia({
      label,
      type,
      hotkey,
      targetPath,
      originalPath: file.path,
      editingIndex: isEditing ? parseInt(form.dataset.editingIndex) : undefined
    });
    window.electronAPI.refreshHotkeys();
  } else if (!isEditing) {
    // Only require file selection for new buttons, not when editing
    return alert("Please select a file.");
  }

  document.getElementById('settings-modal').classList.add('hidden');
  setTimeout(() => window.location.reload(), 500); // Reload to update buttons
};

window.editButton = async (index) => {
  const config = await window.electronAPI.getConfig();
  const btn = config.buttons[index];
  // Populate form fields
  const labelInput = document.getElementById('label-input');
  labelInput.value = btn.label;
  labelInput.readOnly = false;
  labelInput.disabled = false;
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
  window.electronAPI.disableHotkeys();
  // mark index to replace
  document.getElementById('settings-form').dataset.editingIndex = index;
  // Stop hotkey recording if active
  const recordHotkeyBtn = document.getElementById('record-hotkey');
  if (hotkeyListener) {
    document.removeEventListener('keydown', hotkeyListener);
    hotkeyListener = null;
    recordHotkeyBtn.textContent = 'Record Hotkey';
    recordHotkeyBtn.classList.remove('recording');
  }
};

window.deleteButton = (index) => {
  if (!confirm("Delete this button?")) return;
  window.electronAPI.deleteButton(index);
  window.electronAPI.refreshHotkeys();
};

// Close app button
window.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-app');
  if (closeBtn) {
    closeBtn.onclick = () => {
      window.electronAPI.closeApp();
    };
  }
});

// Hotkey recording functionality
let hotkeyListener = null;

window.addEventListener('DOMContentLoaded', () => {
  // Attach Record Hotkey button handler
  const recordHotkeyBtn = document.getElementById('record-hotkey');
  const hotkeyInput = document.getElementById('hotkey-input');
  const hotkeyStatus = document.getElementById('hotkey-status');

  if (recordHotkeyBtn) {
    recordHotkeyBtn.addEventListener('click', () => {
      // Button click animation
      recordHotkeyBtn.classList.remove('clicked');
      void recordHotkeyBtn.offsetWidth;
      recordHotkeyBtn.classList.add('clicked');
      hotkeyStatus.textContent = 'Press any key...';
      hotkeyInput.value = '';
      hotkeyInput.focus();
      if (hotkeyListener) document.removeEventListener('keydown', hotkeyListener);
      hotkeyListener = function(e) {
        e.preventDefault();
        const keys = [];
        if (e.ctrlKey) keys.push('Control');
        if (e.shiftKey) keys.push('Shift');
        if (e.altKey) keys.push('Alt');
        if (e.metaKey) keys.push('Meta');
        let keyName = e.key;
        if (e.code.startsWith('Numpad')) {
          keyName = e.code.replace('Numpad', '');
        } else if (e.key.length === 1 && /[0-9]/.test(e.key)) {
          keyName = e.key;
        } else if (e.key.startsWith('F') && /^\d+$/.test(e.key.slice(1))) {
          keyName = e.key;
        }
        keys.push(keyName);
        hotkeyInput.value = keys.join('+');
        hotkeyStatus.textContent = `Set to: ${hotkeyInput.value}`;
        document.removeEventListener('keydown', hotkeyListener);
        hotkeyListener = null;
        recordHotkeyBtn.textContent = 'Record Hotkey';
        recordHotkeyBtn.classList.remove('recording');
      };
      document.addEventListener('keydown', hotkeyListener);
      recordHotkeyBtn.textContent = 'Recording...';
      recordHotkeyBtn.classList.add('recording');
    });
  }
});

// Move App Button: Hold to move the window
window.addEventListener('DOMContentLoaded', () => {
  const moveBtn = document.getElementById('move-app-btn');
  const container = document.querySelector('.container');
  if (moveBtn && container) {
    moveBtn.addEventListener('mousedown', () => {
      container.classList.add('moving');
    });
    // Remove moving class on mouseup or mouseleave (anywhere on window)
    const stopMoving = () => container.classList.remove('moving');
    moveBtn.addEventListener('mouseup', stopMoving);
    moveBtn.addEventListener('mouseleave', stopMoving);
    window.addEventListener('mouseup', stopMoving);
  }
});

// Listen for trigger-media events from the main process
window.electronAPI.onTriggerMedia(async (mediaId) => {
  const config = await window.electronAPI.getConfig();
  if (!config || !Array.isArray(config.buttons)) return;
  const button = config.buttons.find(btn =>
    btn.label.toLowerCase().includes(mediaId.toLowerCase())
  );
  if (button) handleTrigger(button);
}); 
