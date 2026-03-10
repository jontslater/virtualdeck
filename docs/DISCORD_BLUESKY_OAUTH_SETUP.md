# Discord and Bluesky OAuth Login Setup

This doc is a step-by-step guide to add “Log in with Discord” and “Log in with Bluesky” to VirtualDeck (go-live and clip announcements), so users pick channels and authorize the app instead of pasting webhook URLs or app passwords.

---

## Overview

| Platform | Current flow | OAuth flow |
|----------|--------------|------------|
| **Discord** | User creates webhook in Discord, pastes URL into VirtualDeck | User clicks “Connect Discord”, authorizes app, picks channel → VirtualDeck receives webhook URL from Discord |
| **Bluesky** | User enters handle + app password in Preferences | User clicks “Log in with Bluesky”, authorizes in browser → VirtualDeck stores OAuth tokens and posts with them |

You need a developer application on each platform (free) and a small OAuth flow in VirtualDeck (redirect handler + token exchange).

---

## Part 1: Discord OAuth (webhook.incoming)

### 1.1 Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, name it (e.g. “VirtualDeck”), create.
3. In the app:
   - **OAuth2 → General**: note your **Client ID** and **Client Secret** (reset secret if needed).
   - **OAuth2 → Redirects**: Add redirect URI(s), e.g.:
     - Dev: `http://localhost:3000/discord/callback` (or whatever port your OAuth server uses).
     - Prod: `https://your-domain.com/discord/callback` if you host a callback server; or a custom scheme like `virtualdeck://discord/callback` for desktop.

### 1.2 Build the authorize URL

Use the **webhook.incoming** scope so the user can pick a channel and Discord returns a webhook for it:

- **Scope:** `webhook.incoming`
- **Authorize URL:**  
  `https://discord.com/oauth2/authorize?response_type=code&client_id=YOUR_CLIENT_ID&scope=webhook.incoming&state=STATE_NONCE&redirect_uri=YOUR_REDIRECT_URI`

Replace `YOUR_CLIENT_ID`, `STATE_NONCE` (random string for CSRF), and `YOUR_REDIRECT_URI` (URL-encoded).

### 1.3 Handle the redirect and exchange code for token

1. User approves in Discord and is sent to your `redirect_uri` with `?code=...&state=...`.
2. In VirtualDeck (main process or a small local server), handle that route:
   - Verify `state` matches what you sent.
   - Exchange the code for tokens:
     - **URL:** `POST https://discord.com/api/oauth2/token`
     - **Content-Type:** `application/x-www-form-urlencoded`
     - **Body:** `client_id`, `client_secret`, `grant_type=authorization_code`, `code`, `redirect_uri`
3. Discord’s token response can include a **webhook** object, e.g.:
   - `webhook.url` – webhook URL for the channel the user chose
   - `webhook.channel_id`, `webhook.guild_id` (optional, for display)
4. Store `webhook.url` in preferences (e.g. `goLiveDiscordWebhook` or `clipDiscordWebhook`) and close the callback window or show “Connected”.

### 1.4 VirtualDeck code changes

- Add config for Discord OAuth (e.g. `discordClientId`, `discordClientSecret`, `discordRedirectUri`) – same pattern as `twitch-oauth-config.js` if you want.
- Add UI: “Connect Discord” (and optionally “Connect for go-live” vs “Connect for clips”).
- Implement: open browser to authorize URL → start a local HTTP server or use existing Twitch OAuth server to handle `/discord/callback` → exchange code → save webhook URL to preferences.
- Keep the existing “paste webhook URL” field as a fallback if you want.

