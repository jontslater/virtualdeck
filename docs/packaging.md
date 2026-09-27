# VirtualDeck Windows Installer Packaging Guide

This guide explains how to build the VirtualDeck Windows installer with the bundled Raven voice AI sidecar.

## Overview

The VirtualDeck installer packages both VirtualDeck and Raven voice AI into a single NSIS installer. After installation:
- Users run the installer once
- VirtualDeck and Raven are installed together
- Raven auto-starts when VirtualDeck launches (in packaged mode)
- Users only need to fill in their API keys once in `raven.env`

## Prerequisites

### On the Build PC (DESKTOP-SEGEUJS or similar)

1. **Node.js** (v18+)
   - Download from: https://nodejs.org/
   - Verify: `node --version`

2. **AITuber Repository**
   - Clone: `git clone https://github.com/jontslater/AITuber`
   - Default location: `E:\AIChatBot`
   - Or set: `$env:AITUBER_ROOT = "C:\path\to\AITuber"`

3. **PowerShell Execution Policy**
   - Run as Administrator: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
   - Or use `-ExecutionPolicy Bypass` flag (already in package.json)

4. **ffmpeg (optional but recommended)**
   - Download from: https://github.com/BtbN/FFmpeg-Builds/releases
   - Place `ffmpeg.exe` and `ffplay.exe` in `E:\AIChatBot\runtime\ffmpeg\`
   - Or ensure ffmpeg is in system PATH
   - **Without ffmpeg**: TTS audio playback will not work

## Recent Improvements

**Version 1.1.1+ includes fixes for:**
- Automatic detection of AITuber directory layouts (no manual path adjustments needed)
- Improved validation that correctly handles empty API key placeholders
- Better error messages when sidecar files cannot be found
- Support for both root-level and scripts-based Raven installations

These fixes ensure `npm run stage-raven` works reliably with Jonathan's AITuber checkout without requiring workarounds.

## Build Process

### Step 1: Clone and Setup VirtualDeck

```bash
git clone https://github.com/yourusername/VirtualDeck.git
cd VirtualDeck
git checkout pilot  # or your target branch
npm install
```

### Step 2: Stage Raven Runtime

This copies Raven sidecar + Node.js + ffmpeg into `extra/raven/`:

```powershell
npm run stage-raven
```

**What this does:**
- Automatically detects AITuber repository layout (supports multiple structures)
- Copies Raven sidecar code from AITuber to `extra/raven/`
- Bundles Node.js portable runtime to `extra/raven/node/`
- Bundles ffmpeg binaries to `extra/raven/ffmpeg/`
- Creates `env.defaults` template (empty API keys only)
- Installs Node.js dependencies in staged directory
- Validates no secrets are being bundled

**Supported AITuber Layouts:**
The staging script automatically detects which layout your AITuber checkout uses:
- **Root layout**: `sidecar.js`, `app/`, `scripts/` at repository root
- **Scripts layout**: `scripts/raven-sidecar.js`, `app/` in subdirectories

**Troubleshooting:**
- If the script fails with "AITuber repository not found":
  - Ensure AITuber is cloned to `E:\AIChatBot`
  - Or set `$env:AITUBER_ROOT = "C:\your\path"`
- If the script fails with "Cannot find sidecar.js":
  - Ensure AITuber repository is complete and built
  - The script checks both `sidecar.js` (root) and `scripts/raven-sidecar.js`
- If Node.js is not found:
  - Ensure Node.js is installed and in PATH
  - Or place portable `node.exe` in `E:\AIChatBot\runtime\node\`
- If ffmpeg warnings appear:
  - Download ffmpeg and place in `E:\AIChatBot\runtime\ffmpeg\`
  - Build will complete but TTS won't work without ffmpeg
- If "Security check failed: env.defaults contains API keys" appears:
  - This is a safety check to prevent accidentally bundling real API keys
  - Ensure `extra/raven/env.defaults` has empty values like `LLM_API_KEY=`
  - Never put real API keys in `env.defaults` (users fill them after install)

### Step 3: Build the Installer

```bash
npm run build:win:with-raven
```

**What this does:**
- Runs security checks (aborts if any `.env` files with keys found)
- Stages test media files
- Builds VirtualDeck with electron-builder
- Bundles `extra/raven/` into `resources/raven/` in installer
- Creates NSIS installer in `dist/`

**Output:**
- `dist/VirtualDeck Setup 1.1.1.exe` (or current version)

**Build time:**
- ~2-5 minutes depending on PC specs

### Step 4: Test the Installer (Optional)

Before distributing, test on a clean VM or second PC:

1. Run the installer
2. Launch VirtualDeck
3. Raven should auto-start but show "API keys required" dialog
4. Click "Open Settings" and fill in API keys
5. Restart Raven from menu
6. Verify voice AI works

## Installation Flow (End User)

### First Install

1. **Run Installer**
   - Double-click `VirtualDeck Setup 1.1.1.exe`
   - Windows SmartScreen warning: Click "More info" → "Run anyway"
     (Installer is unsigned; this is expected)
   - Choose install location (default: `C:\Users\<username>\AppData\Local\Programs\virtualdeck`)
   - Wait for installation (~30 seconds)

2. **Launch VirtualDeck**
   - Installer creates desktop shortcut
   - Double-click "VirtualDeck" icon
   - VirtualDeck launches, Raven auto-starts in background

3. **First-Run: API Keys Required**
   - Dialog appears: "Raven AI - API Keys Required"
   - Click "Open Settings" to open `raven.env` file
   - Fill in your API keys:
     ```
     LLM_API_KEY=sk-your-openai-key-here
     TTS_API_KEY=your-elevenlabs-key-here
     TTS_VOICE_ID=your-voice-id-here
     ```
   - Save and close the file
   - In VirtualDeck menu: Stop Raven AI → Start Raven AI
   - Raven is now active with your credentials

4. **Done!**
   - VirtualDeck + Raven are now installed and configured
   - Raven will auto-start on next VirtualDeck launch
   - API keys are saved in `%APPDATA%\VirtualDeck\raven.env` (user-local)

### Subsequent Launches

- Just run VirtualDeck
- Raven auto-starts with saved API keys
- No additional setup needed

## Security Model

### BYOK (Bring Your Own Key)

VirtualDeck uses a **BYOK model** for API keys:
- **Installers NEVER contain API keys**
- Users provide their own OpenAI, ElevenLabs, etc. keys
- Keys are stored in user's `%APPDATA%\VirtualDeck\raven.env`
- Keys are never uploaded or shared

### Build-Time Security

The build process has multiple security layers:

1. **`prepare-build.js` checks:**
   - Aborts if `.env`, `raven.env`, or `twitch-oauth-config.js` found in repo
   - Aborts if `extra/raven/raven.env` contains populated API keys

2. **`stage-raven-runtime.ps1` checks:**
   - Never copies `.env` or credential files from AITuber
   - Creates `env.defaults` with empty placeholders only
   - Aborts if any API keys detected in staged files

3. **`.gitignore` protection:**
   - All credential files are gitignored
   - `extra/raven/` directory is mostly gitignored (only README and env.defaults tracked)

### Distribution Security

**IMPORTANT:** Never distribute installers with pre-filled API keys:
- ❌ Do NOT commit filled `raven.env` to git
- ❌ Do NOT manually add API keys to `env.defaults`
- ❌ Do NOT share installers with your personal keys
- ✅ Always let users provide their own keys after install

## Troubleshooting

### Build Issues

**"AITuber repository not found"**
- Clone AITuber to `E:\AIChatBot` or set `$env:AITUBER_ROOT`

**"Node.js not found"**
- Install Node.js or place portable node.exe in `E:\AIChatBot\runtime\node\`

**"Security check failed: Found .env"**
- Remove any `.env` files with API keys from repo before building
- These files should never be in version control

**"npm install failed in staged directory"**
- Check Node.js version (needs v18+)
- Check network connection (npm needs internet to download packages)
- Try deleting `extra/raven/` and re-running `npm run stage-raven`

### Runtime Issues

**Raven doesn't start after install**
- Check `%APPDATA%\VirtualDeck\raven.log` for errors
- Verify `raven.env` has API keys filled in
- Try: Stop Raven AI → Start Raven AI from menu

**TTS audio doesn't play**
- Check if ffmpeg was bundled during staging
- Re-run `npm run stage-raven` with ffmpeg in place
- Rebuild installer

**"Missing or invalid auth token" errors**
- JARVIS server may not be running
- Check VirtualDeck console for JARVIS startup logs
- Verify port 8091 is not blocked by firewall

## File Locations

### Build PC (Development)

- **VirtualDeck repo**: `(your clone location)`
- **AITuber source**: `E:\AIChatBot` (or `$env:AITUBER_ROOT`)
- **Staged Raven**: `extra/raven/` (temporary, gitignored)
- **Built installer**: `dist/VirtualDeck Setup 1.1.1.exe`

### End User PC (After Installation)

- **VirtualDeck app**: `C:\Users\<username>\AppData\Local\Programs\virtualdeck\`
- **Raven runtime**: `C:\Users\<username>\AppData\Local\Programs\virtualdeck\resources\raven\`
- **Raven config**: `%APPDATA%\VirtualDeck\raven.env` (user fills API keys here)
- **Raven logs**: `%APPDATA%\VirtualDeck\raven.log`
- **VD auth token**: `%APPDATA%\VirtualDeck\.vd-auth-token`

## Ports Used

VirtualDeck and Raven use these localhost ports:

- **8080** - VirtualDeck overlay HTTP server
- **8081** - Raven WebSocket bridge (VirtualDeck ↔ Raven)
- **8091** - JARVIS tool API (VirtualDeck → Raven for tools)

If any ports conflict with other services:
- Users can edit `raven.env` to change ports
- See env.defaults for all configurable ports

## Code Signing (Future)

Currently, the installer is **unsigned**:
- Windows SmartScreen will show warning
- Users must click "More info" → "Run anyway"
- This is normal for unsigned apps

**To add signing in the future:**
1. Obtain a code signing certificate (e.g., DigiCert, Sectigo)
2. Update `package.json` build config:
   ```json
   "win": {
     "sign": "./sign.js",
     "certificateFile": "path/to/cert.pfx",
     "certificatePassword": "env:CERT_PASSWORD"
   }
   ```
3. Never commit certificate or password to git

## CI/CD Considerations

This build process is designed for **local Windows builds** on DESKTOP-SEGEUJS:
- Requires AITuber checkout (large, not in this repo)
- Requires Windows-specific tools (PowerShell, NSIS)
- Requires manual API key management

**For CI/CD (GitHub Actions, etc.):**
- Would need to:
  - Clone AITuber during build
  - Pre-stage portable Node.js and ffmpeg
  - Use Windows runner (ubuntu/mac can't build NSIS)
  - Handle secrets carefully (no API keys in CI)

Out of scope for this release.

## Next Steps

### After First Build

1. Test installer on clean PC or VM
2. Document voice selection process (if implemented)
3. Add personality picker docs (if implemented)
4. Consider code signing certificate

### For Production

1. Obtain code signing certificate to remove SmartScreen warnings
2. Setup auto-update server (already uses electron-updater)
3. Create installer hosting (GitHub Releases, website, etc.)
4. Add telemetry for first-run success rate (optional)

## Support

If you encounter issues not covered here:
1. Check VirtualDeck logs: `%APPDATA%\VirtualDeck\logs\`
2. Check Raven logs: `%APPDATA%\VirtualDeck\raven.log`
3. Check JARVIS server logs in main VirtualDeck console
4. Open GitHub issue with logs attached
