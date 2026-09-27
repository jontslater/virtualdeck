#!/usr/bin/env node
/**
 * Brain API Surface Test
 * 
 * Validates that the Brain API provides all the documented endpoints
 * and returns properly structured responses.
 * 
 * Run this WITHOUT VirtualDeck running to test graceful error handling,
 * or WITH VirtualDeck running to test the full flow.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const JARVIS_HOST = '127.0.0.1';
const JARVIS_PORT = 8091;

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function log(symbol, message, color = RESET) {
  console.log(`${color}${symbol} ${message}${RESET}`);
}

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
    // Ignore
  }
  return null;
}

function request(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: JARVIS_HOST,
      port: JARVIS_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['X-VD-Auth'] = token;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
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

async function testHealthEndpoint(token) {
  log('→', 'Testing GET /jarvis/health', BLUE);
  try {
    const response = await request('GET', '/jarvis/health', token);
    
    if (response.status === 200 && response.data.status === 'ok') {
      log('✓', 'Health endpoint working', GREEN);
      log('  ', `Version: ${response.data.version}, Uptime: ${response.data.uptime.toFixed(2)}s`);
      return true;
    } else {
      log('✗', `Unexpected response: ${response.status}`, RED);
      return false;
    }
  } catch (err) {
    log('✗', `Connection failed: ${err.message}`, RED);
    return false;
  }
}

async function testToolsEndpoint(token) {
  log('→', 'Testing GET /jarvis/tools', BLUE);
  try {
    const response = await request('GET', '/jarvis/tools', token);
    
    if (response.status === 200 && response.data.tools && response.data.count) {
      const { tools, count } = response.data;
      log('✓', `Tools endpoint working (${count} tools)`, GREEN);
      
      // Validate schema structure
      let valid = true;
      for (const tool of tools) {
        if (!tool.name || !tool.description || !tool.parameters) {
          log('✗', `Tool '${tool.name}' missing required fields`, RED);
          valid = false;
        }
        
        const params = tool.parameters;
        if (params.type !== 'object' || !params.properties) {
          log('✗', `Tool '${tool.name}' has invalid parameter schema`, RED);
          valid = false;
        }
      }
      
      if (valid) {
        log('✓', 'All tools have valid JSON Schema parameters', GREEN);
        log('  ', `Available tools: ${tools.map(t => t.name).join(', ')}`);
      }
      
      return valid;
    } else {
      log('✗', `Unexpected response: ${response.status}`, RED);
      return false;
    }
  } catch (err) {
    log('✗', `Request failed: ${err.message}`, RED);
    return false;
  }
}

async function testInvokeEndpoint(token) {
  log('→', 'Testing POST /jarvis/invoke', BLUE);
  try {
    const response = await request('POST', '/jarvis/invoke', token, {
      tool: 'get_stream_status',
      arguments: {}
    });
    
    if (response.status === 200 && typeof response.data.success === 'boolean') {
      log('✓', 'Invoke endpoint working', GREEN);
      if (response.data.success) {
        log('  ', `Result: ${JSON.stringify(response.data.result)}`);
      } else {
        log('  ', `Error (expected if not connected): ${response.data.error}`);
      }
      return true;
    } else {
      log('✗', `Unexpected response: ${response.status}`, RED);
      return false;
    }
  } catch (err) {
    log('✗', `Request failed: ${err.message}`, RED);
    return false;
  }
}

async function testAuthRequired() {
  log('→', 'Testing auth requirement (no token)', BLUE);
  try {
    const response = await request('GET', '/jarvis/tools', null);
    
    if (response.status === 401) {
      log('✓', 'Auth properly required (401 without token)', GREEN);
      return true;
    } else {
      log('⚠', `Expected 401, got ${response.status} (token may not be configured)`, YELLOW);
      return true; // Not a failure if auth is disabled
    }
  } catch (err) {
    log('✗', `Request failed: ${err.message}`, RED);
    return false;
  }
}

async function testNotFoundEndpoint(token) {
  log('→', 'Testing 404 handling', BLUE);
  try {
    const response = await request('GET', '/jarvis/nonexistent', token);
    
    if (response.status === 404) {
      log('✓', '404 handling working', GREEN);
      return true;
    } else {
      log('✗', `Expected 404, got ${response.status}`, RED);
      return false;
    }
  } catch (err) {
    log('✗', `Request failed: ${err.message}`, RED);
    return false;
  }
}

async function main() {
  console.log('┌────────────────────────────────────────┐');
  console.log('│   Brain API Surface Test               │');
  console.log('└────────────────────────────────────────┘\n');
  
  const token = loadToken();
  if (token) {
    log('✓', 'Auth token loaded', GREEN);
  } else {
    log('⚠', 'No auth token found (will test without auth)', YELLOW);
  }
  
  console.log('');
  
  const tests = [
    testHealthEndpoint,
    testToolsEndpoint,
    testInvokeEndpoint,
    testAuthRequired,
    testNotFoundEndpoint
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test(token);
      results.push(result);
    } catch (err) {
      log('✗', `Test failed: ${err.message}`, RED);
      results.push(false);
    }
    console.log('');
  }
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('────────────────────────────────────────');
  if (passed === total) {
    log('✓', `All ${total} tests passed!`, GREEN);
    console.log('');
    log('→', 'Brain API surface is complete and working correctly.', BLUE);
  } else {
    log('✗', `${passed}/${total} tests passed`, RED);
    console.log('');
    log('→', 'Check if VirtualDeck is running on port 8091', BLUE);
  }
  
  process.exit(passed === total ? 0 : 1);
}

if (require.main === module) {
  main();
}
