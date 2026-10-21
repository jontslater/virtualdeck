# Debugging Overlay Display Issues

## Current Status

✅ **FIXED:** `savedAlerts is not defined` error  
⚠️ **INVESTIGATING:** 2nd and 3rd overlays not showing visual content (but sound works)

## Key Observations

1. **Sound is playing** ✅ - This means:
   - Overlays are loading successfully  
   - WebSocket connection is working
   - Alerts are being received
   - Media files are accessible
   
2. **Visuals not showing** ❌ - Possible causes:
   - Text/images/videos aren't being rendered
   - Content is rendered but hidden (z-index, CSS, positioning)
   - JavaScript errors on the overlay page
   - Wrong overlay name/targeting

## Diagnostic Steps

### Step 1: Check Overlay Console (IMPORTANT!)

1. Open your OBS or browser with the 2nd overlay loaded
2. Right-click on the overlay and select "Inspect" or press F12
3. Look at the **Console** tab for JavaScript errors
4. Look at the **Network** tab for failed resource loads

**What to look for:**
- Red errors in Console tab
- 404/500 errors in Network tab  
- Any warnings about failed media loads

### Step 2: Verify Overlay Names

Check that your alert configuration matches your overlay names:

1. Open VirtualDeck dashboard
2. Go to Overlays tab
3. Note the exact names of your 2nd and 3rd overlays
4. Go to Alerts tab
5. Edit the alerts that should show on 2nd/3rd overlays
6. Verify the "Overlay" dropdown matches EXACTLY (case-sensitive!)

### Step 3: Test with Simple Alert

Create a minimal test alert:

**Settings:**
- Type: `Follower`
- Text: `TEST ALERT`
- Text Color: `#00ff00` (bright green)
- Font Size: `64px`
- Position: `Top Center`
- Overlay: Select your 2nd overlay
- Duration: `10 seconds`
- **NO images, NO videos, NO sounds**

Click "Test Alert" and watch the 2nd overlay:
- ✅ If text shows: Issue is with media files
- ❌ If text doesn't show: Issue is with overlay rendering

### Step 4: Check WebSocket Messages

Open browser console on the overlay window and run:

```javascript
// Check if overlay is receiving messages
console.log('Overlay Name:', window.overlayName);
console.log('WebSocket State:', overlayWS ? overlayWS.readyState : 'No WebSocket');

// Add message listener
let originalOnMessage = overlayWS.onmessage;
overlayWS.onmessage = function(event) {
  console.log('📨 RAW MESSAGE RECEIVED:', event.data);
  try {
    let parsed = JSON.parse(event.data);
    console.log('📨 PARSED PAYLOAD:', parsed);
    console.log('  - Type:', parsed.type);
    console.log('  - Target Overlay:', parsed.targetOverlay);
    console.log('  - Slots:', parsed.slots ? Object.keys(parsed.slots) : 'none');
    console.log('  - Center Media:', parsed.centerMedia?.length || 0);
  } catch (e) {
    console.error('Failed to parse:', e);
  }
  // Call original handler
  if (originalOnMessage) originalOnMessage.call(this, event);
};
```

**Trigger an alert** and check the console output:
- ✅ If you see messages: Overlay is receiving data correctly
- ❌ If no messages: WebSocket routing issue

### Step 5: Check Rendered DOM

After triggering an alert, inspect the overlay DOM:

```javascript
// Check what's actually in the overlay
console.log('=== OVERLAY CONTENT ===');
console.log('Text Slots:', document.querySelectorAll('.text-slot').length);
console.log('Active Text Slots:', document.querySelectorAll('.text-slot.active').length);
console.log('Center Media:', document.querySelector('#center-media')?.innerHTML || 'Empty');
console.log('All Images:', document.querySelectorAll('img').length);
console.log('All Videos:', document.querySelectorAll('video').length);

// List all text slot content
document.querySelectorAll('.text-slot').forEach((slot, i) => {
  console.log(`Slot ${i}:`, slot.id, 'Active:', slot.classList.contains('active'), 'Content:', slot.textContent);
});
```

**Expected output:**
- If alert has text: Should see active text slots  
- If alert has media: Should see images/videos in center-media

### Step 6: Force Render Test

Try manually rendering content on the overlay:

```javascript
// Open browser console on the overlay window
// Paste this code to manually render a test message

const testPayload = {
  type: 'buttonTrigger',
  targetOverlay: window.overlayName, // Use current overlay
  options: {
    clearPrevious: true,
    durationMs: 10000 // 10 seconds
  },
  slots: {
    topCenter: {
      text: 'MANUAL TEST - OVERLAY IS WORKING!',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: '64px',
        color: '#00ff00', // Bright green
        fontWeight: 'bold',
        textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
        textAlign: 'center',
        zIndex: '100'
      }
    }
  },
  centerMedia: []
};

console.log('🧪 Rendering manual test payload...');
renderPayload(testPayload);
```

**Expected result:**
- ✅ Big green text "MANUAL TEST - OVERLAY IS WORKING!" appears
- ❌ If nothing shows: JavaScript error preventing rendering

## Common Issues & Fixes

### Issue: Overlays load but nothing renders

**Possible Cause:** Overlay names don't match

**Fix:**
1. Check exact overlay names (case-sensitive!)  
2. Re-save alerts with correct overlay selection
3. Test again

### Issue: "Failed to load resource: 500 error"

**Possible Cause:** Server error generating overlay HTML

**Fix:**
1. Check main.js console for errors
2. Verify overlays/baseOverlay/index.html exists
3. Restart the application

### Issue: Content renders on "main" but not on custom overlays

**Possible Cause:** Overlay targeting issue

**Fix:**
1. In alert settings, verify "Overlay" dropdown shows your custom overlay name
2. Save the alert
3. Test again

### Issue: Only sound plays, no visuals

**Possible Cause:** Z-index or CSS issue hiding content

**Fix:**
```javascript
// Run on overlay console to check z-index
document.querySelectorAll('.text-slot.active').forEach(el => {
  console.log('Text slot z-index:', window.getComputedStyle(el).zIndex);
  el.style.setProperty('z-index', '9999', 'important'); // Force to front
});

document.querySelectorAll('img, video').forEach(el => {
  console.log('Media z-index:', window.getComputedStyle(el).zIndex);
  el.style.setProperty('opacity', '1', 'important'); // Force visible
  el.style.setProperty('display', 'block', 'important');
});
```

## Report Template

After running diagnostics, please provide:

1. **Overlay Names:**
   - 2nd overlay name: _______________
   - 3rd overlay name: _______________

2. **Console Errors:**
   ```
   (paste any red errors from browser console)
   ```

3. **WebSocket Messages:**
   - Are messages being received? Yes/No
   - Does `targetOverlay` match your overlay name? Yes/No
   - Are `slots` and `centerMedia` present in payload? Yes/No

4. **Simple Text Test:**
   - Did the simple text alert show? Yes/No
   - Did the manual test payload work? Yes/No

5. **DOM Inspection:**
   - Number of active text slots: ___
   - Number of images: ___
   - Number of videos: ___

6. **Screenshot:**
   - Screenshot of overlay window with browser DevTools open

This information will help identify exactly where the issue is occurring!