**Reference:** [Discord OAuth2](https://discord.com/developers/docs/topics/oauth2), [OAuth2 to Webhooks](https://discord.com/developers/docs/topics/oauth2#webhooks) (webhook in token response).

---

## Part 2: Bluesky OAuth

### 2.1 Register an OAuth client with Bluesky

1. Read Bluesky’s OAuth docs: [OAuth Client Implementation](https://docs.bsky.app/docs/advanced-guides/oauth-client), [OAuth for AT Protocol](https://docs.bsky.app/blog/oauth-atproto).
2. Register your client (Bluesky may use discovery or a developer portal – follow their current instructions for “Desktop” or “Native” app).
3. Get:
   - **Client ID** (often a URL, e.g. `https://your-app.com` or an identifier).
   - **Client Secret** (if required for your client type).
   - **Redirect URI(s)** – for desktop, often `http://localhost:PORT/callback` or a custom URL scheme.

### 2.2 Build the authorize URL

1. Bluesky uses standard OAuth2 auth + token endpoints (with possible discovery). Obtain:
   - Authorization URL (e.g. from Bluesky’s well-known or docs).
   - Token URL for exchanging `code` for tokens.
2. Open the user’s browser to the authorization URL with:
   - `response_type=code`
   - `client_id`
   - `redirect_uri`
   - `scope` (e.g. post/create scope if documented)
   - `state` (random string)

### 2.3 Handle the redirect and exchange code for tokens

1. User authorizes and is redirected to your `redirect_uri` with `?code=...&state=...`.
2. In VirtualDeck:
   - Verify `state`.
   - Exchange `code` for tokens (POST to Bluesky’s token endpoint with `client_id`, `client_secret` if used, `code`, `redirect_uri`, `grant_type=authorization_code`).
   - Store **access_token** and **refresh_token** securely (e.g. in preferences.json or a secrets store; do not log them).
3. When posting (go-live):
   - Use **access_token** in the `Authorization: Bearer ...` header instead of creating a session with handle + app password.
   - Use Bluesky’s create post endpoint (e.g. `com.atproto.repo.createRecord`) with the access token; refresh the token when it expires using **refresh_token**.

### 2.4 VirtualDeck code changes

- Add Bluesky OAuth config (client id, secret if needed, redirect URI).
- Add UI: “Log in with Bluesky” (and optionally “Disconnect”).
- Implement: open browser to Bluesky authorize URL → handle callback (local server or custom scheme) → exchange code → store access + refresh tokens.
- In `postToBluesky` (or equivalent): if OAuth tokens exist, use them to get a fresh access token (and refresh if needed), then call the post API with that token; otherwise fall back to existing handle + app password flow if you keep it.

**Reference:** [Bluesky OAuth Client Implementation](https://docs.bsky.app/docs/advanced-guides/oauth-client), [OAuth for AT Protocol](https://docs.bsky.app/blog/oauth-atproto).

---

## Part 3: Implementation checklist

### Discord

- [ ] Create Discord Application; note Client ID and Client Secret.
- [ ] Add OAuth2 redirect URI(s) in the Discord portal.
- [ ] Add Discord OAuth config (e.g. in a config file or env) and optionally a `discord-oauth-config.js`-style file.
- [ ] Implement: “Connect Discord” button → open authorize URL with `scope=webhook.incoming` and state.
- [ ] Implement: callback server/route → exchange code for token → read `webhook.url` from response → save to preferences (go-live and/or clip webhook).
- [ ] (Optional) Keep “paste webhook URL” as fallback.

### Bluesky

- [ ] Register OAuth client with Bluesky/AT Protocol; note client id, secret (if any), redirect URI(s).
- [ ] Add Bluesky OAuth config in VirtualDeck.
- [ ] Implement: “Log in with Bluesky” → open authorize URL → callback handler → exchange code → store access + refresh tokens.
- [ ] Implement: token refresh when access token expires.
- [ ] Update post logic to use OAuth access token when present; optionally keep handle + app password as fallback.

### Security

- [ ] Do not log client secrets, app passwords, or OAuth tokens.
- [ ] Store tokens in userData (e.g. preferences.json) or a dedicated secrets file with restricted permissions; avoid localStorage for tokens if the renderer is not fully trusted.
- [ ] Validate `state` on OAuth callbacks to prevent CSRF.

---

## Quick reference

| Step | Discord | Bluesky |
|------|---------|---------|
| **Developer signup** | [discord.com/developers](https://discord.com/developers/applications) | Bluesky OAuth client registration (see docs.bsky.app) |
| **Scope / permission** | `webhook.incoming` | Post/create (see Bluesky OAuth docs) |
| **What you get back** | Webhook URL (and channel/guild ids) | Access token + refresh token |
| **Where it’s stored** | preferences: `goLiveDiscordWebhook`, `clipDiscordWebhook` | preferences or secrets: `blueskyAccessToken`, `blueskyRefreshToken` (and expiry) |
| **Callback** | Local server or custom URL scheme | Same |

Once both flows are implemented, users can “log in” to Discord and Bluesky and pick channels or authorize posting without pasting webhooks or app passwords.
