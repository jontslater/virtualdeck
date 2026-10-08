# VirtualDeck Windows Installer Packaging Guide

This guide explains how to build the VirtualDeck Windows installer with the bundled Raven voice AI sidecar.

## Overview

The VirtualDeck installer can package VirtualDeck and Raven into a single NSIS installer. After installation:

- Users run the installer once
- VirtualDeck and Raven are installed together (when built with Raven)
- Raven auto-starts when VirtualDeck launches (packaged mode)
- Users fill API keys once in `%APPDATA%\VirtualDeck\raven.env` (BYOK)

## Prerequisites (Windows build PC)

1. **Node.js** (v18+) on PATH
2. **pnpm** (for the AITuber monorepo)
3. **AITuber** clone: https://github.com/jontslater/AITuber  
   - Default path: `E:\AIChatBot`  
   - Or: `$env:AITUBER_ROOT = "C:\path\to\AITuber"`
4. **PowerShell** (script uses `-ExecutionPolicy Bypass` via `package.json`)
5. **ffmpeg + ffplay** (real binaries, not Chocolatey shims under ~1 MB)  
   - Set `$env:FFMPEG_DIR` to a folder containing `ffmpeg.exe` and `ffplay.exe`, or  
   - Place both under `AITuber\runtime\ffmpeg\`, or  
   - Install ffmpeg so the resolved binary is the full build (script follows Chocolatey shims to `C:\ProgramData\chocolatey\lib\ffmpeg\tools\ffmpeg\bin`)

Optional: portable `node.exe` under `AITuber\runtime\node\` (otherwise the staging script copies system `node.exe` into `extra/raven/node/`).

## AITuber layout (pnpm monorepo)

The staging script targets Jonathan's AITuber checkout:

| Path | Role |
|------|------|
| `apps/controller` | Raven controller (TypeScript → `dist/`) |
| `packages/*` | Workspace packages (including VirtualDeck bridge) |
| `scripts/raven-sidecar.js` | Sidecar entry (copied to `extra/raven/sidecar.js`) |
| `pnpm-workspace.yaml` | Monorepo marker |

**What `npm run stage-raven` does for the monorepo:**

1. `pnpm install` at the AITuber root
2. `pnpm --filter ./apps/controller run build`
3. Builds `packages/*` that define a `build` script
4. `pnpm --filter ./apps/controller deploy --prod <tmpdir>` → copied to `extra/raven/app/` as real files (no workspace symlinks)
5. Copies `packages/` (excluding `node_modules`) for bridge/runtime imports
6. Copies `scripts/raven-sidecar.js` → `sidecar.js`
7. Bundles `node.exe` and ffmpeg/ffplay
8. Writes `env.defaults` from the VirtualDeck template (empty API keys only)
9. Fails if node, ffmpeg, sidecar, controller `dist`, security checks, or dependency install fail

Legacy layouts (`sidecar.js` at repo root, or scripts layout with `app/`) are still supported for older checkouts.

## Build commands

```powershell
cd VirtualDeck
npm install

# Stage Raven from AITuber (requires AITUBER_ROOT, pnpm, ffmpeg)
npm run stage-raven

# Full installer with Raven
npm run build:win:with-raven
```

**VirtualDeck-only installer** (no Raven bundle):

```powershell
npm run build:win
```

This sets `SKIP_RAVEN=1` during `prepare-build` so a missing `extra/raven/sidecar.js` is allowed.

**Output:** `dist/VirtualDeck Setup <version>.exe`

### Environment variables

| Variable | Purpose |
|----------|---------|
| `AITUBER_ROOT` | Path to AITuber clone (default `E:\AIChatBot`) |
| `FFMPEG_DIR` | Directory with `ffmpeg.exe` and `ffplay.exe` |
| `RAVEN_CONTROLLER_FILTER` | Override pnpm filter (default `./apps/controller`) |
| `SKIP_RAVEN=1` | Allow build without staged Raven (`prepare-build:no-raven`) |

## Security model

- Installers **never** ship API keys; `env.defaults` uses blank placeholders only.
- Staging never copies `.env` / `raven.env` from AITuber.
- `prepare-build.js` does **not** fail merely because `.env` or `twitch-oauth-config.js` exists in the repo root (common local dev files). It checks whether those paths are included in `electron-builder` `files` / `extraResources`, and scans `extra/raven` for credential files and populated keys.
- `build:win:with-raven` requires `extra/raven/sidecar.js` unless `SKIP_RAVEN=1`.

Run packaging helper tests on any OS:

```bash
npm run test:prepare-build
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `AITuber repository not found` | Clone AITuber or set `$env:AITUBER_ROOT` |
| `pnpm is required` | `npm i -g pnpm`, then re-run `stage-raven` |
| `ffmpeg.exe ... only N bytes — likely a shim` | Set `$env:FFMPEG_DIR` to real binaries or use Chocolatey `lib\ffmpeg\tools\ffmpeg\bin` |
| `Security validation failed` on empty `LLM_API_KEY=` | Update to this branch (line-by-line key check; CRLF-safe) |
| `extra/raven/sidecar.js missing` on with-raven build | Run `npm run stage-raven` first |
| `controller ... no dist entrypoint` | Fix `apps/controller` build in AITuber; confirm `pnpm --filter ./apps/controller run build` works |
| `npm install in staged directory failed` | Check network/Node version; delete `extra/raven` and re-stage |

## File locations

| | Path |
|--|------|
| Staged Raven (build machine) | `extra/raven/` (gitignored except README + template `env.defaults`) |
| Installer output | `dist/` |
| Installed Raven (end user) | `<VirtualDeck>\resources\raven\` |
| User API keys | `%APPDATA%\VirtualDeck\raven.env` |

## Ports

- **8080** — overlay HTTP (configurable in `raven.env`)
- **8081** — VirtualDeck ↔ Raven WebSocket
- **8091** — JARVIS tool API
