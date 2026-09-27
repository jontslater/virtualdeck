# Raven Voice AI Staging Directory

This directory is used to stage the Raven voice AI sidecar for bundling with VirtualDeck's Windows installer.

## What Goes Here

When you run `npm run stage-raven`, this directory is populated with:

1. **sidecar.js** - Main Raven entry point
2. **app/** - Raven application code (bridge, controller, TTS, etc.)
3. **scripts/** - Helper scripts (raven-sidecar.js, etc.)
4. **node/** - Portable Node.js runtime (node.exe)
5. **ffmpeg/** - ffmpeg binaries for audio playback (ffmpeg.exe, ffplay.exe)
6. **env.defaults** - Configuration template (NO API KEYS)
7. **package.json** - Node.js dependencies
8. **node_modules/** - Installed dependencies

## Security

**IMPORTANT:** This directory must NEVER contain:
- `.env` files with actual API keys
- `raven.env` with filled credentials
- Any other files containing secrets

The `env.defaults` file should only have empty placeholders. Users provide their own API keys after installation (BYOK - Bring Your Own Key model).

The `prepare-build.js` script will abort the build if any credential files are detected.

## Staging Process

To stage Raven for building:

1. Clone AITuber repository: `git clone https://github.com/jontslater/AITuber`
2. Place it at `E:\AIChatBot` or set `$env:AITUBER_ROOT` to your clone location
3. Run: `npm run stage-raven`
4. Verify staging: `dir extra/raven/sidecar.js` should exist
5. Build installer: `npm run build:win:with-raven`

## Gitignore

Most files in this directory are gitignored (except README.md and env.defaults) because they are:
- Binary executables (node.exe, ffmpeg.exe)
- Generated from the AITuber repository
- Large node_modules dependencies

The staging script regenerates them from the AITuber source each build.
