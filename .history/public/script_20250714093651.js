// public/script.js
const { ipcRenderer } = require('electron');

const buttonsDiv = document.getElementById("buttons");
const visualContainer = document.getElementById("visual-container");

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
    audio.play();
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
  const hotkey = form.hotkey.value.trim();
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
      document.querySelector('#settings-form [name="hotkey"]').value = btn.hotkey || "";
      document.getElementById('settings-modal').classList.remove('hidden');
      // mark index to replace
      form.dataset.editingIndex = index;
    });
};

window.deleteButton = (index) => {
  if (!confirm("Delete this button?")) return;
  ipcRenderer.send('delete-button', index);
  setTimeout(() => window.location.reload(), 500);
}; 
