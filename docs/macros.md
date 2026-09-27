# VirtualDeck Macros

Macros allow you to create sequences of JARVIS tool calls that can be triggered by voice phrases or buttons. This enables complex multi-step workflows like "going live" routines or clip posting automation.

## What Are Macros?

A **macro** is a named sequence of allowlisted JARVIS tool steps that execute in order. Each step is a JARVIS tool call with specific arguments.

**Key Features:**
- **Voice Triggered**: Use Raven voice commands to execute macros (e.g., "Raven we are going live")
- **Button Triggered**: Can also be triggered from VirtualDeck buttons (future enhancement)
- **Sequential Execution**: Steps run in order, one after another
- **Fail-Safe**: Execution stops on first error by default
- **Reusable**: Create once, use repeatedly

## Architecture

- **Grok/Raven = Brain**: The LLM brain decides when to call macros
- **VirtualDeck = Body**: Macros execute allowlisted JARVIS tools (no unrestricted shell or click-at-coordinates)
- **Storage**: Macros are stored in `userData/macros.json` (user-local, not in repo)
- **Security**: Only allowlisted tools can be used in macro steps

## Creating Macros

### Via UI

1. Open **Edit → Preferences**
2. Go to **Macros** section
3. Click **Manage Macros**
4. Click **+ New Macro**
5. Fill in:
   - **Name**: Descriptive name (e.g., "Going Live")
   - **Description**: What the macro does
   - **Voice Trigger Phrase**: Exact phrase to trigger (e.g., "raven we are going live")
   - **Enabled**: Toggle on/off
6. Click **+ Add Step** to add tool calls
7. For each step:
   - Select the **tool** from dropdown
   - Fill in **arguments** (tool-specific)
   - Add optional **description**
8. Click **Save Macro**

### Example: Going Live Macro

**Name:** Going Live  
**Phrase:** "raven we are going live"  
**Steps:**
1. **change_scene** → `sceneName: "Starting Soon"`
2. **refresh_browser_sources** → `waitForSceneName: "Starting Soon"` (waits for scene change to complete)
3. **discord_announce_live** → `includeStreamInfo: true`

### Example: Post Clip Macro

**Name:** Post Clip  
**Phrase:** "raven post the clip"  
**Steps:**
1. **discord_post_clip** → `clipUrl: "<clip-url>"`, `title: "Epic moment!"`
2. **send_twitch_message** → `text: "Clip posted to Discord! Check it out."`

## Available Tools

Macros can use these allowlisted JARVIS tools:

| Tool | Description | Arguments |
|------|-------------|-----------|
| `change_scene` | Switch Meld/OBS scene | `sceneName` |
| `refresh_browser_sources` | Refresh browser sources in current Meld scene | `layerName` (optional) |
| `play_sound` | Play a sound | `name` |
| `send_twitch_message` | Send Twitch chat message | `text` |
| `discord_send_message` | Send Discord message | `message` |
| `discord_announce_live` | Post go-live notification | (optional) `message`, `includeStreamInfo` |
| `discord_post_clip` | Post clip to Discord | `clipUrl`, `title` (optional) |
| `trigger_button` | Trigger a VirtualDeck button | `label` |
| `launch_app` | Launch an application | `nameOrPath` |
| `get_scenes` | Get list of scenes (data only) | none |
| `get_stream_status` | Get stream status (data only) | none |

## Meld Studio Integration

### `refresh_browser_sources`

Refreshes browser sources in the current Meld Studio scene by toggling their visibility (hide then show). This is useful for forcing browser sources to reload their content, such as overlays, web dashboards, or dynamic widgets.

**Arguments:**
- `layerName` (optional): Name of a specific browser source layer to refresh. If not provided, all browser sources in the current scene will be refreshed.
- `waitForSceneName` (optional): Scene name to wait for before refreshing. Use this when calling after `change_scene` to ensure the scene change completes before refreshing. Will poll up to 3 seconds for the scene to become active.

**How it works:**
- Connects to Meld Studio via WebChannel API
- If `waitForSceneName` is provided, polls until the specified scene is active (avoids race condition with scene changes)
- Identifies all layers with a `url` property (browser sources) in the current scene
- Toggles each layer's visibility off, then back on after a brief delay
- This forces the browser source to reload

