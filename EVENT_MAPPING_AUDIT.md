# Event Mapping Audit & Fixes

## ✅ All Event Types Now Properly Mapped

### Summary of Changes

Fixed event type mapping to ensure ALL Twitch events trigger the correct alert types.

---

## Event Type Mappings

### Follower Events
| Twitch Event Type | Alert Type | Status |
|------------------|------------|--------|
| `channel.follow` | `follower` | ✅ Working |
| `poll.follow` | `follower` | ✅ **FIXED** (was missing) |

**Details:** `poll.follow` is sent when followers are detected via polling (fallback when EventSub isn't available). Previously showed warning "No alert type mapping for event: poll.follow" and didn't trigger alerts.

---

### Subscription Events (with intelligent differentiation)
| Twitch Event Type | Event Criteria | Alert Type | Status |
|------------------|----------------|------------|--------|
| `channel.subscribe` | `is_gift === false` && `cumulative_months === 1` | `subscriber` | ✅ **ENHANCED** |
| `channel.subscribe` | `is_gift === false` && `cumulative_months > 1` | `resubscriber` | ✅ **ENHANCED** |
| `channel.subscribe` | `is_gift === true` | `gift-sub` | ✅ **ENHANCED** |
| `channel.subscribe` | `is_gift === true` && `user_id === broadcaster_user_id` | `gift-sub-received` | ✅ **ENHANCED** |
| `channel.subscription.message` | Always | `resubscriber` | ✅ **FIXED** (was missing) |
| `channel.subscription.gift` | Always | `gift-sub` | ✅ Working |

**Details:** 
- **Before:** All `channel.subscribe` events triggered generic "subscriber" alerts
- **After:** Smart detection based on `is_gift` and `cumulative_months` fields
- `channel.subscription.message` now properly triggers resubscriber alerts

---

### Raid Events
| Twitch Event Type | Alert Type | Status |
|------------------|------------|--------|
| `channel.raid` | `raid` | ✅ Working |

---

### Bits/Cheer Events
| Twitch Event Type | Alert Type | Status |
|------------------|------------|--------|
| `channel.cheer` | `bits` | ✅ Working |

---

### Ban Events
| Twitch Event Type | Alert Type | Status |
|------------------|------------|--------|
| `channel.ban` | `ban` | ✅ **FIXED** (was missing) |

**Details:** Previously showed warning "No alert type mapping for event: channel.ban" and didn't trigger ban alerts.

---

### Channel Points Events
| Twitch Event Type | Alert Type | Status |
|------------------|------------|--------|
| `channel.channel_points_custom_reward_redemption.add` | Handled separately | ✅ Working |

**Details:** Channel point redemptions are handled by the TwitchConnected system and can trigger buttons. Daily check-in redemptions trigger `daily-checkin` alerts.

---

## Available Alert Types

These are all the alert types you can configure in VirtualDeck:

1. **`follower`** - Triggered by new followers
2. **`subscriber`** - Triggered by first-time subscribers
3. **`resubscriber`** - Triggered by returning subscribers (2+ months)
4. **`gift-sub`** - Triggered when someone gifts a subscription
5. **`gift-sub-received`** - Triggered when broadcaster receives a gift sub
6. **`raid`** - Triggered by incoming raids
7. **`bits`** - Triggered by bit donations/cheers
8. **`ban`** - Triggered when a user is banned
9. **`daily-checkin`** - Triggered by daily check-in channel point redemptions

---

## Technical Details

### Subscription Differentiation Logic

The system now uses intelligent detection to determine the correct subscription alert type:

```javascript
if (eventData.type === 'channel.subscribe') {
  if (eventData.event.is_gift === true) {
    // Gift subscription
    if (eventData.event.user_id === eventData.event.broadcaster_user_id) {
      alertType = 'gift-sub-received'; // Broadcaster received a gift
    } else {
      alertType = 'gift-sub'; // Someone gifted to another user
    }
  } else if (eventData.event.cumulative_months && eventData.event.cumulative_months > 1) {
    alertType = 'resubscriber'; // Returning subscriber
  } else {
    alertType = 'subscriber'; // First-time subscriber
  }
}
```

### Polling Fallback

When EventSub is unavailable or delayed, the polling system detects new followers and sends `poll.follow` events. These now properly trigger follower alerts just like EventSub follower events.

---

## User Data Placeholders

All alert types can use these placeholders in alert text:

- `{username}` - User's login name
- `{display_name}` - User's display name
- `{tier}` - Subscription tier (1000/2000/3000)
- `{months}` - Cumulative months subscribed
- `{viewers}` - Number of raid viewers
- `{bits}` - Amount of bits donated
- `{message}` - User's message (for resub announcements)
- `{reward}` - Channel point reward title
- `{total_checkins}` - Total daily check-ins (for daily-checkin alerts)
- `{streak}` - Current streak (for daily-checkin alerts)

---

## Testing Recommendations

To verify all event types are working:

### 1. Test Follower Alerts
- Configure a follower alert
- Test with the "Test Alert" button
- Have someone follow your channel (tests both EventSub and polling)

### 2. Test Subscription Alerts
Create separate alerts for:
- **New Subscriber** - Will trigger for first-time subs
- **Resubscriber** - Will trigger for 2+ month subs
- **Gift Sub** - Will trigger when someone gifts
- **Gift Received** - Will trigger when broadcaster receives a gift

Test using Twitch's Test Events in the EventSub dashboard, or use real subscriptions.

### 3. Test Ban Alerts
- Configure a ban alert
- Ban a test user (or use Twitch's test events)
- Verify the alert triggers

### 4. Test Raid Alerts
- Configure a raid alert with `{username}` and `{viewers}`
- Test with Twitch's test events or a real raid
- Verify placeholder replacement works

### 5. Test Bits Alerts
- Configure a bits alert with `{username}` and `{bits}`
- Test with Twitch's test events or real bits
- Verify placeholder replacement works

---

## Files Modified

1. **public/script.js** (lines 2662-2717)
   - Added `poll.follow` → `follower` mapping
   - Added `channel.ban` → `ban` mapping
   - Added `channel.subscription.message` → `resubscriber` mapping
   - Implemented smart subscription type detection
   - Added logging for alert type determination
   - Updated recent subscriber tracking to include subscription.message events

---

## Before vs After

### Before
```
⚠️ No alert type mapping for event: poll.follow
⚠️ No alert type mapping for event: channel.ban
⚠️ No alert type mapping for event: channel.subscription.message
⚠️ All channel.subscribe events triggered generic "subscriber" alert
```

### After
```
✅ poll.follow → follower alert
✅ channel.ban → ban alert
✅ channel.subscription.message → resubscriber alert
✅ channel.subscribe (new) → subscriber alert
✅ channel.subscribe (resub) → resubscriber alert
✅ channel.subscribe (gift) → gift-sub alert
✅ channel.subscribe (gift received) → gift-sub-received alert
```

---

## No More Missing Events! 🎉

All configured Twitch event types now properly trigger their corresponding alerts. No more "No alert type mapping" warnings!
