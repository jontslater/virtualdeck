# VirtualDeck Auto-Update Guide

## Overview

VirtualDeck now includes automatic update functionality using `electron-updater`. This allows users to receive updates automatically from GitHub releases.

## How It Works

- **Windows**: Full auto-update support (download and install) even for unsigned builds
- **macOS**: Shows a link to GitHub releases page (unsigned builds cannot auto-install on macOS)
- **Update Check**: Automatically checks on startup (3-second delay) and can be triggered manually via Help menu

## For Users

### Automatic Updates

When you launch VirtualDeck:
1. The app will automatically check for updates after 3 seconds
2. If an update is available, you'll see a dialog:
   - **Windows**: Option to download and install
   - **macOS**: Link to GitHub releases page
3. After download completes, you can restart to apply the update

### Manual Update Check

You can manually check for updates at any time:
1. Click **Help** → **Check for Updates...**
2. Follow the prompts if an update is available

## For Developers

### Publishing a New Release

To publish a new release that users will receive as an update:

#### 1. Update Version Number

Edit `package.json` and increment the version:
```json
{
  "version": "1.1.1"  // or 1.2.0, etc.
}
```

#### 2. Build the Installer

```bash
npm run build:win
```

This creates the following files in the `dist/` folder:
- `VirtualDeck Setup X.X.X.exe` - The installer
- `VirtualDeck Setup X.X.X.exe.blockmap` - Update metadata
- `latest.yml` - Version information file

#### 3. Create GitHub Release

1. Go to https://github.com/jontslater/VirtualDeck/releases/new
2. Create a new tag matching your version (e.g., `v1.1.1`, `v1.2.0`)
3. Set release title: "VirtualDeck vX.X.X"
4. Add release notes describing changes
5. Upload these files from `dist/`:
   - `VirtualDeck Setup X.X.X.exe`
   - `VirtualDeck Setup X.X.X.exe.blockmap`
   - `latest.yml`

#### 4. Publish Release

Click "Publish release" - electron-updater will automatically detect it!

### Testing Updates

**Important**: Auto-updates only work when the app is installed via the installer, not when running in development mode.

To test:
1. Install the current version using the installer
2. Create a new release with a higher version number
3. Launch the installed app
4. Wait for the update dialog (or use Help → Check for Updates)

### Update Flow

```
App Starts
  ↓
Wait 3 seconds
  ↓
Check GitHub for latest release
  ↓
Compare versions
  ↓
┌─────────────────────────┐
│ Update Available?       │
└─────────────────────────┘
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    ↓         └→ Continue normally
Show Dialog
    │
    ↓
User clicks Download
    │
    ↓
Download update
    │
    ↓
Show "Update Ready" dialog
    │
    ↓
User clicks "Restart Now"
    │
    ↓
App quits and installs update
```

## Configuration

The auto-updater is configured in `package.json`:

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "jontslater",
      "repo": "VirtualDeck"
    }
  }
}
```

And in `main.js`:

```javascript
autoUpdater.autoDownload = false;      // Ask user before downloading
autoUpdater.autoInstallOnAppQuit = true; // Install when app quits
```

## Troubleshooting

### Update Check Fails

If you see "Auto-update check failed" in the console:
- This is normal in development mode (not installed via installer)
- Make sure there's an internet connection
- Verify the GitHub repository is accessible

### Updates Not Detected

1. Verify the version in `package.json` is higher than the installed version
2. Check that `latest.yml` was uploaded to the GitHub release
3. Ensure the release is published (not draft)

### macOS Auto-Install Not Working

This is expected behavior for unsigned builds. macOS requires code signing for auto-installation. Users will be directed to download manually from GitHub.

## Future Enhancements

When code signing is implemented:
- macOS will support full auto-install
- No code changes needed - electron-updater will automatically use the new signature
- Just update the build configuration with signing certificates

## Security Notes

- Updates are only downloaded from the official GitHub repository
- electron-updater verifies file integrity using blockmap files
- Users can always verify releases on GitHub before installing
- HTTPS is used for all update communications

