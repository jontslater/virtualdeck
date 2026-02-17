# VirtualDeck Twitch Battles (MVP Plan)

## Goal
Create a Twitch “battle” feature where:
- Streamers join a shared battle room
- Viewer support events (Bits, Subs, Gifted Subs) trigger battle actions
- Each streamer has ONE persistent OBS browser source overlay
- Overlay stays transparent when idle and automatically appears when a battle starts

This is similar to TikTok battles, but powered by Twitch events + a backend battle engine.

---

## MVP Definition (Ship This First)
### MVP Experience
1) Streamer authenticates with Twitch
2) Streamer creates a room / joins a room
3) Both streamers already have a single “Battle Overlay” browser source set up once
4) Streamer clicks “Start Battle”
5) Viewers Cheer/Sub to trigger damage/abilities
6) Overlay becomes visible (renders UI) only while the battle is active
7) Battle ends automatically after timer or HP hits 0

### MVP Scope
- 2 streamers max per room
- Event types:
  - Bits (Cheer)
  - Subs (new/resub)
  - Gift subs (community or single)
- Battle rules:
  - Each side has HP (e.g. 10,000)
  - Bits/subs convert to damage
  - Simple effects (hit flashes, damage numbers)
- Overlay:
  - Minimal UI: names + HP bars + last action + countdown timer
  - Transparent when idle (renders nothing)
- VirtualDeck:
  - “Create Room”, “Join Room”, “Start/End”
  - “Copy Overlay URL” (one-time setup helper)

---

## Architecture Overview
### Core Components
1) Backend API (Auth, Rooms, Battle State)
2) Twitch EventSub Ingestion (realtime events -> battle actions)
3) Realtime Gateway (WebSocket) for overlay updates
4) Overlay Web App (browser source) renders battle UI
5) VirtualDeck UI integration (room control + setup)

### Recommended Tech (fits your stack)
- Backend: Node.js + TypeScript (Fastify or Express)
- DB: Postgres (Neon) + Drizzle ORM (or Prisma)
- Realtime: Socket.IO (fast iteration) or WS
- Overlay: React/Vite (or Next) hosted as static app + socket
- Auth: Twitch OAuth
- Twitch events: EventSub (webhooks or websocket transport)

---

## Critical Design Choice: ONE Persistent Overlay URL
Streamer adds browser source once:
- URL is stable, never changes
- Overlay determines if battle is active for that streamer and only renders during battle

Two viable approaches:
A) Stable URL + channel param (simpler)
  https://overlay.virtualdeck.gg/battle?channel=tehchno
B) Stable URL + signed token (more secure)
  https://overlay.virtualdeck.gg/battle?token=JWT

MVP suggestion: start with (A) + add signing later.

---

## Data Model (Minimal)
### Tables
#### users
- id (uuid)
- twitch_user_id (string)
- twitch_login (string)
- display_name (string)
- access_token (encrypted/secure store)
- refresh_token (encrypted/secure store)
- token_expires_at (timestamp)
- created_at, updated_at

#### rooms
- id (uuid / short code like ABC123)
- host_user_id (uuid)
- status ("lobby" | "active" | "ended")
- created_at, updated_at

#### room_participants
- id
- room_id
- user_id
- team ("A" | "B")
- joined_at

#### battles
- id
- room_id
- status ("active" | "ended")
- started_at
- ends_at
- winner_team ("A" | "B" | null)
- hp_a (int)
- hp_b (int)

#### battle_events (optional for audit/debug)
- id
- battle_id
- type ("bits" | "sub" | "gift_sub")
- twitch_event_id (string) UNIQUE (for idempotency)
- from_user (string nullable)
- amount (int)
- team ("A"|"B")
- created_at

---

## Twitch Event Mapping (MVP Rules)
Define a single function:
`supportEventToDamage(event) => damage`

Example rules:
- Bits: damage = bits * 1 (or bits * 0.5)
- Sub: damage = 500
- Gift Sub: damage = 250

Also define “specials” later (V1):
- Bits >= 1000 triggers “ULT” animation
- Gift streak triggers “combo”

---

## Realtime Contract (Overlay <-> Backend)
Use a single channel per streamer: `channel:{twitch_login}`

### Socket Events
Client -> Server
- "overlay:hello" { channel: "tehchno" }
- "overlay:join" { channel: "tehchno" }  // subscribe to that streamer’s updates

Server -> Client
- "battle:status" {
    active: boolean,
    roomId?: string,
    battle?: {
      hpA, hpB,
      teamAName, teamBName,
      endsAt,
      lastAction?: { text, amount, team }
    }
  }

- "battle:update" {
    hpA, hpB,
    lastAction: { text, amount, team },
    ts
  }

Overlay behavior:
- if active=false => render nothing (transparent)
- if active=true => render the battle UI

---

## Backend APIs (MVP)
### Auth
- GET /auth/twitch -> redirect to Twitch OAuth
- GET /auth/twitch/callback -> store tokens, create user, issue session/JWT

### Rooms
- POST /rooms -> create room (host becomes Team A)
- POST /rooms/:id/join -> join room (joiner becomes Team B)
- POST /rooms/:id/start -> create battle, set status active, broadcast
- POST /rooms/:id/end -> end battle, broadcast

### Overlay helpers
- GET /overlay/status?channel=tehchno
  returns { active, roomId, battleSnapshot }

Overlay can call this on load, then connect socket for deltas.

---

## Twitch EventSub Plan
### What you need
For each participating streamer, you must be able to receive:
- channel.cheer
- channel.subscribe
- channel.subscription.gift

Implementation options:
1) EventSub Webhooks (requires public https + signature verification)
2) EventSub WebSocket transport (often easier for MVP, but still needs careful reconnect logic)