**Example: Refresh all browser sources**
```json
{
  "tool": "refresh_browser_sources",
  "arguments": {}
}
```

**Example: Refresh specific browser source**
```json
{
  "tool": "refresh_browser_sources",
  "arguments": {
    "layerName": "Chat Overlay"
  }
}
```

**Example: Wait for scene change then refresh**
```json
{
  "tool": "refresh_browser_sources",
  "arguments": {
    "waitForSceneName": "Starting Soon"
  }
}
```

**Important: Using with `change_scene`**

When using `refresh_browser_sources` immediately after `change_scene` in a macro, always include `waitForSceneName` to avoid a race condition where the refresh targets the old scene's browser sources instead of the new scene:

```json
{
  "steps": [
    { "tool": "change_scene", "arguments": { "sceneName": "Starting Soon" } },
    { "tool": "refresh_browser_sources", "arguments": { "waitForSceneName": "Starting Soon" } }
  ]
}
```

**Requirements:**
- Meld Studio must be running and connected to VirtualDeck
- Browser sources must exist in the current scene
- WebChannel API must be available (Meld Studio 1.0+)

**Use Cases:**
- Refresh chat overlays when going live
- Reload event list widgets before stream starts
- Update dynamic overlays with new data
- Force browser sources to reconnect after network issues

## Discord Integration

### Setup

Before using Discord tools in macros, configure Discord in **Edit → Preferences**:

#### Option 1: Webhook URL (Recommended)

1. Go to your Discord server settings
2. Navigate to **Integrations → Webhooks**
3. Click **New Webhook**
4. Set name (e.g., "VirtualDeck") and choose channel
5. Copy the **Webhook URL**
6. Paste into VirtualDeck **Preferences → Discord Integration → Webhook URL**

