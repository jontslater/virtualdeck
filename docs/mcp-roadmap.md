# VirtualDeck MCP Integration Roadmap

> **Status**: Future / Not Yet Implemented  
> **Priority**: Low (Brain API via HTTP/WS is sufficient for Phase 3)

## Overview

This document outlines how VirtualDeck's Brain API could be exposed via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for seamless integration with Cursor AI agents, Claude Desktop, and other MCP-compatible tools.

**Current State**: VirtualDeck provides a localhost HTTP/WebSocket API (the "Brain API") that external AI agents can consume. This works well for local agents and remote agents via SSH tunneling.

**Future State**: An MCP server would wrap the Brain API, making VirtualDeck tools discoverable and invokable directly within Cursor's agent system without requiring HTTP client code.

---

## Why MCP?

### Benefits

✅ **Native Integration**: VirtualDeck tools appear alongside other MCP servers in Cursor  
✅ **Automatic Discovery**: No need to manually fetch tool schemas  
✅ **Streaming Support**: MCP supports long-running operations  
✅ **Standard Protocol**: Works with any MCP-compatible client (Cursor, Claude Desktop, etc.)  

### Why Not HTTP?

HTTP is **sufficient** for most use cases:
- ✅ Simple to test (curl, browser, Postman)
- ✅ Works with any HTTP client
- ✅ Easy to tunnel (SSH, ngrok, etc.)
- ✅ No protocol learning curve

MCP adds value primarily for **tight integration** with Cursor's agent system and **discoverability** without manual setup.

---

## MCP Server Architecture

### Option 1: Thin MCP Wrapper (Recommended)

The MCP server would be a **thin adapter** that proxies to the existing Brain API:

```
┌─────────────────────────────────────────┐
│      Cursor AI Agent / Claude Desktop   │
└───────────────┬─────────────────────────┘
                │ MCP Protocol (stdio/SSE)
                │
┌───────────────▼─────────────────────────┐
│         VirtualDeck MCP Server          │
│        (virtualdeck-mcp-server)         │
│                                         │
│  • Implements MCP protocol              │
│  • Proxies to http://127.0.0.1:8091     │
│  • Loads .vd-auth-token                 │
│  • Converts MCP calls → HTTP requests   │
└───────────────┬─────────────────────────┘
                │ HTTP/WS
                │
┌───────────────▼─────────────────────────┐
│         JARVIS HTTP/WS Server           │
│           (jarvis-server.js)            │
│                                         │
│  Already implemented ✓                  │
└─────────────────────────────────────────┘
```

**Advantages**:
- ✅ No duplication of tool logic
- ✅ Single source of truth (Brain API)
- ✅ Easy to maintain (MCP server is just translation layer)
- ✅ Brain API remains primary interface

**Implementation**:
```javascript
// virtualdeck-mcp-server.js (pseudocode)
const { MCPServer } = require('@modelcontextprotocol/server');
const { loadAuthToken, brainRequest } = require('./brain-client');

class VirtualDeckMCPServer extends MCPServer {
  constructor() {
    super({ name: 'virtualdeck', version: '1.0.0' });
    this.token = loadAuthToken();
    this.baseUrl = 'http://127.0.0.1:8091';
  }

  async listTools() {
    const response = await brainRequest('GET', '/jarvis/tools', this.token);
    return response.data.tools; // Already in correct format!
  }

  async callTool(name, arguments) {
    const response = await brainRequest('POST', '/jarvis/invoke', this.token, {
      tool: name,
      arguments
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error);
    }
    
    return response.data.result;
  }
}

// Start MCP server (stdio or SSE transport)
const server = new VirtualDeckMCPServer();
server.start();
```

---

### Option 2: Standalone MCP Server

The MCP server would **directly** implement tool logic, bypassing the HTTP layer.

**Disadvantages**:
- ❌ Duplicates tool registry
- ❌ Two codebases to maintain
- ❌ Brain API becomes secondary

**Not Recommended**: Adds complexity without clear benefits.

---

## Remote Access (Cursor Grok Bot)

Cursor's Grok Bot runs on a remote VM, not localhost. The MCP server would need to handle this.

