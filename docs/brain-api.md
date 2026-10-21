# VirtualDeck Brain API

> **Phase 3**: Brain-facing local HTTP/WebSocket interface for external AI agents (Grok, Cursor Grok Bot, Claude, etc.)

## Overview

The VirtualDeck Brain API provides a **localhost-only**, **authenticated**, **tool-discovery** interface for AI agents to control VirtualDeck functionality without requiring click automation or unrestricted PC access.

### Key Principles

✅ **Allowlist-only**: Only explicitly registered tools are exposed  
✅ **Localhost-only**: Default binding to `127.0.0.1` for security  
✅ **Authenticated**: Shared token-based auth (`X-VD-Auth`, `X-Jarvis-Token`, or `Bearer`)  
✅ **Schema-driven**: All tools expose JSON Schema for LLM function calling  
✅ **No PC control expansion**: This API will never provide shell access or click automation  

---

## Quick Start

### 1. Start VirtualDeck

The JARVIS server (Brain API backend) starts automatically when VirtualDeck launches.

Console output:
```
[JARVIS Server] Listening on http://127.0.0.1:8091
[JARVIS Server] WebSocket endpoint: ws://127.0.0.1:8091/jarvis/ws
[JARVIS Server] Auth required: X-Jarvis-Token, X-VD-Auth, or Authorization: Bearer <token>
```

### 2. Locate Your Auth Token

VirtualDeck generates a shared auth token on first startup:

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\virtualdeck\.vd-auth-token` |
| macOS    | `~/Library/Application Support/virtualdeck/.vd-auth-token` |
| Linux    | `~/.config/virtualdeck/.vd-auth-token` |

**Read the token:**

```bash
# Windows PowerShell
Get-Content $env:APPDATA\virtualdeck\.vd-auth-token

# Windows CMD
type %APPDATA%\virtualdeck\.vd-auth-token

# macOS/Linux
cat ~/.config/virtualdeck/.vd-auth-token
```

### 3. Discover Tools

```bash
curl -H "X-VD-Auth: <your-token>" http://127.0.0.1:8091/jarvis/tools
```

Response:
```json
{
  "tools": [
    {
      "name": "get_stream_status",
      "description": "Get current streaming status and configuration",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    },
    ...
  ],
  "count": 11
}
```

### 4. Invoke a Tool

```bash
curl -X POST http://127.0.0.1:8091/jarvis/invoke \
  -H "Content-Type: application/json" \
  -H "X-VD-Auth: <your-token>" \
  -d '{
    "tool": "get_stream_status",
    "arguments": {}
  }'
```

Response:
```json
{
  "success": true,
  "result": {
    "connected": true,
    "channel": "#mychannel",
    "username": "myuser",
    "overlayServerRunning": true,
    "overlayPort": 8080
  }
}
```

---

## API Reference

### Base URL

```
http://127.0.0.1:8091
```

**Note**: The server binds to localhost only by default. For remote access (e.g., Cursor Grok Bot running on a different machine), you'll need an SSH tunnel or reverse proxy. See [Remote Access](#remote-access) below.

---

### Authentication

All endpoints require authentication via one of these header formats:

| Header | Format | Use Case |
|--------|--------|----------|
| `X-VD-Auth` | `X-VD-Auth: <token>` | **Recommended** for VirtualDeck integrations |
| `X-Jarvis-Token` | `X-Jarvis-Token: <token>` | Legacy JARVIS-specific |
| `Authorization` | `Authorization: Bearer <token>` | Standard OAuth-style |

**Token Source**: Read from `.vd-auth-token` file (see [Quick Start](#2-locate-your-auth-token))

**401 Unauthorized** responses indicate missing or invalid token.

---

### Endpoints

#### `GET /jarvis/tools`

List all available tools with their schemas.

**Request:**
```http
GET /jarvis/tools HTTP/1.1
Host: 127.0.0.1:8091
X-VD-Auth: <token>
```

**Response:**
```json
{
  "tools": [
    {
      "name": "tool_name",
      "description": "What the tool does",
      "parameters": {
        "type": "object",
        "properties": {
          "param1": {
            "type": "string",
            "description": "Parameter description"
          }
        },
        "required": ["param1"]
      }
    }
  ],
  "count": 11
}
```

**Schema Format**: Parameters follow [JSON Schema](https://json-schema.org/) conventions, making them directly usable for LLM function calling.

---

#### `POST /jarvis/invoke`

Invoke a tool by name with arguments.

**Request:**
```http
POST /jarvis/invoke HTTP/1.1
Host: 127.0.0.1:8091
Content-Type: application/json
X-VD-Auth: <token>

