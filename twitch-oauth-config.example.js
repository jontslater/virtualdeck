// Twitch OAuth Configuration
// Copy this file to twitch-oauth-config.js and add your credentials.
// Get them from https://dev.twitch.tv/console/apps
// Set OAuth redirect URL to: http://localhost:3000/oauth/callback
//
// Alternatively, set environment variables: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET

module.exports = {
  clientId: process.env.TWITCH_CLIENT_ID || 'your_client_id_here',
  clientSecret: process.env.TWITCH_CLIENT_SECRET || 'your_client_secret_here',
  redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
};
