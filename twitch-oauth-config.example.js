// Twitch OAuth Configuration — EXAMPLE (safe to commit)
// Copy to twitch-oauth-config.js for local dev, or set TWITCH_CLIENT_ID in .env / CI.
// VirtualDeck uses the public Device Code flow (no client secret in the app binary).

module.exports = {
  clientId: process.env.TWITCH_CLIENT_ID || '6xnmuyhhtmfpqugw2cn9j5njh770ct',
  // Optional: only for server-side tooling — not shipped to end users
  clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  // Implicit-flow fallback redirect (localhost)
  redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:17563/oauth/callback',
};
