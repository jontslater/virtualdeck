# Twitch Battles Backend

Node + TypeScript backend for VirtualDeck Twitch Battles: rooms, battle state, EventSub webhooks, and realtime overlay updates.

## Requirements

- Node 18+
- Postgres (local or hosted, e.g. Neon)

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `4000`) |
| `DATABASE_URL` | Postgres connection string (default `postgres://postgres:postgres@localhost:5432/virtualdeck`) |
| `TWITCH_EVENTSUB_SECRET` | Optional. If set, EventSub webhook requests are verified with HMAC-SHA256. Set this to the secret you configure when creating EventSub subscriptions in the Twitch developer console. |

## Setup

1. Create a Postgres database and set `DATABASE_URL` if needed.
2. Install and run:

```bash
npm install
npm run dev
```

On first run, the server creates tables (users, rooms, room_participants, battles, battle_events) if they do not exist.

## Scripts

- `npm run dev` — start with ts-node-dev (reload on change)
- `npm run build` — compile to `dist/`
- `npm run start` — run compiled `dist/index.js`
- `npm test` — run Vitest tests

## API (MVP)

- `GET /health` — health check
- `GET /overlay/status?channel=<channel>` — overlay snapshot (active battle or inactive)
- `POST /rooms` — create room (body: `{ "hostUserId": "..." }`)
- `POST /rooms/:id/join` — join room (body: `{ "userId": "..." }`)
- `POST /rooms/:id/start` — start battle (body: `{ "duration": 120 }` optional)
- `POST /rooms/:id/end` — end active battle
- `POST /webhooks/eventsub` — Twitch EventSub webhook (validate signature if `TWITCH_EVENTSUB_SECRET` is set)

## Realtime (Socket.IO)

- Connect to the same origin as the API (e.g. `http://localhost:4000`).
- Emit `overlay:join` with `{ channel: "<channel>" }` to subscribe to that channel’s battle updates.
- Listen for `battle:status` (full snapshot) and `battle:update` (HP/last action deltas).

## EventSub

For production, configure Twitch EventSub (webhooks) for the topics you need (e.g. `channel.cheer`, `channel.subscribe`, `channel.subscription.gift`) and set the webhook URL to `https://your-domain/webhooks/eventsub`. Set `TWITCH_EVENTSUB_SECRET` to the secret you provide when creating the subscription so the backend can verify request signatures.
