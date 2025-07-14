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
    
    const buttonList = document.getElementById("button-list");

    data.buttons.forEach((btn, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${btn.label}</strong> [${btn.type}] ${btn.hotkey ? `(Hotkey: ${btn.hotkey})` : ""}
        <button onclick="editButton(${index})">Edit</button>
        <button onclick="deleteButton(${index})">Delete</button>
      `;
      buttonList.appendChild(li);
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

// Settings modal logic
document.getElementById('open-settings').onclick = () => {
  document.getElementById('settings-modal').classList.remove('hidden');
};

// Add sound card functionality
document.getElementById('add-sound-card').onclick = () => {
  // Clear form for new sound
  document.getElementById('settings-form').reset();
  document.getElementById('hotkey-input').value = '';
  document.getElementById('hotkey-status').textContent = '';
  delete document.getElementById('settings-form').dataset.editingIndex;
  
  // Update modal title
  document.querySelector('#settings-modal h2').textContent = 'Add New Sound';
  
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

  if (!label || !fileInput.files.length) return alert("Please fill in all required fields.");

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
    editingIndex: form.dataset.editingIndex ? parseInt(form.dataset.editingIndex) : undefined
  });

  document.getElementById('settings-modal').classList.add('hidden');
  setTimeout(() => window.location.reload(), 500); // Reload to update buttons
};

window.editButton = (index) => {
  fetch("../config.json")
    .then(res => res.json())
    .then(config => {
      const btn = config.buttons[index];
      document.querySelector('#settings-form [name="label"]').value = btn.label;
      document.querySelector('#settings-form [name="type"]').value = btn.type;
      document.getElementById('hotkey-input').value = btn.hotkey || "";
      
      // Update modal title
      document.querySelector('#settings-modal h2').textContent = `Edit Sound: ${btn.label}`;
      
      document.getElementById('settings-modal').classList.remove('hidden');
      // mark index to replace
      document.getElementById('settings-form').dataset.editingIndex = index;
    });
};

window.deleteButton = (index) => {
  if (!confirm("Delete this button?")) return;
  ipcRenderer.send('delete-button', index);
  setTimeout(() => window.location.reload(), 500);
};

// Close app button
document.getElementById('close-app').onclick = () => {
  ipcRenderer.send('close-app');
};

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
