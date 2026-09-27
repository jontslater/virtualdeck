// public/macros-ui.js
// UI logic for macro management

let currentMacroId = null;
let currentMacroSteps = [];
let availableTools = [];

// List of JARVIS tools that can be used in macros
const ALLOWLISTED_TOOLS = [
  { name: 'change_scene', label: 'Change Scene', args: ['sceneName'] },
  { name: 'refresh_browser_sources', label: 'Refresh Browser Sources', args: ['layerName'] },
  { name: 'play_sound', label: 'Play Sound', args: ['name'] },
  { name: 'send_twitch_message', label: 'Send Twitch Message', args: ['text'] },
  { name: 'discord_send_message', label: 'Send Discord Message', args: ['message'] },
  { name: 'discord_announce_live', label: 'Discord: Announce Go Live', args: [] },
  { name: 'discord_post_clip', label: 'Discord: Post Clip', args: ['clipUrl', 'title'] },
  { name: 'trigger_button', label: 'Trigger Button', args: ['label'] },
  { name: 'launch_app', label: 'Launch Application', args: ['nameOrPath'] },
  { name: 'get_scenes', label: 'Get Scenes (data only)', args: [] },
  { name: 'get_stream_status', label: 'Get Stream Status (data only)', args: [] }
];

/**
 * Initialize macro UI
 */
function initializeMacrosUI() {
  console.log('🎬 Initializing Macros UI');

  // Open macros manager from preferences
  const manageMacrosBtn = document.getElementById('preferences-macros-manage');
  if (manageMacrosBtn) {
    manageMacrosBtn.addEventListener('click', openMacrosManager);
  }

  // Close buttons
  const macrosModalClose = document.getElementById('macros-modal-close');
  if (macrosModalClose) {
    macrosModalClose.addEventListener('click', closeMacrosManager);
  }

  const macroEditClose = document.getElementById('macro-edit-close');
  if (macroEditClose) {
    macroEditClose.addEventListener('click', closeMacroEditor);
  }

  // New macro button
  const addMacroBtn = document.getElementById('add-macro-btn');
  if (addMacroBtn) {
    addMacroBtn.addEventListener('click', () => createNewMacro());
  }

  // Save/Cancel/Delete buttons
  const saveMacroBtn = document.getElementById('save-macro-btn');
  if (saveMacroBtn) {
    saveMacroBtn.addEventListener('click', saveMacro);
  }

  const cancelMacroBtn = document.getElementById('cancel-macro-btn');
  if (cancelMacroBtn) {
    cancelMacroBtn.addEventListener('click', closeMacroEditor);
  }

  const deleteMacroBtn = document.getElementById('delete-macro-btn');
  if (deleteMacroBtn) {
    deleteMacroBtn.addEventListener('click', deleteMacro);
  }

  // Add step button
  const addStepBtn = document.getElementById('add-step-btn');
  if (addStepBtn) {
    addStepBtn.addEventListener('click', addMacroStep);
  }

  availableTools = ALLOWLISTED_TOOLS;
}

/**
 * Open macros manager modal
 */
async function openMacrosManager() {
  const modal = document.getElementById('macros-modal');
  if (!modal) return;

  await loadMacrosList();
  modal.classList.remove('hidden');
}

/**
 * Close macros manager modal
 */
