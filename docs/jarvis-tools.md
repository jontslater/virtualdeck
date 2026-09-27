# JARVIS Tool API

The JARVIS Tool API provides a controlled set of tools for LLM brain integration with VirtualDeck. This allows an AI agent (like Grok) to control VirtualDeck functionality through a clean HTTP/WebSocket interface instead of unrestricted system access.

## Architecture

- **Tool Registry** (`jarvis-tools.js`): Defines all available tools with schemas and handlers
- **HTTP/WS Server** (`jarvis-server.js`): Exposes tools via REST and WebSocket APIs
- **Integration** (`main.js`): Wires tools to VirtualDeck functionality

## Configuration

Set these environment variables in `.env` (optional):

```env
# JARVIS server settings
JARVIS_PORT=8091           # Port for JARVIS API (default: 8091)
JARVIS_HOST=127.0.0.1      # Host to bind to (default: 127.0.0.1, localhost only)
JARVIS_TOKEN=your-custom-token  # Optional: Override default auth token
```

### Security & Authentication

**Default Authentication**: JARVIS uses the shared `.vd-auth-token` from VirtualDeck's SecurityManager by default. This token is automatically generated on first startup and stored in:
- **Windows**: `%APPDATA%\virtualdeck\.vd-auth-token`
- **macOS**: `~/Library/Application Support/virtualdeck/.vd-auth-token`
- **Linux**: `~/.config/virtualdeck/.vd-auth-token`

**Custom Token**: Set `JARVIS_TOKEN` environment variable to override the default shared token.

**Auth Headers**: Clients can provide the token using any of these methods:
- `X-Jarvis-Token: <token>` (legacy JARVIS-specific)
- `X-VD-Auth: <token>` (shared VirtualDeck auth)
- `Authorization: Bearer <token>` (standard OAuth-style)

**WebSocket Auth**: For WebSocket connections, pass the token as a query parameter:
- `ws://127.0.0.1:8091/jarvis/ws?token=<your-token>`

**Network Security**: 
- Server binds to `127.0.0.1` (localhost only) by default for security
- Authentication is always required (token is auto-generated if not provided)
- No public network exposure without explicit host configuration

## Raven/Brain Integration

For AI brains (Raven, Grok, Claude, etc.) that need to control VirtualDeck, use the included `RavenJarvisBridge` helper:

```javascript
const { RavenJarvisBridge } = require('./examples/raven-jarvis-bridge');

// Auto-loads .vd-auth-token from standard location
const bridge = new RavenJarvisBridge();

// List available tools
const { tools } = await bridge.listTools();

// Execute a tool (throws on error)
const status = await bridge.exec('get_stream_status');

// Invoke a tool (returns {success, result?, error?})
const result = await bridge.invoke('play_sound', { name: 'airhorn' });
```

The bridge automatically:
- Loads `.vd-auth-token` from VirtualDeck's userData directory
- Handles HTTP requests with proper auth headers
- Provides both high-level (`exec`) and low-level (`invoke`) APIs
- Works cross-platform (Windows, macOS, Linux)

Run the example:
```bash
node examples/raven-jarvis-bridge.js
```

## Tool Bridge API Reference

### `new RavenJarvisBridge(options)`
Create a new bridge instance.
- `options.baseUrl` - JARVIS API URL (default: `http://127.0.0.1:8091`)
- `options.token` - Auth token (auto-loaded if not provided)

### `bridge.health()`
Check server health. Returns `{status, version, uptime}`.

### `bridge.listTools()`
List all available tools with schemas. Returns `{tools: [...], count}`.

### `bridge.getTool(toolName)`
Get a specific tool's schema by name. Returns tool object or null.

### `bridge.invoke(toolName, args)`
Invoke a tool. Returns `{success: boolean, result?: any, error?: string}`.

### `bridge.exec(toolName, args)`
Execute a tool and return result directly. Throws Error on failure.

## API Endpoints

### List Available Tools

