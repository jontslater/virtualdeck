#!/usr/bin/env node
/**
 * Raven/Brain JARVIS Bridge
 * 
 * Lightweight helper module for AI brains (Raven, Grok, etc.) to control
 * VirtualDeck through the JARVIS Tool API.
 * 
 * This bridge provides:
 * - Auto-loading of .vd-auth-token
 * - List all available tools with schemas
 * - Invoke tools by name with arguments
 * - Health check
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

class RavenJarvisBridge {
  /**
   * @param {object} options
   * @param {string} options.baseUrl - JARVIS API base URL (default: http://127.0.0.1:8091)
   * @param {string} options.token - Auth token (auto-loaded from .vd-auth-token if not provided)
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.JARVIS_URL || 'http://127.0.0.1:8091';
    
    // Auto-load token from .vd-auth-token if not provided
    if (options.token) {
      this.token = options.token;
    } else {
      this.token = this.loadToken();
    }
  }

  /**
   * Load auth token from VirtualDeck's .vd-auth-token file
   */
  loadToken() {
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
        const token = fs.readFileSync(tokenPath, 'utf-8').trim();
        console.log(`[Raven JARVIS] Loaded auth token from: ${tokenPath}`);
        return token;
      } else {
        console.warn(`[Raven JARVIS] Warning: .vd-auth-token not found at ${tokenPath}`);
        return null;
      }
    } catch (err) {
      console.error('[Raven JARVIS] Error loading auth token:', err.message);
      return null;
    }
  }

  /**
   * Make HTTP request to JARVIS API
   */
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-VD-Auth': this.token
        }
      };

      const req = http.request(url, options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            if (res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${result.error || result.message || 'Request failed'}`));
            } else {
              resolve(result);
            }
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
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

  /**
   * Check JARVIS server health
   * @returns {Promise<{status: string, version: string, uptime: number}>}
   */
  async health() {
    return this.request('GET', '/jarvis/health');
  }

  /**
   * List all available tools with their schemas
   * @returns {Promise<{tools: Array, count: number}>}
   */
  async listTools() {
    return this.request('GET', '/jarvis/tools');
  }

  /**
   * Get a specific tool's schema
   * @param {string} toolName - Tool name to look up
   * @returns {Promise<object|null>} Tool schema or null if not found
   */
  async getTool(toolName) {
    const { tools } = await this.listTools();
    return tools.find(t => t.name === toolName) || null;
  }

  /**
   * Invoke a tool by name with arguments
   * @param {string} toolName - Tool name to invoke
   * @param {object} args - Tool arguments
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async invoke(toolName, args = {}) {
    return this.request('POST', '/jarvis/invoke', {
      tool: toolName,
      arguments: args
    });
  }

  /**
   * High-level helper: Execute a tool and return result or throw error
   * @param {string} toolName - Tool name to invoke
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool result
   * @throws {Error} If tool invocation fails
   */
  async exec(toolName, args = {}) {
    const response = await this.invoke(toolName, args);
    
    if (response.success) {
      return response.result;
    } else {
      throw new Error(`Tool '${toolName}' failed: ${response.error}`);
    }
  }
}

// Example usage
async function example() {
  const bridge = new RavenJarvisBridge();

  console.log('🤖 Raven JARVIS Bridge Example\n');

  try {
    // 1. Health check
    console.log('1️⃣ Health check...');
    const health = await bridge.health();
    console.log(`   Status: ${health.status} (uptime: ${health.uptime.toFixed(2)}s)\n`);

    // 2. List available tools
    console.log('2️⃣ Available tools:');
    const { tools } = await bridge.listTools();
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // 3. Get stream status
    console.log('3️⃣ Get stream status:');
    const status = await bridge.exec('get_stream_status');
    console.log('   ', JSON.stringify(status, null, 2));
    console.log('');

    // 4. Example invocations (commented out to avoid side effects)
    console.log('4️⃣ Example invocations (not executed):');
    console.log(`   await bridge.exec('play_sound', { name: 'airhorn' });`);
    console.log(`   await bridge.exec('change_scene', { sceneName: 'BRB Scene' });`);
    console.log(`   await bridge.exec('send_twitch_message', { text: 'Hello chat!' });`);
    console.log('');

    console.log('✅ Bridge ready for use!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Export for use as a module
module.exports = { RavenJarvisBridge };

// Run example if executed directly
if (require.main === module) {
  example();
}
