# Alert Checkbox System - Enhanced Guide

## ✅ Feature Status: ALREADY IMPLEMENTED + ENHANCED

The checkbox system for individual alert control was **already fully functional** in VirtualDeck! I've enhanced the UI to make it more obvious and easier to use.

---

## How It Works

### **Individual Alert Control**

Each alert variation can be independently enabled or disabled using checkboxes. This gives you complete control over which alerts are active for each event type.

### **Example Use Case:**

You have 5 follower alerts:
1. "Welcome {username}!" with confetti image
2. "{username} joined the party!" with party horn sound
3. "New follower: {username}" with simple text
4. "Thanks for following, {username}!" with thank you GIF
5. "Follower hype! {username}" with airhorn sound

**You can:**
- ✅ Enable only alerts #1, #3, and #5 (uncheck #2 and #4)
- ✅ Toggle Random Mode to pick randomly from the 3 enabled alerts
- ✅ Or keep Random Mode OFF to always use alert #1 (first enabled)

---

## UI Features (Enhanced)

### **Variation Header**
```
Variations (5 total, 3 enabled): [Enable All] [Disable All] [Random Mode ✓]
```

- **Total count**: Shows how many alert variations exist
- **Enabled count**: Shows how many are currently active
- **Enable All / Disable All**: Quick bulk actions
- **Random Mode**: Pick randomly from enabled alerts

### **Help Tip Box**
A blue info box explains how the checkbox system works based on your current Random Mode setting.

### **Visual Indicators**
- **✓ Enabled alerts**: 
  - Green border (accent color)
  - Blue tinted background
  - Checkbox checked
  - Checkmark (✓) before text
- **○ Disabled alerts**:
  - Grayed out (50% opacity)
  - Tertiary border color
  - Checkbox unchecked
  - Circle (○) before text

---

## How To Use

### **Step 1: Go to Tools → Alerts**

Navigate to the Alerts tab in VirtualDeck.

### **Step 2: Select an Alert Type**

Click on any alert type (e.g., "New Follower") to see all its variations.

### **Step 3: Enable/Disable Individual Alerts**

**Method 1 - Individual Checkboxes:**
- Check the box next to each alert you want to enable
- Uncheck to disable

**Method 2 - Bulk Actions:**
- Click "Enable All" to check all alerts of this type
- Click "Disable All" to uncheck all alerts of this type

### **Step 4: Choose Selection Mode**

**Random Mode OFF:**
- System uses the **first enabled alert** in the list
- Predictable and consistent

**Random Mode ON:**
- System **randomly picks** from all enabled alerts
- Variety and surprise

### **Step 5: Test Your Setup**

Click "Test" on any enabled alert to see it in action!

---

## Selection Logic

The alert system follows this logic when an event is triggered:

```javascript
1. Filter to alerts of the correct type (e.g., "follower")
2. Filter to only enabled alerts (enabled !== false)
3. If no enabled alerts → Skip (no alert shown)
4. If Random Mode ON → Pick randomly from enabled alerts
5. If Random Mode OFF → Use first enabled alert
6. Trigger the selected alert
```

---

## Advanced Scenarios

### **Scenario 1: Different Alerts for Different Overlays**

Create multiple alerts for the same event type but route them to different overlays:

- Alert #1: Follower text → Main overlay ✓ ENABLED
- Alert #2: Follower confetti → Overlay 2 ✗ DISABLED
- Alert #3: Follower celebration → Overlay 3 ✓ ENABLED

With Random Mode ON, it will randomly pick between Alert #1 and #3 (both enabled).

### **Scenario 2: Temporary Disable During Stream**

Quick disable alerts without deleting them:

1. Uncheck all "bits" alerts (temporarily disable bits notifications)
2. Stream continues without bits alerts
3. Re-enable after stream by clicking "Enable All"

### **Scenario 3: Testing Before Deployment**

Before going live with new alerts:

1. Keep old alerts enabled
2. Create new alerts but leave them disabled
3. Test new alerts using "Test" button
4. When ready, disable old alerts and enable new ones

### **Scenario 4: Sequential Rotation**

Without Random Mode:

- Alert #1 enabled → Always uses this one
- Later: Disable #1, enable #2 → Now uses #2
- Manual rotation by toggling checkboxes

---

## Functions Available

### **Global Functions**

