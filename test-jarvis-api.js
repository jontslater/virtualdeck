#!/usr/bin/env node
/**
 * Simple test script for JARVIS API
 * Tests the tool registry and server independently
 */

const { registry } = require('./jarvis-tools');
const { JarvisServer } = require('./jarvis-server');

console.log('🧪 Testing JARVIS API Components\n');

// Test 1: Tool Registry
console.log('1️⃣ Testing Tool Registry...');
const tools = registry.list();
console.log(`   ✅ Found ${tools.length} tools registered`);
tools.forEach(tool => {
  console.log(`      - ${tool.name}: ${tool.description}`);
});

// Test 2: Tool Invocation (without VD context)
console.log('\n2️⃣ Testing Tool Invocation (stub mode)...');
registry.setContext({
  win: null,
  twitchClient: null,
  config: { twitchChannel: '#test' },
  triggerButtonFn: (label, source) => {
    console.log(`      [Mock] Would trigger button: ${label} from ${source}`);
    return true;
  }
});

(async () => {
  try {
    // Test get_stream_status (should work without VD running)
    const statusResult = await registry.invoke('get_stream_status', {});
    console.log(`   ✅ get_stream_status: ${JSON.stringify(statusResult.result, null, 2)}`);

    // Test set_volume (stub)
    const volumeResult = await registry.invoke('set_volume', { target: 'master', level: 50 });
    console.log(`   ✅ set_volume (stub): ${JSON.stringify(volumeResult, null, 2)}`);

    // Test invalid tool
    const invalidResult = await registry.invoke('nonexistent_tool', {});
    console.log(`   ✅ Invalid tool handling: ${invalidResult.error}`);

    // Test 3: Server Initialization
    console.log('\n3️⃣ Testing Server Initialization...');
    const server = new JarvisServer({
      port: 18081, // Use different port for testing
      host: '127.0.0.1',
      token: null
    });

    await server.start();
    console.log('   ✅ Server started successfully');

    // Give it a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 4: HTTP Request
    console.log('\n4️⃣ Testing HTTP Endpoint...');
    const fetch = require('node-fetch');
    
    // Test GET /jarvis/tools
    const listResponse = await fetch('http://127.0.0.1:18081/jarvis/tools');
    const listData = await listResponse.json();
    console.log(`   ✅ GET /jarvis/tools: ${listData.count} tools`);

    // Test POST /jarvis/invoke
    const invokeResponse = await fetch('http://127.0.0.1:18081/jarvis/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'get_stream_status',
        arguments: {}
      })
    });
    const invokeData = await invokeResponse.json();
    console.log(`   ✅ POST /jarvis/invoke: ${invokeData.success ? 'Success' : 'Failed'}`);

    // Test GET /jarvis/health
    const healthResponse = await fetch('http://127.0.0.1:18081/jarvis/health');
    const healthData = await healthResponse.json();
    console.log(`   ✅ GET /jarvis/health: ${healthData.status}`);

    // Test 5: WebSocket
    console.log('\n5️⃣ Testing WebSocket...');
    const WebSocket = require('ws');
    const ws = new WebSocket('ws://127.0.0.1:18081/jarvis/ws');

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('   ✅ WebSocket connected');
        ws.send(JSON.stringify({
          id: 'test-1',
          tool: 'get_stream_status',
          arguments: {}
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'welcome') {
          console.log('   ✅ Received welcome message');
        } else if (message.id === 'test-1') {
          console.log(`   ✅ Received response: ${message.success ? 'Success' : 'Failed'}`);
          ws.close();
          resolve();
        }
      });

      ws.on('error', reject);
    });

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await server.stop();
    
    console.log('\n✅ All tests passed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start VirtualDeck normally');
    console.log('   2. JARVIS server will start on port 8081 (configurable)');
    console.log('   3. Test with: curl http://127.0.0.1:8081/jarvis/tools');
    console.log('   4. See docs/jarvis-tools.md for complete API reference');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
})();