```http
GET http://127.0.0.1:8091/jarvis/tools
X-VD-Auth: <token-from-vd-auth-token-file>
```

Returns:
```json
{
  "tools": [
    {
      "name": "launch_app",
      "description": "Launch an application by name or path",
      "parameters": {
        "type": "object",
        "properties": {
          "nameOrPath": { "type": "string" },
          "args": { "type": "string" }
        },
        "required": ["nameOrPath"]
      }
    }
  ],
  "count": 10
}
```

### Invoke a Tool (Method 1)

```http
POST http://127.0.0.1:8091/jarvis/tools/:toolName
X-VD-Auth: <token-from-vd-auth-token-file>

{
  "nameOrPath": "notepad.exe"
}
```

### Invoke a Tool (Method 2)

```http
POST http://127.0.0.1:8091/jarvis/invoke
X-VD-Auth: <token-from-vd-auth-token-file>

{
  "tool": "launch_app",
  "arguments": {
    "nameOrPath": "notepad.exe"
  }
}
```

Response:
```json
{
  "success": true,
  "result": {
    "launched": true,
    "app": "notepad.exe"
  }
}
```

### Health Check

```http
GET http://127.0.0.1:8091/jarvis/health
X-VD-Auth: <token-from-vd-auth-token-file>
```

Returns:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123.456
}
```

## WebSocket API

Connect to `ws://127.0.0.1:8091/jarvis/ws?token=<your-token>` for streaming tool calls.

Send:
```json
{
  "id": "request-123",
  "tool": "launch_app",
  "arguments": {
    "nameOrPath": "notepad.exe"
  }
}
```

Receive:
```json
{
  "id": "request-123",
  "success": true,
  "result": {
    "launched": true,
    "app": "notepad.exe"
  }
}
```

## Available Tools

### 1. launch_app

Launch an application by name or path.

**Parameters:**
- `nameOrPath` (string, required): Application name or full path to executable
- `args` (string, optional): Command-line arguments

**Example:**
```json
{
  "tool": "launch_app",
  "arguments": {
    "nameOrPath": "C:\\Program Files\\OBS Studio\\bin\\64bit\\obs64.exe"
  }
}
```

### 2. change_scene

Switch to a different Meld Studio scene.

**Parameters:**
- `sceneName` (string, required): Name of the scene to switch to

**Example:**
```json
{
  "tool": "change_scene",
  "arguments": {
    "sceneName": "BRB Scene"
  }
}
```

**Note:** Requires Meld Studio to be running and connected via WebChannel.

### 3. get_scenes

List available Meld Studio scenes.

**Parameters:** None

**Example:**
```json
{
  "tool": "get_scenes",
  "arguments": {}
}
```

**Returns:**
```json
{
  "success": true,
  "scenes": [
    { "id": "scene-1", "name": "Main Scene" },
    { "id": "scene-2", "name": "BRB Scene" }
  ]
}
```

### 4. get_stream_status

Get current streaming status and configuration.

**Parameters:** None

**Example:**
```json
{
  "tool": "get_stream_status",
  "arguments": {}
}
```

**Returns:**
```json
{
  "connected": true,
  "channel": "#channelname",
  "username": "username",
  "overlayServerRunning": true,
  "overlayPort": 8080
}
```

### 5. trigger_button

Trigger a VirtualDeck button by label.

**Parameters:**
- `label` (string, required): Button label to trigger

**Example:**
```json
{
  "tool": "trigger_button",
  "arguments": {
    "label": "Applause"
  }
}
```

### 6. play_sound

Play a sound or alert from VirtualDeck library.

**Parameters:**
- `name` (string, required): Name or label of the sound to play

**Example:**
```json
{
  "tool": "play_sound",
  "arguments": {
    "name": "airhorn"
  }
}
```

### 7. run_macro

Execute a named macro or button sequence.

**Parameters:**
- `name` (string, required): Macro name or button label

**Example:**
```json
{
  "tool": "run_macro",
  "arguments": {
    "name": "start-stream"
  }
}
```

