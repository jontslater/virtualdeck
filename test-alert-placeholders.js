#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  replacePlaceholders,
  buildUserDataFromTwitchEvent,
  buildChannelPointsUserData,
  resolveAlertSpeakText,
  isRavenTtsEnabled,
  PLACEHOLDER_NAMES,
} = require('./lib/alert-placeholders');
const { alertMatchesChannelPointsRedemption } = require('./lib/channel-points-alert-reward');

assert.ok(PLACEHOLDER_NAMES.includes('recipient'));
assert.ok(PLACEHOLDER_NAMES.includes('count'));

assert.strictEqual(
  replacePlaceholders('{username} gifted {count} to {recipient}', {
    username: 'Gifter',
    count: '5',
    recipient: 'the community',
  }),
  'Gifter gifted 5 to the community',
);

const massGift = buildUserDataFromTwitchEvent({
  type: 'channel.subscription.gift',
  event: {
    user_name: 'BigGifter',
    display_name: 'BigGifter',
    total: 10,
    tier: '1000',
  },
});
assert.strictEqual(massGift.count, '10');
assert.strictEqual(massGift.recipient, 'the community');
assert.strictEqual(
  replacePlaceholders('{username} gifted {count} subs!', massGift),
  'BigGifter gifted 10 subs!',
);

const singleGift = buildUserDataFromTwitchEvent({
  type: 'channel.subscription.gift',
  event: {
    user_name: 'Gifter',
    display_name: 'Gifter',
    total: 1,
    recipient_user_name: 'LuckyViewer',
    tier: '1000',
  },
});
assert.strictEqual(singleGift.recipient, 'LuckyViewer');
assert.strictEqual(singleGift.count, '1');

const subGift = buildUserDataFromTwitchEvent({
  type: 'channel.subscribe',
  event: {
    is_gift: true,
    user_name: 'Recipient',
    display_name: 'Recipient',
    gifter_user_name: 'Generous',
    gifter_display_name: 'Generous',
    tier: '1000',
  },
});
assert.strictEqual(subGift.username, 'Generous');
assert.strictEqual(subGift.recipient, 'Recipient');

const cp = buildChannelPointsUserData({
  user_login: 'viewer1',
  user_name: 'viewer1',
  display_name: 'ViewerOne',
  user_input: 'Hello stream!',
  reward: { id: 'reward-abc', title: 'Hydrate' },
});
assert.strictEqual(
  replacePlaceholders('{display_name} redeemed {reward}: {message}', cp),
  'ViewerOne redeemed Hydrate: Hello stream!',
);

assert.strictEqual(
  alertMatchesChannelPointsRedemption(
    { type: 'channel-points', channelPointsConfig: { rewardId: 'reward-abc' } },
    { reward: { id: 'reward-abc', title: 'Hydrate' } },
  ),
  true,
);
assert.strictEqual(
  alertMatchesChannelPointsRedemption(
    { type: 'channel-points', channelPointsConfig: { rewardId: 'reward-abc' } },
    { reward: { id: 'other', title: 'Hydrate' } },
  ),
  false,
);
assert.strictEqual(
  alertMatchesChannelPointsRedemption(
    { type: 'channel-points', channelPointsConfig: { rewardName: 'Hydrate' } },
    { reward: { title: 'Hydrate' } },
  ),
  true,
);

assert.strictEqual(isRavenTtsEnabled({ ravenTtsEnabled: true, text: 'Hi {username}' }), true);
assert.strictEqual(
  resolveAlertSpeakText(
    { ravenTtsEnabled: true, text: 'Welcome {username}' },
    { username: 'tehchno' },
  ),
  'Welcome tehchno',
);
assert.strictEqual(
  resolveAlertSpeakText(
    { ravenTtsEnabled: true, ttsText: 'Shoutout to {display_name}' },
    { display_name: 'TehChno' },
  ),
  'Shoutout to TehChno',
);

const script = fs.readFileSync(path.join(__dirname, 'public/script.js'), 'utf8');
assert.ok(script.includes('vdAlertPlaceholders'), 'script delegates to vdAlertPlaceholders');
assert.ok(script.includes('resolveAlertSpeakText'), 'triggerAlert uses Raven TTS placeholder resolution');
assert.ok(script.includes("triggerAlertForEvent('channel-points'"), 'EventSub fires channel-points alerts');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
assert.ok(html.includes('alert-placeholders.js'));
assert.ok(html.includes('channel-points-settings'));
assert.ok(html.includes('value="channel-points"'));

console.log('✅ test-alert-placeholders.js passed');