```javascript
// Toggle individual alert
window.toggleAlert(alertId, enabled)

// Toggle random mode for alert type  
window.toggleRandomModeForType(alertType, randomMode)

// Enable/disable all alerts of a type
window.toggleAllAlertsForType(alertType, enabled)
```

### **Testing From Console**

```javascript
// Enable all follower alerts
window.toggleAllAlertsForType('follower', true);

// Disable all raid alerts
window.toggleAllAlertsForType('raid', false);

// Turn on random mode for subscribers
window.toggleRandomModeForType('subscriber', true);
```

---

## Data Structure

Each alert is stored with an `enabled` property:

```javascript
{
  id: "alert_1234567890",
  type: "follower",
  text: "Welcome {username}!",
  enabled: true, // ← Controls if this alert is active
  randomMode: false, // ← Shared across all alerts of same type
  overlay: "main",
  duration: 5,
  // ... other properties
}
```

---

## Benefits

### **1. Flexibility**
- Enable/disable without deleting
- Quick A/B testing
- Easy rotation of content

### **2. Organization**
- Keep all alerts in the system
- Enable/disable as needed
- No need to recreate deleted alerts

### **3. Control**
- Choose exact alerts for each stream
- Different setups for different stream types
- Quick bulk changes with "Enable All" / "Disable All"

### **4. Safety**
- Test new alerts before enabling
- Keep old alerts as backup
- No accidental deletions

---

## Enhancements Made

### **Before (Already Working)**
- ✅ Individual checkboxes existed
- ✅ Toggle functionality worked
- ✅ Random mode functional
- ✅ Visual indicators present

### **After (Enhanced UI)**
- ✨ **NEW**: Count of total vs enabled alerts in header
- ✨ **NEW**: "Enable All" and "Disable All" bulk action buttons
- ✨ **NEW**: Help tip box explaining current mode
- ✨ **NEW**: Visual checkmark (✓) / circle (○) indicators
- ✨ **NEW**: Better disabled state styling (grayed out)
- ✨ **NEW**: "Random Mode" label (was just "Random")
- ✨ **NEW**: `toggleAllAlertsForType()` function
- ✨ **NEW**: Success notifications for bulk actions

---

## Tips & Best Practices

### **Tip 1: Use Descriptive Text**
Give each alert unique text so you can easily identify them:
- ✓ "Welcome {username}! (confetti)"
- ✓ "Thanks for following! (party horn)"
- ✗ "New follower" (too generic if you have multiple)

### **Tip 2: Group by Style**
Create variations with different styles:
- Alert #1-3: Fun/energetic for gaming streams
- Alert #4-6: Professional for work streams
- Enable the appropriate group per stream type

### **Tip 3: Test Disabled Alerts**
You can still test disabled alerts using the "Test" button! This lets you preview them before enabling.

### **Tip 4: Use Random Mode Strategically**
- **Random Mode ON**: Great for follower/subscriber alerts (variety)
- **Random Mode OFF**: Better for bits/raids (consistent branding)

### **Tip 5: Keep a "Safe" Alert**
Always have at least one enabled alert per type you care about. If all are disabled, no alert will show when that event triggers.

---

## Troubleshooting

### **Problem: No alerts showing**
**Solution**: Check if at least one alert is enabled for that event type

### **Problem: Always getting the same alert**
**Solution**: Turn ON Random Mode or check if other alerts are enabled

### **Problem: Can't find checkboxes**
**Solution**: Make sure you've selected an alert type from the filter dropdown

### **Problem: Bulk actions not working**
**Solution**: Reload VirtualDeck to get the updated code

---

## All Event Types Support Checkboxes

This checkbox system works for **ALL** alert types:

- ✅ Follower
- ✅ Subscriber
- ✅ Resubscriber
- ✅ Gift Sub
- ✅ Gift Sub Received
- ✅ Raid
- ✅ Bits
- ✅ Ban
- ✅ Daily Check-in

---

## Summary

The individual checkbox system was already fully implemented! I've enhanced the UI to make it clearer and added bulk action buttons for convenience. You now have complete, fine-grained control over which specific alerts are active for each event type.

**Key Features:**
- ✓ Individual enable/disable checkboxes
- ✓ Random Mode toggle
- ✓ Enable All / Disable All buttons
- ✓ Visual indicators for enabled/disabled state
- ✓ Count of total vs enabled alerts
- ✓ Help tips explaining current mode
- ✓ Works for all event types

Enjoy your enhanced alert control! 🎉
