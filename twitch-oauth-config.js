// Twitch OAuth Configuration
// Get these from https://dev.twitch.tv/console/apps
// Create a new application and set OAuth redirect URL to: http://localhost:3000/oauth/callback
//
// NOTE: Client Secret is hidden by default - click the eye icon 👁️ to reveal it
// It will show as dots (••••••••••••••••) until you click the eye
//
// You can either:
// 1. Edit the values below directly, or
// 2. Set environment variables: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET

module.exports = {
  clientId: process.env.TWITCH_CLIENT_ID || '6xnmuyhhtmfpqugw2cn9j5njh770ct',
  clientSecret: process.env.TWITCH_CLIENT_SECRET || 'gwiy3lnly60cvfgpv687xbue748xph',
  redirectUri: 'http://localhost:3000/oauth/callback'
};
