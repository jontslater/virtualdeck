# Twitch OAuth Setup

To enable Twitch login in VirtualDeck, you need to set up OAuth credentials. This is a one-time setup that allows users to login with just one click.

## Quick Setup

1. **Go to Twitch Developer Console**
2. **Create a new application:**
   - Name: "VirtualDeck"
   - OAuth Redirect URLs: `http://localhost:3000/oauth/callback`
   - Category: choose appropriate category
3. **Copy your credentials:**
   - **Client ID**
   - **Client Secret**

## Configure credentials (choose an option)

**Option A: twitch-oauth-config.js** (gitignored – never commit secrets)
1. Copy `twitch-oauth-config.example.js` to `twitch-oauth-config.js`
2. Replace the placeholder values with your Client ID and Client Secret

**Option B: environment variables**
```bash
TWITCH_CLIENT_ID=your_client_id_here
TWITCH_CLIENT_SECRET=your_client_secret_here
```

## Security Notes
- Client Secret is used server-side; access tokens are refreshed and stored securely.
- **Never commit** `twitch-oauth-config.js` – it is in `.gitignore`. Use the example file as a template.
- If credentials were ever exposed in git history, **revoke and rotate** them in the Twitch Developer Console immediately.

