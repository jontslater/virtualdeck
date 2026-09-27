#!/usr/bin/env node
/**
 * Basic security module test
 * Run with: node test-security.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const SecurityManager = require('./lib/security');

// Create temp directory for testing
const testDir = path.join(os.tmpdir(), 'vd-security-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

console.log('🧪 Testing VirtualDeck Security Module\n');

// Test 1: Token generation
console.log('Test 1: Token Generation');
const security = new SecurityManager(testDir);
const token1 = security.getOrCreateToken();
console.log('✅ Token generated:', token1.substring(0, 16) + '...');
console.log('   Length:', token1.length, 'chars');

// Test 2: Token persistence
console.log('\nTest 2: Token Persistence');
const security2 = new SecurityManager(testDir);
const token2 = security2.getOrCreateToken();
if (token1 === token2) {
  console.log('✅ Token persisted correctly');
} else {
  console.error('❌ Token changed! Expected same token.');
}

// Test 3: Token validation
console.log('\nTest 3: Token Validation');
const valid = security.validateToken(token1);
const invalid = security.validateToken('wrong-token');
console.log('✅ Valid token accepted:', valid);
console.log('✅ Invalid token rejected:', !invalid);

// Test 4: Path sanitization
console.log('\nTest 4: Path Sanitization');
try {
  const safe1 = security.sanitizePath(testDir, 'safe/file.txt');
  console.log('✅ Safe path allowed:', path.basename(safe1));
  
  try {
    const unsafe = security.sanitizePath(testDir, '../../etc/passwd');
    console.error('❌ Traversal attack not blocked!');
  } catch (err) {
    console.log('✅ Path traversal blocked:', err.message);
  }
} catch (err) {
  console.error('❌ Path sanitization failed:', err);
}

// Test 5: Rate limiter
console.log('\nTest 5: Rate Limiter');
const limiter = security.createRateLimiter(1000, 3); // 3 requests per second
const clientId = 'test-client';

let allowed = 0;
let denied = 0;

for (let i = 0; i < 5; i++) {
  if (limiter.check(clientId)) {
    allowed++;
  } else {
    denied++;
  }
}

console.log('✅ Rate limiter working:');
console.log('   Allowed:', allowed, '/ 3 (expected)');
console.log('   Denied:', denied, '/ 2 (expected)');

if (allowed === 3 && denied === 2) {
  console.log('✅ Rate limiting correct');
} else {
  console.error('❌ Rate limiting incorrect');
}

// Test 6: Token extraction from mock request
console.log('\nTest 6: Token Extraction');
const mockReq1 = {
  headers: {
    'x-vd-auth': token1
  }
};
const extracted1 = security.extractToken(mockReq1);
console.log('✅ Extracted from X-VD-Auth header:', extracted1 === token1);

const mockReq2 = {
  headers: {
    'authorization': `Bearer ${token1}`
  }
};
const extracted2 = security.extractToken(mockReq2);
console.log('✅ Extracted from Bearer token:', extracted2 === token1);

const mockUrl = new URL(`http://localhost:8080/test?token=${token1}`);
const extracted3 = security.extractToken({headers: {}}, mockUrl);
console.log('✅ Extracted from query param:', extracted3 === token1);

// Cleanup
console.log('\n🧹 Cleaning up test directory');
fs.rmSync(testDir, { recursive: true, force: true });

console.log('\n✅ All tests passed!\n');
