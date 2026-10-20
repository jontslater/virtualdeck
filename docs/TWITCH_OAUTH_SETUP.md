# Twitch OAuth Setup (VirtualDeck desktop)

VirtualDeck connects to Twitch with **OAuth Device Code Grant** (primary) and a **localhost implicit redirect** fallback. No client secret is embedded in the Electron app.

## Owner setup (Twitch Developer Console)

1. Open [Twitch Developer Console → Applications](https://dev.twitch.tv/console/apps).
2. **Register Your Application** (or edit the existing VirtualDeck app).
3. Set **Client Type** to **Public** (confidential / secret-based flows are not used in the shipped app).
4. Under **OAuth Redirect URLs**, add:
   - `http://localhost:17563/oauth/callback`
5. Save the application and copy the **Client ID**.
6. Provide the Client ID to builds via **one** of:
   - Environment variable `TWITCH_CLIENT_ID` (recommended for CI/release), or
   - Local gitignored `twitch-oauth-config.js` copied from `twitch-oauth-config.example.js`.

Device Code Grant is enabled for public clients on Twitch; no separate toggle is required beyond using a public client.

### Scopes

VirtualDeck requests the scopes in `lib/twitch-oauth-scopes.js` (chat, channel points, raids, etc.). Users approve these on Twitch during login.

## End-user experience

1. **Tools → Twitch** (or the Twitch connect entry point) → **Connect with Twitch**.
2. The app shows a short code and opens Twitch in the browser.
3. After **Authorize**, VirtualDeck stores tokens with OS-backed encryption (`safeStorage`) in `tc_config.json` and connects chat/EventSub.
4. **Disconnect Twitch** clears stored tokens and shuts down connections.
5. **Advanced: manual token entry** remains for power users.

## Token refresh

When Twitch returns a refresh token (device flow), VirtualDeck refreshes access tokens automatically before they expire. If refresh fails, the user is prompted to connect again.

## Security notes

- Do **not** commit `twitch-oauth-config.js` or real Client IDs in the repository.
- Rotate credentials in the Twitch console if they were ever exposed.
- Access/refresh tokens are not written to `localStorage` by the OAuth flow.
