// public/macros-ui.js
// UI logic for macro management

let currentMacroId = null;
let currentMacroSteps = [];
let availableTools = [];
let currentMacroHotkey = '';
let savedMacroSnapshot = null;

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
  { name: 'get_stream_status', label: 'Get Stream Status (data only)', args: [] },
  { name: 'list_live_raid_favorites', label: 'List live raid favorites', args: [] },
  { name: 'start_raid', label: 'Start Twitch raid', args: ['login', 'confirmed'] }
];

/**
 * Initialize macro UI
 */
function initializeMacrosUI() {
  // Reload live scene lists whenever the macros manager is opened
  const macrosBtnForScenes = document.getElementById('preferences-macros-manage');
  if (macrosBtnForScenes && window.VDMacroScenePicker) {
    macrosBtnForScenes.addEventListener('click', () => window.VDMacroScenePicker.clearSceneCache());
  }
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

  const testMacroBtn = document.getElementById('test-macro-btn');
  if (testMacroBtn) {
    testMacroBtn.addEventListener('click', testCurrentMacro);
  }

  initMacroHotkeyCapture();

  if (window.electronAPI && typeof window.electronAPI.onMacroExecuted === 'function') {
    window.electronAPI.onMacroExecuted((result) => {
      const rows = window.VDMacroHotkeys ? window.VDMacroHotkeys.formatMacroRunSteps(result) : [];
      const failed = rows.find((r) => !r.ok);
      showCustomAlert(result.success
        ? `Hotkey macro "${result.macro}" done (${rows.length} step(s))`
        : `Hotkey macro "${result.macro || result.id}" failed: ${failed ? failed.label + ' - ' + failed.detail : result.error}`);
    });
  }

  availableTools = ALLOWLISTED_TOOLS;
}

function setHotkeyStatus(text, isError) {
  const el = document.getElementById('macro-hotkey-status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

function setMacroHotkey(value) {
  currentMacroHotkey = value || '';
  const input = document.getElementById('macro-hotkey');
  if (input) input.value = currentMacroHotkey;
}

async function validateMacroHotkeyLive() {
  if (!currentMacroHotkey) {
    setHotkeyStatus('No hotkey. Click the field and press a combo like Ctrl+Shift+1.', false);
    return true;
  }
  const local = window.VDMacroHotkeys.parseAccelerator(currentMacroHotkey);
  if (!local.valid) { setHotkeyStatus(local.errors.join('; '), true); return false; }
  if (window.electronAPI && typeof window.electronAPI.checkMacroHotkey === 'function') {
    const res = await window.electronAPI.checkMacroHotkey(currentMacroId, local.accelerator);
    if (!res.valid) { setHotkeyStatus(res.errors.join('; '), true); return false; }
  }
  setHotkeyStatus(`${local.accelerator} will run this macro after you save.`, false);
  return true;
}

function initMacroHotkeyCapture() {
  const input = document.getElementById('macro-hotkey');
  const clearBtn = document.getElementById('macro-hotkey-clear');
  if (!input) return;
  let before = '';
  input.addEventListener('focus', () => {
    before = currentMacroHotkey;
    input.classList.add('capturing');
    input.value = 'Press keys…';
    // Pause global shortcuts so the combo being captured doesn't fire an existing hotkey.
    if (window.electronAPI && window.electronAPI.disableHotkeys) window.electronAPI.disableHotkeys();
  });
  input.addEventListener('blur', () => {
    input.classList.remove('capturing');
    input.value = currentMacroHotkey;
    if (window.electronAPI && window.electronAPI.enableHotkeys) window.electronAPI.enableHotkeys();
  });
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const noMods = !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
    if (noMods && e.code === 'Escape') { setMacroHotkey(before); input.blur(); return; }
    if (noMods && (e.code === 'Backspace' || e.code === 'Delete')) { setMacroHotkey(''); input.blur(); validateMacroHotkeyLive(); return; }
    const { accelerator, complete } = window.VDMacroHotkeys.acceleratorFromKeyEvent(e);
    if (!complete) { input.value = accelerator ? accelerator + '+…' : 'Press keys…'; return; }
    setMacroHotkey(accelerator);
    input.blur();
    validateMacroHotkeyLive();
  });
  if (clearBtn) clearBtn.addEventListener('click', () => { setMacroHotkey(''); validateMacroHotkeyLive(); });
}

function buildMacroFromForm() {
  return {
    name: document.getElementById('macro-name').value.trim(),
    description: document.getElementById('macro-description').value.trim(),
    triggers: {
      phrase: document.getElementById('macro-phrase').value.trim() || null,
      button: null,
      hotkey: currentMacroHotkey || null
    },
    steps: currentMacroSteps,
    enabled: document.getElementById('macro-enabled').checked
  };
}

