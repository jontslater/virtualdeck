#!/usr/bin/env node
/**
 * Brain HTTP Client Example
 * 
 * Minimal example showing how an external AI brain (Grok, Cursor Grok Bot, Claude, etc.)
 * can discover and invoke VirtualDeck tools via the Brain API.
 * 
 * This example uses only Node.js built-in modules (http, fs, path) - no external dependencies.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const JARVIS_HOST = process.env.JARVIS_HOST || '127.0.0.1';
const JARVIS_PORT = process.env.JARVIS_PORT || 8091;

/**
 * Load auth token from VirtualDeck's standard location
 */
function loadAuthToken() {
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
      const token = fs.readFileSync(tokenPath, 'utf-8').trim();
      console.log(`✓ Loaded auth token from: ${tokenPath}`);
      return token;
    } else {
      console.warn(`⚠ Auth token file not found: ${tokenPath}`);
      console.warn('  Make sure VirtualDeck has run at least once to generate the token.');
      return null;
    }
  } catch (err) {
    console.error(`✗ Error loading auth token: ${err.message}`);
    return null;
  }
}

/**
 * Make an HTTP request to the Brain API
 */
function brainRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: JARVIS_HOST,
      port: JARVIS_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-VD-Auth': token || ''
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * List all available tools
 */
async function listTools(token) {
  console.log('\n📋 Listing available tools...');
  const response = await brainRequest('GET', '/jarvis/tools', token);
  
  if (response.status === 401) {
    console.error('✗ 401 Unauthorized - check your auth token');
    return null;
  }
  
  if (response.status !== 200) {
    console.error(`✗ HTTP ${response.status}:`, response.data);
    return null;
  }
  
  const { tools, count } = response.data;
  console.log(`✓ Found ${count} tools:\n`);
  
  tools.forEach((tool, index) => {
    console.log(`  ${index + 1}. ${tool.name}`);
    console.log(`     ${tool.description}`);
    
    const requiredParams = tool.parameters?.required || [];
    if (requiredParams.length > 0) {
      console.log(`     Required: ${requiredParams.join(', ')}`);
    } else {
      console.log(`     No required parameters`);
    }
    console.log('');
  });
  
  return tools;
}

/**
 * Invoke a tool
 */
async function invokeTool(token, toolName, args = {}) {
  console.log(`\n🎯 Invoking tool: ${toolName}`);
  console.log(`   Arguments:`, JSON.stringify(args, null, 2));
  
  const response = await brainRequest('POST', '/jarvis/invoke', token, {
    tool: toolName,
    arguments: args
  });
  
  if (response.status === 401) {
    console.error('✗ 401 Unauthorized - check your auth token');
    return null;
  }
  
  if (response.status !== 200) {
    console.error(`✗ HTTP ${response.status}:`, response.data);
    return null;
  }
  
  const result = response.data;
  
  if (result.success) {
    console.log('✓ Tool executed successfully');
    console.log('   Result:', JSON.stringify(result.result, null, 2));
  } else {
    console.log('✗ Tool execution failed');
    console.log('   Error:', result.error);
  }
  
  return result;
}

/**
 * Check server health
 */
async function checkHealth(token) {
  console.log('\n❤️  Checking server health...');
  const response = await brainRequest('GET', '/jarvis/health', token);
  
  if (response.status === 401) {
    console.error('✗ 401 Unauthorized - check your auth token');
    return null;
  }
  
  if (response.status !== 200) {
    console.error(`✗ HTTP ${response.status}:`, response.data);
    return null;
  }
  
  const { status, version, uptime } = response.data;
  console.log(`✓ Server Status: ${status}`);
  console.log(`  Version: ${version}`);
  console.log(`  Uptime: ${uptime.toFixed(2)}s`);
  
  return response.data;
}

/**
 * Main example flow
 */
async function main() {
  console.log('┌─────────────────────────────────────────┐');
  console.log('│   VirtualDeck Brain API Client Example │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`\nConnecting to: http://${JARVIS_HOST}:${JARVIS_PORT}`);
  
  // Step 1: Load auth token
  const token = loadAuthToken();
  if (!token) {
    console.error('\n❌ Cannot proceed without auth token.');
    console.log('\nTo fix this:');
    console.log('1. Start VirtualDeck at least once');
    console.log('2. Check that the .vd-auth-token file exists');
    console.log('3. Verify the file is readable');
    process.exit(1);
  }
  
  try {
    // Step 2: Check server health
    const health = await checkHealth(token);
    if (!health) {
      console.error('\n❌ Server is not responding. Make sure VirtualDeck is running.');
      process.exit(1);
    }
    
    // Step 3: List available tools
    const tools = await listTools(token);
    if (!tools) {
      process.exit(1);
    }
    
    // Step 4: Invoke get_stream_status (safe, no side effects)
    await invokeTool(token, 'get_stream_status', {});
    
    // Success!
    console.log('\n✅ Example completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   • Review docs/brain-api.md for full API documentation');
    console.log('   • Check docs/jarvis-tools.md for detailed tool schemas');
    console.log('   • See docs/mcp-roadmap.md for MCP integration plans');
    console.log('   • Try invoking other tools from the list above');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('• Is VirtualDeck running?');
    console.log('• Is the JARVIS server started? (check VirtualDeck console)');
    console.log('• Is port 8091 accessible?');
    console.log('• Try: curl http://127.0.0.1:8091/jarvis/health');
    process.exit(1);
  }
}

// Run the example if executed directly
if (require.main === module) {
  main();
}

// Export functions for use as a library
module.exports = {
  loadAuthToken,
  brainRequest,
  listTools,
  invokeTool,
  checkHealth
};
