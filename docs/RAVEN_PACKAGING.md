# Raven in public installers

Raven (the paid AI assistant) is **not** implemented inside VirtualDeck’s Electron tree. It is staged from the **[AITuber](https://github.com/jontslater/AITuber)** monorepo into `extra/raven/` before `electron-builder` runs.

## What VirtualDeck actually bundles

| Piece | Source in AITuber | Role |
|-------|-------------------|------|
| `sidecar.js` | `scripts/raven-sidecar.js` | Spawns controller + bridge |
| `app/apps/controller` | Built `dist/` + prod `node_modules` | Raven “brain”, HTTP API (~3004), copilot |
| `app/packages/integrations/virtualdeck` | VirtualDeck bridge | WebSocket + macro whitelist to JARVIS |
| `app/packages/*` | `shared`, `director`, `llm`, `tts-*`, etc. | Controller dependencies |
| `node/node.exe` | System or AITuber `runtime/node` | Run sidecar on user PCs without global Node |
| `ffmpeg/` | `FFMPEG_DIR` or AITuber `runtime/ffmpeg` | TTS / audio playback |
| `env.defaults` | Template in VirtualDeck | **Empty** API keys (BYOK) |

At runtime, `raven-host.js` copies `env.defaults` → `%APPDATA%/VirtualDeck/raven.env` on first launch.

## Why CI skipped Raven initially

`npm run stage-raven` is a **PowerShell** script that:

- Runs `pnpm` builds across the AITuber workspace
- Copies ~hundreds of MB of `node_modules` into `extra/raven`
- Requires **ffmpeg** binaries and a full AITuber checkout

The first v1.2 workflow used `build:win:publish` (`SKIP_RAVEN=1`), which produces a valid updater feed but **no Raven** — unsuitable for selling Pro AI.

## Implemented approach (v1.2.0+)

**Release workflow** (`.github/workflows/release-windows.yml`):

1. Check out VirtualDeck + **AITuber** into `vendor/AITuber` (needs `AITUBER_CHECKOUT_TOKEN` if the repo is private).
2. `choco install ffmpeg`
3. `npm run build:win:publish:raven` → stage + keyless `prepare-build` + `electron-builder --publish always`

Maintainers must ensure the token can read AITuber and that release tags match `package.json` (see `docs/VERSIONING.md`).

## Cleaner long-term options (not fully implemented)

| Option | Effort | Notes |
|--------|--------|--------|
| **A. CI checkout (current)** | **Small** — workflow + secret | Same staging script as local; reproducible on tag push |
| **B. Prebuilt “raven-runtime” GitHub Release** | **Medium** | AITuber CI uploads `raven-runtime-vX.Y.zip`; VirtualDeck CI downloads + unpacks to `extra/raven` (no pnpm on VD CI) |
| **C. npm/git dependency** | **Medium–large** | Publish `@virtualdeck/raven-runtime` from AITuber; version pin in VirtualDeck |
| **D. Vendor into VirtualDeck git** | **Large** | Huge binaries in git/LFS; painful reviews and drift |

**Recommendation:** ship **A** for v1.2; move to **B** before Nov launch if AITuber builds are slow or flaky on VirtualDeck CI.

### Option B sketch

1. AITuber workflow on tag → `stage-raven` → zip `extra/raven` layout → attach to `raven-runtime-v*` release.
2. VirtualDeck `scripts/fetch-raven-runtime.js` downloads that zip by version (env `RAVEN_RUNTIME_VERSION`).
3. VirtualDeck release workflow: fetch zip → `prepare-build` → `electron-builder`.

## Local dev (unchanged)

```powershell
git clone https://github.com/jontslater/AITuber E:\AIChatBot
cd VirtualDeck
npm run stage-raven
npm run build:win:with-raven
```

Never use `build:win:personal` for public releases.

## Verification (Windows only)

1. Install CI-built NSIS package.
2. **Tools → Raven AI → Start** (requires Pro license + BYOK in `raven.env`).
3. Confirm `%LOCALAPPDATA%/VirtualDeck/raven.log` shows controller startup.
