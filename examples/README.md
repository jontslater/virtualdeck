# JARVIS Examples

This directory contains example clients and test tools for VirtualDeck's Brain API (JARVIS Tool API).

## Files

### `brain-http-client.js` 🚀 **NEW** - Minimal Brain API Example

**Recommended starting point** for external AI brains (Grok, Cursor Grok Bot, Claude, etc.).

**Features:**
- Zero external dependencies (Node.js built-in `http`, `fs`, `path` only)
- Auto-loads `.vd-auth-token` from VirtualDeck's userData directory
- Simple, readable code demonstrating the core Brain API flow
- Perfect for copy-paste into your own brain implementation

**Usage:**
```bash
node brain-http-client.js
```

**What it does:**
1. Loads auth token from standard location
2. Checks server health (`GET /jarvis/health`)
3. Lists all available tools (`GET /jarvis/tools`)
4. Invokes `get_stream_status` as a safe example (`POST /jarvis/invoke`)

**See also**: [docs/brain-api.md](../docs/brain-api.md) for complete API documentation.

---

### `raven-jarvis-bridge.js` ⭐ Advanced Helper Class

Lightweight helper class for AI brains (Raven, Grok, Claude, etc.) to control VirtualDeck.

**Features:**
- Auto-loads `.vd-auth-token` from VirtualDeck's userData directory
- Clean API: `listTools()`, `getTool()`, `invoke()`, `exec()`
- Cross-platform (Windows, macOS, Linux)
- No external dependencies (uses Node.js built-in `http` and `fs`)

**Usage:**
```javascript
const { RavenJarvisBridge } = require('./raven-jarvis-bridge');

const bridge = new RavenJarvisBridge();

// List all available tools
const { tools } = await bridge.listTools();

// Execute a tool (throws on error)
const status = await bridge.exec('get_stream_status');

// Invoke a tool (returns {success, result?, error?})
const result = await bridge.invoke('play_sound', { name: 'airhorn' });
```

**Run Example:**
```bash
node raven-jarvis-bridge.js
```

---

### `jarvis-client-example.js`

General-purpose HTTP and WebSocket client example showing how to:
- Load auth token automatically
- List tools via HTTP GET
- Invoke tools via HTTP POST
- Connect via WebSocket for streaming

**Usage:**
```bash
node jarvis-client-example.js
```

---

### `test-jarvis-phase2.js` 🧪 Test Suite

Comprehensive test suite for JARVIS Phase 2 features:
- Tests all auth header formats (X-VD-Auth, X-Jarvis-Token, Bearer)
- Validates auth requirement (401 without token)
- Tests RavenJarvisBridge helper
- Verifies tool invocation
- Checks audio controls return errors (not fake success)

**Usage:**
```bash
# Start VirtualDeck first, then run:
node test-jarvis-phase2.js
```

**Output:**
- ✓ Green checkmarks for passing tests
- ✗ Red X's for failures
- ℹ Blue info messages
- Color-coded test results

---

## Prerequisites

All examples require:
1. **VirtualDeck running** with JARVIS server enabled (default: port 8081)
2. **Auth token generated**: VirtualDeck creates `.vd-auth-token` on first startup

### Token Location

- **Windows**: `%APPDATA%\virtualdeck\.vd-auth-token`
- **macOS**: `~/Library/Application Support/virtualdeck/.vd-auth-token`
- **Linux**: `~/.config/virtualdeck/.vd-auth-token`

### Reading Your Token

**PowerShell:**
```powershell
Get-Content $env:APPDATA\virtualdeck\.vd-auth-token
```

**cmd:**
```cmd
type %APPDATA%\virtualdeck\.vd-auth-token
```

**bash/zsh:**
```bash
cat ~/.config/virtualdeck/.vd-auth-token
```

---

## Integration Patterns

### Pattern 1: Simple HTTP Client

Use for basic tool invocation without dependencies:

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load token
const tokenPath = path.join(process.env.APPDATA, 'virtualdeck', '.vd-auth-token');
const token = fs.readFileSync(tokenPath, 'utf-8').trim();

// Invoke tool
const options = {
  method: 'POST',
  hostname: '127.0.0.1',
  port: 8091,
  path: '/jarvis/invoke',
  headers: {
    'Content-Type': 'application/json',
    'X-VD-Auth': token
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(JSON.parse(data)));
});

req.write(JSON.stringify({
  tool: 'play_sound',
  arguments: { name: 'airhorn' }
}));
req.end();
```

### Pattern 2: RavenJarvisBridge (Recommended)

Use for AI brain integration:

```javascript
const { RavenJarvisBridge } = require('./raven-jarvis-bridge');

async function handleVoiceCommand(intent) {
  const bridge = new RavenJarvisBridge();
  
  switch (intent.action) {
    case 'play_sound':
      await bridge.exec('play_sound', { name: intent.soundName });
      return 'Playing sound';
    
    case 'change_scene':
      await bridge.exec('change_scene', { sceneName: intent.sceneName });
      return 'Scene changed';
    
    default:
      const { tools } = await bridge.listTools();
      return `Available tools: ${tools.map(t => t.name).join(', ')}`;
  }
}
```

### Pattern 3: WebSocket Streaming

Use for real-time bidirectional communication:

```javascript
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Load token
const tokenPath = path.join(process.env.APPDATA, 'virtualdeck', '.vd-auth-token');
const token = fs.readFileSync(tokenPath, 'utf-8').trim();

// Connect with token as query param
const ws = new WebSocket(`ws://127.0.0.1:8091/jarvis/ws?token=${token}`);

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 'req-1',
    tool: 'get_stream_status',
    arguments: {}
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);
});
```

---

## Troubleshooting

### Error: Cannot find token file

**Cause:** VirtualDeck hasn't run yet or userData path is incorrect

**Solution:** 
1. Start VirtualDeck once to generate the token
2. Check the console log for "Auth token" message showing the path

### Error: 401 Unauthorized

**Cause:** Token not sent or incorrect

**Solution:**
1. Verify token file exists and is readable
2. Check header name: `X-VD-Auth`, `X-Jarvis-Token`, or `Authorization: Bearer <token>`
3. Ensure no extra whitespace in token

### Error: Connection refused

**Cause:** JARVIS server not running

**Solution:**
1. Start VirtualDeck
2. Check console logs for "JARVIS Server] Listening on http://127.0.0.1:8091"
3. Verify port 8091 is not blocked by firewall

### Error: ECONNREFUSED or timeout

**Cause:** Server not running or wrong host/port

**Solution:**
1. Verify VirtualDeck is running
2. Check `JARVIS_PORT` and `JARVIS_HOST` env vars
3. Default is `http://127.0.0.1:8091`

---

## See Also

- [JARVIS Tools Documentation](../docs/jarvis-tools.md) - Complete API reference
- [VirtualDeck Repository](https://github.com/jontslater/virtualdeck) - Main project
- Phase 2 PR: #79 - Shared auth and tool bridge

---

## License

Same as VirtualDeck (MIT)