### Option A: MCP Server on Remote VM

Run the MCP server on the same VM as Grok Bot, with an SSH tunnel to VirtualDeck:

```
┌─────────────────────────────┐
│   Cursor Grok Bot (Cloud)   │
└───────────┬─────────────────┘
            │ MCP (stdio)
            │
┌───────────▼─────────────────┐
│   VirtualDeck MCP Server    │  ← Running on cloud VM
│       (Cloud-hosted)        │
└───────────┬─────────────────┘
            │ SSH Tunnel
            │
┌───────────▼─────────────────┐
│   User's PC: Brain API      │
│   http://127.0.0.1:8091     │
└─────────────────────────────┘
```

**Setup**:
```bash
# On user's PC: Start SSH tunnel (keep alive)
ssh -R 8091:127.0.0.1:8091 grokbot-vm

# On Grok Bot VM: Configure MCP server
export JARVIS_HOST=127.0.0.1
export JARVIS_PORT=8091
node virtualdeck-mcp-server.js
```

### Option B: MCP Server on User's PC

Run the MCP server locally, expose it to Grok Bot via reverse SSH:

```
┌─────────────────────────────┐
│   Cursor Grok Bot (Cloud)   │
└───────────┬─────────────────┘
            │ SSH Tunnel (MCP over stdio)
            │
┌───────────▼─────────────────┐
│   User's PC: MCP Server     │
│   + Brain API (both local)  │
└─────────────────────────────┘
```

**Challenges**:
- Requires persistent SSH connection from user's PC → Cloud
- User's PC must be online during agent runs

**Not Recommended**: Option A is simpler.

---

## Implementation Steps (Future)

When we decide to implement MCP support:

### Phase 1: Proof of Concept (1-2 days)

1. **Create MCP server stub**:
   ```bash
   npm install @modelcontextprotocol/server
   ```

2. **Implement `listTools()` and `callTool()`**:
   - Proxy to `http://127.0.0.1:8091/jarvis/tools`
   - Proxy to `http://127.0.0.1:8091/jarvis/invoke`

3. **Test with Cursor**:
   - Add to `.cursor/mcp-config.json`:
     ```json
     {
       "servers": {
         "virtualdeck": {
           "command": "node",
           "args": ["path/to/virtualdeck-mcp-server.js"]
         }
       }
     }
     ```

### Phase 2: Handle Remote Access (1-2 days)

1. **Document SSH tunnel setup** for Grok Bot
2. **Add connection health checks** (ping Brain API before tool calls)
3. **Handle reconnection** if Brain API goes down

### Phase 3: Polish (1 day)

1. **Add error handling** (translate Brain API errors to MCP errors)
2. **Add logging** (debug MCP ↔ Brain API communication)
3. **Package for distribution** (npm package or standalone binary)

**Total Estimated Effort**: 4-5 days

---

## Configuration (Future)

Once implemented, users would configure the MCP server like this:

### Local Use (Cursor on same PC as VirtualDeck)

`.cursor/mcp-config.json`:
```json
{
  "servers": {
    "virtualdeck": {
      "command": "node",
      "args": ["/path/to/virtualdeck-mcp-server.js"],
      "env": {
        "JARVIS_HOST": "127.0.0.1",
        "JARVIS_PORT": "8091"
      }
    }
  }
}
```

### Remote Use (Cursor Grok Bot)

On Grok Bot VM, same config, but **with SSH tunnel established first**:

```bash
# User runs on their PC (keep alive):
ssh -R 8091:127.0.0.1:8091 grokbot-vm -N

# Grok Bot uses same MCP config as above
```

---

## Authentication

The MCP server would load `.vd-auth-token` **from the user's PC**, not from Grok Bot's VM.

### Option 1: Read from Standard Path (Local Only)

```javascript
// Works when MCP server is on same PC as VirtualDeck
const tokenPath = path.join(
  process.env.APPDATA || process.env.HOME,
  'virtualdeck',
  '.vd-auth-token'
);
const token = fs.readFileSync(tokenPath, 'utf-8').trim();
```

### Option 2: Environment Variable (Remote Use)