{
  "tool": "tool_name",
  "arguments": {
    "param1": "value1"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "result": {
    "key": "value"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

#### `POST /jarvis/tools/:name`

Alternative invocation method: pass arguments directly as request body.

**Request:**
```http
POST /jarvis/tools/get_stream_status HTTP/1.1
Host: 127.0.0.1:8091
Content-Type: application/json
X-VD-Auth: <token>

{}
```

**Response**: Same as `/jarvis/invoke`

---

#### `GET /jarvis/health`

Health check endpoint.

**Request:**
```http
GET /jarvis/health HTTP/1.1
Host: 127.0.0.1:8091
X-VD-Auth: <token>
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123.456
}
```

---

### WebSocket API (Optional)

For real-time bidirectional communication.

**Endpoint**: `ws://127.0.0.1:8091/jarvis/ws?token=<token>`

**Authentication**: Pass token as query parameter (`?token=<token>`)

**Message Format (Client → Server):**
```json
{
  "id": "unique-request-id",
  "tool": "tool_name",
  "arguments": {
    "param1": "value1"
  }
}
```

**Message Format (Server → Client):**
```json
{
  "id": "unique-request-id",
  "success": true,
  "result": {
    "key": "value"
  }
}
```

**Error Response:**
```json
{
  "id": "unique-request-id",
  "success": false,
  "error": "Error message"
}
```

**Welcome Message**: On connection, the server sends:
```json
{
  "type": "welcome",
  "message": "Connected to JARVIS tool server",
  "version": "1.0.0"
}
```

---

## Available Tools

For the complete list of tools with detailed schemas and examples, see:
- [JARVIS Tools Documentation](./jarvis-tools.md)
- [JARVIS Quick Start](../JARVIS-QUICKSTART.md)

### Tool Categories

| Category | Tools | Status |
|----------|-------|--------|
| **Streaming** | `get_stream_status`, `send_twitch_message` | ✅ Wired |
| **Scene Control** | `change_scene`, `get_scenes` | ✅ Wired |
| **Audio/Triggers** | `play_sound`, `trigger_button`, `run_macro` | ✅ Wired |
| **System** | `launch_app` | ✅ Wired |
| **Audio Control** | `set_volume`, `mute_mic`, `unmute_mic` | ⚠️ Stubbed (TODO) |

---

## LLM Function Calling Integration

The Brain API is designed to work seamlessly with LLM function calling systems (OpenAI, Anthropic, etc.).

### Step 1: Fetch Tool Schemas

```javascript
const response = await fetch('http://127.0.0.1:8091/jarvis/tools', {
  headers: { 'X-VD-Auth': authToken }
});
const { tools } = await response.json();
```

### Step 2: Convert to LLM Function Format

The `parameters` field in each tool is already JSON Schema-compatible. Example conversion for OpenAI:

```javascript
const openAIFunctions = tools.map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters
}));
```

### Step 3: Handle Function Calls

When the LLM returns a function call:

```javascript
async function executeLLMFunction(functionName, functionArgs) {
  const response = await fetch('http://127.0.0.1:8091/jarvis/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VD-Auth': authToken
    },
    body: JSON.stringify({
      tool: functionName,
      arguments: functionArgs
    })
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return result.result;
}
```

---

## Remote Access

By default, the JARVIS server binds to `127.0.0.1` (localhost only). For remote AI agents (e.g., Cursor Grok Bot running on a cloud VM), you need a tunnel.

### Option 1: SSH Tunnel (Recommended)

On the remote machine running the AI agent:

```bash
ssh -L 8091:127.0.0.1:8091 user@virtualdeck-host
```

Now the remote agent can access `http://127.0.0.1:8091` as if it were local.

### Option 2: Reverse Proxy (Advanced)

Use nginx, Caddy, or similar to expose the JARVIS API over HTTPS. **Not recommended** unless you have proper firewall rules and strong authentication.

### Option 3: Change Binding (Dangerous)

Set `JARVIS_HOST=0.0.0.0` to bind to all interfaces. **Only do this on a trusted network** with firewall rules in place.

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | Success | Tool executed successfully |
| `400` | Bad Request | Missing `tool` field, invalid JSON |
| `401` | Unauthorized | Missing or invalid auth token |
| `404` | Not Found | Unknown endpoint |
| `500` | Internal Server Error | Tool handler threw an error |

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

Or for tool invocations:

```json
{
  "success": false,
  "error": "Tool-specific error message"
}
```

### Common Errors

#### `401 Unauthorized`

**Cause**: Missing or invalid auth token

**Solution**: Include `X-VD-Auth`, `X-Jarvis-Token`, or `Authorization: Bearer` header with token from `.vd-auth-token`

#### `Tool '<name>' not found`

**Cause**: Requested tool doesn't exist

**Solution**: Call `GET /jarvis/tools` to get the current tool list

#### `VirtualDeck window not available`

**Cause**: VirtualDeck is not fully loaded or has crashed

**Solution**: Restart VirtualDeck

#### `Twitch client not connected`

**Cause**: Twitch integration is not set up or disconnected

**Solution**: Configure Twitch credentials in VirtualDeck

---

## Security Model

### Threat Model

The Brain API is designed for **local AI agents on the same machine** or **trusted remote agents via SSH tunnel**.

**In Scope:**
- ✅ Localhost-only binding by default
- ✅ Token-based authentication
- ✅ Allowlist of safe tools
- ✅ No shell access or click automation

**Out of Scope:**
- ❌ Public internet exposure (use tunnels if needed)
- ❌ Multi-user authentication (single shared token per VirtualDeck instance)
- ❌ Rate limiting (trust model assumes cooperative agents)

### Allowlist Philosophy

The Brain API will **never** expand to include:
- Shell command execution
- Click/keyboard automation
- File system manipulation outside VirtualDeck's data directories
- Arbitrary process spawning

**Why?** VirtualDeck is a paid product for streamers who bring their own API keys (Twitch, etc.). We control what the "brain" can do, not the other way around.

---

## Example Client Code

See [examples/brain-http-client.js](../examples/brain-http-client.js) for a complete Node.js example that:
- Loads the auth token automatically
- Lists available tools
- Invokes `get_stream_status` with authentication
- Handles errors gracefully

**Run the example:**
```bash
node examples/brain-http-client.js
```

---

## Configuration

Set these environment variables in `.env` (optional):

```env
# JARVIS server settings
JARVIS_PORT=8091           # Port for Brain API (default: 8091)
JARVIS_HOST=127.0.0.1      # Host to bind to (default: 127.0.0.1)
JARVIS_TOKEN=custom-token  # Override auto-generated token
```

**Note**: If `JARVIS_TOKEN` is not set, the server uses the shared `.vd-auth-token` from VirtualDeck's SecurityManager.

---

## MCP Integration (Future)

For **Model Context Protocol (MCP)** support, see [docs/mcp-roadmap.md](./mcp-roadmap.md).

**TL;DR**: A future Cursor MCP server can wrap this Brain API with minimal code, making VirtualDeck tools available directly in Cursor's AI agents.

---

## Troubleshooting

### Server won't start

**Symptoms**: No console output, connection refused

**Check**:
1. Is port 8091 already in use? Set `JARVIS_PORT=8092` in `.env`
2. Check VirtualDeck console logs for errors
3. Try `curl http://127.0.0.1:8091/jarvis/health` (should get 401 without token)

### 401 Unauthorized

**Symptoms**: `{"error": "Unauthorized"}`

**Check**:
1. Auth token file exists at the correct path
2. Token is passed in one of the supported headers
3. No extra whitespace in the token

### Tool returns errors

**Symptoms**: `{"success": false, "error": "..."}`

**Check**:
1. VirtualDeck is fully loaded (not just starting up)
2. For `change_scene`/`get_scenes`: Meld Studio is running
3. For `send_twitch_message`: Twitch is connected
4. For `set_volume`/`mute_mic`: These are not yet implemented (see [JARVIS Tools](./jarvis-tools.md))

### WebSocket disconnects immediately

**Symptoms**: Connection closes with 1008 code

**Check**:
1. Token is passed as query parameter: `?token=<token>`
2. Token is valid (same as HTTP auth)
3. No proxy interfering with WebSocket upgrade

---

## Support & Contributing

- **Issues**: [GitHub Issues](https://github.com/jontslater/virtualdeck/issues)
- **Documentation**: This file, [JARVIS-QUICKSTART.md](../JARVIS-QUICKSTART.md), [docs/jarvis-tools.md](./jarvis-tools.md)
- **Examples**: [examples/](../examples/)

---

## Appendix: Architecture Diagram

```
┌─────────────────────────────────────────────┐
│         External AI Brain                   │
│  (Grok, Cursor Grok Bot, Claude, Raven)     │
└───────────────┬─────────────────────────────┘
                │
                │ HTTP/WS (localhost or SSH tunnel)
                │ Auth: X-VD-Auth token
                │
┌───────────────▼─────────────────────────────┐
│         JARVIS HTTP/WS Server               │
│           (jarvis-server.js)                │
│                                             │
│  • GET  /jarvis/tools    → List tools       │
│  • POST /jarvis/invoke   → Execute tool     │
│  • WS   /jarvis/ws       → Streaming        │
│  • Auth middleware                          │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│         Tool Registry                       │
│        (jarvis-tools.js)                    │
│                                             │
│  • Allowlisted tools only                   │
│  • JSON Schema for parameters               │
│  • Handler functions                        │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│         VirtualDeck Core                    │
│           (main.js, renderer)               │
│                                             │
│  • Twitch integration                       │
│  • Meld Studio (OBS-style scenes)           │
│  • Audio triggers                           │
│  • Overlay server (port 8080)               │
└─────────────────────────────────────────────┘
```

---

## Related Documentation

- **[JARVIS Quick Start](../JARVIS-QUICKSTART.md)** - Fastest way to get started
- **[JARVIS Tools Reference](./jarvis-tools.md)** - Complete tool documentation with examples
- **[MCP Roadmap](./mcp-roadmap.md)** - Future Model Context Protocol integration
- **[Security Summary](./SECURITY_SUMMARY.md)** - VirtualDeck security architecture
- **[Examples Directory](../examples/README.md)** - Sample client code

---

**Last Updated**: 2026-09-27  
**API Version**: 1.0.0  
**VirtualDeck**: Phase 3 (Brain API)
