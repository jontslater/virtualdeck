#!/usr/bin/env node
/**
 * JARVIS Phase 2 Test Suite
 * 
 * Tests shared auth, tool bridge, and error responses
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, emoji, message) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function success(msg) { log(colors.green, '✓', msg); }
function error(msg) { log(colors.red, '✗', msg); }
function info(msg) { log(colors.blue, 'ℹ', msg); }
function warn(msg) { log(colors.yellow, '⚠', msg); }

// Test configuration
const JARVIS_URL = 'http://127.0.0.1:8091';
let authToken = null;

// Load auth token
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
      authToken = fs.readFileSync(tokenPath, 'utf-8').trim();
      success(`Loaded token from: ${tokenPath}`);
      return true;
    } else {
      warn(`Token file not found: ${tokenPath}`);
      warn('VirtualDeck must be running to create the token file');
      return false;
    }
  } catch (err) {
    error(`Error loading token: ${err.message}`);
    return false;
  }
}

// Make HTTP request
function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, JARVIS_URL);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: result });
        } catch (err) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test suite
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Tests
test('Health check without auth (should fail)', async () => {
  const res = await request('GET', '/jarvis/health');
  if (res.status === 401) {
    success('Health check correctly requires auth');
    return true;
  } else {
    error(`Expected 401, got ${res.status}`);
    return false;
  }
});

test('Health check with X-VD-Auth header', async () => {
  const res = await request('GET', '/jarvis/health', { 'X-VD-Auth': authToken });
  if (res.status === 200 && res.body.status === 'ok') {
    success('X-VD-Auth header works');
    return true;
  } else {
    error(`Expected 200 OK, got ${res.status}`);
    return false;
  }
});

test('Health check with X-Jarvis-Token header (legacy)', async () => {
  const res = await request('GET', '/jarvis/health', { 'X-Jarvis-Token': authToken });
  if (res.status === 200 && res.body.status === 'ok') {
    success('X-Jarvis-Token header works (legacy)');
    return true;
  } else {
    error(`Expected 200 OK, got ${res.status}`);
    return false;
  }
});

test('Health check with Authorization Bearer header', async () => {
  const res = await request('GET', '/jarvis/health', { 'Authorization': `Bearer ${authToken}` });
  if (res.status === 200 && res.body.status === 'ok') {
    success('Authorization Bearer header works');
    return true;
  } else {
    error(`Expected 200 OK, got ${res.status}`);
    return false;
  }
});

test('List tools with auth', async () => {
  const res = await request('GET', '/jarvis/tools', { 'X-VD-Auth': authToken });
  if (res.status === 200 && Array.isArray(res.body.tools)) {
    success(`Listed ${res.body.count} tools`);
    return true;
  } else {
    error(`Expected tools list, got ${res.status}`);
    return false;
  }
});

test('Invoke get_stream_status tool', async () => {
  const res = await request('POST', '/jarvis/invoke', 
    { 'X-VD-Auth': authToken },
    { tool: 'get_stream_status', arguments: {} }
  );
  if (res.status === 200 && res.body.success) {
    success('get_stream_status invoked successfully');
    info(`  Connected: ${res.body.result.connected}`);
    return true;
  } else {
    error(`Tool invocation failed: ${res.status}`);
    return false;
  }
});

test('Audio control returns error (not fake success)', async () => {
  const res = await request('POST', '/jarvis/invoke',
    { 'X-VD-Auth': authToken },
    { tool: 'set_volume', arguments: { target: 'master', level: 50 } }
  );
  if (res.status === 400 && !res.body.success) {
    success('set_volume correctly returns error (not fake success)');
    info(`  Error: ${res.body.result.error}`);
    return true;
  } else if (res.status === 200 && res.body.success) {
    error('set_volume returned fake success (should return error)');
    return false;
  } else {
    error(`Unexpected response: ${res.status}`);
    return false;
  }
});

test('RavenJarvisBridge helper loads', async () => {
  try {
    const { RavenJarvisBridge } = require('./raven-jarvis-bridge');
    const bridge = new RavenJarvisBridge({ token: authToken });
    
    const health = await bridge.health();
    if (health.status === 'ok') {
      success('RavenJarvisBridge works');
      return true;
    } else {
      error('Bridge health check failed');
      return false;
    }
  } catch (err) {
    error(`Bridge error: ${err.message}`);
    return false;
  }
});

test('RavenJarvisBridge listTools', async () => {
  try {
    const { RavenJarvisBridge } = require('./raven-jarvis-bridge');
    const bridge = new RavenJarvisBridge({ token: authToken });
    
    const { tools, count } = await bridge.listTools();
    if (Array.isArray(tools) && count > 0) {
      success(`Bridge listed ${count} tools`);
      return true;
    } else {
      error('Bridge listTools failed');
      return false;
    }
  } catch (err) {
    error(`Bridge error: ${err.message}`);
    return false;
  }
});

test('RavenJarvisBridge exec method', async () => {
  try {
    const { RavenJarvisBridge } = require('./raven-jarvis-bridge');
    const bridge = new RavenJarvisBridge({ token: authToken });
    
    const result = await bridge.exec('get_stream_status');
    if (result && typeof result.connected === 'boolean') {
      success('Bridge exec() works');
      return true;
    } else {
      error('Bridge exec() returned unexpected result');
      return false;
    }
  } catch (err) {
    error(`Bridge error: ${err.message}`);
    return false;
  }
});

// Run tests
async function runTests() {
  console.log('\n' + colors.blue + '='.repeat(60) + colors.reset);
  console.log(colors.blue + '  JARVIS Phase 2 Test Suite' + colors.reset);
  console.log(colors.blue + '='.repeat(60) + colors.reset + '\n');

  info('Loading auth token...');
  if (!loadToken()) {
    error('Cannot run tests without auth token');
    error('Please start VirtualDeck first to generate .vd-auth-token');
    process.exit(1);
  }
  console.log('');

  info(`Testing JARVIS at ${JARVIS_URL}...`);
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    info(`Running: ${name}`);
    try {
      const result = await fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      error(`Test threw error: ${err.message}`);
      failed++;
    }
    console.log('');
  }

  console.log(colors.blue + '='.repeat(60) + colors.reset);
  console.log(`${colors.green}✓ Passed: ${passed}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}✗ Failed: ${failed}${colors.reset}`);
  }
  console.log(colors.blue + '='.repeat(60) + colors.reset + '\n');

  if (failed > 0) {
    warn('Some tests failed. Check VirtualDeck is running with JARVIS enabled.');
    process.exit(1);
  } else {
    success('All tests passed! JARVIS Phase 2 is ready.');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