### 8. send_twitch_message

Send a message to Twitch chat.

**Parameters:**
- `text` (string, required): Message text to send
- `channel` (string, optional): Channel override (defaults to configured channel)

**Example:**
```json
{
  "tool": "send_twitch_message",
  "arguments": {
    "text": "Thanks for the follow!"
  }
}
```

**Note:** Requires Twitch client to be connected.

### 9. set_volume

Set volume level for a target audio source.

**Parameters:**
- `target` (string, required): Audio target - "master", "media", or "mic"
- `level` (number, required): Volume level (0-100)

**Example:**
```json
{
  "tool": "set_volume",
  "arguments": {
    "target": "master",
    "level": 75
  }
}
```

**Status:** Not yet implemented - returns error. Requires audio control API integration (see TODOs in jarvis-tools.js).

### 10. mute_mic / unmute_mic

Mute or unmute the microphone.

**Parameters:** None

**Example:**
```json
{
  "tool": "mute_mic",
  "arguments": {}
}
```

**Status:** Not yet implemented - returns error. Requires audio control API integration (see TODOs in jarvis-tools.js).

## Testing

### Reading the Auth Token

On Windows, get your token with PowerShell:
```powershell
Get-Content $env:APPDATA\virtualdeck\.vd-auth-token
```

Or cmd:
```cmd
type %APPDATA%\virtualdeck\.vd-auth-token
```

### Using curl

List tools:
```bash
# Read token first
TOKEN=$(cat ~/.config/virtualdeck/.vd-auth-token)  # Linux/macOS
# or
TOKEN=$(type %APPDATA%\virtualdeck\.vd-auth-token)  # Windows cmd

# Make request
curl -H "X-VD-Auth: $TOKEN" http://127.0.0.1:8091/jarvis/tools
```

With authentication (using different header formats):
```bash
# Method 1: X-VD-Auth header (recommended for VirtualDeck clients)
curl -H "X-VD-Auth: your-token-here" http://127.0.0.1:8091/jarvis/tools

# Method 2: X-Jarvis-Token header (legacy)
curl -H "X-Jarvis-Token: your-token-here" http://127.0.0.1:8091/jarvis/tools

# Method 3: Authorization Bearer (standard OAuth-style)
curl -H "Authorization: Bearer your-token-here" http://127.0.0.1:8091/jarvis/tools
```

Invoke a tool:
```bash
curl -X POST http://127.0.0.1:8091/jarvis/invoke \
  -H "Content-Type: application/json" \
  -H "X-VD-Auth: your-token-here" \
  -d '{
    "tool": "get_stream_status",
    "arguments": {}
  }'
```

### Using Node.js

```javascript
const fs = require('fs');
const path = require('path');

// Read token from file
const tokenPath = process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'virtualdeck', '.vd-auth-token')
  : path.join(process.env.HOME, '.config', 'virtualdeck', '.vd-auth-token');
const token = fs.readFileSync(tokenPath, 'utf-8').trim();

// Make authenticated request
const response = await fetch('http://127.0.0.1:8091/jarvis/invoke', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-VD-Auth': token  // or 'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    tool: 'play_sound',
    arguments: { name: 'airhorn' }
  })
});

const result = await response.json();
console.log(result);
```

### WebSocket Example

```javascript
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Read token from file
const tokenPath = process.platform === 'win32'
  ? path.join(process.env.APPDATA, 'virtualdeck', '.vd-auth-token')
  : path.join(process.env.HOME, '.config', 'virtualdeck', '.vd-auth-token');
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
  console.log('Response:', JSON.parse(data));
});
```

## Implementation Status

✅ **Fully Wired:**
- `launch_app` - Launches apps via execFile
- `change_scene` - Switches Meld scenes via meldClient
- `get_scenes` - Lists Meld scenes
- `get_stream_status` - Returns Twitch connection status
- `trigger_button` - Triggers VirtualDeck buttons with debouncing
- `play_sound` - Plays sounds via trigger-media system
- `run_macro` - Runs macros/buttons via trigger-media system
- `send_twitch_message` - Sends Twitch chat messages via tmi.js

