# JARVIS Tool API - Quick Start

> **Phase 1 Complete** ✅ - Basic tool scaffold with core VirtualDeck integration

## What is JARVIS?

JARVIS is VirtualDeck's tool API layer for controlled LLM/AI agent integration. Instead of giving an AI unrestricted PC access, JARVIS provides a clean set of named tools with schemas and handlers.

## Quick Setup

### 1. Configure (Optional)

Add to `.env` (or use defaults):
```env
JARVIS_PORT=8091
JARVIS_HOST=127.0.0.1
JARVIS_TOKEN=your-secret-token-here
```

### 2. Start VirtualDeck

JARVIS server starts automatically when VirtualDeck launches.

Look for console output:
```
[JARVIS Server] Listening on http://127.0.0.1:8091
[JARVIS Server] WebSocket endpoint: ws://127.0.0.1:8091/jarvis/ws
```

### 3. Test It

```bash
# List available tools
curl http://127.0.0.1:8091/jarvis/tools

# Get stream status
curl -X POST http://127.0.0.1:8091/jarvis/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_stream_status", "arguments": {}}'
```

## Available Tools

| Tool | Status | Description |
|------|--------|-------------|
| `launch_app` | ✅ Wired | Launch applications by path |
| `change_scene` | ✅ Wired | Switch Meld Studio scenes |
| `get_scenes` | ✅ Wired | List available Meld scenes |
| `get_stream_status` | ✅ Wired | Get Twitch connection info |
| `trigger_button` | ✅ Wired | Trigger VirtualDeck buttons |
| `play_sound` | ✅ Wired | Play sounds from library |
| `run_macro` | ✅ Wired | Execute button macros |
| `send_twitch_message` | ✅ Wired | Send Twitch chat messages |
| `set_volume` | ⚠️ Stub | Volume control (TODO) |
| `mute_mic` | ⚠️ Stub | Mute microphone (TODO) |
| `unmute_mic` | ⚠️ Stub | Unmute microphone (TODO) |

## Example: Change Scene

```bash
curl -X POST http://127.0.0.1:8091/jarvis/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "change_scene",
    "arguments": {
      "sceneName": "BRB Scene"
    }
  }'
```

Response:
```json
{
  "success": true,
  "result": {
    "success": true,
    "scene": "BRB Scene",
    "note": "Scene change requested via Meld client"
  }
}
```

## Example: Play Sound

```bash
curl -X POST http://127.0.0.1:8091/jarvis/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "play_sound",
    "arguments": {
      "name": "airhorn"
    }
  }'
```

## Example: Send Twitch Message

```bash
curl -X POST http://127.0.0.1:8091/jarvis/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "send_twitch_message",
    "arguments": {
      "text": "Thanks for the follow!"
    }
  }'
```

## For AI Agents

### 1. Tool Discovery

```javascript
const tools = await fetch('http://127.0.0.1:8091/jarvis/tools')
  .then(r => r.json());
// Returns: { tools: [...], count: 11 }
```

### 2. Tool Invocation

```javascript
const result = await fetch('http://127.0.0.1:8091/jarvis/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool: 'play_sound',
    arguments: { name: 'applause' }
  })
}).then(r => r.json());
```

### 3. Error Handling

All tools return structured responses:
```json
{
  "success": true,
  "result": { ... }
}
```

Or on error:
```json
{
  "success": false,
  "error": "Error message"
}
```

## WebSocket API

For streaming/real-time updates:

```javascript
const ws = new WebSocket('ws://127.0.0.1:8091/jarvis/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 'req-1',
    tool: 'get_scenes',
    arguments: {}
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log(response);
};
```

## Security

- **Localhost only**: Server binds to `127.0.0.1` by default
- **Optional auth**: Set `JARVIS_TOKEN` to require `X-Jarvis-Token` header
- **Controlled access**: Only whitelisted tools are available
- **No raw PC access**: All operations go through validated tool handlers

## Testing

Run the test suite:
```bash
node test-jarvis-api.js
```

Try the example client:
```bash
node examples/jarvis-client-example.js
```

## Documentation

- **Full API docs**: `docs/jarvis-tools.md`
- **Examples**: `examples/README.md`
- **This quickstart**: `JARVIS-QUICKSTART.md`

## Architecture

```
┌─────────────────┐
│   LLM Brain     │  (Grok, GPT, Claude, etc.)
│   (External)    │
└────────┬────────┘
         │ HTTP/WS
         │ Port 8091
         │
┌────────▼────────┐
│ JARVIS Server   │  (jarvis-server.js)
│  HTTP + WS API  │
└────────┬────────┘
         │
┌────────▼────────┐
│ Tool Registry   │  (jarvis-tools.js)
│ name → handler  │
└────────┬────────┘
         │
┌────────▼────────┐
│  VirtualDeck    │  (main.js, renderer)
│   Internals     │
└─────────────────┘
```

## What's Next?

Phase 1 ✅ Complete:
- Tool registry scaffold
- HTTP/WebSocket server
- Core tools wired
- Documentation

Phase 2 (Future):
- Wire volume/mic control stubs
- Add OBS control tools
- Add monitoring tools
- Rate limiting
- Execution logging

## Troubleshooting

**Server won't start**
- Check if port 8091 is in use
- Set `JARVIS_PORT=8092` in `.env`

**401 Unauthorized**
- Include `X-Jarvis-Token` header if token is set

**Tool returns error**
- Check VirtualDeck is fully loaded
- For scene tools: Ensure Meld Studio is running
- For Twitch tools: Ensure Twitch is connected

## Support

- Report issues on GitHub
- See full docs in `docs/jarvis-tools.md`
- Check examples in `examples/`
