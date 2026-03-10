# File moved

This document has been moved to `docs/DAILY_CHECKIN_QUICKSTART.md`.
Please open that file for the quick start guide.

## Benefits

- **Increase Engagement**: Encourage viewers to interact with your stream
- **Reward Loyalty**: Track and recognize your most dedicated viewers
- **Simple Setup**: 5-minute configuration process
- **Automated**: Runs in the background, no manual work required

## Setup (5 minutes)

### Step 1: Create a Twitch Channel Point Reward

1. Go to your **Twitch Creator Dashboard**
2. Navigate to **Viewer Rewards** → **Channel Points** → **Manage Rewards**
3. Click **"Add New Custom Reward"**
4. Configure your reward:
   - **Name**: `Daily Check-In` (or any name you prefer)
   - **Cost**: `10-100 points` (choose what works for your channel)
   - **Description**: "Check in once per stream!"
   - **User Input**: Not required
   - **Cooldown**: Enable **"Limit to 1 per stream per user"** ✅ (Important!)
5. Click **Save**

### Step 2: Configure VirtualDeck

1. Open **VirtualDeck**
2. Go to **Tools** → **Daily Check-In**
3. If it's your first time, you'll see the setup wizard:
   - Enter your reward name: `Daily Check-In` (must match exactly)
   - **Overlay Message**: Message shown on OBS overlay (optional): `Thanks for checking in, {username}!`
   - **Chat Message**: Message sent in Twitch chat: `Thanks for checking in, @{username}! You've checked in {total} times! 🎉`
   - Choose whether to display messages on overlay (toggle)
   - Choose whether to send messages in Twitch chat (toggle)
   - Click **"Complete Setup & Enable"**

### Step 3: Test It!

1. Open your Twitch chat
2. Redeem your "Daily Check-In" reward
3. Check for:
   - ✅ **VirtualDeck notification** showing your check-in was processed
   - ✅ **Twitch chat message** confirming the check-in (if enabled)
   - ✅ **Overlay message** displayed (if enabled)
   - ✅ **Stats updated** in the Daily Check-In settings

## Message Placeholders

Customize your check-in message with these placeholders:

- `{username}` - Viewer's username
- `{total}` - Total number of check-ins for this viewer

**Example**:
```
Thanks for checking in, {username}! You've checked in {total} times!
```

**Output**:
```
Thanks for checking in, CoolViewer! You've checked in 15 times!
```

## Viewing Statistics

1. Go to **Tools** → **Daily Check-In**
2. View your stats:
   - **Total Viewers**: How many unique viewers have checked in
   - **Total Check-Ins**: Combined check-ins across all viewers
   - **Today's Check-Ins**: How many viewers checked in today
   - **Top 10 Leaderboard**: Your most dedicated viewers

## Settings

### Enable/Disable
Toggle the feature on/off without losing your data.

### Reward Name
The exact name of your Twitch Channel Point reward (case-insensitive).

### Overlay Message
The message shown on your OBS overlay when viewers check in. Use placeholders for personalization.

### Display on Overlay
Toggle to show/hide check-in messages on your OBS overlay.

### Chat Message
The message sent in Twitch chat when viewers check in. Use placeholders for personalization.

### Send in Chat
Toggle to enable/disable automatic chat responses when viewers check in.

## Tips & Best Practices

### Pricing Your Reward
- **Low Cost (10-50 pts)**: Encourages maximum participation
- **Medium Cost (50-100 pts)**: Balances accessibility with value
- **High Cost (100+ pts)**: Makes check-ins feel more special

### Promoting the Feature
- Mention it at the start of your stream
- Add a chat command explaining the reward
- Recognize milestone check-ins (10th, 25th, 50th, etc.)

### Chat Messages
- Keep messages friendly and encouraging
- Use the `@{username}` mention to ping the viewer
- Show total check-ins to recognize dedication: `{total}`
- Add emojis for fun: 🎉 ✅ 🎮

### Overlay Messages
- Keep messages short and sweet
- Position them where they won't cover gameplay
- Set duration to 3-5 seconds for best visibility

### Recognizing Top Viewers
- Shout out your top 10 check-in leaders
- Create special rewards for milestone achievements
- Thank viewers for their consistent support

## Troubleshooting

### "My check-ins aren't being tracked"
- ✅ Verify the feature is **Enabled** in settings
- ✅ Check that the **reward name matches exactly**
- ✅ Ensure you're **connected to Twitch** in VirtualDeck
- ✅ Redeem the reward and check the **console for errors**

### "I redeemed twice but only one counted"
- ✅ This is expected! The feature limits to **one check-in per stream**
- ✅ This prevents spam and ensures fair tracking
- ✅ Check-ins reset when you start a new stream

### "Chat message not showing"
- ✅ Ensure **"Send message in Twitch chat" is checked**
- ✅ Verify you're **connected to Twitch** in VirtualDeck
- ✅ Check the **console for connection errors**
- ✅ Make sure your **Twitch account has chat permissions**

### "Overlay message not showing"
- ✅ Ensure **"Display message on overlay" is checked**
- ✅ Verify your **OBS browser source is connected** to VirtualDeck
- ✅ Check the **overlay URL** is correct: `http://localhost:8080/overlay`

### "Stats not updating"
- ✅ Close and reopen the Daily Check-In settings modal
- ✅ Check the **console for errors**
- ✅ Verify the data files exist in your **userData folder**

## Advanced: Manual Data Management

### Resetting All Data
1. Go to **Tools** → **Daily Check-In**
2. Click **"Reset All Check-In Data"**
3. Confirm the action
4. All check-in history will be deleted (cannot be undone)

### Exporting Data (Manual)
Data files are stored in JSON format:
- **Windows**: `%APPDATA%/VirtualDeck/daily_checkin_data.json`
- **macOS**: `~/Library/Application Support/VirtualDeck/daily_checkin_data.json`
- **Linux**: `~/.config/VirtualDeck/daily_checkin_data.json`

You can copy these files for backup or analysis.

## FAQs

**Q: Can I have multiple check-in rewards?**
A: Currently, only one reward is supported. This may be added in a future update.

**Q: Does this work with other platforms (YouTube, etc.)?**
A: No, this feature is Twitch-only and requires Twitch Channel Points.

**Q: Will my data sync across devices?**
A: Currently, data is stored locally. Cloud sync may be added in future updates.

**Q: Can I see when specific viewers checked in?**
A: Check-in timestamps are stored in the data file but not displayed in the UI yet.

**Q: What happens if I change my reward name?**
A: Update the reward name in VirtualDeck settings to match your new Twitch reward name.

**Q: Can I disable the chat message but keep the overlay message?**
A: Yes! Both are independent toggles. You can enable/disable them separately.

**Q: Can I customize the chat message?**
A: Absolutely! Use {username} and {total} placeholders to personalize it.

**Q: Can viewers check in multiple times per stream?**
A: No, Twitch's "1 per stream per user" setting prevents this.

**Q: Will this affect my channel point balance?**
A: Viewers spend their channel points to check in, just like any other reward.

**Q: Does the chat message work if I'm not streaming?**
A: The chat message only sends if you're connected to Twitch in VirtualDeck.

## Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review the full documentation: `DAILY_CHECKIN_FEATURE.md`
3. Check VirtualDeck console for error messages
4. Verify your Twitch connection is active

---

**Happy Streaming!** 🎮✨

Your viewers will love this feature, and you'll gain valuable insights into your most engaged community members.
