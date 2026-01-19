# Twitch OAuth Setup

To enable Twitch login in VirtualDeck, you need to set up OAuth credentials. This is a one-time setup that allows users to login with just one click.

## Quick Setup

1. **Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)**

2. **Create a new application:**
   - Click "Create Application"
   - Name: "VirtualDeck" (or whatever you prefer)
   - OAuth Redirect URLs: `http://localhost:3000/oauth/callback`
   - Category: Choose appropriate category (e.g., "Game Integration")
   - Click "Create"

3. **Copy your credentials:**
   - **Client ID**: Always visible at the top of your app page
   - **Client Secret**: Initially shows as "••••••••••••••••" - click the 👁️ (eye) icon to reveal it

   ```
   Your Application
   ┌─────────────────────────────────────────┐
   │ Client ID: abc123def456ghi789...        │ ← Always visible
   │ Client Secret: •••••••••••••••• [👁️]    │ ← Click eye to reveal
   └─────────────────────────────────────────┘
   ```

4. **Configure credentials** (choose one option):

   **Option A: Edit `twitch-oauth-config.js`:**
   ```javascript
   module.exports = {
     clientId: 'your_client_id_here',
     clientSecret: 'your_client_secret_here',
     redirectUri: 'http://localhost:3000/oauth/callback'
   };
   ```

   **Option B: Use environment variables** (create a `.env` file):
   ```bash
   TWITCH_CLIENT_ID=your_client_id_here
   TWITCH_CLIENT_SECRET=your_client_secret_here
   ```

5. **Restart VirtualDeck**

## How It Works

- Users see a simple "🔵 Login with Twitch" button
- Clicking it opens their browser to Twitch's login page
- After login, they're redirected back to VirtualDeck automatically
- The app securely stores their access token for future use

## Advanced Usage

If you want to use custom OAuth credentials (for multiple apps, testing, etc.), users can click "Advanced Settings" in the login modal to configure their own Client ID and Secret.

## Security Notes

- Client Secret is stored securely and only used server-side
- Access tokens are automatically refreshed when they expire
- No user passwords are stored - only OAuth tokens
- All OAuth communication happens over HTTPS