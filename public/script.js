// public/script.js

const soundGrid = document.getElementById("sound-grid");
const visualContainer = document.getElementById("visual-container");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");

// Add refresh UI listener
window.electronAPI.onRefreshUI(() => {
  loadButtons();
});

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

// Helper function for smart auto-scroll
function smartAutoScroll(chatMessagesContainer) {
  if (!chatMessagesContainer) return;
  
  // Auto-scroll to bottom only if user is near the bottom
  const isNearBottom = chatMessagesContainer.scrollTop + chatMessagesContainer.clientHeight >= chatMessagesContainer.scrollHeight - 50;
  if (isNearBottom) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
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
  // Clean up any ghost
  if (vdDragState.ghost && vdDragState.ghost.parentNode) {
    vdDragState.ghost.parentNode.removeChild(vdDragState.ghost);
  }
  vdDragState = { draggingCard: null, ghost: null, fromIndex: -1, activeSlot: null, startX: 0, startY: 0, moved: false };
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

function cleanupDrag() {
  // Remove ghost
  if (vdDragState.ghost && vdDragState.ghost.parentNode) vdDragState.ghost.parentNode.removeChild(vdDragState.ghost);
  // Remove slot highlight
  if (vdDragState.activeSlot) vdDragState.activeSlot.classList.remove('slot-active');
  // Remove global listeners
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', endPointerDrag);
  // Restore selection
  document.body.style.userSelect = '';

  // Reset state
  vdDragState = { draggingCard: null, ghost: null, fromIndex: -1, activeSlot: null, startX: 0, startY: 0, moved: false };
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
  const soundGrid = document.getElementById('sound-grid');
  const soundCards = Array.from(soundGrid.querySelectorAll('.sound-card'));
  
  const newOrder = soundCards
    .filter(card => card.dataset.soundData) // Only include cards with sound data
    .map(card => {
      const soundData = JSON.parse(card.dataset.soundData);
      return soundData;
    });
  
  // Save to localStorage
  localStorage.setItem('soundButtonOrder', JSON.stringify(newOrder));
}

function loadButtonOrder() {
  const savedOrder = localStorage.getItem('soundButtonOrder');
  if (savedOrder) {
    try {
      return JSON.parse(savedOrder);
    } catch (e) {
      console.error('Error loading button order:', e);
    }
  }
  return null;
}

// Initialize chat display
function initializeChatDisplay() {
  const chatContainer = document.getElementById('twitch-chat-container');
  const toggleBtn = document.getElementById('toggle-chat');
  const statusIndicator = document.getElementById('chat-status-indicator');
  const chatMessagesContainer = document.getElementById('twitch-chat-messages');
  
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
  
  
  // Add global mouse wheel handler
  document.addEventListener('wheel', handleGlobalMouseWheel, { passive: false });
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
    
    // Add to container
    chatMessagesContainer.appendChild(row);
    
    // Store in array for management
    chatMessages.push({
      element: row,
      timestamp: Date.now()
    });
    
    // Limit number of messages
    if (chatMessages.length > MAX_CHAT_MESSAGES) {
      const oldMessage = chatMessages.shift();
      if (oldMessage.element.parentNode) {
        oldMessage.element.parentNode.removeChild(oldMessage.element);
      }
    }
    
    // Smart auto-scroll to bottom
    smartAutoScroll(chatMessagesContainer);
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
      chatContainer.classList.remove('hidden');
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
    <div class="add-text">Add Sound</div>
  `;
  addCard.onclick = () => {
    const settingsForm = document.getElementById('settings-form');
    settingsForm.reset();
  // Stop any active hotkey recording and clear displayed status/value
  if (typeof stopHotkeyRecording === 'function') stopHotkeyRecording();
  const hkIn = document.getElementById('hotkey-input'); if (hkIn) hkIn.value = '';
  const hkStatus = document.getElementById('hotkey-status'); if (hkStatus) hkStatus.textContent = '';
  // Fully clear all dataset properties for new record
  delete settingsForm.dataset.editingIndex;
  delete settingsForm.dataset.editingId;
    delete settingsForm.dataset.resolvedPath;
    delete settingsForm.dataset.resolvedArgs;
    delete settingsForm.dataset.existingFile;
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
    document.querySelector('#settings-modal h2').textContent = 'Add New Sound';
    document.getElementById('settings-modal').classList.remove('hidden');
    window.electronAPI.disableHotkeys();
  };
  
  soundGrid.appendChild(addCard);

  // Load buttons from config
  const data = await window.electronAPI.getConfig();
  
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
      <div class="sound-name">${button.label}</div>
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
          if (sd) handleTrigger(sd);
        } catch (err) {
          console.error('Failed to parse soundData on click:', err);
        }
      }
    });
    soundGrid.appendChild(card);
  }
  
  // Re-enable drag mode if it was active
  if (isDragMode) {
    enableDragMode();
  }
}

// Essential: Both preventDefault() and stopPropagation() are required for Electron
// Only prevent drag events when NOT in sound card drag mode
document.addEventListener('dragover', (e) => {
  console.log('Global dragover, isDragMode:', isDragMode, 'target:', e.target);
  if (!isDragMode || !e.target.classList.contains('sound-card')) {
    e.preventDefault();
    e.stopPropagation();
  }
});

document.addEventListener('drop', (e) => {
  console.log('Global drop, isDragMode:', isDragMode, 'target:', e.target);
  if (!isDragMode || !e.target.classList.contains('sound-card')) {
    e.preventDefault();
    e.stopPropagation();
    // Visual feedback
    const globalDropZone = document.getElementById('global-drop-zone');
    if (globalDropZone) globalDropZone.classList.add('hidden');
    // Process dropped files
    for (const file of e.dataTransfer.files) {
      handleFileDrop(file);
      break; // Only handle the first file
    }
  }
});

document.addEventListener('dragenter', (e) => {
  const globalDropZone = document.getElementById('global-drop-zone');
  if (globalDropZone) globalDropZone.classList.remove('hidden');
});

document.addEventListener('dragleave', (e) => {
  if (!document.body.contains(e.relatedTarget)) {
    const globalDropZone = document.getElementById('global-drop-zone');
    if (globalDropZone) globalDropZone.classList.add('hidden');
  }
});

// Initial load
loadButtons();

// Initialize chat display
initializeChatDisplay();

// Initialize drag and drop
initializeDragAndDrop();

// Initialize component visibility dropdown
initializeVisibilityDropdown();

// Load and display app version
loadAppVersion();

// Component Visibility Dropdown Functions
function initializeVisibilityDropdown() {
  console.log('Initializing visibility dropdown...'); // Debug log
  
  const toggleBtn = document.getElementById('visibility-toggle');
  const menu = document.getElementById('visibility-menu');
  
  console.log('Toggle button found:', !!toggleBtn); // Debug log
  console.log('Menu found:', !!menu); // Debug log
  const checkboxes = {
    'toggle-sound-grid': 'sound-grid',
    'toggle-twitch-stats': 'twitch-stats-container',
    'toggle-recent-activity': 'recent-activity-container',
    'toggle-twitch-chat': 'twitch-chat-container',
    'toggle-sound-controls': 'sound-controls',
    'toggle-move-bar': 'move-bar'
  };

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
    if (menu && !menu.contains(e.target) && !toggleBtn.contains(e.target)) {
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
      });
    });
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

    // Show stats container
    statsContainer.classList.remove('hidden');
    
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
    statsContainer.classList.add('hidden');
  }
}

// Initialize stats display
function initializeStatsDisplay() {
  const statsContainer = document.getElementById('twitch-stats-container');
  
  // Start with stats hidden
  if (statsContainer) {
    statsContainer.classList.add('hidden');
  }
  
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
    // Show loading state
    activityContainer.classList.remove('hidden');
    
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

// Listen for Twitch chat events
window.electronAPI.onTwitchChatEvent((eventData) => {
  if (eventData.type === 'chat') {
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
window.electronAPI.onTwitchEventSub((eventData) => {
  addTwitchEvent(eventData.type, eventData.event);
  
  // Update recent activity for follows and subscribers
  if (eventData.type === 'channel.follow' || eventData.type === 'poll.follow') {
    addRecentFollower(eventData.event);
  } else if (eventData.type === 'channel.subscribe') {
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
  
  // Add to container
  chatMessagesContainer.appendChild(row);
  
  // Store in array for management
  chatMessages.push({
    element: row,
    timestamp: Date.now()
  });
  
  // Limit number of messages
  if (chatMessages.length > MAX_CHAT_MESSAGES) {
    const oldMessage = chatMessages.shift();
    if (oldMessage.element.parentNode) {
      oldMessage.element.parentNode.removeChild(oldMessage.element);
    }
  }
  
  // Smart auto-scroll to bottom
  smartAutoScroll(chatMessagesContainer);
}

// Listen for Twitch connection status
window.electronAPI.onTwitchConnected(() => {
  updateChatVisibility(true);
  updateChatStatusIndicator(true);
  // Auto-expand chat when connected
  const chatContainer = document.getElementById('twitch-chat-container');
  if (chatContainer) {
    chatContainer.classList.remove('hidden');
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
  
  // Make sure stats container is visible
  const statsContainer = document.getElementById('twitch-stats-container');
  if (statsContainer) {
    statsContainer.classList.remove('hidden');
    
    // Add debug info
    let debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
      debugDiv.innerHTML += `Stats container made visible on connection, classes: ${statsContainer.className}<br>`;
    }
  } else {
    // Add debug info
    let debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
      debugDiv.innerHTML += 'Stats container not found!<br>';
    }
  }
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
  // Prevent accidental plays while editing/reordering
  if (isDragMode) return;
  // If caller passed a DOM element instead of button object, normalize
  if (button && button._vdJustDragged) return;

  if (button.type === "audio") {
    const audioPath = await window.electronAPI.getSoundPath(button.src);
    const audio = new Audio(audioPath);
    audio.play().catch(error => {
    });
  } else if (button.type === "app") {
    // If the button has args, pass them along
    if (button.args) {
      window.electronAPI.launchApp({ path: button.src, args: button.args });
    } else {
      window.electronAPI.launchApp({ path: button.src });
    }
  }
  // Removed visual handling
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
  const type = form.type.value;
  // Ensure we reference the hotkey input element safely
  const hotkeyInput = document.getElementById('hotkey-input');
  const hotkey = hotkeyInput && hotkeyInput.value ? hotkeyInput.value.trim() : '';
  const isEditing = form.dataset.editingIndex !== undefined;
  let skipReload = false;

  // Get modifier checkboxes
  if (!label) return alert("Please fill in the label field.");
  // Use the recorded hotkey directly (accumulative recorder populates hotkeyInput.value)
  const completeHotkey = (hotkeyInput && hotkeyInput.value && hotkeyInput.value.trim()) ? hotkeyInput.value.trim() : hotkey;

  // Get the appropriate file input based on type
  const fileInput = type === 'app' ? document.getElementById('app-file-input') : document.getElementById('file-input');

  // Check if we have a resolved path from drag-and-drop
  const resolvedPath = form.dataset.resolvedPath;
  const resolvedArgs = form.dataset.resolvedArgs || '';
  
  // Debug logging
  console.log('Form submission debug:');
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
      targetPath: existingFile,
      originalPath: existingFile,
      editingIndex: parseInt(form.dataset.editingIndex)
    });
    window.electronAPI.refreshHotkeys();
    // Update the displayed card in-place to avoid full re-render flash
    try {
      const editingId = form.dataset.editingId;
      const updated = {
        id: editingId,
        label,
        type,
        src: existingFile,
        hotkey: completeHotkey || undefined,
        args: form.dataset.resolvedArgs || undefined
      };
      if (editingId) {
        const card = document.querySelector(`.sound-card[data-button-id="${editingId}"]`);
        if (card) {
          card.dataset.soundData = JSON.stringify(updated);
          const nameEl = card.querySelector('.sound-name'); if (nameEl) nameEl.textContent = updated.label;
          const hotkeyEl = card.querySelector('.sound-hotkey'); if (hotkeyEl) hotkeyEl.textContent = updated.hotkey || 'No hotkey';
          const typeEl = card.querySelector('.sound-type'); if (typeEl) typeEl.textContent = updated.type;
        }
      }
    } catch (err) { console.error('In-place update failed:', err); }
    skipReload = true;
  } else if (fileInput.files.length || resolvedPath) {
    // New file selected or resolved path from drag-and-drop
    console.log('Form submission - resolvedPath:', resolvedPath);
    console.log('Form submission - fileInput.files.length:', fileInput.files.length);
    if (fileInput.files.length > 0) {
      console.log('Form submission - fileInput.files[0]:', fileInput.files[0]);
    }
    
    const filePath = resolvedPath || fileInput.files[0].path;
    const fileName = resolvedPath ? (resolvedPath.split('\\').pop() || resolvedPath.split('/').pop()) : fileInput.files[0].name;
    
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
      args
    });

    // Send file path and data to main
    window.electronAPI.addMedia({
      label,
      type,
      hotkey: completeHotkey,
      targetPath,
      originalPath: filePath,
      args,
      editingIndex: isEditing ? parseInt(form.dataset.editingIndex) : undefined
    });
    window.electronAPI.refreshHotkeys();
    // If editing (with new file), update in-place using the computed targetPath
    if (isEditing) {
      try {
        const editingId = form.dataset.editingId;
        const updated = {
          id: editingId,
          label,
          type,
          src: targetPath,
          hotkey: completeHotkey || undefined,
          args: args || undefined
        };
        if (editingId) {
          const card = document.querySelector(`.sound-card[data-button-id="${editingId}"]`);
          if (card) {
            card.dataset.soundData = JSON.stringify(updated);
            const nameEl = card.querySelector('.sound-name'); if (nameEl) nameEl.textContent = updated.label;
            const hotkeyEl = card.querySelector('.sound-hotkey'); if (hotkeyEl) hotkeyEl.textContent = updated.hotkey || 'No hotkey';
            const typeEl = card.querySelector('.sound-type'); if (typeEl) typeEl.textContent = updated.type;
          }
        }
      } catch (err) { console.error('In-place update failed:', err); }
      skipReload = true;
    }
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
  labelInput.value = btn.label;
  labelInput.readOnly = false;
  labelInput.disabled = false;
  // Set the type selection
  const typeSelect = document.getElementById('type-select');
  typeSelect.value = btn.type;
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
  // Store the existing file path and args for editing
  settingsForm.dataset.existingFile = btn.src;
  if (btn.args) {
    settingsForm.dataset.resolvedArgs = btn.args;
  }
  // Update modal title
  document.querySelector('#settings-modal h2').textContent = `Edit ${btn.type === 'audio' ? 'Sound' : 'App'}: ${btn.label}`;
  // Show current file info
  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    const fileName = btn.src.split('/').pop() || btn.src.split('\\').pop();
    dropZone.innerHTML = `
      <div style="margin-bottom: 10px; color: #4CAF50; font-weight: bold;">
        ✓ Current file: ${fileName}
      </div>
      <div style="color: #888; font-size: 0.9em;">
        Drag new file here to replace, or leave empty to keep current file
      </div>
    `;
  }
  document.getElementById('settings-modal').classList.remove('hidden');
  window.electronAPI.disableHotkeys();
  // Ensure recorder is stopped when opening edit
  if (typeof stopHotkeyRecording === 'function') stopHotkeyRecording();
};

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
    if (confirm("Delete this button?")) {
      window.electronAPI.deleteButton(origIndex);
      window.electronAPI.refreshHotkeys();
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

// Move App Button: Hold to move the window
window.addEventListener('DOMContentLoaded', () => {
  const moveBar = document.getElementById('move-bar');
  if (moveBar) {
    let isDragging = false;
    let startX, startY;

    moveBar.addEventListener('mousedown', (e) => {
      isDragging = true;
      moveBar.classList.add('dragging');
      
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
        window.electronAPI.moveWindow({
          x: deltaX,
          y: deltaY
        });
        
        // Update start position to current position
        startX = e.screenX;
        startY = e.screenY;
      }
      
      e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        moveBar.classList.remove('dragging');
      }
    });

    // Prevent context menu on move bar
    moveBar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
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

function handleFileDrop(file) {
  console.log('handleFileDrop called with file:', file);
  console.log('File name:', file.name);
  console.log('File path:', file.path);
  
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
  const typeSelect = document.getElementById('type-select');
  const audioFileSection = document.getElementById('audio-file-section');
  const appFileSection = document.getElementById('app-file-section');
  const fileInput = document.getElementById('file-input');
  const appFileInput = document.getElementById('app-file-input');
  const settingsModal = document.getElementById('settings-modal');

  // Null checks
  if (!settingsForm || !hotkeyInput || !hotkeyStatus || !labelInput || !typeSelect || !audioFileSection || !appFileSection || !fileInput || !appFileInput || !settingsModal) {
    console.warn('One or more required elements are missing in the DOM.');
    return;
  }

  // Open add menu
  settingsForm.reset();
  hotkeyInput.value = '';
  hotkeyStatus.textContent = '';
  delete settingsForm.dataset.editingIndex;
  delete settingsForm.dataset.editingId;
  document.querySelector('#settings-modal h2').textContent = 'Add New ' + (type === 'audio' ? 'Sound' : 'App');
  typeSelect.value = type;

  // Handle shortcut resolution for app files
  if (type === 'app') {
    // Try to resolve as shortcut regardless of extension
    console.log('Attempting to resolve as shortcut:', file.path);
    window.electronAPI.resolveShortcut(file.path).then(shortcut => {
      if (shortcut && shortcut.target) {
        console.log('Shortcut resolved to:', shortcut);
        // Store the resolved path and args in the form
        settingsForm.dataset.resolvedPath = shortcut.target;
        settingsForm.dataset.resolvedArgs = shortcut.args || '';
        setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
      } else {
        console.warn('Failed to resolve shortcut, using original file');
        settingsForm.dataset.resolvedPath = file.path;
        settingsForm.dataset.resolvedArgs = '';
        setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
      }
    }).catch(error => {
      console.error('Error resolving shortcut:', error);
      settingsForm.dataset.resolvedPath = file.path;
      settingsForm.dataset.resolvedArgs = '';
      setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
    });
  } else {
    settingsForm.dataset.resolvedPath = file.path;
    settingsForm.dataset.resolvedArgs = '';
    setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput);
  }

  // Set label to file name (no extension)
  labelInput.value = file.name.replace(/\.[^/.]+$/, "");
  settingsModal.classList.remove('hidden');
  window.electronAPI.disableHotkeys();
}

// Helper function to set file in the appropriate form input
function setFileInForm(file, type, audioFileSection, appFileSection, fileInput, appFileInput) {
  if (type === 'audio') {
    audioFileSection.style.display = '';
    appFileSection.style.display = 'none';
    fileInput.required = true;
    appFileInput.required = false;
    // Set file input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    // Create or update file display
    updateFileDisplay(fileInput, file.name);
  } else {
    audioFileSection.style.display = 'none';
    appFileSection.style.display = '';
    fileInput.required = false;
    appFileInput.required = true;
    // Set app file input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    appFileInput.files = dataTransfer.files;
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

// Add event listener to Type select to toggle required state dynamically
const typeSelect = document.getElementById('type-select');
typeSelect.addEventListener('change', function() {
  const fileInput = document.getElementById('file-input');
  const appFileInput = document.getElementById('app-file-input');
  if (typeSelect.value === 'audio') {
    fileInput.required = true;
    appFileInput.required = false;
  } else {
    fileInput.required = false;
    appFileInput.required = true;
  }
});
