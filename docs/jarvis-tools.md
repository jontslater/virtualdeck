# JARVIS Tool API

The JARVIS Tool API provides a controlled set of tools for LLM brain integration with VirtualDeck. This allows an AI agent (like Grok) to control VirtualDeck functionality through a clean HTTP/WebSocket interface instead of unrestricted system access.

## Architecture

- **Tool Registry** (`jarvis-tools.js`): Defines all available tools with schemas and handlers
- **HTTP/WS Server** (`jarvis-server.js`): Exposes tools via REST and WebSocket APIs
- **Integration** (`main.js`): Wires tools to VirtualDeck functionality

## Configuration

Set these environment variables in `.env`:

```env
# JARVIS server settings
JARVIS_PORT=8081           # Port for JARVIS API (default: 8081)
JARVIS_HOST=127.0.0.1      # Host to bind to (default: 127.0.0.1, localhost only)
JARVIS_TOKEN=your-secret-token-here  # Optional auth token for API access
```

### Security

- **Default**: Server binds to `127.0.0.1` (localhost only) for security
- **Auth**: Set `JARVIS_TOKEN` to require `X-Jarvis-Token` header on all requests
- **Without token**: API is open but only accessible from localhost

## API Endpoints

### List Available Tools

```http
GET http://127.0.0.1:8081/jarvis/tools
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
POST http://127.0.0.1:8081/jarvis/tools/:toolName
X-Jarvis-Token: your-secret-token-here

{
  "nameOrPath": "notepad.exe"
}
```

### Invoke a Tool (Method 2)

```http
POST http://127.0.0.1:8081/jarvis/invoke
X-Jarvis-Token: your-secret-token-here

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
GET http://127.0.0.1:8081/jarvis/health
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

Connect to `ws://127.0.0.1:8081/jarvis/ws` for streaming tool calls.

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

**Status:** Stub implementation - wire to actual volume control when available.

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

**Status:** Stub implementation - wire to actual microphone control when available.

## Testing

### Using curl

List tools:
```bash
curl http://127.0.0.1:8081/jarvis/tools
```

With authentication:
```bash
curl -H "X-Jarvis-Token: your-secret-token-here" http://127.0.0.1:8081/jarvis/tools
```

Invoke a tool:
```bash
curl -X POST http://127.0.0.1:8081/jarvis/invoke \
  -H "Content-Type: application/json" \
  -H "X-Jarvis-Token: your-secret-token-here" \
  -d '{
    "tool": "get_stream_status",
    "arguments": {}
  }'
```

### Using Node.js

```javascript
const response = await fetch('http://127.0.0.1:8081/jarvis/invoke', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Jarvis-Token': 'your-secret-token-here'
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
const ws = new WebSocket('ws://127.0.0.1:8081/jarvis/ws');

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

⚠️ **Stubbed (TODO):**
- `set_volume` - Needs volume control API integration
- `mute_mic` / `unmute_mic` - Needs microphone control integration

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

- [ ] Wire volume control tools to actual audio API
- [ ] Wire microphone mute tools to actual audio API
- [ ] Add OBS control tools (scene switching, recording, streaming)
- [ ] Add more VTube Studio integration tools
- [ ] Add Discord webhook tools
- [ ] Add file system tools (read logs, check files)
- [ ] Add monitoring tools (CPU, memory, disk usage)
- [ ] Add rate limiting per tool
- [ ] Add tool execution history/logging
- [ ] Add WebSocket authentication
- [ ] Add tool execution metrics

## Troubleshooting

### Server won't start

1. Check if port 8081 is already in use
2. Set a different port: `JARVIS_PORT=8082`
3. Check console logs for errors

### 401 Unauthorized

Make sure to include the `X-Jarvis-Token` header with the correct token from your `.env` file.

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
