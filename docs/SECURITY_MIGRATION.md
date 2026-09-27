# Security Hardening Migration Guide

This document describes the security changes in this release and what you need to know.

## What Changed?

### 1. Authentication Required for Control APIs

**Before:** Anyone/anything on your PC could control VirtualDeck via HTTP
**After:** Control operations require an authentication token

### 2. Twitch Tokens Encrypted

**Before:** Twitch OAuth tokens stored in plain text
**After:** Tokens encrypted using OS-level encryption (DPAPI/Keychain)

### 3. Path Validation

**Before:** File paths from IPC not validated
**After:** All paths sanitized to prevent directory traversal

## Do I Need to Do Anything?

### For Most Users: NO

- Your existing setup will continue working
- OBS overlays work without any changes
- Twitch tokens are automatically migrated to encrypted storage

### You MAY Need to Act If:

#### You control VirtualDeck from external scripts

If you have scripts that POST to the VTuber API, you'll need to add the token:

**Old way (no longer works):**
```bash
curl -X POST http://localhost:8080/api/vtuber/state \
  -H "Content-Type: application/json" \
  -d '{"state": "talking"}'
```

**New way:**
```bash
# Get your token first
TOKEN=$(cat "$APPDATA/VirtualDeck/.vd-auth-token")

# Use it in your request
curl -X POST http://localhost:8080/api/vtuber/state \
  -H "X-VD-Auth: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "talking"}'
```

#### You use VirtualDeck on multiple PCs

If you want to control VirtualDeck on PC #2 from scripts on PC #1:

1. **On PC 1:** Copy `%APPDATA%\VirtualDeck\.vd-auth-token`
2. **On PC 2:** Paste it to the same location
3. Restart VirtualDeck on PC 2

Now both PCs share the same auth token.

## OBS Browser Sources - No Changes Required

**Read-only overlays continue to work with no token:**

```
http://localhost:8080/overlay?name=myOverlay         ← Still works!
http://localhost:8080/overlay?name=vtuberOverlay     ← Still works!
http://localhost:8080/hydration                      ← Still works!
```

These URLs don't need a token because they're read-only display surfaces.

## Troubleshooting

### "Unauthorized" error when using VTuber API

**Problem:** You're getting 401 errors from the API

**Solution:** Add the token to your requests:
- Query param: `?token=YOUR_TOKEN`
- Header: `X-VD-Auth: YOUR_TOKEN`
- Or: `Authorization: Bearer YOUR_TOKEN`

### Where do I find my token?

**Windows:**
```
%APPDATA%\VirtualDeck\.vd-auth-token
```
Typical path: `C:\Users\YourName\AppData\Roaming\VirtualDeck\.vd-auth-token`

**macOS:**
```
~/Library/Application Support/VirtualDeck/.vd-auth-token
```

**Linux:**
```
~/.config/VirtualDeck/.vd-auth-token
```

Open it with Notepad (Windows) or any text editor.

### My Twitch connection stopped working

This should **not** happen. If it does:

1. Check console logs for encryption errors
2. Try disconnecting and reconnecting Twitch
3. Your token will be re-encrypted on the next save

If problems persist, open a GitHub issue.

## Technical Details

### Token Generation

- Format: 64 hex characters (256 bits of entropy)
- Generated using Node.js `crypto.randomBytes(32)`
- Stored with filesystem permissions 0600 (owner read/write only)

### Encryption Method

Twitch tokens use Electron's `safeStorage` API:
- **Windows:** DPAPI with user's login credentials
- **macOS:** Keychain with application identifier
- **Linux:** libsecret / Secret Service API

### Backward Compatibility

Old config files with plain-text tokens:
1. Are still readable (no data loss)
2. Get automatically upgraded to encrypted storage on next save
3. The upgrade is transparent to the user

## Security Benefits

### Before This Update

❌ Any malicious browser tab could trigger your buttons  
❌ Malware could read your Twitch token from `tc_config.json`  
❌ Malicious buttons could read arbitrary files via path traversal  
❌ No rate limiting on WebSocket messages  

### After This Update

✅ Control operations require authentication  
✅ Twitch tokens encrypted at rest  
✅ File paths validated and sanitized  
✅ WebSocket rate limiting (10 msg/sec)  
✅ OBS overlays still work seamlessly  

## What's Next?

### Future Security Features (P1)

- Settings UI to view/copy your token
- License validation for paid features (JARVIS)
- Tool permission system (approve/deny individual AI actions)
- Audit log for control operations

### Long-term (P2)

- Optional remote access with OAuth2
- Cloud profile sync with E2EE
- Sandboxed plugin system

---

Questions? See `docs/SECURITY.md` or open a GitHub issue.
