# P0 Security Hardening - Quick Reference for Jonathan

## What Was Done

✅ **All P0 security issues from product-audit.md are now addressed:**

1. **P0-1: Localhost Auth** — Random token required for control APIs, OBS overlays still work
2. **P0-2: Encrypted Tokens** — Twitch OAuth encrypted with OS keychain/DPAPI
3. **P0-3: Input Validation** — Path traversal protection on file operations
4. **P0-4: No API Keys** — Build fails if API keys detected in installer
5. **P0-5: WebSocket Security** — Rate limiting + message validation

## For Your Personal Use

### Multi-PC Setup

You mentioned using VirtualDeck on multiple PCs. Here's how to sync access:

**On PC 1 (first PC you set up):**
```
Windows: %APPDATA%\VirtualDeck\.vd-auth-token
macOS:   ~/Library/Application Support/VirtualDeck/.vd-auth-token
```

**On PC 2, 3, etc:**
1. Copy that `.vd-auth-token` file from PC 1
2. Paste it in the same location on PC 2
3. Restart VirtualDeck on PC 2

Now all your PCs will accept the same token.

### OBS Overlays

**No changes needed!** Your OBS Browser Sources continue to work:
```
http://localhost:8080/overlay?name=myOverlay
http://localhost:8080/hydration
http://localhost:8080/overlay?name=vtuberOverlay
```

These are read-only, so no token required.

### If You Have External Control Scripts

If you wrote any scripts that POST to the VTuber API, add the token:

**Before (no longer works for writes):**
```bash
curl -X POST http://localhost:8080/api/vtuber/state \
  -H "Content-Type: application/json" \
  -d '{"state": "talking"}'
```

**After:**
```bash
TOKEN=$(cat "$APPDATA/VirtualDeck/.vd-auth-token")
curl -X POST http://localhost:8080/api/vtuber/state \
  -H "X-VD-Auth: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "talking"}'
```

Or add query param: `http://localhost:8080/api/vtuber/state?token=YOUR_TOKEN`

## What Stayed The Same

- ✅ All your buttons, sounds, overlays work exactly as before
- ✅ Twitch connections work (tokens auto-upgraded to encrypted storage)
- ✅ OBS Browser Sources work without any changes
- ✅ Raven/JARVIS still works (no changes to AI functionality)
- ✅ No impact on the JARVIS Tool API (PR #71) — that's on port 8081

## What's Protected Now

### Before This PR
- ❌ Any malicious website could trigger your buttons if you visited while VirtualDeck was running
- ❌ Malware could steal your Twitch OAuth token from plain-text config file
- ❌ Malicious button configs could read arbitrary files from your PC
- ❌ No protection against spamming the WebSocket server

### After This PR
- ✅ Control operations require authentication token
- ✅ Twitch tokens encrypted using Windows DPAPI / macOS Keychain
- ✅ File paths validated — can't escape VirtualDeck's data directory
- ✅ WebSocket rate-limited to 10 messages/second per client
- ✅ Build script prevents accidental API key leakage

## Building and Distributing

### Important: Never Ship API Keys

The build script (`prepare-build.js`) now validates:
- No `.env` with keys
- No `raven.env` with populated OpenAI/ElevenLabs keys
- No credential files in the bundle

If detected, build fails with clear error.

**For paid JARVIS features later:**
- Users MUST provide their own API keys (BYOK)
- Or you run a backend service that proxies to OpenAI (with license checks)
- Never bundle your personal API keys in the installer

## Security Posture

This PR makes VirtualDeck safe for:
- ✅ Free public distribution (no credential leakage risk)
- ✅ Running on your personal PCs (protected from local attacks)
- ✅ Streaming (tokens won't leak if you show config files on stream)
- ✅ Sharing button configs (no path traversal exploits)

Still needed for paid JARVIS (P1, not in this PR):
- License validation system
- Feature gating (free vs paid tiers)
- Tool permission system (approve AI actions)
- Usage tracking/limits

## Testing Recommendations

Before merging, manually verify:

1. **OBS Overlays:** Open VirtualDeck → copy overlay URL → paste in OBS Browser Source → works without token
2. **VTuber API Auth:** Try `curl POST` without token → get 401 error → add token → works
3. **Twitch Connection:** Disconnect & reconnect Twitch → token saved encrypted in tc_config.json
4. **Multi-PC Sync:** Copy `.vd-auth-token` to another PC → restart VD → both PCs accept same token

Run automated tests: `node test-security.js` (already passing)

## Documentation for Users

Created comprehensive docs:
- `docs/SECURITY.md` — Full security guide
- `docs/SECURITY_MIGRATION.md` — Migration guide for existing users
- Both cover multi-PC sync, OBS setup, troubleshooting

## Next Steps (After This PR)

**Immediate (if merging to main):**
- Add Settings UI to view/copy the auth token (currently requires opening file)
- Release notes explaining security improvements
- Update README with security section

**P1 (for paid launch):**
- License validation system (P1-1 from audit)
- JARVIS tool permission system (P1-2 from audit)
- Code signing certs (P1-3 from audit)

**P2 (nice to have):**
- Audit log for all control operations
- Content Security Policy for overlays
- Optional remote access with OAuth2

## Questions?

Check:
- `docs/SECURITY.md` — Detailed security documentation
- `docs/SECURITY_MIGRATION.md` — Migration guide
- `lib/security.js` — Security module implementation
- `test-security.js` — Test suite

Or review the PR: #72

---

**Bottom line:** VirtualDeck is now secure for free distribution and safe for your personal use across multiple PCs. OBS overlays work seamlessly, and you're protected from local attacks and credential theft. No breaking changes for normal usage.
