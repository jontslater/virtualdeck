# Meld Studio Scene Switching

VirtualDeck can switch scenes in **Meld Studio** via Meld's WebChannel API. Users add a "Meld Scene" button, pick a scene from the list (fetched from Meld), and trigger that button to switch Meld to that scene.

## Requirements

- **Meld Studio** must be running and have the WebChannel server enabled (default: listens on `ws://127.0.0.1:13376`).
- No extra configuration in Meld is needed; the API is built in.

## How It Works

1. **Add button**: User chooses "Meld Scene" when adding a button. VirtualDeck connects to Meld, fetches the list of scenes, and shows a dropdown.
2. **Select scene**: User picks a scene (e.g. "Just Chatting", "Gaming") and gives the button a label and optional hotkey.
3. **Trigger**: When the user clicks the button or presses the hotkey, VirtualDeck sends a scene switch to Meld; Meld switches to that scene.

## API Reference

Meld's API is documented here:

- **Docs**: [Meld Studio API](https://meldstudio.co/docs/api/)
- **WebChannel API (GitHub)**: [WebChannelAPI.md](https://github.com/MeldStudio/streamdeck/blob/main/WebChannelAPI.md)

Summary:

- **Endpoint**: WebSocket `ws://127.0.0.1:13376`
- **Protocol**: Qt WebChannel (JavaScript client: `qwebchannel.min.js` from Meld's CDN)
- **Scene switch**: `meld.showScene(sceneId)` where `sceneId` is the 32-character hex ID of the scene
- **Scene list**: `meld.session.items` — filter items with `type === 'scene'`; each has `name`, `current`, `index`, etc.

## Button Data

A Meld Scene button is stored with:

- `type: 'meld-scene'`
- `sceneId`: Meld scene ID (32-char hex)
- `sceneName`: Display name (e.g. "Just Chatting")
- `label`, `hotkey`, `id`, etc. (same as other buttons)

No file path or media is used.

## Troubleshooting

- **"No scenes" or empty list**: Ensure Meld Studio is open and the project has at least one scene. Restart Meld if the WebChannel port was changed.
- **Button does nothing**: Confirm Meld is running and the scene still exists (IDs are stable for the session but can change if the project is edited).
- **Connection errors**: Check that nothing else is using port 13376 and that your firewall allows localhost WebSocket connections.
