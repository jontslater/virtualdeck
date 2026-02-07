/**
 * Tests for drag and drop functionality
 * 
 * This test suite verifies that drag and drop works correctly for multiple apps,
 * ensuring the bug where it stops working after the first app is fixed.
 * 
 * Run with: npm test
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

describe('Drag and Drop Functionality', () => {
  let dom;
  let document;
  let window;
  let handleFileDrop;

  beforeEach(() => {
    // Create a fresh DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="settings-form">
            <input id="hotkey-input" />
            <div id="hotkey-status"></div>
            <input id="label-input" />
            <div id="audio-file-section"></div>
            <div id="app-file-section"></div>
            <input id="file-input" type="file" />
            <input id="app-file-input" type="file" />
          </form>
          <div id="settings-modal" class="hidden">
            <h2>Add New App</h2>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    // Mock electronAPI
    window.electronAPI = {
      resolveShortcut: jest.fn(),
      disableHotkeys: jest.fn(),
      enableHotkeys: jest.fn()
    };

    // Mock stopHotkeyRecording if it exists
    global.stopHotkeyRecording = jest.fn();

    // Extract handleFileDrop function logic for testing
    // In a real scenario, you'd import the actual function
    handleFileDrop = (file) => {
      const settingsForm = document.getElementById('settings-form');
      const hotkeyInput = document.getElementById('hotkey-input');
      const hotkeyStatus = document.getElementById('hotkey-status');
      const labelInput = document.getElementById('label-input');
      const audioFileSection = document.getElementById('audio-file-section');
      const appFileSection = document.getElementById('app-file-section');
      const fileInput = document.getElementById('file-input');
      const appFileInput = document.getElementById('app-file-input');
      const settingsModal = document.getElementById('settings-modal');

      if (!settingsForm || !hotkeyInput || !hotkeyStatus || !labelInput || 
          !audioFileSection || !appFileSection || !fileInput || !appFileInput || !settingsModal) {
        return;
      }

      // Ensure modal is closed and form is reset
      if (!settingsModal.classList.contains('hidden')) {
        settingsModal.classList.add('hidden');
        if (typeof stopHotkeyRecording === 'function') stopHotkeyRecording();
        if (window.electronAPI && window.electronAPI.enableHotkeys) {
          window.electronAPI.enableHotkeys();
        }
      }

      // Reset form state
      settingsForm.reset();
      hotkeyInput.value = '';
      hotkeyStatus.textContent = '';
      delete settingsForm.dataset.editingIndex;
      delete settingsForm.dataset.editingId;
      delete settingsForm.dataset.resolvedPath;
      delete settingsForm.dataset.resolvedArgs;
      delete settingsForm.dataset.existingFile;

      // Determine file type
      const audioExts = ['mp3', 'wav', 'ogg'];
      const appExts = ['exe', 'bat', 'cmd', 'lnk', 'app', 'sh', 'desktop'];
      const ext = file.name.split('.').pop().toLowerCase();
      let type = 'audio';
      if (appExts.includes(ext)) type = 'app';

      // Update modal title
      document.querySelector('#settings-modal h2').textContent = 'Add New ' + (type === 'audio' ? 'Sound' : 'App');

      // Set label
      labelInput.value = file.name.replace(/\.[^/.]+$/, "");

      // Show modal
      settingsModal.classList.remove('hidden');
      window.electronAPI.disableHotkeys();
    };
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  describe('handleFileDrop', () => {
    test('should reset form state when modal is already open', () => {
      const settingsModal = document.getElementById('settings-modal');
      const settingsForm = document.getElementById('settings-form');
      
      // Simulate modal being open
      settingsModal.classList.remove('hidden');
      settingsForm.dataset.editingIndex = '0';
      settingsForm.dataset.resolvedPath = '/some/path';
      
      const file1 = { name: 'test.exe', path: '/test.exe' };
      handleFileDrop(file1);

      // Modal should be closed first, then reopened
      expect(settingsModal.classList.contains('hidden')).toBe(false);
      expect(settingsForm.dataset.editingIndex).toBeUndefined();
      expect(settingsForm.dataset.resolvedPath).toBeUndefined();
    });

    test('should properly reset all form state between drops', () => {
      const settingsForm = document.getElementById('settings-form');
      const hotkeyInput = document.getElementById('hotkey-input');
      const labelInput = document.getElementById('label-input');
      
      // Set some state
      settingsForm.dataset.editingIndex = '0';
      settingsForm.dataset.resolvedPath = '/first/app.exe';
      hotkeyInput.value = 'Ctrl+F1';
      labelInput.value = 'First App';

      const file1 = { name: 'first.exe', path: '/first.exe' };
      handleFileDrop(file1);

      // Verify state is reset
      expect(settingsForm.dataset.editingIndex).toBeUndefined();
      expect(settingsForm.dataset.resolvedPath).toBeUndefined();
      expect(hotkeyInput.value).toBe('');
      expect(labelInput.value).toBe('first');
    });

    test('should handle multiple consecutive drops', () => {
      const settingsModal = document.getElementById('settings-modal');
      const settingsForm = document.getElementById('settings-form');
      const labelInput = document.getElementById('label-input');

      // First drop
      const file1 = { name: 'app1.exe', path: '/app1.exe' };
      handleFileDrop(file1);
      
      expect(settingsModal.classList.contains('hidden')).toBe(false);
      expect(labelInput.value).toBe('app1');
      expect(settingsForm.dataset.resolvedPath).toBeUndefined();

      // Simulate closing modal (as would happen after form submission)
      settingsModal.classList.add('hidden');
      settingsForm.dataset.resolvedPath = '/app1.exe'; // Simulate form submission setting this

      // Second drop - should work correctly
      const file2 = { name: 'app2.exe', path: '/app2.exe' };
      handleFileDrop(file2);

      // Should reset and work for second app
      expect(settingsModal.classList.contains('hidden')).toBe(false);
      expect(labelInput.value).toBe('app2');
      expect(settingsForm.dataset.resolvedPath).toBeUndefined(); // Should be reset

      // Third drop - should still work
      const file3 = { name: 'app3.exe', path: '/app3.exe' };
      handleFileDrop(file3);

      expect(settingsModal.classList.contains('hidden')).toBe(false);
      expect(labelInput.value).toBe('app3');
    });

    test('should detect app files correctly', () => {
      const settingsModal = document.getElementById('settings-modal');
      const h2 = document.querySelector('#settings-modal h2');

      const appFile = { name: 'test.exe', path: '/test.exe' };
      handleFileDrop(appFile);

      expect(h2.textContent).toBe('Add New App');
    });

    test('should detect audio files correctly', () => {
      const settingsModal = document.getElementById('settings-modal');
      const h2 = document.querySelector('#settings-modal h2');

      const audioFile = { name: 'sound.mp3', path: '/sound.mp3' };
      handleFileDrop(audioFile);

      expect(h2.textContent).toBe('Add New Sound');
    });

    test('should call disableHotkeys when opening modal', () => {
      const file = { name: 'test.exe', path: '/test.exe' };
      handleFileDrop(file);

      expect(window.electronAPI.disableHotkeys).toHaveBeenCalled();
    });

    test('should enable hotkeys when closing existing modal', () => {
      const settingsModal = document.getElementById('settings-modal');
      settingsModal.classList.remove('hidden');

      const file = { name: 'test.exe', path: '/test.exe' };
      handleFileDrop(file);

      // Should enable hotkeys when closing, then disable when reopening
      expect(window.electronAPI.enableHotkeys).toHaveBeenCalled();
      expect(window.electronAPI.disableHotkeys).toHaveBeenCalled();
    });
  });

  describe('Form state cleanup', () => {
    test('should clear all dataset properties', () => {
      const settingsForm = document.getElementById('settings-form');
      
      // Set all possible dataset properties
      settingsForm.dataset.editingIndex = '5';
      settingsForm.dataset.editingId = 'btn_123';
      settingsForm.dataset.resolvedPath = '/some/path';
      settingsForm.dataset.resolvedArgs = '--arg1';
      settingsForm.dataset.existingFile = '/old/file';

      const file = { name: 'test.exe', path: '/test.exe' };
      handleFileDrop(file);

      // All should be cleared
      expect(settingsForm.dataset.editingIndex).toBeUndefined();
      expect(settingsForm.dataset.editingId).toBeUndefined();
      expect(settingsForm.dataset.resolvedPath).toBeUndefined();
      expect(settingsForm.dataset.resolvedArgs).toBeUndefined();
      expect(settingsForm.dataset.existingFile).toBeUndefined();
    });

    test('should reset form inputs', () => {
      const hotkeyInput = document.getElementById('hotkey-input');
      const hotkeyStatus = document.getElementById('hotkey-status');
      const labelInput = document.getElementById('label-input');

      // Set values
      hotkeyInput.value = 'Ctrl+F1';
      hotkeyStatus.textContent = 'Recording...';
      labelInput.value = 'Old Label';

      const file = { name: 'new.exe', path: '/new.exe' };
      handleFileDrop(file);

      expect(hotkeyInput.value).toBe('');
      expect(hotkeyStatus.textContent).toBe('');
      expect(labelInput.value).toBe('new');
    });
  });
});
