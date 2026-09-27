# AI Voice & Personality Configuration

VirtualDeck now includes UI scaffolding for configuring Raven AI's voice and personality settings directly from the AI Audio Settings panel.

## Features

### 🎙️ Voice Picker

Select your preferred TTS voice from your ElevenLabs account.

**Location:** AI Audio Settings panel → Voice Picker section

**Requirements:**
- `TTS_API_KEY` configured in `raven.env` (located in user data folder)
- Active ElevenLabs account with available voices
- Raven AI must be running

**How it works:**
1. Voice list is fetched from ElevenLabs API on startup
2. Select a voice from the dropdown
3. Voice ID is saved to `raven.env` as `TTS_VOICE_ID`
4. Raven uses the selected voice for all TTS output

**Troubleshooting:**
- If voices don't load, click the "Refresh" button
- Ensure `TTS_API_KEY` is set in `raven.env`
- Check that Raven AI is running (View menu → Start Raven AI)
- Voice list retries automatically for ~45 seconds after launch

### 🧠 Personality Builder

Compose AI personality from structured dropdowns instead of editing raw prompts.

**Location:** AI Audio Settings panel → Personality Builder section

**Personality Components:**

1. **Tone** - Overall communication style
   - Friendly & Warm
   - Professional
   - Casual & Relaxed
   - Enthusiastic
   - Sarcastic
   - Witty & Clever

2. **Energy Level** - Activity and excitement
   - High Energy
   - Medium Energy (default)
   - Low Energy / Chill
   - Adaptive (Match Chat)

3. **Humor Style** - Comedy approach
   - No Humor
   - Light Jokes
   - Moderate Humor (default)
   - Lots of Jokes
   - Dry Humor
   - Meme Culture

4. **Role/Character** - AI's function
   - Gaming Companion (default)
   - Gaming Coach
   - Commentator
   - Sidekick
   - Assistant
   - Custom (use raw prompt)

**How it works:**
1. Select options from each dropdown
2. Click "Save Personality" button
3. System composes a personality prompt from your selections
4. Prompt is saved to `raven.env` as `AI_PERSONALITY_PROMPT`
5. Personality config is also saved as a JSON comment for later editing

**Advanced: Raw Prompt Override**

Expand the "Advanced: Raw Prompt" section to enter a custom system prompt that overrides the dropdown composition. Leave empty to use the personality builder.

## Technical Details

### API Endpoints

VirtualDeck provides the following HTTP API endpoints on port 8080:

**All endpoints require authentication** via one of:
- `X-VD-Auth: <token>` header
- `Authorization: Bearer <token>` header
- `?token=<token>` query parameter

Token is stored in `.vd-auth-token` in user data folder.

**Endpoints:**

- `GET /api/ai/voices` - Fetch available voices from ElevenLabs (requires auth to protect API quota)
- `POST /api/ai/voice` - Save selected voice ID (requires auth)
  - Body: `{ "voiceId": "...", "voiceName": "..." }`
- `GET /api/ai/personality` - Get saved personality config (requires auth)
- `POST /api/ai/personality` - Save personality settings (requires auth)
  - Body: `{ "personality": {...}, "prompt": "..." }`

### Configuration Storage

All settings are persisted to `raven.env` in the user data directory.

**Safe Writing**: Values containing spaces, newlines, or special characters are automatically quoted and escaped to prevent env file corruption. Multi-line personality prompts are stored as single-line escaped strings.

```env
# Voice configuration
TTS_VOICE_ID=abc123...

# Personality configuration (quoted/escaped if contains special chars)
AI_PERSONALITY_PROMPT="You are friendly and warm, maintaining a balanced energy level.\nYou use moderate humor to keep things fun."
# AI_PERSONALITY_CONFIG={"tone":"friendly","energy":"medium",...}
```

### Frontend Storage

UI state is also cached in browser localStorage:
- `VD_AI_VOICE_CONFIG` - Selected voice (for UI display)
- `VD_AI_PERSONALITY_CONFIG` - Personality dropdowns state

## Raven/AITuber Integration

### Current Scope

This feature provides **configuration UI only**. The actual voice/personality application happens in:
- **Raven** - The AI controller that reads `raven.env` and applies settings
- **AITuber** - If needed, reads the same config

### Usage in Raven

Raven should read these environment variables on startup or config reload:

```javascript
const voiceId = process.env.TTS_VOICE_ID || '';
const personalityPrompt = process.env.AI_PERSONALITY_PROMPT || defaultPrompt;

// Use voiceId when calling ElevenLabs TTS API
// Use personalityPrompt as system message in LLM calls
```

### Recommended Raven Changes

If Raven needs updates to honor these settings:

1. Read `TTS_VOICE_ID` and pass to ElevenLabs API
2. Read `AI_PERSONALITY_PROMPT` and use as system message
3. Optionally: expose a reload-config endpoint for live updates

## Development Notes

### Module Structure

- `lib/ai-config.js` - AIConfigManager class
  - Reads/writes `raven.env`
  - Fetches voices from ElevenLabs
  - Composes personality prompts
- `main.js` - HTTP API handler (`handleAIConfigAPI`)
- `public/index.html` - UI components
- `public/script.js` - Frontend logic

### Security

- **Authentication required**: All `/api/ai/*` endpoints require `.vd-auth-token` authentication
  - Protects against unauthorized config changes
  - Protects ElevenLabs API quota (GET `/api/ai/voices` requires auth)
- API keys are **never** hardcoded or bundled
- Users must provide their own keys (BYOK)
- `TTS_API_KEY` is read from user data folder only
- Voice API requests go through VirtualDeck backend (keys not exposed to frontend)
- Frontend uses `electronAPI.getAuthToken()` to retrieve token securely
- Same auth mechanism as other VirtualDeck overlay/API endpoints

### Future Enhancements

Potential improvements for later:
- Live preview of personality changes
- Voice preview/sample playback
- More granular personality controls
- AI mode presets that bundle voice + personality
- Multi-profile support (different personalities per stream segment)
