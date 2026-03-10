# VirtualDeck Production Auto-Update Setup

This guide walks through setting up production auto-updates for VirtualDeck so users receive updates automatically when you release new versions.

## Current State

- **electron-updater** is already integrated in the app (event handlers, dialogs, etc.)
- **package.json** has `"publish": null` — no update server is configured
- Update check is disabled in code with a "private repository" comment
- Build produces `dist/` with NSIS installer (~95MB exe) and `latest.yml` (required by electron-updater)

## Recommended Approach: GitHub Releases + GitHub Actions

**Railway** is great for backends but not ideal for hosting large update files (95MB exe). **GitHub Releases** is the standard for Electron: free, supports large assets, and electron-updater has native support.

---

## Step-by-Step Setup

### Step 1: Put the Repo on GitHub

- Create a repository (e.g. `YourUsername/virtualdeck`) or use an existing one
- Push your code and ensure it's set as `origin`

### Step 2: Configure package.json for Publishing

Add a `repository` field and set `build.publish` to the GitHub provider. Replace `YourUsername` and `virtualdeck` with your actual GitHub owner and repo name:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/YourUsername/virtualdeck.git"
  },
  "build": {
    "publish": {
      "provider": "github",
      "owner": "YourUsername",
      "repo": "virtualdeck",
      "releaseType": "release"
    },
    ...
  }
}
```

- `releaseType` options: `"draft"` (publish as draft), `"prerelease"`, or `"release"` (public release)
- Remove or replace the existing `"publish": null` in the build config

### Step 3: Re-enable the Update Check in main.js

In the block around lines 4947–4956, uncomment the `autoUpdater.checkForUpdates()` call and remove/adjust the "private repository" logic so the app actually checks when the user has auto-update enabled:

```javascript
if (preferences.autoUpdate !== false) {
  autoUpdater.checkForUpdates().catch(err => {
    console.log('Auto-update check failed:', err.message);
  });
}
```

### Step 4: Create a GitHub Token

- Go to GitHub → Settings → Developer settings → Personal access tokens
- Create a token with **repo** scope (create releases, upload assets)
- In your repo: Settings → Secrets and variables → Actions
- Add a new repository secret: `GH_TOKEN` with the token value

### Step 5: Add a GitHub Actions Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build:win
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}

      - name: Publish to GitHub Releases
        uses: softprops/action-gh-release@v2
        with:
          files: dist/*.exe dist/*.yml dist/*.blockmap
          draft: false
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
```

**Note:** If you use `electron-builder --publish always`, it can publish directly. The workflow above builds first, then uses `action-gh-release` to upload. Alternatively, run `npm run build:win -- --publish always` and electron-builder will create the release and upload assets (ensure `GH_TOKEN` is set in env).

### Step 6: Release a New Version

Releases use the **production** branch for the live app.

1. Bump `version` in `package.json` (e.g. `1.1.1` → `1.1.2`)
2. Commit and push your changes to your working branch, then merge into **production**
3. Check out production and create/push the tag:
   ```bash
   git checkout production
   git pull origin production
   git tag v1.1.2
   git push origin v1.1.2
   ```
4. The workflow runs, builds the Windows app, and publishes to GitHub Releases
5. Users with the app installed will see the update on next launch (or via Tools → Check for Updates)

---

## Summary Checklist

| Step | Action |
|------|--------|
| 1 | Put repo on GitHub |
| 2 | Add `repository` and `build.publish` (github provider) to package.json |
| 3 | Re-enable `autoUpdater.checkForUpdates()` in main.js |
| 4 | Add `GH_TOKEN` secret to the repo |
| 5 | Add `.github/workflows/release.yml` |
| 6 | Release from production: bump version, merge to production, tag (e.g. `v1.1.2`), push tag |

---

## Alternative: Generic Provider (Custom URL)

If you prefer to host updates elsewhere (e.g. S3, Cloudflare R2, or a static server), use the generic provider:

```json
"publish": {
  "provider": "generic",
  "url": "https://your-update-server.com/releases"
}
```

Upload the contents of `dist/` (exe, latest.yml, blockmap) to that URL. electron-updater will look for `latest.yml` at the base URL.
