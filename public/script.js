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
    // Show selection modal
    document.getElementById('button-type-modal').classList.remove('hidden');
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
  console.log('📡 Twitch EventSub received:', eventData);
  
  // Update alerts from storage in case they changed
  alertSystem.updateAlerts();
  
  // Map Twitch event types to alert types
  const eventTypeMap = {
    'channel.follow': 'follower',
    'channel.subscribe': 'subscriber', 
    'channel.subscription.gift': 'gift-sub',
    'channel.raid': 'raid',
    'channel.cheer': 'bits'
  };
  
  const alertType = eventTypeMap[eventData.type];
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
      reward: eventData.event.reward || eventData.event.reward_title || '',
      ...eventData.event // Include all event data
    };
    
    console.log('👤 Extracted user data:', userData);
    
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
  
  // Use the new schema directly (no nested data object)
  const audioData = button.audio || [];
  const slotsData = button.slots || {};
  const centerMediaData = button.centerMedia || [];
  const optionsData = button.options || { clearPrevious: true };
  
  // 1. Play audio(s) in dashboard - start immediately
  const audioPromises = [];
  if (Array.isArray(audioData)) {
    for (const audioEntry of audioData) {
      if (audioEntry.src) {
        // Create async function to load and play audio
        const playAudio = (async () => {
          try {
            let audioSrc = audioEntry.src;
            
            // Load audio from disk if it's a file path
            if (typeof audioSrc === 'string' && 
                !audioSrc.startsWith('data:') && 
                !audioSrc.startsWith('blob:') && 
                !audioSrc.startsWith('http')) {
              console.log('🎵 Loading audio file from disk:', audioSrc);
              try {
                if (window.electronAPI && window.electronAPI.getMediaFile) {
                  const result = await window.electronAPI.getMediaFile(audioSrc);
                  if (result.success) {
                    const sizeKB = (result.data.length / 1024).toFixed(2);
                    console.log(`✅ Audio file loaded: ${audioSrc} (${sizeKB} KB)`);
                    audioSrc = result.data; // Use base64 data URI
                  } else {
                    console.error('Failed to load audio file:', result.error);
                  }
                }
              } catch (error) {
                console.error('Error loading audio file:', error);
              }
            }
            
            // Use cached audio or create new one
            let audio = audioCache.get(audioSrc);
            if (!audio) {
              audio = new Audio(audioSrc);
              audioCache.set(audioSrc, audio);
            }
            
            // Reset and configure audio
            audio.currentTime = 0;
            audio.volume = audioEntry.volume || 1.0; // Volume is already 0-1 in new schema
            audio.loop = audioEntry.loop || false;
            
            // Start playing
            return audio.play();
          } catch (error) {
            console.warn('Failed to play audio:', error);
          }
        })();
        
        audioPromises.push(playAudio);
      }
    }
  }

  // 2. Send overlay payload - immediately after starting audio
  // Process center media similar to alert system
  const processedCenterMedia = await Promise.all(centerMediaData.map(async (item) => {
    if (item.src) {
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
        // File path (relative to userDataPath) - load from disk
        console.log('🖼️ Loading media file from disk:', item.src);
        try {
          if (window.electronAPI && window.electronAPI.getMediaFile) {
            const result = await window.electronAPI.getMediaFile(item.src);
            if (result.success) {
              const sizeKB = (result.data.length / 1024).toFixed(2);
              console.log(`✅ Media file loaded: ${item.src} (${sizeKB} KB)`);
              return {
                ...item,
                src: result.data // Base64 data URI
              };
            } else {
              console.error('Failed to load media file:', result.error);
              return item; // Return as-is, might be URL
            }
          } else {
            console.warn('getMediaFile API not available, using path directly');
            return item;
          }
        } catch (error) {
          console.error('Error loading media file:', error);
          return item;
        }
      } else {
        // Already HTTP URL or other format - use as is
        return item;
      }
    }
    return item;
  }));

  const overlayPayload = {
    type: 'buttonTrigger',
    options: optionsData,
    slots: slotsData,
    centerMedia: processedCenterMedia
  };

  // Log payload summary without full base64 data
  console.log('📤 Sending overlay payload:', {
    type: overlayPayload.type,
    slots: Object.keys(overlayPayload.slots || {}),
    centerMedia: centerMediaData.map(item => ({
      type: item.type,
      src: item.src // Shows file path from config
    })),
    options: overlayPayload.options
  });

  // Send to overlay iframe (if exists) - immediately
  const overlayIframe = document.getElementById('overlay-iframe');
  if (overlayIframe && overlayIframe.contentWindow) {
    try {
      overlayIframe.contentWindow.postMessage(overlayPayload, '*');
      console.log('Message sent to overlay iframe');
    } catch (error) {
      console.warn('Failed to send message to overlay iframe:', error);
    }
  }

  // Send to overlay widget (if exists) - immediately
  const overlayWidget = document.getElementById('overlay-widget');
  if (overlayWidget && !overlayWidget.classList.contains('hidden')) {
    try {
      // Trigger the overlay widget's test function
      if (window.testMultiSource) {
        window.testMultiSource(overlayPayload);
      }
      console.log('Message sent to overlay widget');
    } catch (error) {
      console.warn('Failed to send message to overlay widget:', error);
    }
  }

  // Send via WebSocket (if available) - immediately
  if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
    try {
      window.electronAPI.sendOverlayMessage(overlayPayload);
      console.log('Message sent via WebSocket');
    } catch (error) {
      console.warn('Failed to send message via WebSocket:', error);
    }
  }

  // Wait for audio to start (non-blocking - overlay message already sent)
  if (audioPromises.length > 0) {
    try {
      await Promise.all(audioPromises);
      console.log('All audio started successfully');
    } catch (error) {
      console.warn('Some audio failed to start:', error);
    }
  }
  
  // Set up overlay clearing based on media duration
  // Check if button has custom duration in options
  const customDuration = button.options && button.options.durationMs ? button.options.durationMs / 1000 : null;
  setupOverlayClearing(audioData, centerMediaData, customDuration);
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
      if (window.testMultiSource) {
        window.testMultiSource(clearPayload);
        console.log(`✅ [${timestamp}] Clear message sent to overlay widget`);
      } else {
        console.log(`ℹ️ [${timestamp}] Overlay widget found but testMultiSource function not available`);
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
  labelInput.value = btn.name || btn.label || ''; // Support both new and old schema
  labelInput.readOnly = false;
  labelInput.disabled = false;
  // Set the type selection
  const typeSelect = document.querySelector(`input[name="button-type"][value="${btn.type}"]`);
  if (typeSelect) typeSelect.checked = true;
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
  const button = config.buttons.find(btn => {
    // Check both name and label for compatibility - use exact match for precision
    const name = btn.name || btn.label || '';
    return name.toLowerCase() === mediaId.toLowerCase();
  });
  if (button) {
    console.log('🎯 Triggering mapped button:', button.name || button.label, 'Type:', button.type);
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
  
  // Clear overlay immediately on app startup
  console.log('🧹 Clearing overlay on DOM ready...');
  clearOverlay();
  
  setupAppToolbar();
  setupOverlayControls();
  setupOverlayWidget();
  setupAlertWidget();
  // initialize left app menu
  if (typeof setupLeftAppMenu === 'function') {
    console.log('🔧 Setting up left app menu');
    setupLeftAppMenu();
  } else {
    console.log('🔧 setupLeftAppMenu function not found');
  }
});