function renderMacroTestResults(container, result) {
  if (!container) return;
  container.classList.remove('hidden');
  container.innerHTML = '';
  const head = document.createElement('div');
  head.className = result.success ? 'ok' : 'fail';
  head.textContent = result.success
    ? `\u2714 "${result.macro}" completed`
    : `\u2716 "${result.macro || 'Macro'}" failed${result.error ? ': ' + result.error : ''}`;
  container.appendChild(head);
  const rows = window.VDMacroHotkeys.formatMacroRunSteps(result);
  rows.forEach((r) => {
    const line = document.createElement('div');
    line.className = 'macro-test-step';
    const mark = document.createElement('span');
    mark.className = r.ok ? 'ok' : 'fail';
    mark.textContent = r.ok ? '\u2714' : '\u2716';
    const text = document.createElement('span');
    text.textContent = `${r.label} \u2014 ${r.detail}`;
    line.appendChild(mark);
    line.appendChild(text);
    container.appendChild(line);
  });
  const total = Array.isArray(result.steps) ? result.steps.length : 0;
  const expected = typeof result.totalSteps === 'number' ? result.totalSteps : null;
  if (!result.success && expected && total < expected) {
    const skipped = document.createElement('div');
    skipped.className = 'fail';
    skipped.textContent = `${expected - total} later step(s) skipped`;
    container.appendChild(skipped);
  }
}

async function runMacroTest(macroId, container, totalSteps) {
  if (container) { container.classList.remove('hidden'); container.textContent = 'Running…'; }
  try {
    const result = await window.electronAPI.executeMacro(macroId);
    renderMacroTestResults(container, { ...result, totalSteps });
    return result;
  } catch (error) {
    renderMacroTestResults(container, { success: false, error: error.message, steps: [] });
    return { success: false };
  }
}

async function testCurrentMacro() {
  const container = document.getElementById('macro-test-results');
  const current = JSON.stringify(buildMacroFromForm());
  if (savedMacroSnapshot === null || savedMacroSnapshot !== current) {
    renderMacroTestResults(container, { success: false, error: 'Save the macro first; Test runs the saved version.', steps: [] });
    return;
  }
  await runMacroTest(currentMacroId, container, currentMacroSteps.length);
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

  if (macro.triggers?.hotkey) {
    const hk = document.createElement('p');
    hk.className = 'macro-trigger';
    const strong = document.createElement('strong');
    strong.textContent = 'Hotkey: ';
    const badge = document.createElement('span');
    badge.className = 'macro-hotkey-badge';
    badge.textContent = macro.triggers.hotkey;
    hk.appendChild(strong);
    hk.appendChild(badge);
    card.appendChild(hk);
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

  const results = document.createElement('div');
  results.className = 'macro-test-results hidden';
  results.setAttribute('role', 'status');

  const runBtn = document.createElement('button');
  runBtn.className = 'preference-button small primary';
  runBtn.textContent = 'Test';
  runBtn.title = macro.enabled ? 'Run this macro now' : 'Enable the macro to test it';
  runBtn.disabled = !macro.enabled;
  runBtn.addEventListener('click', () => runMacroTest(macro.id, results, macro.steps?.length || 0));
  actions.appendChild(runBtn);

  card.appendChild(actions);
  card.appendChild(results);

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
  setMacroHotkey('');
  savedMacroSnapshot = null;
  const newResults = document.getElementById('macro-test-results');
  if (newResults) newResults.classList.add('hidden');
  validateMacroHotkeyLive();

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
    setMacroHotkey(macro.triggers?.hotkey || '');
    const editResults = document.getElementById('macro-test-results');
    if (editResults) editResults.classList.add('hidden');
    validateMacroHotkeyLive();

    renderMacroSteps();
    savedMacroSnapshot = JSON.stringify(buildMacroFromForm());
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
    if (step.arguments && step.tool !== 'change_scene') delete step.arguments.app;
    renderMacroSteps();
  });
  card.appendChild(toolSelect);

  const selectedTool = availableTools.find(t => t.name === step.tool);
  if (step.tool === 'change_scene' && window.VDMacroScenePicker) {
    card.appendChild(window.VDMacroScenePicker.createScenePicker(step));
  } else if (selectedTool && selectedTool.args.length > 0) {
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

    if (!(await validateMacroHotkeyLive())) {
      showCustomAlert('Fix the hotkey first: ' + (document.getElementById('macro-hotkey-status')?.textContent || ''));
      return;
    }

    const macro = buildMacroFromForm();

    const result = await window.electronAPI.saveMacro(currentMacroId, macro);
    if (!result.success) {
      showCustomAlert('Failed to save macro: ' + (result.error || result.errors?.join(', ')));
      return;
    }

    if (result.macro?.triggers?.hotkey) setMacroHotkey(result.macro.triggers.hotkey);
    savedMacroSnapshot = JSON.stringify(buildMacroFromForm());
    showCustomAlert(result.warning || 'Macro saved. Use Test to run it now.');
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
    
    const rows = window.VDMacroHotkeys ? window.VDMacroHotkeys.formatMacroRunSteps(result) : [];
    if (result.success) {
      showCustomAlert(`Macro executed successfully! ${rows.length} steps completed.`);
    } else {
      const failed = rows.find((r) => !r.ok);
      showCustomAlert('Macro execution failed: ' + (failed ? `${failed.label} - ${failed.detail}` : result.error));
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
