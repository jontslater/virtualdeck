#!/usr/bin/env node
/**
 * JARVIS API Client Example
 * 
 * Demonstrates how to interact with VirtualDeck's JARVIS tool API
 * from an external application or AI agent.
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuration
const JARVIS_URL = process.env.JARVIS_URL || 'http://127.0.0.1:8091';

// Auto-load token from .vd-auth-token
function loadToken() {
  let tokenPath;
  
  if (process.platform === 'win32') {
    tokenPath = path.join(process.env.APPDATA || '', 'virtualdeck', '.vd-auth-token');
  } else if (process.platform === 'darwin') {
    tokenPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'virtualdeck', '.vd-auth-token');
  } else {
    tokenPath = path.join(process.env.HOME || '', '.config', 'virtualdeck', '.vd-auth-token');
  }

  try {
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf-8').trim();
    }
  } catch (err) {
    console.warn('Warning: Could not load .vd-auth-token:', err.message);
  }
  
  // Fall back to env var
  return process.env.JARVIS_TOKEN || null;
}

const JARVIS_TOKEN = loadToken();

class JarvisClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  /**
   * Get request headers with optional auth token
   */
  headers() {
    const h = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      h['X-VD-Auth'] = this.token;
    }
    return h;
  }

  /**
   * List all available tools
   */
  async listTools() {
    const response = await fetch(`${this.baseUrl}/jarvis/tools`, {
      headers: this.headers()
    });
    return await response.json();
  }

  /**
   * Invoke a tool by name with arguments
   */
  async invoke(toolName, args = {}) {
    const response = await fetch(`${this.baseUrl}/jarvis/invoke`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        tool: toolName,
        arguments: args
      })
    });
    return await response.json();
  }

  /**
   * Check server health
   */
  async health() {
    const response = await fetch(`${this.baseUrl}/jarvis/health`, {
      headers: this.headers()
    });
    return await response.json();
  }
}

// Example usage
async function main() {
  const client = new JarvisClient(JARVIS_URL, JARVIS_TOKEN);

  console.log('🤖 JARVIS API Client Example\n');

  try {
    // 1. Check server health
    console.log('1️⃣ Checking server health...');
    const health = await client.health();
    console.log(`   Status: ${health.status}`);
    console.log(`   Uptime: ${health.uptime.toFixed(2)}s\n`);

    // 2. List available tools
    console.log('2️⃣ Listing available tools...');
    const { tools, count } = await client.listTools();
    console.log(`   Found ${count} tools:`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // 3. Get stream status
    console.log('3️⃣ Getting stream status...');
    const status = await client.invoke('get_stream_status');
    console.log('   Result:', JSON.stringify(status.result, null, 2));
    console.log('');

    // 4. Example: Change scene (if Meld is running)
    console.log('4️⃣ Example: Change scene...');
    console.log('   (Skipped - requires Meld Studio to be running)');
    // const sceneResult = await client.invoke('change_scene', {
    //   sceneName: 'Main Scene'
    // });
    // console.log('   Result:', sceneResult);
    console.log('');

    // 5. Example: Play a sound
    console.log('5️⃣ Example: Trigger a button/sound...');
    console.log('   (Skipped - requires VirtualDeck to be running)');
    // const soundResult = await client.invoke('play_sound', {
    //   name: 'airhorn'
    // });
    // console.log('   Result:', soundResult);
    console.log('');

    // 6. Example: Send Twitch message
    console.log('6️⃣ Example: Send Twitch message...');
    console.log('   (Skipped - requires Twitch to be connected)');
    // const chatResult = await client.invoke('send_twitch_message', {
    //   text: 'Hello from JARVIS!'
    // });
    // console.log('   Result:', chatResult);
    console.log('');

    console.log('✅ Example completed successfully!');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Start VirtualDeck to test the full API');
    console.log('   - Connect Meld Studio for scene switching');
    console.log('   - Connect Twitch for chat integration');
    console.log('   - Set JARVIS_TOKEN env var if authentication is enabled');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Make sure VirtualDeck is running with JARVIS server enabled');
    process.exit(1);
  }
}

// WebSocket example
async function websocketExample() {
  const WebSocket = require('ws');
  
  console.log('\n📡 WebSocket Example\n');
  
  // Connect with token as query param
  const wsUrl = JARVIS_TOKEN 
    ? `ws://127.0.0.1:8091/jarvis/ws?token=${JARVIS_TOKEN}`
    : 'ws://127.0.0.1:8091/jarvis/ws';
  
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('✅ Connected to JARVIS WebSocket');
    
    // Send a tool invocation
    ws.send(JSON.stringify({
      id: 'req-1',
      tool: 'get_stream_status',
      arguments: {}
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', JSON.stringify(message, null, 2));
    
    if (message.id === 'req-1') {
      ws.close();
    }
  });

  ws.on('close', () => {
    console.log('👋 WebSocket closed');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
}

// Run the example
if (require.main === module) {
  main().then(() => {
    // Uncomment to test WebSocket
    // return websocketExample();
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { JarvisClient };
