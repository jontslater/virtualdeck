# VirtualDeck Security Documentation

This document describes the security measures implemented in VirtualDeck and how to use them.

## Overview

VirtualDeck now includes P0 security hardening to protect against:
- Unauthorized localhost API access
- Quota theft via bundled API keys
- Path traversal attacks
- Token theft and credential leakage

## Authentication Token

### What is it?

VirtualDeck generates a random 64-character authentication token on first run. This token is required for:
- Control operations via the VTuber API (`/api/vtuber/*` POST/PUT/DELETE)
- Sending control messages via WebSocket (future features)

Read-only operations (like viewing overlays in OBS) do **not** require the token.

### Where is the token stored?

The token is stored in:
```
%APPDATA%\VirtualDeck\.vd-auth-token        (Windows)
~/Library/Application Support/VirtualDeck/.vd-auth-token  (macOS)
~/.config/VirtualDeck/.vd-auth-token        (Linux)
```

**Important:** This file is secured with filesystem permissions (mode 0600 on Unix-like systems).

### How to use the token

#### For OBS Browser Sources (Overlays)

**No token required!** Overlays are read-only and work out of the box:
```
http://localhost:8080/overlay?name=yourOverlay
```

#### For control operations (VTuber API)

Add the token as a query parameter:
```
http://localhost:8080/api/vtuber/config?token=YOUR_TOKEN_HERE
```

Or use the `X-VD-Auth` header:
```bash
curl -X POST http://localhost:8080/api/vtuber/state \
  -H "X-VD-Auth: YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"state": "talking"}'
```

Or use Bearer authentication:
```bash
curl -X POST http://localhost:8080/api/vtuber/state \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"state": "talking"}'
```

### Syncing the token to another PC

If you use VirtualDeck on multiple PCs and want to control it remotely from one PC to another:

1. **On PC 1:** Find the token file location (see above)
2. Copy the `.vd-auth-token` file
3. **On PC 2:** Paste it into the same location
4. Restart VirtualDeck on PC 2

Both PCs will now accept the same token for control operations.

### Viewing the token in VirtualDeck

*(Coming soon: Settings UI to display and copy the token)*

For now, you can view it from the command line:
```bash
# Windows
type %APPDATA%\VirtualDeck\.vd-auth-token

# macOS/Linux
cat ~/Library/Application\ Support/VirtualDeck/.vd-auth-token
```

Or open the token file in any text editor.

## Twitch OAuth Security

### Encrypted Storage

Twitch OAuth tokens are now encrypted using Electron's `safeStorage` API before being saved to disk. This uses:
- **Windows:** DPAPI (Data Protection API)
- **macOS:** Keychain
- **Linux:** Secret Service API / libsecret

Your Twitch token is no longer stored in plain text in `tc_config.json`.

### Migration

When you upgrade to this version:
- **Existing tokens:** Will be automatically encrypted on the next save
- **New tokens:** Automatically encrypted when you connect to Twitch

No action required on your part!

### Limitations

The encryption protects against:
- ✅ Malware reading your token from disk
- ✅ Accidental exposure (e.g., sharing config files)

It does **not** protect against:
- ❌ Malware running as your user account (same security boundary)
- ❌ Physical access to your PC while you're logged in

This is the best protection available for desktop applications without a remote server.

## API Keys (Raven/JARVIS)

### Important: Never Bundle Keys

**For Jonathan (Developer):**
- Never commit API keys to git
- Never bundle OpenAI/ElevenLabs keys in the installer
- Always require users to provide their own keys

**For Users:**
- VirtualDeck will never ship with pre-filled API keys
- You must provide your own OpenAI/ElevenLabs keys
- Keys are stored encrypted in your `raven.env` file

See `docs/raven-setup.md` for instructions on setting up your own API keys.

## WebSocket Rate Limiting

The overlay WebSocket server enforces rate limits to prevent abuse:
- **Limit:** 10 messages per second per client
- **Window:** 1 second rolling window
- **Action:** Exceeding the limit disconnects the client temporarily

This prevents:
- Malicious overlays from spamming the server
- Accidental infinite loops in overlay scripts
- DoS attacks from local processes

## Path Traversal Protection

All file operations validate paths to prevent directory traversal attacks:

### Protected Handlers
- `save-media-file-by-path` — Rejects paths with `..` segments
- `get-media-file-path` — Sanitizes relative paths
- `get-media-file` — Sanitizes relative paths
- `import-skin` — Validates JSON extension

### How it works

The security manager sanitizes all user-provided paths:
```javascript
// User provides: "../../../etc/passwd"
// After sanitization: "/safe/user/data/path/etc/passwd"
// (Path is forced to stay within allowed directory)
```

## HTTP Server Security

### Localhost Binding

The overlay server binds to `127.0.0.1` (localhost only) and is **not** accessible from:
- Other devices on your network
- The internet

This prevents remote attackers from controlling your deck.

### CORS Policy

CORS headers allow any origin (`*`) for overlay compatibility with OBS Browser Sources. This is safe because:
1. Server only listens on localhost
2. Control operations require authentication
3. Read-only overlays don't expose sensitive data

## Security Checklist for Streamers

- ✅ Keep VirtualDeck updated
- ✅ Don't share your `.vd-auth-token` file publicly
- ✅ Don't stream/screenshot your token or API keys
- ✅ Use your own OpenAI/ElevenLabs keys (never use shared keys)
- ✅ Review button configurations before importing from others
- ✅ Keep your PC's OS and antivirus up to date

## Reporting Security Issues

If you discover a security vulnerability in VirtualDeck:

**Do not open a public GitHub issue.**

Instead, email: [security@virtualdeck.dev](mailto:security@virtualdeck.dev) (or your preferred contact)

We'll work with you to fix it before public disclosure.

## Future Security Enhancements (Roadmap)

### Planned (Post-P0)
- Settings UI to view/copy auth token
- License validation system for paid features
- Tool permission system for JARVIS API
- Audit log for all control operations
- Content Security Policy for overlays

### Under Consideration
- Optional remote access with stronger authentication (OAuth2)
- End-to-end encryption for cloud profile sync
- Hardware token support (YubiKey, etc.)
- Sandboxed plugin system

---

**Last Updated:** September 27, 2026  
**Version:** 1.1.1 (P0 Security Hardening)
