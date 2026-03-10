// Twitch OAuth Configuration
// Use environment variables - create a .env file (see env-example.txt) with:
//   TWITCH_CLIENT_ID=your_client_id
//   TWITCH_CLIENT_SECRET=your_client_secret
// Get credentials from https://dev.twitch.tv/console/apps
// Set OAuth redirect URL to: http://localhost:3000/oauth/callback

module.exports = {
  clientId: process.env.TWITCH_CLIENT_ID || '',
  clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
};
