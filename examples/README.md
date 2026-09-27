# JARVIS API Examples

This directory contains example code demonstrating how to interact with VirtualDeck's JARVIS tool API.

## Prerequisites

1. VirtualDeck must be running with JARVIS server enabled
2. Node.js and npm installed (for Node.js examples)
3. Optional: Set `JARVIS_TOKEN` in `.env` if authentication is enabled

## Examples

### Node.js Client Example

**File:** `jarvis-client-example.js`

A complete JavaScript client demonstrating:
- Health checks
- Listing available tools
- Invoking tools with arguments
- Error handling
- WebSocket connection (commented out)

**Run it:**
```bash
node examples/jarvis-client-example.js
```

**With authentication:**
```bash
JARVIS_TOKEN=your-token-here node examples/jarvis-client-example.js
```

### cURL Examples

**List tools:**
```bash
curl http://127.0.0.1:8081/jarvis/tools
```

**Get stream status:**
```bash
curl -X POST http://127.0.0.1:8081/jarvis/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_stream_status", "arguments": {}}'
```

**Change scene:**
```bash
curl -X POST http://127.0.0.1:8081/jarvis/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool": "change_scene", "arguments": {"sceneName": "BRB Scene"}}'
```

**With authentication:**
```bash
curl -H "X-Jarvis-Token: your-token-here" \
  http://127.0.0.1:8081/jarvis/tools
```

### Python Example

```python
import requests

JARVIS_URL = "http://127.0.0.1:8081"
JARVIS_TOKEN = None  # Set if authentication is enabled

headers = {"Content-Type": "application/json"}
if JARVIS_TOKEN:
    headers["X-Jarvis-Token"] = JARVIS_TOKEN

# List tools
response = requests.get(f"{JARVIS_URL}/jarvis/tools", headers=headers)
tools = response.json()
print(f"Found {tools['count']} tools")

# Invoke a tool
response = requests.post(
    f"{JARVIS_URL}/jarvis/invoke",
    headers=headers,
    json={
        "tool": "get_stream_status",
        "arguments": {}
    }
)
result = response.json()
print(result)
```

## LLM/AI Agent Integration

For integrating with AI agents like Grok, GPT, or Claude:

### 1. Tool Discovery

First, have the agent discover available tools:

```javascript
const tools = await fetch('http://127.0.0.1:8081/jarvis/tools').then(r => r.json());
```

### 2. Tool Schema

Each tool includes a JSON schema describing its parameters:

```json
{
  "name": "change_scene",
  "description": "Switch to a different Meld Studio scene",
  "parameters": {
    "type": "object",
    "properties": {
      "sceneName": {
        "type": "string",
        "description": "Name of the scene to switch to"
      }
    },
    "required": ["sceneName"]
  }
}
```

### 3. Tool Invocation

The agent can then invoke tools based on user intent:

```javascript
// User says: "Switch to the BRB scene"
const result = await fetch('http://127.0.0.1:8081/jarvis/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool: 'change_scene',
    arguments: { sceneName: 'BRB Scene' }
  })
}).then(r => r.json());

// Response:
// {
//   "success": true,
//   "result": {
//     "success": true,
//     "scene": "BRB Scene",
//     "note": "Scene change requested via Meld client"
//   }
// }
```

### 4. Error Handling

Tools return structured success/error responses:

```javascript
{
  "success": false,
  "error": "Twitch client not connected"
}
```

### Example AI Agent Workflow

1. **Discovery**: Agent fetches tool list at startup
2. **Intent Recognition**: User says "play the airhorn sound"
3. **Tool Mapping**: Agent maps to `play_sound` tool
4. **Validation**: Agent checks required parameters
5. **Invocation**: Agent calls API with parameters
6. **Response**: Agent confirms action to user

## WebSocket for Streaming

For long-running operations or real-time updates, use WebSocket:

```javascript
const ws = new WebSocket('ws://127.0.0.1:8081/jarvis/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 'req-1',
    tool: 'get_scenes',
    arguments: {}
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Tool result:', response);
};
```

## Security Best Practices

1. **Localhost Only**: Server binds to 127.0.0.1 by default
2. **Token Auth**: Set `JARVIS_TOKEN` for additional security
3. **Network Isolation**: Don't expose the API to external networks
4. **Tool Restrictions**: Only whitelisted tools are available
5. **Input Validation**: All tool parameters are validated

## Troubleshooting

### Connection Refused

Make sure VirtualDeck is running:
```bash
# Check if server is listening
curl http://127.0.0.1:8081/jarvis/health
```

### 401 Unauthorized

Include the auth token:
```bash
curl -H "X-Jarvis-Token: your-token" http://127.0.0.1:8081/jarvis/tools
```

### Tool Returns Error

Check the error message:
```json
{
  "success": false,
  "error": "VirtualDeck window not available"
}
```

This usually means VirtualDeck isn't fully loaded yet.

## Next Steps

- See `docs/jarvis-tools.md` for complete API documentation
- Check available tools and their parameters
- Build your own AI agent integration
- Submit PRs for new tools or improvements!
