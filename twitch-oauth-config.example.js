// Twitch OAuth Configuration — EXAMPLE (safe to commit)
// Copy to twitch-oauth-config.js and add your credentials.
// Or set environment variables: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET

module.exports = {
  clientId: process.env.TWITCH_CLIENT_ID || 'YOUR_TWITCH_CLIENT_ID',
  clientSecret: process.env.TWITCH_CLIENT_SECRET || 'YOUR_TWITCH_CLIENT_SECRET',
  redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
};