**Pros**: Simple, no bot setup needed  
**Cons**: Can only post to one channel (the webhook's channel)

#### Option 2: Bot Token (Advanced)

1. Create a Discord bot at [discord.com/developers/applications](https://discord.com/developers/applications)
2. Go to **Bot** section and copy the **token**
3. Invite bot to your server with `Send Messages` permission
4. Paste token into VirtualDeck **Preferences → Discord Integration → Bot Token**
5. Enter **Default Channel ID** (right-click channel in Discord with Developer Mode enabled)

**Pros**: Can post to multiple channels  
**Cons**: Requires bot setup

### Discord Tools

#### `discord_send_message`

Send a custom message to Discord.

**Arguments:**
- `message` (required): Message text
- `channelId` (optional): Channel ID (bot mode only, uses default if not provided)

**Example:**
```json
{
  "tool": "discord_send_message",
  "arguments": {
    "message": "Stream starting in 5 minutes! 🎮"
  }
}
```

#### `discord_announce_live`

Post a go-live announcement with embedded stream info.

**Arguments:**
- `message` (optional): Custom announcement text (default: "🔴 Going live now! Come hang out! 🎮")
- `includeStreamInfo` (optional): Include Twitch channel embed (default: true)
- `channelId` (optional): Channel ID (bot mode only)

**Example:**
```json
{
  "tool": "discord_announce_live",
  "arguments": {
    "message": "🎮 We're live! Playing Elden Ring today!",
    "includeStreamInfo": true
  }
}
```

#### `discord_post_clip`

Post a clip notification with link.

**Arguments:**
- `clipUrl` (required): Clip URL
- `title` (optional): Clip title
- `message` (optional): Custom message
- `channelId` (optional): Channel ID (bot mode only)

**Example:**
```json
{
  "tool": "discord_post_clip",
  "arguments": {
    "clipUrl": "https://clips.twitch.tv/...",
    "title": "Epic Boss Fight!",
    "message": "Check out this insane clip! 🔥"
  }
}
```

## Executing Macros

### Via Voice (Raven)

If Raven is running and connected, simply say the trigger phrase:

```
"Raven we are going live"
```

Raven will recognize the phrase and call the `run_macro` JARVIS tool.

### Via JARVIS API

You can also execute macros programmatically via JARVIS HTTP API:

```bash
curl -X POST http://127.0.0.1:8091/jarvis/invoke \
  -H "Content-Type: application/json" \
  -H "X-VD-Auth: <your-token>" \
  -d '{
    "tool": "run_macro",
    "arguments": {
      "id": "going-live"
    }
  }'
```

### Via UI

In the Macros Manager, click the **Run** button next to any enabled macro to test it immediately.

## Macro Execution Flow

1. **Trigger**: Voice phrase detected or button pressed
2. **Lookup**: Find macro by ID or phrase
3. **Validate**: Check if macro is enabled
4. **Execute Steps**: Run each step sequentially
   - Step 1: Call tool with arguments
   - Step 2: Wait for result
   - Step 3: If success, continue; if error, stop (unless `stopOnError: false`)
5. **Return**: Report success/failure with per-step results

## Troubleshooting

### Macro doesn't trigger via voice

- Ensure Raven is running and connected
- Check voice trigger phrase is **exact match** (case-insensitive)
- Verify macro is **enabled** in Macros Manager
- Check Raven logs for LLM intent recognition

### Discord notification fails

- Verify Discord is configured in Preferences
- Test webhook URL with a simple `curl` command
- For bot mode, ensure bot has **Send Messages** permission
- Check channel ID is correct (copy from Discord with Developer Mode)

### Step execution fails

- Check JARVIS server is running (should start automatically)
- Verify tool arguments are correct (e.g., scene names, button labels)
- Check auth token is valid (`.vd-auth-token` file exists)
- Look at VirtualDeck console logs for error details

### Macro runs but does nothing

- Verify each step's tool is implemented (some tools are stubs)
- For scene changes, ensure Meld Studio is running and connected
- For Discord posts, ensure Discord config is valid
- Check macro steps list in editor to confirm steps are saved

## Best Practices

1. **Test Steps Individually**: Before creating a macro, test each tool via JARVIS API to ensure it works
2. **Use Descriptive Names**: Name macros clearly (e.g., "Going Live Routine" not "Macro 1")
3. **Add Descriptions**: Document what each step does for future reference
4. **Keep Macros Focused**: Don't create mega-macros; use multiple small macros instead
5. **Handle Failures**: Consider adding error recovery steps or notifications
6. **Secure Your Tokens**: Never commit Discord bot tokens or webhook URLs to public repos

## Security Notes

- **API Keys**: Discord bot tokens and webhook URLs are stored in user preferences (localStorage), not in the repo
- **Allowlist Only**: Macros can only execute pre-approved JARVIS tools, not arbitrary shell commands
- **Auth Required**: JARVIS API requires `.vd-auth-token` authentication
- **Local Network**: JARVIS server binds to `127.0.0.1` (localhost only) by default

## Advanced: Programmatic Macro Creation

Macros are stored in `userData/macros.json` as JSON. You can edit this file directly (with VirtualDeck closed):

```json
{
  "my-macro": {
    "name": "My Custom Macro",
    "description": "Does cool stuff",
    "triggers": {
      "phrase": "raven do the thing",
      "button": null
    },
    "steps": [
      {
        "tool": "play_sound",
        "arguments": { "name": "airhorn" },
        "description": "Play airhorn"
      },
      {
        "tool": "send_twitch_message",
        "arguments": { "text": "The thing has been done!" },
        "description": "Announce in chat"
      }
    ],
    "enabled": true,
    "stopOnError": true,
    "createdAt": "2026-09-27T20:00:00.000Z",
    "updatedAt": "2026-09-27T20:00:00.000Z"
  }
}
```

**Fields:**
- `name` (required): Display name
- `description` (optional): What the macro does
- `triggers.phrase` (optional): Voice trigger phrase
- `triggers.button` (optional): Button ID (future)
- `steps` (required): Array of `{tool, arguments, description}` objects
- `enabled` (optional): true/false (default: true)
- `stopOnError` (optional): Stop on first error (default: true)

## Future Enhancements

- **Button Triggers**: Bind macros to VirtualDeck buttons
- **Conditional Logic**: If/else branching in macro steps
- **Variables**: Pass data between steps
- **Scheduled Macros**: Run macros at specific times
- **Macro Templates**: Pre-built macros for common workflows
- **Import/Export**: Share macros with community

## Support

For issues or feature requests, file an issue on the [VirtualDeck GitHub repo](https://github.com/jontslater/virtualdeck).
