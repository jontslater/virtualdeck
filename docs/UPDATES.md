# Auto-updates (GitHub Releases)

VirtualDeck uses **`electron-updater`** with **`electron-builder`** publishing to **[jontslater/virtualdeck](https://github.com/jontslater/virtualdeck)** releases.

## Required release artifacts

Each Windows release **must** upload (CI does this automatically):

| File | Purpose |
|------|---------|
| `latest.yml` | Version metadata feed for `electron-updater` |
| `VirtualDeck-Setup-X.Y.Z.exe` | NSIS installer |
| `VirtualDeck-Setup-X.Y.Z.exe.blockmap` | Differential download |

Artifact names are fixed via `package.json` → `build.win.artifactName`: `VirtualDeck-Setup-${version}.${ext}` (matches v1.1.8+ releases).

## App behavior

| Trigger | Behavior |
|---------|----------|
| **Startup** (~3s delay) | Checks GitHub if Preferences → “Automatically check for updates” is enabled (default on) |
| **Tools → Check for Updates** | Manual check; shows “up to date” or errors |
| **Preferences → Check for Updates Now** | Same as manual; shows inline status + progress bar |
| **Download** | User confirms; progress in Preferences and main-process logs |
| **Install** | “Restart Now” or install on quit (`autoInstallOnAppQuit`) |

Unsigned Windows installers are supported; SmartScreen may warn on first install.

### Graceful failures

| Situation | UX |
|-----------|-----|
| Offline / DNS | Warning; optional link to releases page on manual check |
| GitHub rate limit | Warning with retry guidance |
| Not installed (dev `npm start`) | Info dialog — updates only work from NSIS install |
| Startup check errors | Logged only (no modal spam) |

Set `VD_DISABLE_AUTO_UPDATE=1` to disable checks entirely (support/debug).

## Build & publish locally

Public installer (no bundled API keys):

```bash
npm ci
npm run build:win
# dist/: VirtualDeck-Setup-X.Y.Z.exe, latest.yml, *.blockmap
```

Publish to GitHub (requires `GH_TOKEN` with `contents: write`):

```bash
export GH_TOKEN=...
npm run build:win:publish
```

**Do not** use `build:win:personal` for public releases.

## CI: `release-windows.yml`

On push of tag `v*`:

1. Verifies tag matches `package.json` version.
2. Runs `npm run build:win:publish` on `windows-latest`.
3. Attaches assets to the GitHub Release.

Optional: set repository secret `AITUBER_REPO_TOKEN` and extend the workflow to stage Raven for `build:win:with-raven` (not required for the keyless feed).

## Manual test plan: upgrade 1.1.8 → 1.2.0

**Requires a real Windows PC** with NSIS-installed VirtualDeck (not `npm start`).

### Prerequisites

- Install **v1.1.8** from [GitHub Releases](https://github.com/jontslater/virtualdeck/releases/tag/v1.1.8).
- Publish **v1.2.0** with the three artifacts above (or run the release workflow).

### Steps

1. Launch installed VirtualDeck 1.1.8 → wait ~5s → confirm no error modal (startup check).
2. **Tools → Check for Updates** → expect offer to download **1.2.0** (if release is live).
3. Accept download → open **Preferences** → watch progress text/bar.
4. When complete → **Restart Now** → app relaunches as **1.2.0** (About / `getAppVersion`).
5. Repeat manual check → “You are up to date”.
6. **Offline test:** disable network → manual check → friendly offline message (no crash).
7. **Preferences:** disable auto-update → restart → confirm no startup check in logs.

### What cannot be verified in Linux CI

- NSIS install / `quitAndInstall` / SmartScreen
- End-to-end download from GitHub CDN on Windows
- Raven-bundled installer size (local `stage-raven` only)

Automated coverage in this repo: `test-app-updater.js` (error classification), `test-release-metadata.js` (publish config + version format).
