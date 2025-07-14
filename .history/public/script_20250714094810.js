// public/script.js
const { ipcRenderer } = require('electron');

const buttonsDiv = document.getElementById("buttons");
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
    data.buttons.forEach(button => {
      const btn = document.createElement("button");
      btn.innerText = button.label;
      btn.onclick = () => handleTrigger(button);
      buttonsDiv.appendChild(btn);
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
let isRecording = false;
let recordedKeys = [];

document.getElementById('record-hotkey').onclick = () => {
  console.log('Record hotkey button clicked!');
  const recordBtn = document.getElementById('record-hotkey');
  const hotkeyInput = document.getElementById('hotkey-input');
  
  if (!isRecording) {
    // Start recording
    console.log('Starting hotkey recording...');
    isRecording = true;
    recordedKeys = [];
    recordBtn.textContent = 'Recording...';
    recordBtn.classList.add('recording');
    hotkeyInput.value = 'Press keys now...';
    
    // Focus on the button to capture key events
    recordBtn.focus();
  } else {
    // Stop recording
    console.log('Stopping hotkey recording...');
    isRecording = false;
    recordBtn.textContent = 'Record Hotkey';
    recordBtn.classList.remove('recording');
    
    if (recordedKeys.length > 0) {
      hotkeyInput.value = recordedKeys.join('+');
      console.log('Recorded hotkey:', recordedKeys.join('+'));
    } else {
      hotkeyInput.value = '';
    }
  }
};

// Global key event listener for recording
document.addEventListener('keydown', (e) => {
  if (!isRecording) return;
  
  e.preventDefault();
  
  const key = e.key.toLowerCase();
  const modifiers = [];
  
  if (e.ctrlKey) modifiers.push('Control');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.altKey) modifiers.push('Alt');
  if (e.metaKey) modifiers.push('Meta');
  
  // Don't add modifier keys twice
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
    modifiers.push(key);
  }
  
  if (modifiers.length > 0) {
    recordedKeys = modifiers;
    document.getElementById('hotkey-input').value = recordedKeys.join('+');
  }
});

document.addEventListener('keyup', (e) => {
  if (!isRecording) return;
  
  // Stop recording after a short delay
  setTimeout(() => {
    if (isRecording) {
      isRecording = false;
      document.getElementById('record-hotkey').textContent = 'Record Hotkey';
      document.getElementById('record-hotkey').classList.remove('recording');
    }
  }, 500);
}); 