❌ **Not Yet Implemented:**
- `set_volume` - Needs Windows audio control API (nircmd or loudness-windows)
- `mute_mic` / `unmute_mic` - Needs Windows microphone control API

See detailed TODOs in `jarvis-tools.js` for implementation paths.

## Adding New Tools

To add a new tool:

1. **Register in `jarvis-tools.js`:**

```javascript
registry.register(
  'tool_name',
  {
    description: 'What the tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['param1']
    }
  },
  async (args, context) => {
    // Implementation
    const { param1 } = args;
    const { win, twitchClient, config } = context;
    
    // Do something...
    
    return {
      success: true,
      result: { ... }
    };
  }
);
```

2. **Update context in `main.js` if needed:**

```javascript
jarvisRegistry.setContext({
  win,
  twitchClient,
  config: loadedConfig,
  triggerButtonFn: triggerButtonWithDebounce,
  // Add new context here
});
```

3. **Update this documentation** with the new tool.

## Future Enhancements

- [ ] Complete volume control integration (Windows audio APIs)
- [ ] Complete microphone mute integration (Windows audio APIs)
- [ ] Add OBS control tools (scene switching, recording, streaming)
- [ ] Add more VTube Studio integration tools
- [ ] Add Discord webhook tools
- [ ] Add file system tools (read logs, check files)
- [ ] Add monitoring tools (CPU, memory, disk usage)
- [ ] Add rate limiting per tool
- [ ] Add tool execution history/logging
- [ ] Add tool execution metrics

## Integration with Raven Voice Assistant

To integrate JARVIS with Raven (or other voice assistants):

1. **Install Dependencies**: Raven should have `http` (built-in) or `node-fetch` available

2. **Load Auth Token**: Use the RavenJarvisBridge helper (see above) or manually read `.vd-auth-token`

3. **Voice → LLM → Tool Flow**:
   ```
   User speaks → Raven STT → LLM decides action → RavenJarvisBridge.exec() → VirtualDeck
   ```

4. **Example Integration**:
   ```javascript
   const { RavenJarvisBridge } = require('./path/to/examples/raven-jarvis-bridge');
   
   // In your Raven LLM handler
   async function handleVoiceCommand(transcription, intent) {
     const bridge = new RavenJarvisBridge();
     
     if (intent.action === 'play_sound') {
       await bridge.exec('play_sound', { name: intent.soundName });
       return 'Playing sound';
     }
     
     if (intent.action === 'change_scene') {
       await bridge.exec('change_scene', { sceneName: intent.sceneName });
       return 'Scene changed';
     }
     
     // ... more intent handlers
   }
   ```

5. **Available Tool List**: Call `bridge.listTools()` to get all available tools and their schemas for LLM function calling

## Troubleshooting

### Server won't start

1. Check if port 8091 is already in use
2. Set a different port: `JARVIS_PORT=8092`
3. Check console logs for errors

### 401 Unauthorized

Make sure to include one of the auth headers (`X-VD-Auth`, `X-Jarvis-Token`, or `Authorization: Bearer`) with the token from your `.vd-auth-token` file:
- **Windows**: `%APPDATA%\virtualdeck\.vd-auth-token`
- **macOS**: `~/Library/Application Support/virtualdeck/.vd-auth-token`
- **Linux**: `~/.config/virtualdeck/.vd-auth-token`

### Tool returns "VirtualDeck window not available"

VirtualDeck main window must be running. Some tools require the renderer process to be ready.

### Scene change not working

1. Make sure Meld Studio is running
2. Check that Meld WebChannel is connected (port 13376)
3. Check browser console in VirtualDeck DevTools (F12)

### Twitch message not sending

1. Make sure Twitch is connected in VirtualDeck
2. Check that credentials are configured
3. Verify channel name is correct
