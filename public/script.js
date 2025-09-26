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

  // Also persist order to main config.json by sending ordered ids
  try {
    const orderedIds = newOrder.map(b => b.id).filter(Boolean);
    if (window.electronAPI && typeof window.electronAPI.saveButtonOrder === 'function') {
      window.electronAPI.saveButtonOrder(orderedIds);
    } else if (window.electronAPI && window.electronAPI.send) {
      // fallback if older API exposure
      window.electronAPI.send('save-button-order', orderedIds);
    }
  } catch (e) {
    console.warn('Failed to persist button order to main process:', e);
  }
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
  // Show settings modal (user-initiated) - always allow
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

  // After full list appended to DOM, compute pagination and show page
  computePagination();
  renderCurrentPage();
  
  // Re-enable drag mode if it was active
  if (isDragMode) {
    enableDragMode();
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
          // Persist visibility preference
          try {
            const prefs = JSON.parse(localStorage.getItem('vdVisibility') || '{}');
            prefs[componentId] = checkbox.checked;
            localStorage.setItem('vdVisibility', JSON.stringify(prefs));
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
  // Prevent accidental plays while editing/reordering
  if (isDragMode) return;
  // If caller passed a DOM element instead of button object, normalize
  if (button && button._vdJustDragged) return;

  if (button.type === "audio") {
    const audioPath = await window.electronAPI.getSoundPath(button.src);
    const audio = new Audio(audioPath);
    // Apply saved volume if present (expect 0.0 - 1.0). Fallback to 1.0
    // Note: volume is stored per-button in `config.json` and only applied for
    // audio-type buttons. The renderer sends `volume` as a float (0.0-1.0)
    // when saving; the main process persists it into the button config.
    try {
      const vol = (typeof button.volume === 'number') ? button.volume : (button.volume ? parseFloat(button.volume) : 1.0);
      if (!isNaN(vol)) audio.volume = Math.max(0, Math.min(1, vol));
    } catch (err) {
      // ignore and use default
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
      volume: parseFloat((document.getElementById('volume-input') && document.getElementById('volume-input').value) || 100) / 100,
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
        volume: parseFloat((document.getElementById('volume-input') && document.getElementById('volume-input').value) || 100) / 100,
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
      volume: parseFloat((document.getElementById('volume-input') && document.getElementById('volume-input').value) || 100) / 100,
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
          volume: parseFloat((document.getElementById('volume-input') && document.getElementById('volume-input').value) || 100) / 100,
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
    this.applyTheme(this.currentTheme);
    
    // Ensure theme is applied after delays to handle any timing issues
    setTimeout(() => {
      this.applyTheme(this.currentTheme);
    }, 100);
    
    // Apply again after a longer delay to ensure it sticks
    setTimeout(() => {
      this.applyTheme(this.currentTheme);
    }, 500);
    
    // Sync the menu state with the loaded theme
    setTimeout(() => {
      if (window.electronAPI?.syncTheme) {
        window.electronAPI.syncTheme(this.currentTheme);
      }
    }, 600);
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
          savedTheme = config?.theme;
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
    try {
      // Try Electron API first (production)
      if (window.electronAPI?.updateConfig) {
        window.electronAPI.updateConfig({ theme: themeName });
      } else {
        // Fallback to localStorage (development)
        localStorage.setItem(this.storageKey, themeName);
      }
    } catch (error) {
      // Try localStorage as fallback
      try {
        localStorage.setItem(this.storageKey, themeName);
      } catch (localError) {
        // Silent fail if both methods fail
      }
    }
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
      cssContent += skinData.css;
    }

    // Add custom component styles
    if (skinData.components && typeof skinData.components === 'object') {
      for (const [selector, styles] of Object.entries(skinData.components)) {
        if (typeof styles === 'object') {
          cssContent += `${selector} {\n`;
          for (const [property, value] of Object.entries(styles)) {
            cssContent += `  ${property}: ${value};\n`;
          }
          cssContent += '}\n';
        }
      }
    }

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
  const btnMin = document.getElementById('btn-minimize');
  const btnMax = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  const maxIcon = document.getElementById('max-icon');

  if (btnMin) btnMin.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.electronAPI && typeof window.electronAPI.minimizeWindow === 'function') window.electronAPI.minimizeWindow();
  });
  if (btnMax) btnMax.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.electronAPI && typeof window.electronAPI.toggleMaximizeWindow === 'function') window.electronAPI.toggleMaximizeWindow();
  });
  if (btnClose) btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.electronAPI && typeof window.electronAPI.closeWindow === 'function') window.electronAPI.closeWindow();
  });

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
  setupAppToolbar();
  // initialize left app menu
  if (typeof setupLeftAppMenu === 'function') setupLeftAppMenu();
});

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
    const allDropdowns = [menuDropdown, viewDropdown, helpDropdown, editDropdown].filter(Boolean);
    const allBtns = [menuBtn, viewBtn, helpBtn, editBtn].filter(Boolean);
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
  if (prefBtn) {
    prefBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.electronAPI && typeof window.electronAPI.openPreferences === 'function') {
        window.electronAPI.openPreferences();
      } else {
        try { window.ipcRenderer && window.ipcRenderer.send && window.ipcRenderer.send('open-preferences'); } catch (e) {}
      }
    });
  }
}

// Wait for DOM to be ready before initializing theme manager
document.addEventListener('DOMContentLoaded', () => {
  themeManager = new ThemeManager();
  notificationManager = new NotificationManager();
  
  // Add hotkey to cycle through themes (Ctrl+Shift+T)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      if (themeManager) {
        themeManager.cycleTheme();
      }
    }
  });
  
  // Export for potential use by other parts of the app
  window.themeManager = themeManager;
  window.notificationManager = notificationManager;
  
  // Watch for any changes to the document element's data-theme attribute
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme !== themeManager.getCurrentTheme()) {
          setTimeout(() => {
            themeManager.applyTheme(themeManager.getCurrentTheme());
          }, 10);
        }
      }
    });
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  
  // Final theme application after everything else has loaded
  window.addEventListener('load', () => {
    setTimeout(() => {
      themeManager.applyTheme(themeManager.getCurrentTheme());
    }, 1000);
  });
});