function closeMacrosManager() {
  const modal = document.getElementById('macros-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Load and display all macros
 */
async function loadMacrosList() {
  try {
    const result = await window.electronAPI.getMacros();
    const macrosList = document.getElementById('macros-list');
    if (!macrosList) return;

    if (!result.success || !result.macros || result.macros.length === 0) {
      macrosList.innerHTML = '<p class="no-macros">No macros yet. Click "New Macro" to create one.</p>';
      return;
    }

    macrosList.innerHTML = '';
    result.macros.forEach(macro => {
      const macroCard = createMacroCard(macro);
      macrosList.appendChild(macroCard);
    });
  } catch (error) {
    console.error('Error loading macros:', error);
    showCustomAlert('Failed to load macros: ' + error.message);
  }
}

/**
 * Create a macro card element
 */
function createMacroCard(macro) {
  const card = document.createElement('div');
  card.className = 'macro-card';
  if (!macro.enabled) {
    card.classList.add('disabled');
  }

  const header = document.createElement('div');
  header.className = 'macro-card-header';

  const title = document.createElement('h4');
  title.textContent = macro.name;
  header.appendChild(title);

  const status = document.createElement('span');
  status.className = 'macro-status';
  status.textContent = macro.enabled ? 'Enabled' : 'Disabled';
  header.appendChild(status);

  card.appendChild(header);

  if (macro.description) {
    const desc = document.createElement('p');
    desc.className = 'macro-description';
    desc.textContent = macro.description;
    card.appendChild(desc);
  }

  if (macro.triggers?.phrase) {
    const phrase = document.createElement('p');
    phrase.className = 'macro-trigger';
    phrase.innerHTML = `<strong>Phrase:</strong> "${macro.triggers.phrase}"`;
    card.appendChild(phrase);
  }

  const steps = document.createElement('p');
  steps.className = 'macro-steps-count';
  steps.textContent = `${macro.steps?.length || 0} step(s)`;
  card.appendChild(steps);

  const actions = document.createElement('div');
  actions.className = 'macro-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'preference-button small';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => editMacro(macro.id));
  actions.appendChild(editBtn);

  const runBtn = document.createElement('button');
  runBtn.className = 'preference-button small primary';
  runBtn.textContent = 'Run';
  runBtn.disabled = !macro.enabled;
  runBtn.addEventListener('click', () => runMacro(macro.id));
  actions.appendChild(runBtn);

  card.appendChild(actions);

  return card;
}

/**
 * Create new macro
 */
function createNewMacro() {
  currentMacroId = 'macro-' + Date.now();
  currentMacroSteps = [];
  
  document.getElementById('macro-edit-title').textContent = 'New Macro';
  document.getElementById('macro-name').value = '';
  document.getElementById('macro-description').value = '';
  document.getElementById('macro-phrase').value = '';
  document.getElementById('macro-enabled').checked = true;
  document.getElementById('delete-macro-btn').style.display = 'none';

  renderMacroSteps();
  openMacroEditor();
}

/**
 * Edit existing macro
 */
async function editMacro(macroId) {
  try {
    const result = await window.electronAPI.getMacro(macroId);
    if (!result.success) {
      showCustomAlert('Failed to load macro: ' + result.error);
      return;
    }

    const macro = result.macro;
    currentMacroId = macro.id;
    currentMacroSteps = macro.steps || [];

    document.getElementById('macro-edit-title').textContent = 'Edit Macro';
    document.getElementById('macro-name').value = macro.name || '';
    document.getElementById('macro-description').value = macro.description || '';
    document.getElementById('macro-phrase').value = macro.triggers?.phrase || '';
    document.getElementById('macro-enabled').checked = macro.enabled !== false;
    document.getElementById('delete-macro-btn').style.display = 'inline-block';

    renderMacroSteps();
    openMacroEditor();
  } catch (error) {
    console.error('Error editing macro:', error);
    showCustomAlert('Failed to edit macro: ' + error.message);
  }
}

/**
 * Open macro editor modal
 */
function openMacroEditor() {
  closeMacrosManager();
  const modal = document.getElementById('macro-edit-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * Close macro editor modal
 */
function closeMacroEditor() {
  const modal = document.getElementById('macro-edit-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  openMacrosManager();
}

/**
 * Add a new step to the macro
 */
function addMacroStep() {
  currentMacroSteps.push({
    tool: 'change_scene',
    arguments: {},
    description: ''
  });
  renderMacroSteps();
}

/**
 * Remove a step from the macro
 */
function removeStep(index) {
  currentMacroSteps.splice(index, 1);
  renderMacroSteps();
}

/**
 * Move step up
 */
function moveStepUp(index) {
  if (index === 0) return;
  const temp = currentMacroSteps[index];
  currentMacroSteps[index] = currentMacroSteps[index - 1];
  currentMacroSteps[index - 1] = temp;
  renderMacroSteps();
}

/**
 * Move step down
 */
function moveStepDown(index) {
  if (index === currentMacroSteps.length - 1) return;
  const temp = currentMacroSteps[index];
  currentMacroSteps[index] = currentMacroSteps[index + 1];
  currentMacroSteps[index + 1] = temp;
  renderMacroSteps();
}

/**
 * Render macro steps list
 */
function renderMacroSteps() {
  const stepsList = document.getElementById('macro-steps-list');
  if (!stepsList) return;

  stepsList.innerHTML = '';

  if (currentMacroSteps.length === 0) {
    stepsList.innerHTML = '<p class="no-steps">No steps yet. Click "Add Step" to add one.</p>';
    return;
  }

  currentMacroSteps.forEach((step, index) => {
    const stepCard = createStepCard(step, index);
    stepsList.appendChild(stepCard);
  });
}

/**
 * Create a step card element
 */
function createStepCard(step, index) {
  const card = document.createElement('div');
  card.className = 'macro-step-card';

  const header = document.createElement('div');
  header.className = 'step-header';

  const stepNum = document.createElement('span');
  stepNum.className = 'step-number';
  stepNum.textContent = `Step ${index + 1}`;
  header.appendChild(stepNum);

  const controls = document.createElement('div');
  controls.className = 'step-controls';

  if (index > 0) {
    const upBtn = document.createElement('button');
    upBtn.className = 'step-btn';
    upBtn.textContent = '↑';
    upBtn.title = 'Move up';
    upBtn.addEventListener('click', () => moveStepUp(index));
    controls.appendChild(upBtn);
  }

  if (index < currentMacroSteps.length - 1) {
    const downBtn = document.createElement('button');
    downBtn.className = 'step-btn';
    downBtn.textContent = '↓';
    downBtn.title = 'Move down';
    downBtn.addEventListener('click', () => moveStepDown(index));
    controls.appendChild(downBtn);
  }

  const removeBtn = document.createElement('button');
  removeBtn.className = 'step-btn danger';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remove step';
  removeBtn.addEventListener('click', () => removeStep(index));
  controls.appendChild(removeBtn);

  header.appendChild(controls);
  card.appendChild(header);

  const toolSelect = document.createElement('select');
  toolSelect.className = 'step-tool-select';
  availableTools.forEach(tool => {
    const option = document.createElement('option');
    option.value = tool.name;
    option.textContent = tool.label;
    if (tool.name === step.tool) {
      option.selected = true;
    }
    toolSelect.appendChild(option);
  });
  toolSelect.addEventListener('change', (e) => {
    step.tool = e.target.value;
    renderMacroSteps();
  });
  card.appendChild(toolSelect);

  const selectedTool = availableTools.find(t => t.name === step.tool);
  if (selectedTool && selectedTool.args.length > 0) {
    const argsContainer = document.createElement('div');
    argsContainer.className = 'step-args';

    selectedTool.args.forEach(argName => {
      const argGroup = document.createElement('div');
      argGroup.className = 'step-arg-group';

      const label = document.createElement('label');
      label.textContent = argName + ':';
      argGroup.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'step-arg-input';
      input.value = step.arguments?.[argName] || '';
      input.placeholder = argName;
      input.addEventListener('input', (e) => {
        if (!step.arguments) step.arguments = {};
        step.arguments[argName] = e.target.value;
      });
      argGroup.appendChild(input);

      argsContainer.appendChild(argGroup);
    });

    card.appendChild(argsContainer);
  }

  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'step-description-input';
  descInput.placeholder = 'Step description (optional)';
  descInput.value = step.description || '';
  descInput.addEventListener('input', (e) => {
    step.description = e.target.value;
  });
  card.appendChild(descInput);

  return card;
}

/**
 * Save macro
 */
async function saveMacro() {
  try {
    const name = document.getElementById('macro-name').value.trim();
    if (!name) {
      showCustomAlert('Macro name is required');
      return;
    }

    const macro = {
      name,
      description: document.getElementById('macro-description').value.trim(),
      triggers: {
        phrase: document.getElementById('macro-phrase').value.trim() || null,
        button: null
      },
      steps: currentMacroSteps,
      enabled: document.getElementById('macro-enabled').checked
    };

    const result = await window.electronAPI.saveMacro(currentMacroId, macro);
    if (!result.success) {
      showCustomAlert('Failed to save macro: ' + (result.error || result.errors?.join(', ')));
      return;
    }

    showCustomAlert('Macro saved successfully!');
    closeMacroEditor();
    await loadMacrosList();
  } catch (error) {
    console.error('Error saving macro:', error);
    showCustomAlert('Failed to save macro: ' + error.message);
  }
}

/**
 * Delete macro
 */
async function deleteMacro() {
  if (!confirm('Are you sure you want to delete this macro?')) {
    return;
  }

  try {
    const result = await window.electronAPI.deleteMacro(currentMacroId);
    if (!result.success) {
      showCustomAlert('Failed to delete macro');
      return;
    }

    showCustomAlert('Macro deleted');
    closeMacroEditor();
    await loadMacrosList();
  } catch (error) {
    console.error('Error deleting macro:', error);
    showCustomAlert('Failed to delete macro: ' + error.message);
  }
}

/**
 * Run macro
 */
async function runMacro(macroId) {
  try {
    console.log('Running macro:', macroId);
    const result = await window.electronAPI.executeMacro(macroId);
    
    if (result.success) {
      showCustomAlert(`Macro executed successfully! ${result.steps?.length || 0} steps completed.`);
    } else {
      showCustomAlert('Macro execution failed: ' + result.error);
    }
  } catch (error) {
    console.error('Error running macro:', error);
    showCustomAlert('Failed to run macro: ' + error.message);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMacrosUI);
} else {
  initializeMacrosUI();
}