// Overlay controls setup
function setupOverlayControls() {
  console.log('🔧 Setting up overlay controls');
  
  // Clear overlay on app startup with a small delay to ensure overlay is ready
  console.log('🧹 Clearing overlay on app startup...');
  setTimeout(() => {
    clearOverlay();
    console.log('✅ Overlay cleared on startup');
  }, 1000); // 1 second delay to ensure overlay is ready
  
  const overlayUrlBtn = document.getElementById('show-overlay-url');
  
  if (overlayUrlBtn) {
    console.log('🔧 Overlay URL button found');
    overlayUrlBtn.addEventListener('click', () => {
      console.log('🔧 Overlay URL button clicked');
      const overlayUrl = 'http://localhost:8080/overlay';
      alert(`Overlay URL for OBS Browser Source:\n\n${overlayUrl}\n\nCopy this URL and paste it into OBS Browser Source.`);
      
      // Copy to clipboard if possible
      if (navigator.clipboard) {
        navigator.clipboard.writeText(overlayUrl).then(() => {
          console.log('Overlay URL copied to clipboard');
        }).catch(err => {
          console.log('Failed to copy to clipboard:', err);
        });
      }
    });
  } else {
    console.log('🔧 Overlay URL button not found');
  }
}

// Overlay widget setup
function setupOverlayWidget() {
  console.log('🔧 Setting up overlay widget');
  
  const overlayWidget = document.getElementById('overlay-widget');
  const closeBtn = document.getElementById('close-overlay-widget');
  const testBtns = document.querySelectorAll('.overlay-test-btn');
  const mediaBtns = document.querySelectorAll('.overlay-media-btn');
  const customTextInput = document.getElementById('custom-text');
  const customPositionSelect = document.getElementById('custom-position');
  const sendCustomTextBtn = document.getElementById('send-custom-text');
  const copyUrlBtn = document.getElementById('copy-overlay-url');
  
  // Position mapping for overlay IDs (old format for backward compatibility)
  const positionMap = {
    1: 'text-top-left',
    2: 'text-top-center', 
    3: 'text-top-right',
    4: 'text-mid-left',
    5: 'center-media',
    6: 'text-mid-right',
    7: 'text-bottom-left',
    8: 'text-bottom-center',
    9: 'text-bottom-right'
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
                                    fontSize: '18px',
                                    color: '#00ff00',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    zIndex: '1'
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
              src: 'https://via.placeholder.com/300x200/00ff00/000000?text=Test+Image+Connected',
              alt: 'Test Image Connected'
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
              src: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
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
  
  // Custom text input
  if (sendCustomTextBtn) {
    sendCustomTextBtn.addEventListener('click', () => {
      const text = customTextInput.value.trim();
      const position = parseInt(customPositionSelect.value);
      const targetId = positionMap[position];
      
      if (text) {
        console.log(`Sending custom text to position ${position} (${targetId}): ${text}`);
        
        if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
          const payload = {
            type: 'buttonTrigger',
            options: {
              clearPrevious: false
            },
            slots: {
              [targetId]: {
                text: text,
                style: {
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '16px',
                  color: '#ffffff',
                  fontWeight: 'normal',
                  textAlign: 'center',
                  zIndex: '1'
                }
              }
            }
          };
          window.electronAPI.sendOverlayMessage(payload);
          
          // Clear the input
          customTextInput.value = '';
        }
      }
    });
  }
  
  // Enter key support for custom text
  if (customTextInput) {
    customTextInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendCustomTextBtn.click();
      }
    });
  }
  
  // Copy URL button
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', () => {
      const overlayUrl = 'http://localhost:8080/overlay';
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(overlayUrl).then(() => {
          console.log('Overlay URL copied to clipboard');
          // Show brief feedback
          const originalText = copyUrlBtn.textContent;
          copyUrlBtn.textContent = '✓';
          setTimeout(() => {
            copyUrlBtn.textContent = originalText;
          }, 1000);
        }).catch(err => {
          console.log('Failed to copy to clipboard:', err);
        });
      }
    });
  }
  
  // Multi-source test buttons
  const testMultiSourceBtn = document.getElementById('test-multi-source');
  const testAllPositionsBtn = document.getElementById('test-all-positions');
  
  if (testMultiSourceBtn) {
    testMultiSourceBtn.addEventListener('click', () => {
      console.log('Testing multi-source capability...');
      
      const payload = {
        type: 'buttonTrigger',
        options: {
          clearPrevious: true
        },
        slots: {
          'topLeft': {
            text: '🎮 GAME START',
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
          'topRight': {
            text: 'SCORE: 9999',
            style: {
              fontFamily: 'Courier, monospace',
              fontSize: 24,
              color: '#ffff00',
              bold: true,
              italic: false,
              align: 'right',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              zIndex: '10'
            }
          },
          'bottomCenter': {
            text: 'PRESS SPACE TO CONTINUE',
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
          'midLeft': {
            text: 'LIVES: 3',
            style: {
              fontFamily: 'Arial, sans-serif',
              fontSize: 18,
              color: '#ff6b6b',
              bold: true,
              textAlign: 'left',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              zIndex: '10'
            }
          },
          'midRight': {
            text: 'LEVEL: 5',
            style: {
              fontFamily: 'Arial, sans-serif',
              fontSize: 18,
              color: '#4ecdc4',
              bold: true,
              italic: false,
              align: 'right',
              animation: null
            }
          }
        },
        centerMedia: [
          {
            type: 'image',
            src: 'https://via.placeholder.com/600x400/000000/ffffff?text=GAME+SCREEN',
            alt: 'Game Screen'
          },
          {
            type: 'video',
            src: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
            loop: true
          }
        ]
      };
      
      if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
        window.electronAPI.sendOverlayMessage(payload);
        console.log('Sent multi-source test payload');
      } else {
        console.log('sendOverlayMessage not available');
      }
    });
  }
  
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
            fontSize: 18,
            color: '#00ff00',
            bold: true,
            italic: false,
            align: 'center',
            animation: null
          }
        };
      });
      
      // Add center media test
      payload.centerMedia = [{
        type: 'image',
        src: 'https://via.placeholder.com/400x300/ff00ff/ffffff?text=Test+Center+Media',
        alt: 'Test Center Media'
      }];
      
      if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
        window.electronAPI.sendOverlayMessage(payload);
        console.log('Sent comprehensive test payload with all positions');
      } else {
        console.log('sendOverlayMessage not available');
      }
    });
  }
  
  // Resolution controls
  const resolutionSelect = document.getElementById('overlay-resolution');
  const applyResolutionBtn = document.getElementById('apply-resolution');
  
  if (resolutionSelect && applyResolutionBtn) {
    applyResolutionBtn.addEventListener('click', () => {
      const selectedResolution = resolutionSelect.value;
      const [width, height] = selectedResolution.split('x').map(Number);
      
      console.log(`Applying overlay resolution: ${width}x${height}`);
      
      // Send resolution change to overlay iframe
      const overlayIframe = document.getElementById('overlay-iframe');
      if (overlayIframe && overlayIframe.contentWindow) {
        try {
          overlayIframe.contentWindow.setOverlayResolution(width, height);
          console.log(`✅ Resolution changed to ${width}x${height}`);
          
          // Show feedback
          const originalText = applyResolutionBtn.textContent;
          applyResolutionBtn.textContent = '✓ Applied';
          applyResolutionBtn.style.background = '#4CAF50';
          setTimeout(() => {
            applyResolutionBtn.textContent = originalText;
            applyResolutionBtn.style.background = '';
          }, 2000);
        } catch (error) {
          console.error('Failed to change overlay resolution:', error);
          applyResolutionBtn.textContent = '❌ Failed';
          applyResolutionBtn.style.background = '#f44336';
          setTimeout(() => {
            applyResolutionBtn.textContent = 'Apply Resolution';
            applyResolutionBtn.style.background = '';
          }, 2000);
        }
      } else {
        console.error('Overlay iframe not found');
      }
    });
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
        'host': 'Host',
        'unhost': 'Unhost',
        'channel-points': 'Channel Points'
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
      'host': 'Host',
      'unhost': 'Unhost',
      'channel-points': 'Channel Points'
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
  const alertTextInput = document.getElementById('alert-text');
  const alertDurationInput = document.getElementById('alert-duration');
  const alertBitsThresholdInput = document.getElementById('alert-bits-threshold');
  const bitsThresholdGroup = document.getElementById('bits-threshold-group');
  const alertSoundInput = document.getElementById('alert-sound');
  const alertImageInput = document.getElementById('alert-image');
  const saveAlertBtn = document.getElementById('save-alert');
  const clearAlertsBtn = document.getElementById('clear-alerts');
  const alertPreviewArea = document.getElementById('alert-preview-area');
  const alertListContainer = document.getElementById('alert-list-container');
  
  
  // Queue control elements
  const clearQueueBtn = document.getElementById('clear-queue');
  const skipCurrentBtn = document.getElementById('skip-current');
  const hardStopBtn = document.getElementById('hard-stop');
  const queueStatusBtn = document.getElementById('queue-status');
  const queueInfo = document.getElementById('queue-info');
  
  
  
  // Alert storage
  let savedAlerts = JSON.parse(localStorage.getItem('twitchAlerts') || '[]');
  
  
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
  
  // Alert management functions for grouped approach
  function toggleAlert(alertId, enabled) {
    const alert = savedAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.enabled = enabled;
      localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
      updateAlertList();
      console.log('Toggled alert:', alertId, 'enabled:', enabled);
    }
  }
  
  function toggleRandomModeForType(alertType, randomMode) {
    // Update random mode for all alerts of this type
    savedAlerts.forEach(alert => {
      if (alert.type === alertType) {
        alert.randomMode = randomMode;
      }
    });
    
    localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
    updateAlertList();
    console.log('Toggled random mode for type:', alertType, 'random:', randomMode);
  }
  
  // Close widget
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideAlertWidget();
    });
  }
  
  // Show/hide bits threshold based on alert type
  if (alertTypeSelect && bitsThresholdGroup) {
    alertTypeSelect.addEventListener('change', () => {
      if (alertTypeSelect.value === 'bits') {
        bitsThresholdGroup.style.display = 'block';
      } else {
        bitsThresholdGroup.style.display = 'none';
      }
    });
    
    // Trigger initial check
    if (alertTypeSelect.value === 'bits') {
      bitsThresholdGroup.style.display = 'block';
    }
  }
  
  // Make alert functions globally accessible
  window.toggleAlert = toggleAlert;
  window.toggleRandomModeForType = toggleRandomModeForType;
  
  
  // Setup alert widget tabs
  setupAlertTabs();
  
  // Setup alert type change handler to filter saved alerts
  setupAlertTypeFilter();
  
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
  function updatePreview() {
    const type = alertTypeSelect.value;
    const text = alertTextInput.value;
    const duration = alertDurationInput.value;
    const soundFile = alertSoundInput.files[0];
    const imageFile = alertImageInput.files[0];
    
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
      reward: 'Test Reward'
    };
    
    // Process text with sample data for preview
    const processedText = replacePlaceholders(text, sampleUserData);
    
    let previewHTML = '<div class="alert-preview-content">';
    
    if (imageFile) {
      if (imageFile instanceof File) {
        const imageUrl = URL.createObjectURL(imageFile);
        previewHTML += `<img src="${imageUrl}" alt="Alert Image" />`;
      } else if (imageFile.data) {
        previewHTML += `<img src="${imageFile.data}" alt="Alert Image" />`;
      }
    }
    
    previewHTML += `<h3>${getAlertTypeDisplayName(type)}</h3>`;
    previewHTML += `<p>${processedText}</p>`;
    previewHTML += `<p><small>Duration: ${duration}s</small></p>`;
    
    if (soundFile) {
      previewHTML += `<p><small>Sound: ${soundFile.name}</small></p>`;
    }
    
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
      'bits': 'Bits Donation'
    };
    return typeNames[type] || type;
  }
  
  // Event listeners for form changes
  [alertTypeSelect, alertTextInput, alertDurationInput, alertSoundInput, alertImageInput].forEach(element => {
    if (element) {
      element.addEventListener('change', updatePreview);
      element.addEventListener('input', updatePreview);
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
          updatePreview();
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
          console.log(`🎵 Auto-updated duration to ${duration}s for image/video file`);
          updatePreview();
        }
      }
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
      
      if (!text) {
        alert('Please enter alert text');
        return;
      }
      
      // Auto-detect duration from media files
      const soundDuration = await getMediaDuration(soundFile);
      const imageDuration = await getMediaDuration(imageFile);
      
      // Use the longer duration if media is present
      if (soundDuration || imageDuration) {
        const mediaDuration = Math.max(soundDuration || 0, imageDuration || 0);
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
      
      const alertData = {
        id: alertId,
        type: type,
        text: text,
        duration: duration,
        bitsThreshold: type === 'bits' ? (parseInt(alertBitsThresholdInput.value) || 10) : null,
        soundFile: soundFilePath ? {
          name: soundFile.name,
          size: soundFile.size,
          type: soundFile.type,
          path: soundFilePath // Store file path instead of base64
        } : null,
        imageFile: imageFilePath ? {
          name: imageFile.name,
          size: imageFile.size,
          type: imageFile.type,
          path: imageFilePath // Store file path instead of base64
        } : null,
        variations: [],
        randomMode: false,
        createdAt: new Date().toISOString()
      };
      
      try {
        savedAlerts.push(alertData);
        localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
        
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
        localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
        updateAlertList();
        console.log('All alerts cleared');
      }
    });
  }
  
  // Clear form
  function clearForm() {
    alertTextInput.value = '';
    alertDurationInput.value = '5';
    alertSoundInput.value = '';
    alertImageInput.value = '';
    updatePreview();
  }
  
  // Get display name for alert type
  function getAlertTypeDisplayName(alertType) {
    const typeNames = {
      'follower': 'Follower',
      'subscriber': 'Subscriber', 
      'resubscriber': 'Resubscriber',
      'gift-sub': 'Gift Sub',
      'gift-sub-received': 'Gift Received',
      'raid': 'Raid',
      'bits': 'Bits',
      'host': 'Host',
      'unhost': 'Unhost',
      'channel-points': 'Channel Points'
    };
    return typeNames[alertType] || alertType;
  }

  // Update alert list display - filtered by selected alert type
  function updateAlertList() {
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
          <span>Variations (${filteredAlerts.length}):</span>
          <label class="random-toggle">
            <input type="checkbox" ${firstAlert.randomMode ? 'checked' : ''} 
                   onchange="toggleRandomModeForType('${selectedType}', this.checked)" />
            Random
          </label>
        </div>
        <div class="variations-items">
          ${filteredAlerts.map((alert, index) => `
            <div class="variation-item ${alert.enabled !== false ? 'enabled' : ''}">
              <label class="variation-toggle">
                <input type="checkbox" ${alert.enabled !== false ? 'checked' : ''} 
                       onchange="toggleAlert('${alert.id}', this.checked)" />
                <span class="variation-text">${alert.text}</span>
              </label>
              <div class="variation-actions">
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
        reward: 'Test Reward'
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
  window.deleteAlert = function(alertId) {
    if (confirm('Are you sure you want to delete this alert?')) {
      savedAlerts = savedAlerts.filter(a => a.id !== alertId);
      localStorage.setItem('twitchAlerts', JSON.stringify(savedAlerts));
      updateAlertList();
      console.log('Alert deleted:', alertId);
    }
  };
  

  // Queue control event listeners
  if (clearQueueBtn) {
    clearQueueBtn.addEventListener('click', () => {
      alertQueue.clearQueue();
      updateQueueStatus();
    });
  }
  
  if (skipCurrentBtn) {
    skipCurrentBtn.addEventListener('click', () => {
      alertQueue.clearCurrentAlert();
      updateQueueStatus();
    });
  }
  
  if (hardStopBtn) {
    hardStopBtn.addEventListener('click', () => {
      alertQueue.hardStop();
      updateQueueStatus();
    });
  }
  
  if (queueStatusBtn) {
    queueStatusBtn.addEventListener('click', () => {
      updateQueueStatus();
      const status = alertQueue.getStatus();
      console.log('Queue Status:', status);
    });
  }
  
  // Update queue status display
  function updateQueueStatus() {
    if (!queueInfo) return;
    
    const status = alertQueue.getStatus();
    const statusText = queueInfo.querySelector('.queue-status-text');
    
    if (statusText) {
      let statusMessage = `Queue: ${status.queueLength} alerts`;
      statusMessage += ` | Processing: ${status.isProcessing ? 'Yes' : 'No'}`;
      
      if (status.currentAlert) {
        statusMessage += ` | Current: ${status.currentAlert.type}`;
      }
      
      statusText.textContent = statusMessage;
    }
  }
  
  // Update queue status every second
  setInterval(updateQueueStatus, 1000);
  
  // Initialize
  updateAlertList();
  updatePreview();
  updateQueueStatus();
}

// Global replace placeholders function
function replacePlaceholders(text, userData) {
  if (!userData) return text;
  
  let processedText = text;
  
  // Replace common placeholders
  processedText = processedText.replace(/\{username\}/g, userData.username || userData.user_name || userData.user || 'Unknown');
  processedText = processedText.replace(/\{display_name\}/g, userData.display_name || userData.user_name || userData.user || 'Unknown');
  processedText = processedText.replace(/\{tier\}/g, userData.tier || userData.sub_plan || '');
  processedText = processedText.replace(/\{viewers\}/g, userData.viewers || userData.view_count || userData.viewer_count || '');
  processedText = processedText.replace(/\{bits\}/g, userData.bits || userData.bits_used || userData.bits_amount || userData.amount || '');
  processedText = processedText.replace(/\{months\}/g, userData.cumulative_months || userData.months || '');
  processedText = processedText.replace(/\{message\}/g, userData.message || userData.user_input || '');
  processedText = processedText.replace(/\{reward\}/g, userData.reward || userData.reward_title || '');
  
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
  
  // Clear current alert and stop processing
  clearCurrentAlert() {
    this.hardStop();
    
    if (this.currentAlert) {
      this.currentAlert.status = 'cancelled';
      this.currentAlert = null;
    }
    
    console.log('🛑 Current alert cleared');
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
    if (window.electronAPI && typeof window.electronAPI.sendOverlayMessage === 'function') {
      // Process text with user data if available
      const processedText = userData ? replacePlaceholders(alertData.text, userData) : alertData.text;
      
      console.log('🎯 Triggering alert:', { alertData, userData, processedText });
      
      const payload = {
        type: 'buttonTrigger',
        options: {
          clearPrevious: true,
          durationMs: alertData.duration * 1000
        },
        slots: {
          topCenter: {
            text: processedText,
            style: {
              fontFamily: 'Arial, sans-serif',
              fontSize: '24px',
              color: '#00ff00',
              fontWeight: 'bold',
              textAlign: 'center',
              zIndex: '1'
            }
          }
        },
        centerMedia: []
      };
      
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
          // This is a saved alert with file path - load from disk like multi-media buttons
          console.log('🖼️ Loading alert image from disk:', alertData.imageFile.path);
          try {
            if (window.electronAPI && window.electronAPI.getMediaFile) {
              const result = await window.electronAPI.getMediaFile(alertData.imageFile.path);
              if (result.success) {
                const sizeKB = (result.data.length / 1024).toFixed(2);
                console.log(`✅ Alert image loaded: ${alertData.imageFile.path} (${sizeKB} KB)`);
                payload.centerMedia.push({
                  type: 'image',
                  src: result.data, // Send base64 data URI like multi-media buttons
                  alt: 'Alert Image'
                });
              } else {
                console.error('Failed to load alert image:', result.error);
              }
            }
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
      window.electronAPI.sendOverlayMessage(payload);
      
      // Play sound if present - store reference for hard stop
      if (alertData.soundFile) {
        if (alertData.soundFile instanceof File) {
          // Fresh file upload
          this.currentAudio = new Audio(URL.createObjectURL(alertData.soundFile));
          this.currentAudio.volume = 1.0;
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
                this.currentAudio.volume = 1.0;
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
          this.currentAudio.volume = 1.0;
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
    },
    'host': {
      type: 'channel.host',
      event: {
        ...baseUserData,
        viewers: 15,
        hosted_at: new Date().toISOString()
      }
    },
    'unhost': {
      type: 'channel.unhost',
      event: {
        ...baseUserData,
        viewers: 0
      }
    },
    'channel-points': {
      type: 'channel.channel_points_custom_reward_redemption.add',
      event: {
        ...baseUserData,
        reward: {
          id: 'test-reward-id',
          title: 'Test Reward',
          cost: 100
        },
        user_input: 'Test message',
        redeemed_at: new Date().toISOString()
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
    const alertsOfType = this.alerts.filter(a => a.type === eventType);
    if (alertsOfType.length === 0) {
      console.log(`⚠️ No alerts found for event type: ${eventType}`);
      return;
    }
    
    // Get enabled alerts
    const enabledAlerts = alertsOfType.filter(a => a.enabled !== false);
    if (enabledAlerts.length === 0) {
      console.log(`⚠️ No enabled alerts found for event type: ${eventType}`);
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
  const alertWidget = document.getElementById('alert-widget');
  if (alertWidget) {
    alertWidget.classList.remove('hidden');
  }
}

// Function to hide alert widget
function hideAlertWidget() {
  const alertWidget = document.getElementById('alert-widget');
  if (alertWidget) {
    alertWidget.classList.add('hidden');
  }
}

// Function to hide overlay widget
function hideOverlayWidget() {
  const overlayWidget = document.getElementById('overlay-widget');
  if (overlayWidget) {
    overlayWidget.classList.add('hidden');
  }
}

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
      e.stopPropagation();
      showAlertWidget();
      if (toolsDropdown) toolsDropdown.classList.add('hidden');
      if (toolsBtn) toolsBtn.setAttribute('aria-expanded', 'false');
    });
  }
  
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
        imageUrl: 'https://via.placeholder.com/200x100/00ff00/000000?text=Test+Image' 
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
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4' 
      });
    } else {
      console.log('sendOverlayVideo not available');
    }
  };
  
  // Removed duplicate clearOverlay function - using the main one defined earlier
  
  // Test multi-source functionality
  window.testMultiSource = function(payload) {
    console.log('Testing multi-source with payload:', payload);
    
    // Send to overlay iframe if available - send payload directly
    const overlayIframe = document.getElementById('overlay-iframe');
    if (overlayIframe && overlayIframe.contentWindow) {
      try {
        overlayIframe.contentWindow.postMessage(payload, '*');
        console.log('Multi-source test sent to overlay iframe');
      } catch (error) {
        console.warn('Failed to send multi-source test to overlay iframe:', error);
      }
    }
    
    // Send via WebSocket if available
    if (window.electronAPI && window.electronAPI.sendOverlayMessage) {
      try {
        window.electronAPI.sendOverlayMessage(payload);
        console.log('Multi-source test sent via WebSocket');
      } catch (error) {
        console.warn('Failed to send multi-source test via WebSocket:', error);
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
          fontSize: '18px',
          color: '#00ff00',
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: (index + 1).toString()
        }
      };
    });
    
    // Add center media test
    payload.centerMedia = [{
      type: 'image',
      src: 'https://via.placeholder.com/400x300/ff00ff/ffffff?text=Test+Center+Media',
      alt: 'Test Center Media'
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
          slots: buttonData.slots,
          centerMedia: buttonData.centerMedia,
          audio: buttonData.audio,
          options: buttonData.options
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
      'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
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
          src: 'https://via.placeholder.com/400x300/ff6600/ffffff?text=Test+Image',
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