```bash
# On user's PC: Read token
TOKEN=$(cat ~/.config/virtualdeck/.vd-auth-token)

# Pass to Grok Bot via SSH
ssh grokbot-vm "export VD_AUTH_TOKEN=$TOKEN && node virtualdeck-mcp-server.js"
```

### Option 3: Config File (Best for Remote)

MCP server config includes token:

```json
{
  "servers": {
    "virtualdeck": {
      "command": "node",
      "args": ["/path/to/virtualdeck-mcp-server.js"],
      "env": {
        "VD_AUTH_TOKEN": "user-copies-token-here"
      }
    }
  }
}
```

---

## Alternatives to MCP

If MCP proves too complex, these alternatives exist:

### 1. HTTP Client Library for Cursor

Package the Brain API client as an npm library:

```bash
npm install virtualdeck-client
```

```javascript
const { VirtualDeckClient } = require('virtualdeck-client');

const vd = new VirtualDeckClient(); // Auto-loads token
const tools = await vd.listTools();
await vd.invoke('play_sound', { name: 'airhorn' });
```

**Advantages**:
- ✅ No protocol complexity
- ✅ Works with any Node.js environment
- ✅ Easy to test and debug

### 2. Cursor Plugin/Extension

If Cursor supports custom plugins, write a VirtualDeck plugin:

```javascript
// virtualdeck-cursor-plugin.js
export default {
  name: 'VirtualDeck',
  tools: async () => {
    const response = await fetch('http://127.0.0.1:8091/jarvis/tools');
    return response.json();
  },
  invoke: async (tool, args) => {
    const response = await fetch('http://127.0.0.1:8091/jarvis/invoke', {
      method: 'POST',
      body: JSON.stringify({ tool, arguments: args })
    });
    return response.json();
  }
};
```

### 3. Just Document HTTP API (Current Approach)

AI agents can call the HTTP API directly using their built-in `fetch` or HTTP client:

**Advantages**:
- ✅ No extra code to maintain
- ✅ Universal compatibility
- ✅ Easy to curl-test

**Disadvantages**:
- ❌ Not as integrated with Cursor's UI
- ❌ Agent must implement HTTP client logic

---

## Decision: When to Implement MCP

**Implement MCP when:**
- ✅ Users request it (prove demand first)
- ✅ Cursor's MCP support is stable and well-documented
- ✅ HTTP API is insufficient for specific use cases

**Don't implement MCP if:**
- ❌ HTTP API handles all use cases
- ❌ Users prefer HTTP for flexibility
- ❌ MCP adds maintenance burden without clear benefits

**Current Recommendation**: **Wait and see**. The Brain API is sufficient for Phase 3. Revisit MCP in 3-6 months based on user feedback.

---

## Related Documentation

- **[Brain API](./brain-api.md)** - Current HTTP/WS interface (Phase 3)
- **[JARVIS Tools](./jarvis-tools.md)** - Available tools and schemas
- **[MCP Specification](https://modelcontextprotocol.io/)** - Official MCP docs
- **[Cursor MCP Guide](https://docs.cursor.com/mcp)** - Cursor-specific MCP setup

---

## Appendix: MCP vs HTTP Feature Comparison

| Feature | HTTP API | MCP |
|---------|----------|-----|
| **Tool Discovery** | `GET /jarvis/tools` | `listTools()` |
| **Tool Invocation** | `POST /jarvis/invoke` | `callTool()` |
| **Authentication** | HTTP headers | MCP config |
| **Streaming** | WebSocket | MCP streaming |
| **Remote Access** | SSH tunnel | SSH tunnel |
| **Cursor Integration** | Manual fetch | Native |
| **Testing** | curl, Postman | MCP client |
| **Maintenance** | Single codebase | Two codebases |
| **Flexibility** | Universal | MCP clients only |

**Conclusion**: HTTP API wins on simplicity and universality. MCP wins on tight Cursor integration. For Phase 3, HTTP is sufficient.

---

**Last Updated**: 2026-09-27  
**Status**: Roadmap / Not Implemented  
**Decision**: Defer until user demand is proven
