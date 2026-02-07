/**
 * Manual test script for drag and drop functionality
 * 
 * This script can be run in the browser console to manually test drag and drop.
 * It simulates multiple file drops to verify the fix works correctly.
 * 
 * Usage:
 * 1. Open the app
 * 2. Open DevTools (F12)
 * 3. Copy and paste this entire script into the console
 * 4. Press Enter to run
 * 
 * The test will simulate dropping 3 apps consecutively and verify:
 * - Modal opens for each drop
 * - Form state is reset between drops
 * - No errors occur
 */

(function() {
  console.log('🧪 Starting manual drag and drop test...\n');

  // Helper to create a mock file object
  function createMockFile(name, path, type = 'app') {
    const ext = name.split('.').pop().toLowerCase();
    return {
      name: name,
      path: path,
      type: type === 'app' ? 'application/x-msdownload' : 'audio/mpeg',
      size: 1024,
      lastModified: Date.now()
    };
  }

  // Test state
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  function assert(condition, message) {
    testResults.total++;
    if (condition) {
      testResults.passed++;
      console.log(`✅ ${message}`);
    } else {
      testResults.failed++;
      testResults.errors.push(message);
      console.error(`❌ FAILED: ${message}`);
    }
  }

  function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.error(`Element not found: ${id}`);
      return null;
    }
    return el;
  }

  // Test 1: Verify initial state
  console.log('\n📋 Test 1: Checking initial state...');
  const settingsModal = getElement('settings-modal');
  const settingsForm = getElement('settings-form');
  const labelInput = getElement('label-input');
  
  assert(settingsModal !== null, 'Settings modal exists');
  assert(settingsForm !== null, 'Settings form exists');
  assert(labelInput !== null, 'Label input exists');
  
  // Ensure modal is closed initially
  if (settingsModal && !settingsModal.classList.contains('hidden')) {
    settingsModal.classList.add('hidden');
    console.log('⚠️  Modal was open, closed it for testing');
  }

  // Test 2: First drop
  console.log('\n📋 Test 2: Simulating first app drop...');
  const file1 = createMockFile('app1.exe', '/path/to/app1.exe');
  
  try {
    if (typeof handleFileDrop === 'function') {
      handleFileDrop(file1);
      
      // Check modal is open
      assert(!settingsModal.classList.contains('hidden'), 'Modal opened after first drop');
      assert(labelInput.value === 'app1', 'Label set correctly for first app');
      assert(!settingsForm.dataset.editingIndex, 'No editing index set');
      
      // Simulate closing modal (as would happen after form submission)
      settingsModal.classList.add('hidden');
      settingsForm.dataset.resolvedPath = '/path/to/app1.exe';
      console.log('✅ Simulated form submission and modal close');
    } else {
      console.error('❌ handleFileDrop function not found. Make sure script.js is loaded.');
      testResults.failed++;
    }
  } catch (error) {
    console.error('❌ Error in first drop:', error);
    testResults.errors.push(`First drop error: ${error.message}`);
    testResults.failed++;
  }

  // Test 3: Second drop (the critical test - this was failing before)
  console.log('\n📋 Test 3: Simulating second app drop (this was broken before the fix)...');
  const file2 = createMockFile('app2.exe', '/path/to/app2.exe');
  
  try {
    if (typeof handleFileDrop === 'function') {
      // Verify modal is closed before second drop
      assert(settingsModal.classList.contains('hidden'), 'Modal is closed before second drop');
      
      handleFileDrop(file2);
      
      // Check modal opened again
      assert(!settingsModal.classList.contains('hidden'), 'Modal opened after second drop');
      assert(labelInput.value === 'app2', 'Label set correctly for second app');
      assert(!settingsForm.dataset.resolvedPath || settingsForm.dataset.resolvedPath === '/path/to/app2.exe', 'Form state reset or updated correctly');
      assert(!settingsForm.dataset.editingIndex, 'No editing index set');
      
      // Simulate closing modal again
      settingsModal.classList.add('hidden');
      settingsForm.dataset.resolvedPath = '/path/to/app2.exe';
      console.log('✅ Second drop worked correctly!');
    } else {
      console.error('❌ handleFileDrop function not found');
      testResults.failed++;
    }
  } catch (error) {
    console.error('❌ Error in second drop:', error);
    testResults.errors.push(`Second drop error: ${error.message}`);
    testResults.failed++;
  }

  // Test 4: Third drop (verify it still works)
  console.log('\n📋 Test 4: Simulating third app drop...');
  const file3 = createMockFile('app3.exe', '/path/to/app3.exe');
  
  try {
    if (typeof handleFileDrop === 'function') {
      handleFileDrop(file3);
      
      assert(!settingsModal.classList.contains('hidden'), 'Modal opened after third drop');
      assert(labelInput.value === 'app3', 'Label set correctly for third app');
      assert(!settingsForm.dataset.editingIndex, 'No editing index set');
      
      console.log('✅ Third drop worked correctly!');
    } else {
      console.error('❌ handleFileDrop function not found');
      testResults.failed++;
    }
  } catch (error) {
    console.error('❌ Error in third drop:', error);
    testResults.errors.push(`Third drop error: ${error.message}`);
    testResults.failed++;
  }

  // Test 5: Verify form state cleanup
  console.log('\n📋 Test 5: Verifying form state cleanup...');
  const hotkeyInput = getElement('hotkey-input');
  const hotkeyStatus = getElement('hotkey-status');
  
  if (hotkeyInput && hotkeyStatus) {
    // Set some state
    settingsForm.dataset.editingIndex = '5';
    settingsForm.dataset.editingId = 'btn_123';
    settingsForm.dataset.resolvedPath = '/old/path';
    settingsForm.dataset.resolvedArgs = '--old-arg';
    hotkeyInput.value = 'Ctrl+F1';
    hotkeyStatus.textContent = 'Recording...';
    
    const file4 = createMockFile('cleanup-test.exe', '/cleanup-test.exe');
    handleFileDrop(file4);
    
    assert(!settingsForm.dataset.editingIndex, 'Editing index cleared');
    assert(!settingsForm.dataset.editingId, 'Editing ID cleared');
    assert(hotkeyInput.value === '', 'Hotkey input cleared');
    assert(hotkeyStatus.textContent === '', 'Hotkey status cleared');
  }

  // Test 6: Test with modal already open
  console.log('\n📋 Test 6: Testing drop when modal is already open...');
  if (settingsModal) {
    settingsModal.classList.remove('hidden');
    const file5 = createMockFile('open-modal-test.exe', '/open-modal-test.exe');
    
    try {
      handleFileDrop(file5);
      // Modal should close and reopen
      assert(!settingsModal.classList.contains('hidden'), 'Modal reopened after being open');
      assert(labelInput.value === 'open-modal-test', 'Label set correctly');
    } catch (error) {
      console.error('❌ Error when modal was open:', error);
      testResults.errors.push(`Open modal test error: ${error.message}`);
      testResults.failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   Total tests: ${testResults.total}`);
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Drag and drop is working correctly.');
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Please check the errors above.`);
  }
  console.log('='.repeat(50) + '\n');

  // Clean up - close modal
  if (settingsModal) {
    settingsModal.classList.add('hidden');
  }

  return testResults;
})();
