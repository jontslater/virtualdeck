/**
 * JARVIS HTTP & WebSocket Server
 * 
 * Exposes the tool registry via:
 * - GET  /jarvis/tools - List all available tools
 * - POST /jarvis/tools/:name - Invoke a specific tool
 * - POST /jarvis/invoke - Invoke with { tool, arguments } payload
 * - WS   /jarvis/ws - WebSocket for streaming tool calls
 */

const http = require('http');
const { URL } = require('url');
const WebSocket = require('ws');
const { registry } = require('./jarvis-tools');

class JarvisServer {
  constructor(options = {}) {
    this.port = options.port || 8091;
    this.host = options.host || '127.0.0.1'; // Localhost only by default
    this.token = options.token || null; // Auth token (JARVIS_TOKEN or vd-auth-token)
    this.server = null;
    this.wss = null;
  }

  /**
   * Check authorization header if token is configured
   * Supports multiple header formats for flexibility:
   * - X-Jarvis-Token (legacy JARVIS-specific)
   * - X-VD-Auth (shared VirtualDeck auth)
   * - Authorization: Bearer <token>
   */
  isAuthorized(req) {
    if (!this.token) {
      return true; // No token required
    }

    // Check X-Jarvis-Token (legacy)
    const jarvisHeader = req.headers['x-jarvis-token'];
    if (jarvisHeader === this.token) {
      return true;
    }

    // Check X-VD-Auth (shared VirtualDeck auth)
    const vdAuthHeader = req.headers['x-vd-auth'];
    if (vdAuthHeader === this.token) {
      return true;
    }

    // Check Authorization: Bearer
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1] === this.token) {
        return true;
      }
    }

    return false;
  }

  /**
   * Send JSON response
   */
  sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Jarvis-Token, X-VD-Auth, Authorization'
    });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Handle HTTP requests
   */
  async handleRequest(req, res) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Jarvis-Token, X-VD-Auth, Authorization'
      });
      res.end();
      return;
    }

    // Check authorization
    if (!this.isAuthorized(req)) {
      this.sendJSON(res, 401, {
        error: 'Unauthorized',
        message: 'Missing or invalid auth token. Provide X-Jarvis-Token, X-VD-Auth, or Authorization: Bearer header'
      });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
      // GET /jarvis/tools - List all tools
      if (req.method === 'GET' && pathname === '/jarvis/tools') {
        const tools = registry.list();
        this.sendJSON(res, 200, {
          tools,
          count: tools.length
        });
        return;
      }

      // POST /jarvis/invoke - Invoke with { tool, arguments } body
      if (req.method === 'POST' && pathname === '/jarvis/invoke') {
        const body = await this.readBody(req);
        const { tool, arguments: args } = JSON.parse(body);

        if (!tool) {
          this.sendJSON(res, 400, {
            error: 'Bad Request',
            message: 'Missing "tool" field in request body'
          });
          return;
        }

        const result = await registry.invoke(tool, args || {});
        this.sendJSON(res, result.success ? 200 : 400, result);
        return;
      }

      // POST /jarvis/tools/:name - Invoke specific tool
      if (req.method === 'POST' && pathname.startsWith('/jarvis/tools/')) {
        const toolName = pathname.substring('/jarvis/tools/'.length);
        const body = await this.readBody(req);
        const args = body ? JSON.parse(body) : {};

        const result = await registry.invoke(toolName, args);
        this.sendJSON(res, result.success ? 200 : 400, result);
        return;
      }

      // GET /jarvis/health - Health check
      if (req.method === 'GET' && pathname === '/jarvis/health') {
        this.sendJSON(res, 200, {
          status: 'ok',
          version: '1.0.0',
          uptime: process.uptime()
        });
        return;
      }

      // 404 - Not found
      this.sendJSON(res, 404, {
        error: 'Not Found',
        message: `Path ${pathname} not found`
      });

    } catch (error) {
      console.error('[JARVIS Server] Error handling request:', error);
      this.sendJSON(res, 500, {
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }

  /**
   * Read request body
   */
  readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  /**
   * Handle WebSocket connections
   */
  handleWebSocket(ws, req) {
    // Check WebSocket auth via query param or Sec-WebSocket-Protocol
    if (this.token) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const tokenParam = url.searchParams.get('token');
      const protocolToken = req.headers['sec-websocket-protocol'];
      
      const isValid = tokenParam === this.token || protocolToken === this.token;
      
      if (!isValid) {
        console.log('[JARVIS WS] Unauthorized connection attempt');
        ws.close(1008, 'Unauthorized - provide token query param');
        return;
      }
    }

    console.log('[JARVIS WS] Client connected');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const { id, tool, arguments: args } = message;

        if (!tool) {
          ws.send(JSON.stringify({
            id,
            error: 'Missing "tool" field'
          }));
          return;
        }

        const result = await registry.invoke(tool, args || {});
        ws.send(JSON.stringify({
          id,
          ...result
        }));

      } catch (error) {
        console.error('[JARVIS WS] Error processing message:', error);
        ws.send(JSON.stringify({
          error: error.message
        }));
      }
    });

    ws.on('close', () => {
      console.log('[JARVIS WS] Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('[JARVIS WS] WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to JARVIS tool server',
      version: '1.0.0'
    }));
  }

  /**
   * Start the server
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res).catch(err => {
            console.error('[JARVIS Server] Unhandled error:', err);
          });
        });

        // Create WebSocket server
        this.wss = new WebSocket.Server({ 
          server: this.server,
          path: '/jarvis/ws'
        });

        this.wss.on('connection', (ws, req) => {
          this.handleWebSocket(ws, req);
        });

        // Start listening
        this.server.listen(this.port, this.host, () => {
          console.log(`[JARVIS Server] Listening on http://${this.host}:${this.port}`);
          console.log(`[JARVIS Server] WebSocket endpoint: ws://${this.host}:${this.port}/jarvis/ws`);
          if (this.token) {
            console.log('[JARVIS Server] Auth required: X-Jarvis-Token, X-VD-Auth, or Authorization: Bearer <token>');
          } else {
            console.log('[JARVIS Server] WARNING: No auth token configured - server is open');
          }
          resolve();
        });

        this.server.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close();
      }
      if (this.server) {
        this.server.close(() => {
          console.log('[JARVIS Server] Stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { JarvisServer };
