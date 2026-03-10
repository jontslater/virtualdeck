# VirtualDeck Feature Ideas

Streamer-focused (primarily Twitch) feature suggestions to consider for future releases. Battles already differentiates the app; these would deepen the “control deck” and interactive overlay angle.

---

## 1. Stream health & OBS control

- **OBS WebSocket** – From the deck: switch scene, toggle source visibility, start/stop stream, start/stop recording. One button = “Go live + switch to Starting Soon + run sound”.
- **Alerts** – Optional on-screen or audio when bitrate drops, frames dropped, or stream disconnects (if you read from OBS or a small monitor).

*Why:* Streamers already use OBS; tying the deck to OBS makes it the “control center” and reduces alt-tabbing.

---

## 2. Raid / “Raid out” flow

- **One-click raid** – Button that (1) calls Twitch API to raid a chosen channel (or “last chatted / suggested”), (2) optionally copies a raid message to clipboard or sends a chat command, (3) optionally switches OBS scene (e.g. “Raid out” scene).
- **Raid suggestions** – Small list of channels to raid (e.g. from a fixed list or “recently hosted”) and a deck button per suggestion.

*Why:* Raiding is core to Twitch; making it one button fits the deck and feels unique.

---

## 3. Viewer-triggered deck actions

- **Redeem → deck button** – Map a Channel Point redemption to run a *specific deck button* (sound + overlay + scene, etc.), not just a generic “alert”. So “Play sound X and show overlay Y” is a redemption.
- You already have redemption → progression and redemption → button keywords; this is “redemption → this exact deck button by ID”.

*Why:* Viewers drive the stream; the deck becomes the backend for “viewer redeems = complex action”.

---

## 4. Shoutouts & chat tools

- **Shoutout button** – One press: run a command like `!so username` or send a formatted message (“Go follow @user!”), optionally show an on-screen shoutout (name, avatar, last stream title) using Twitch API. Could be a hotkey or a button per “recent raider / VIP”.
- **Quick chat** – Buttons that send a fixed chat message (e.g. “!discord”, “!clip”, “Back in 5”), with optional cooldown.

*Why:* Shoutouts and quick replies are daily tasks; putting them on the deck speeds things up.

---

## 5. Schedule & “going live” polish

- **Stream schedule** – Simple weekly schedule (e.g. “Tue/Thu 7pm”) stored in app, optional overlay or “next stream” panel.
- **Starting soon / BRB** – Deck buttons that (1) switch OBS to “Starting soon” or “BRB” scene and (2) optionally start a countdown on an overlay. Optionally auto-switch when you go live (if you add OBS + go-live logic).

*Why:* Complements go-live announcements and makes the deck control “the look” of the stream.

---

## 6. Battles-style “second screen” for viewers

- **Polls / predictions on overlay** – Let the streamer start a poll or prediction from the deck; overlay shows question and options; you read result from Twitch API and show winner on overlay.
- **Simple “viewer vs streamer” minigame** – E.g. “chat votes A/B, deck button locks in streamer choice”; overlay shows result. Lighter than full battles but same “interactive overlay” idea.

*Why:* Battles are unique; doubling down on “deck-driven interactive overlays” gives a clear niche.

---

## 7. Clip & highlight workflow

- **“Clip and post”** – After creating a clip (existing !clip + optional Discord), add: “Add to queue” or “Mark as highlight” so a later flow can export a batch to YouTube/TikTok or a “best of” list.
- **Clip templates** – Optional pre-set messages (e.g. “Check out this moment”) when posting clip to Discord/Bluesky.

*Why:* Streamers want to turn clips into content; the deck can be the starting point.

---

## 8. Small quality-of-life

- **Spotify / “now playing”** – Optional overlay or chat command that shows current track (if you integrate with Spotify or a “now playing” API). Less critical but popular.
- **Game/title sync** – Button or auto: set Twitch title/game from a preset (e.g. “Just Chatting – Q&A”) or from OBS scene name. Reduces tabbing to Twitch dashboard.

---

## Suggested priority (if picking a few)

1. **OBS WebSocket** – Biggest leverage: deck controls the stream.
2. **Raid out one-click** – High impact, very “Twitch”, fits the deck.
3. **Redeem → deck button** – Deepens the “viewer drives the deck” angle.
4. **Shoutout button** – Fast to ship, used every stream.

Battles stay the standout “only in VirtualDeck” feature; OBS + raid + redemption-to-deck would make the app feel like a single, streamer-focused control panel rather than a collection of separate tools.
