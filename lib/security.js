const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * VirtualDeck Security Module
 * 
 * Handles authentication tokens, secret generation, and input validation
 * for localhost HTTP/WebSocket servers.
 */

class SecurityManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.tokenPath = path.join(userDataPath, '.vd-auth-token');
    this.token = null;
  }

  /**
   * Generate or load the local auth token.
   * Token is stored in userData and persists across restarts.
   * @returns {string} The auth token
   */
  getOrCreateToken() {
    if (this.token) {
      return this.token;
    }

    try {
      // Try to load existing token
      if (fs.existsSync(this.tokenPath)) {
        const stored = fs.readFileSync(this.tokenPath, 'utf-8').trim();
        if (stored && stored.length >= 32) {
          this.token = stored;
          console.log('✅ [Security] Loaded existing auth token');
          return this.token;
        }
      }
    } catch (err) {
      console.warn('⚠️ [Security] Could not load existing token:', err.message);
    }

    // Generate new token
    this.token = crypto.randomBytes(32).toString('hex');
    
    try {
      fs.writeFileSync(this.tokenPath, this.token, { mode: 0o600 });
      console.log('✅ [Security] Generated new auth token');
      console.log(`📁 Token stored at: ${this.tokenPath}`);
      console.log('ℹ️ [Security] Copy this file to other PCs to sync access');
    } catch (err) {
      console.error('❌ [Security] Failed to save token:', err);
    }

    return this.token;
  }

  /**
   * Validate an incoming auth token against the stored token.
   * @param {string} providedToken - Token from request header or query param
   * @returns {boolean} True if valid
   */
  validateToken(providedToken) {
    if (!providedToken || typeof providedToken !== 'string') {
      return false;
    }

    const expected = this.getOrCreateToken();
    
    // Check length first (constant-time comparison requires same length)
    if (providedToken.length !== expected.length) {
      return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedToken),
        Buffer.from(expected)
      );
    } catch (err) {
      // If comparison fails for any reason, reject
      return false;
    }
  }

  /**
   * Extract auth token from HTTP request headers or query params.
   * Supports:
   * - Authorization: Bearer <token>
   * - X-VD-Auth: <token>
   * - ?token=<token> (for WebSocket compatibility)
   * 
   * @param {http.IncomingMessage} req - HTTP request
   * @param {URL} url - Parsed URL (optional, for query param extraction)
   * @returns {string|null} Extracted token or null
   */
  extractToken(req, url) {
    // Check Authorization header (Bearer scheme)
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1];
      }
    }

    // Check custom X-VD-Auth header
    const customHeader = req.headers['x-vd-auth'];
    if (customHeader) {
      return customHeader;
    }

    // Check query parameter (for WebSocket handshake and OBS browser sources)
    if (url && url.searchParams) {
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) {
        return tokenParam;
      }
    }

    return null;
  }

  /**
   * Sanitize a file path to prevent directory traversal attacks.
   * Ensures the resolved path stays within the allowed base directory.
   * 
   * @param {string} basePath - Base directory that should contain the file
   * @param {string} userPath - User-provided path (relative or absolute)
   * @returns {string} Safe absolute path
   * @throws {Error} If path escapes base directory
   */
  sanitizePath(basePath, userPath) {
    const normalizedBase = path.resolve(basePath);
    const resolvedPath = path.resolve(normalizedBase, userPath);

    // Ensure resolved path is within base directory
    // On Windows, use case-insensitive comparison
    const normalizedResolved = path.normalize(resolvedPath);
    const isWindows = process.platform === 'win32';
    
    const baseToCheck = isWindows ? normalizedBase.toLowerCase() : normalizedBase;
    const pathToCheck = isWindows ? normalizedResolved.toLowerCase() : normalizedResolved;

    if (!pathToCheck.startsWith(baseToCheck)) {
      throw new Error('Path traversal attempt denied');
    }

    return resolvedPath;
  }

  /**
   * Rate limiter for WebSocket messages.
   * Tracks message count per client and enforces limits.
   */
  createRateLimiter(windowMs = 1000, maxRequests = 10) {
    const clients = new Map();

    return {
      check: (clientId) => {
        const now = Date.now();
        const client = clients.get(clientId) || { count: 0, resetAt: now + windowMs };

        if (now >= client.resetAt) {
          // Reset window
          client.count = 1;
          client.resetAt = now + windowMs;
          clients.set(clientId, client);
          return true;
        }

        if (client.count >= maxRequests) {
          return false;
        }

        client.count++;
        clients.set(clientId, client);
        return true;
      },

      reset: (clientId) => {
        clients.delete(clientId);
      }
    };
  }
}

module.exports = SecurityManager;
