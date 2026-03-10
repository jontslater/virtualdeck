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

### Step 4: GitHub token (usually not needed)

The release workflow uses GitHub Actions’ built-in **GITHUB_TOKEN** with `contents: write`, so it can create releases and upload assets **without** a personal access token. You only need a token if your repo or org restricts the default token (e.g. “Read repository contents and packages” only).

**If you do add a secret** (e.g. `GH_TOKEN`):
- **Tokens (classic)** is the most reliable: create a classic token and check the **repo** scope (or **public_repo** for public repos only).
- **Fine-grained** tokens: choose the repo, then set **Contents** to **Read and write**. If release uploads fail, use a classic token with **repo** instead.

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

## How to ship an update (every time you release)

Do this whenever you want to get a new version to users so **Check for Updates** works and the 404 goes away:

1. **Bump version** in `package.json`: set `"version": "1.1.3"` (or next number).
2. **Commit and push** your branch (e.g. `git add -A && git commit -m "Release 1.1.3" && git push`).
3. **Create and push the tag** (tag must match the version in package.json):
   ```bash
   git tag v1.1.3
   git push origin v1.1.3
   ```
4. **Wait for the Release workflow** to finish on GitHub (Actions tab). It will build and attach `latest.yml`, the `.exe`, and `.blockmap` to the new release.
5. **Done.** The new release is “latest” on GitHub. Installed apps will get it when they use Check for Updates.

You can tag from your current branch; you don’t have to use a separate `production` branch unless you want to.

---

## Summary Checklist

| Step | Action |
|------|--------|
| 1 | Put repo on GitHub |
| 2 | Add `repository` and `build.publish` (github provider) to package.json |
| 3 | Re-enable `autoUpdater.checkForUpdates()` in main.js |
| 4 | (Optional) Add `GH_TOKEN` secret only if built-in token is restricted |
| 5 | Add `.github/workflows/release.yml` |
| 6 | Release from production: bump version, merge to production, tag (e.g. `v1.1.2`), push tag |

---

## Troubleshooting: "Cannot find latest.yml" (404)

If users see **Update Error: Cannot find latest.yml in the latest release artifacts** (HTTP 404), the release that electron-updater is using does not have `latest.yml` (and usually the `.blockmap`) as assets. That often happens when:

- The release was created **manually** (e.g. by uploading only the `.exe`) instead of via the GitHub Actions workflow, or
- The workflow was added **after** existing releases (e.g. v1.0.1) were already published.

**Fix:** Publish a **new** release using the workflow so the **latest** release on GitHub includes `latest.yml` and the other assets:

1. Bump `version` in `package.json` (e.g. to `1.1.2` or next).
2. Commit, merge to `production`, then create and push a **tag** from that branch:
   ```bash
   git checkout production
   git pull origin production
   git tag v1.1.2
   git push origin v1.1.2
   ```
3. Wait for the **Release** workflow to finish. It will create the release for that tag and upload `dist/*.exe`, `dist/*.yml`, and `dist/*.blockmap` (including `latest.yml`).
4. That release becomes the **latest** on GitHub. The next time the installed app checks for updates, it will hit this release and find `latest.yml`, so the 404 goes away and updates work.

The workflow uses the built-in **GITHUB_TOKEN**; no secret is required unless your repo or org limits it. If you see permission errors, add a **GH_TOKEN** secret (Settings → Secrets and variables → Actions) with a classic token that has the **repo** scope.

---

## Testing in development

When you run the app with `npm start`, it is **unpacked** (not built with electron-builder). The update check is skipped in that case so you don’t get updater errors or unnecessary network calls in dev. You’ll see in the console:

`Update check skipped (running unpacked). To test in dev: set FORCE_DEV_UPDATE_CHECK=1 and run again.`

To **test the update flow** from dev:

1. Set the env var and start the app:  
   `set FORCE_DEV_UPDATE_CHECK=1 && npm start` (Windows) or `FORCE_DEV_UPDATE_CHECK=1 npm start` (macOS/Linux).
2. Use **Tools → Check for Updates** (or the preference button). The app will then call electron-updater; if your electron-updater version supports `forceDevUpdateConfig`, it will run the check.

For reliable testing, install the app from a built installer (`dist\VirtualDeck Setup x.x.x.exe`), then publish a newer version and use **Check for Updates** from the installed app.

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