MVP suggestion:
- Use EventSub Webhooks if you already run a server publicly (preferred long-term)
- Ensure idempotency using Twitch event ID in battle_events (unique constraint)

Event flow:
Twitch -> /webhooks/eventsub -> validate signature -> parse event -> map to room/team -> apply damage -> broadcast update

---

## Battle Engine (MVP)
Single in-memory loop with DB persistence:
- Create battle row with hpA/hpB, endsAt = now + 120s
- When event arrives:
  - check battle still active
  - compute damage
  - subtract from opposing team HP
  - if hp <= 0 => end battle, set winner
  - emit socket update to both channels
- Timer tick:
  - if now >= endsAt => end battle; winner = higher HP

Notes:
- In-memory is fine for MVP if you have 1 instance.
- If you expect scale, move to Redis pub/sub or DB-backed locking later.

---

## Overlay App (MVP UI)
### Requirements
- Transparent background
- “Idle” mode renders nothing
- Active UI:
  - Team A name + HP bar
  - Team B name + HP bar
  - Countdown timer
  - Last action line (e.g. “Cheer 500! -500 HP”)

### Implementation Details
- Connect socket on load
- Call /overlay/status?channel=... for snapshot
- Smooth animate HP bar changes (CSS transition)
- Keep fonts large, readable on stream

---

## VirtualDeck Integration (MVP)
### Invite Flow (TikTok-style)
- **Enable battles** checkbox: persists to localStorage; when enabled, sends heartbeat every ~25s so you appear in the online list
- **Invite to battle**: list of online users (from `GET /battles/online`); click to send invite via `POST /battles/invite`
- **Pending invites**: list from `GET /battles/invites/pending`; Accept/Decline via `POST /battles/invite/:id/accept` and `POST /battles/invite/:id/decline`
- **Incoming invite toast**: when `battle:invite` arrives via Socket.IO, show toast with Accept/Decline
- **On accept**: room + battle created; both participants get `battle:accepted` via Socket; overlay URL uses room id or Twitch login
- Copy Overlay URL (add to OBS Browser Source)

### Invite API
| Method | Endpoint | Body/Query | Description |
|--------|----------|------------|-------------|
| POST | /battles/heartbeat | `{ twitch_login, battles_enabled }` | Register as online (60s TTL) |
| GET | /battles/online | - | List online users |
| POST | /battles/invite | `{ from, to }` | Send invite |
| GET | /battles/invites/pending | `?user=` | Pending invites for user |
| POST | /battles/invite/:id/accept | - | Accept invite, create room+battle |
| POST | /battles/invite/:id/decline | - | Decline invite |

### Socket.IO (Dashboard)
- Connect to backend, emit `dashboard:hello` with `{ twitch_login }` to join `dashboard:{login}` room
- Listen for `battle:invite` `{ id, from_user, to_user }` → show toast
- Listen for `battle:accepted` `{ roomId, from }` → update overlay URL, show battle UI

### Optional nice touches
- Show “Battle Active” indicator
- Show last event received (debug)

---

## Security + Reliability Checklist
MVP minimum:
- Validate EventSub signatures (if using webhooks)
- Idempotency: ignore duplicate Twitch events (unique twitch_event_id)
- Token storage: encrypt refresh tokens / keep out of logs
- Rate limit overlay status endpoint
- Handle socket reconnect + re-send snapshot

---

## Development Milestones (Execution Order)
### Milestone 1: Skeleton
- [ ] Repo setup (backend + overlay as separate packages)
- [ ] Backend server running + DB migrations
- [ ] Overlay page running + transparent background

### Milestone 2: Rooms + Overlay Status
- [ ] Auth stub (can fake users locally)
- [ ] Create/join room endpoints
- [ ] /overlay/status endpoint returns active=false
- [ ] Overlay shows nothing when inactive

### Milestone 3: Start Battle + Realtime Updates
- [ ] Start battle endpoint creates battle row
- [ ] Socket server: overlay joins channel
- [ ] Broadcast battle:status active=true with snapshot
- [ ] Overlay renders battle UI when active

### Milestone 4: Twitch Auth + EventSub
- [ ] Twitch OAuth login for streamer
- [ ] Register EventSub for cheer/sub/gift topics for that streamer
- [ ] Webhook receiver validates signature
- [ ] Events reduce HP and broadcast battle:update

### Milestone 5: Polish + End Conditions
- [ ] Timer end condition
- [ ] Winner screen for 5s then go idle
- [ ] Basic admin/debug logs
- [ ] VirtualDeck UI buttons wired in

---

## Cursor Workflow (How to Build Fast)
### Recommended Cursor prompts (copy/paste)
1) “Create the backend Fastify/Express server in TypeScript with routes for /rooms, /rooms/:id/join, /rooms/:id/start, and a simple in-memory room store. Include Zod validation.”
2) “Add Postgres + Drizzle models for users/rooms/participants/battles and migrate the in-memory store to DB.”
3) “Implement Socket.IO server: clients join ‘channel:{login}’. Add events battle:status and battle:update.”
4) “Build a React overlay page that reads ?channel= from URL, calls /overlay/status, then connects Socket.IO and renders UI only when active.”
5) “Implement Twitch OAuth login and store tokens securely. Add EventSub webhook route and signature validation.”
6) “Wire EventSub cheer/sub/gift events into battle engine and broadcast updates.”

---

## Future V1 Ideas (After MVP)
- Leaderboard / “top battlers”
- More than 2 streamers (teams)
- Skins + battle themes (monetization)
- Special abilities and combos
- OBS auto-toggle visibility via obs-websocket (through VirtualDeck)
- Replays / highlights / recap card

---
