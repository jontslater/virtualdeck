# VirtualDeck — Product Overview, Features & Monetization Plan

## Short description
VirtualDeck is a streamer‑focused desktop app that provides a compact dashboard and hotkeys to trigger overlay visuals, audio, and scene switches in real time. It integrates with Twitch (chat + EventSub), OBS/browser overlays (WebSocket HTTP server), and Meld Studio (scene switching). Purpose‑built for live streaming workflows — not post‑production editing.

---

## Core features (what the product currently offers)
- Button-driven dashboard: create buttons that trigger audio, app launches, images, videos, or composite multi-media payloads.
- Meld Scene Buttons: create buttons that switch Meld Studio scenes directly (via Meld WebChannel).
- Global hotkeys: trigger buttons without opening the UI.
- Twitch chat integration: connect to chat, auto-reconnect using stored OAuth, post messages, and respond to commands.
- Chat-command mapping: bind chat keywords (e.g. `!scene1`) to trigger buttons.
- Channel point redemptions: match redeem titles to buttons to trigger overlays or scene switches.
- Bot support: optional bot account for sending chat messages/actions.
- Multi-media buttons: composite media (videos, separate audio, images, text slots) and send structured payloads to overlay pages.
- Overlay server + WebSocket: local HTTP + WebSocket server for OBS browser sources and real‑time overlay messages.
- Dashboard preview (muted): in‑app overlay preview is muted automatically; audio plays only in OBS to avoid double audio.
- Auto-muting & race mitigation: dashboard preview mutes itself via a preview flag and parent safety logic.
- Duplicate prevention: guards against double-submits and duplicate button IDs.
- Clip creation: Twitch clip creation (Helix API) from UI with test mode.
- EventSub: subscribe to Twitch EventSub topics and map events to actions.
- Progression / daily check-ins: channel-point progression support and auto messages.
- Profiles & skins: per-profile settings and custom skins/themes.
- Overlay clearing & timers: automatic clearing and duration handling.

---

## Additional features to consider (prioritized)
1. One‑click setup/wizard (OBS + Meld + overlay URL copy) — reduce onboarding friction.
2. Mobile remote (web UI / PWA) — trigger buttons from a phone.
3. Action sequences / macros: one button can run multiple actions (scene switch → play clip → show alert).
4. Conditional triggers & cooldowns: require follower/subscriber or cooldown per-user; better moderation-friendly mappings.
5. Scheduled actions/timers: automatic scene changes, intermissions, or timed overlays.
6. Marketplace for skins/overlay packs (sell templates, skins, fonts).
7. Cloud sync / profile backup for users (sync across machines).
8. Built-in analytics: show top-used buttons, clip usage, most popular scenes.

---

## Monetization strategy & pricing thoughts
- Freemium core + low-cost subscription (suggested $2.99/month) with Pro features (cloud sync, macros, mobile remote).
- Annual plan discount (e.g., ~$29–32/year) to boost retention.
- Skins marketplace for one‑time purchases; include rotating premium skins for Pro subscribers.
- Use Stripe or Paddle for payments (Paddle simplifies VAT compliance).
- Offer 7–14 day free trial for Pro.

---

## Quick recommended roadmap (minimal to high impact)
1. Polished onboarding + one-click OBS/Meld setup and presets.
2. Mobile remote + macros.
3. Cloud sync and profile backup (Pro).
4. Marketplace for skins (curated first).
5. Analytics and usage dashboard.

---

## Next actions I can help with
- Draft README/marketing blurb targeted at Meld-using streamers.
- Produce a pricing page with tier features and a comparison table.
- Create a release checklist (marketing, docs, build, release notes).

--- 

*Generated and saved to `docs/PRODUCT_OVERVIEW_AND_MONETIZATION.md`*

