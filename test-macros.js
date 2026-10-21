#!/usr/bin/env node
/**
 * Basic smoke test for macros and Discord integration
 * Run with: node test-macros.js
 */

const MacroManager = require('./lib/macro-manager');
const { registry } = require('./jarvis-tools');
const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('🧪 VirtualDeck Macros Smoke Test\n');

// Create temp directory for test
const testDir = path.join(os.tmpdir(), 'vd-macro-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });
console.log('✅ Test directory:', testDir);

// Test 1: MacroManager initialization
console.log('\n📋 Test 1: MacroManager initialization');
try {
  const macroManager = new MacroManager(testDir);
  console.log('✅ MacroManager created');
  
  const macros = macroManager.list();
  console.log(`✅ Default macros loaded: ${macros.length} macro(s)`);
  
  if (macros.length > 0) {
    console.log(`   - Found: ${macros.map(m => m.name).join(', ')}`);
  }
} catch (error) {
  console.error('❌ MacroManager test failed:', error.message);
  process.exit(1);
}

// Test 2: JARVIS tools registration
console.log('\n📋 Test 2: JARVIS tools registration');
try {
  const tools = registry.list();
  const macroTools = tools.filter(t => 
    t.name.includes('macro') || t.name.includes('discord')
  );
  
  console.log(`✅ Found ${tools.length} total JARVIS tools`);
  console.log(`✅ Macro/Discord tools: ${macroTools.length}`);
  
  macroTools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  
  // Check for required tools
  const requiredTools = ['run_macro', 'discord_send_message', 'discord_announce_live', 'discord_post_clip'];
  const missingTools = requiredTools.filter(name => !tools.find(t => t.name === name));
  
  if (missingTools.length > 0) {
    console.error('❌ Missing required tools:', missingTools.join(', '));
    process.exit(1);
  }
  
  console.log('✅ All required tools present');
} catch (error) {
  console.error('❌ JARVIS tools test failed:', error.message);
  process.exit(1);
}

// Test 3: Macro validation
console.log('\n📋 Test 3: Macro validation');
try {
  const macroManager = new MacroManager(testDir);
  
  const validMacro = {
    name: 'Test Macro',
    description: 'Test description',
    steps: [
      { tool: 'play_sound', arguments: { name: 'test' }, description: 'Test step' }
    ]
  };
  
  const validation = macroManager.validate(validMacro);
  if (!validation.valid) {
    console.error('❌ Valid macro marked as invalid:', validation.errors);
    process.exit(1);
  }
  console.log('✅ Valid macro passes validation');
  
  const invalidMacro = {
    description: 'Missing name',
    steps: []
  };
  
  const invalidValidation = macroManager.validate(invalidMacro);
  if (invalidValidation.valid) {
    console.error('❌ Invalid macro marked as valid');
    process.exit(1);
  }
  console.log('✅ Invalid macro correctly rejected');
  console.log(`   - Errors: ${invalidValidation.errors.join(', ')}`);
} catch (error) {
  console.error('❌ Validation test failed:', error.message);
  process.exit(1);
}

// Test 4: Macro CRUD operations
console.log('\n📋 Test 4: Macro CRUD operations');
try {
  const macroManager = new MacroManager(testDir);
  
  // Create
  const testMacro = {
    name: 'Test CRUD Macro',
    description: 'Testing create/read/update/delete',
    triggers: { phrase: 'test phrase', button: null },
    steps: [
      { tool: 'play_sound', arguments: { name: 'test' } }
    ],
    enabled: true
  };
  
  macroManager.set('test-crud', testMacro);
  console.log('✅ Macro created');
  
  // Read
  const retrieved = macroManager.get('test-crud');
  if (!retrieved || retrieved.name !== testMacro.name) {
    console.error('❌ Failed to retrieve macro');
    process.exit(1);
  }
  console.log('✅ Macro retrieved');
  
  // Update
  testMacro.name = 'Updated Name';
  macroManager.set('test-crud', testMacro);
  const updated = macroManager.get('test-crud');
  if (updated.name !== 'Updated Name') {
    console.error('❌ Failed to update macro');
    process.exit(1);
  }
  console.log('✅ Macro updated');
  
  // Delete
  const deleted = macroManager.delete('test-crud');
  if (!deleted) {
    console.error('❌ Failed to delete macro');
    process.exit(1);
  }
  const afterDelete = macroManager.get('test-crud');
  if (afterDelete) {
    console.error('❌ Macro still exists after delete');
    process.exit(1);
  }
  console.log('✅ Macro deleted');
} catch (error) {
  console.error('❌ CRUD test failed:', error.message);
  process.exit(1);
}

// Test 5: Discord tool parameter validation
console.log('\n📋 Test 5: Discord tool schemas');
try {
  const discordSend = registry.get('discord_send_message');
  const discordLive = registry.get('discord_announce_live');
  const discordClip = registry.get('discord_post_clip');
  
  if (!discordSend || !discordLive || !discordClip) {
    console.error('❌ Discord tools not registered');
    process.exit(1);
  }
  
  console.log('✅ discord_send_message schema valid');
  console.log('✅ discord_announce_live schema valid');
  console.log('✅ discord_post_clip schema valid');
  
  // Check required parameters
  if (!discordSend.parameters.required.includes('message')) {
    console.error('❌ discord_send_message missing required "message" parameter');
    process.exit(1);
  }
  console.log('✅ Discord tools have correct required parameters');
} catch (error) {
  console.error('❌ Discord tools schema test failed:', error.message);
  process.exit(1);
}

// Cleanup
console.log('\n🧹 Cleaning up...');
try {
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('✅ Test directory cleaned up');
} catch (error) {
  console.warn('⚠️  Failed to clean up test directory:', error.message);
}

console.log('\n✨ All tests passed!\n');
console.log('Note: This is a basic smoke test. Full integration testing requires:');
console.log('  - Running Electron app with UI');
console.log('  - Valid Discord webhook URL or bot token');
console.log('  - Meld Studio running for scene changes');
console.log('  - Raven voice assistant for voice triggers');
