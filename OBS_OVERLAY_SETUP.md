# VirtualDeck OBS Overlay Setup Guide

This guide will help you set up your VirtualDeck overlay in OBS Studio, similar to how MixItUp controls browser sources.

## 🎯 What We've Built

Your VirtualDeck now has a complete OBS overlay system with:

1. **WebSocket Server** (port 8080) - Communicates with overlay
2. **Optimized Overlay HTML** (`overlay-obs.html`) - Designed for OBS browser sources
3. **Control Script** (`overlay-controller.js`) - Test and control the overlay
4. **MixItUp-style Commands** - Show/hide media, update stats, execute multi-actions

## 📋 Setup Steps

### Step 1: Start VirtualDeck
1. Run your VirtualDeck app: `npm start`
2. The WebSocket server will start automatically on port 8080
3. You should see: `"Overlay WebSocket server running on port 8080"`

### Step 2: Add Browser Source to OBS

1. **Open OBS Studio**
2. **Add Browser Source:**
   - Right-click in Sources → Add → Browser Source
   - Name it "VirtualDeck Overlay"

3. **Configure Browser Source:**
   ```
   URL: http://localhost:8080/overlay
   
   Width: 1920 (or your stream resolution)
   Height: 1080 (or your stream resolution)
   
   ✅ Shutdown source when not visible
   ✅ Refresh browser when scene becomes active
   ❌ CSS (leave blank)
   ```

4. **Advanced Settings (Important for OBS):**
   - **FPS**: 60 (or your stream FPS)
   - **Hardware Acceleration**: Enabled
   - **Custom CSS**: Leave empty

### Step 3: Test the Connection

**Option 1: Use the Built-in Test Panel (Recommended)**
1. In VirtualDeck, go to **Tools → OBS Overlay → Open Overlay Test Panel**
2. Click the test buttons to try different overlay functions
3. Use the custom message feature to send your own messages

**Option 2: Use the Command Line Script**
1. **Run the test script:**
   ```bash
   node overlay-controller.js --test
   ```

2. **You should see:**
   - ✅ Connected to overlay WebSocket server
   - 🎬 Starting overlay tests...
   - Various test messages and animations in OBS

### Step 4: Interactive Control

1. **Start interactive mode:**
   ```bash
   node overlay-controller.js --interactive
   ```

2. **Try these commands:**
   ```
   overlay> message Hello OBS! 5
   overlay> stats 1234 5678 90
   overlay> activity NewFollower123 LoyalSubscriber456
   overlay> hide
   overlay> multi
   ```

## 🎮 How It Works (MixItUp-style)

### 1. OBS Browser Source
- OBS loads your HTML file as an embedded Chromium instance
- The overlay connects to your WebSocket server via `ws://localhost:8080`
- All communication happens in real-time

### 2. Video Playback (Autoplay Policy)
Your overlay handles browser autoplay policies correctly:
```html
<video autoplay muted playsinline loop>
```
- Starts **muted** for autoplay compliance
- Automatically **unmutes** when `volume > 0`
- Uses `playsinline` for mobile/OBS compatibility

### 3. Control Flow (Like MixItUp)
```
Your Script → WebSocket → Overlay → OBS Browser Source → Stream
```

**Example:**
```javascript
// Show a video
controller.showVideo('path/to/video.mp4', 5, 1.0);

// This sends:
{
  "type": "showMedia",
  "data": {
    "type": "video",
    "src": "path/to/video.mp4",
    "duration": 5,
    "volume": 1.0
  }
}
```

## 🎬 Available Commands

### Media Control
```javascript
// Show video with audio
controller.showVideo('video.mp4', 5, 1.0);

// Show image
controller.showImage('image.jpg', 5);

// Play sound
controller.playSound('sound.mp3', 1.0, 5);

// Show text message
controller.showMessage('Hello World!', 5, {
  fontSize: 24,
  textColor: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.8)'
});

// Hide everything
controller.hideMedia();
```

### Stats & Activity
```javascript
// Update viewer stats
controller.updateStats(1234, 5678, 90);
controller.toggleOverlay('twitch-stats-overlay', true);

// Update recent activity
controller.updateActivity('NewFollower123', 'LoyalSubscriber456');
controller.toggleOverlay('recent-activity-overlay', true);

// Show current sound
controller.updateSoundStatus('Now Playing: Song Name');
controller.toggleOverlay('sound-status-overlay', true);
```

### Multi-Action (Complex Effects)
```javascript
// Execute multiple actions simultaneously
controller.executeMultiAction([
  {
    type: 'text',
    text: '🎉 CELEBRATION! 🎉',
    duration: 5,
    fontSize: 28,
    textColor: '#ff6b6b'
  },
  {
    type: 'text',
    text: 'Multiple things happening!',
    duration: 5,
    fontSize: 20,
    textColor: '#4ecdc4'
  }
]);
```

## 🔧 Troubleshooting

### Overlay Not Connecting
1. **Check VirtualDeck is running** - You should see WebSocket server message
2. **Check OBS Browser Source URL** - Must be absolute file path
3. **Check OBS Console** - Right-click Browser Source → "Interact" to see console

### Videos Not Playing
1. **Check file paths** - Use absolute paths or HTTP URLs
2. **Check autoplay** - Videos start muted, then unmute automatically
3. **Check OBS settings** - Enable hardware acceleration

### WebSocket Connection Failed
1. **Check port 8080** - Make sure nothing else is using it
2. **Check firewall** - Allow Node.js through Windows Firewall
3. **Restart VirtualDeck** - This restarts the WebSocket server

### Debug Mode
Add `?debug=true` to your overlay URL to see debug info:
```
http://localhost:8080/overlay?debug=true
```

### Connection Status
The overlay now shows a connection indicator in the top-right corner:
- 🔴 **Red**: Disconnected from VirtualDeck
- 🟢 **Green**: Connected to VirtualDeck  
- 🔵 **Blue**: Receiving messages from VirtualDeck

### Testing the Overlay
1. **Local Test**: Click the "Test" button in the connection indicator to test message display
2. **VirtualDeck Test**: Use the overlay widget in VirtualDeck to send test messages
3. **Console Debugging**: Open browser dev tools (F12) to see detailed logs

## 🎨 Customization

### Overlay Positioning
Edit `overlay-obs.html` CSS to change overlay positions:
```css
#twitch-stats-overlay {
  top: 20px;        /* Distance from top */
  right: 20px;      /* Distance from right */
}

#recent-activity-overlay {
  bottom: 20px;     /* Distance from bottom */
  left: 20px;       /* Distance from left */
}
```

### Styling
Modify colors, fonts, and animations in the CSS section of `overlay-obs.html`.

### Adding New Overlays
1. Add HTML structure
2. Add CSS styling
3. Add JavaScript functionality
4. Add toggle control in `main.js`

## 🎮 Built-in Test Panel

Your VirtualDeck app now includes a comprehensive overlay test panel accessible via **Tools → OBS Overlay → Open Overlay Test Panel**.

### Features:
- **📋 Copy OBS URL** - One-click copy of the overlay URL
- **💬 Test Message** - Send test messages to overlay
- **📊 Test Stats** - Update viewer/follower/subscriber counts
- **🎉 Test Activity** - Show recent follower/subscriber activity
- **🎪 Multi Action** - Execute complex multi-overlay effects
- **❌ Hide All** - Hide all overlays
- **📤 Custom Message** - Send custom messages with styling options

### Custom Message Options:
- Text content and duration
- Font size (12-72px)
- Text color and background color
- Real-time preview in OBS

## 🚀 Advanced Usage

### Integration with Your App
You can control the overlay from your main VirtualDeck app:

```javascript
// In your main app
ipcRenderer.send('overlay-show-media', {
  type: 'video',
  src: 'path/to/video.mp4',
  duration: 5,
  volume: 1.0
});

ipcRenderer.send('overlay-update-stats', {
  viewerCount: 1234,
  followerCount: 5678,
  subscriberCount: 90
});
```

### External Control
You can control the overlay from any application that can send WebSocket messages:

```javascript
const ws = new WebSocket('ws://localhost:8080');
ws.send(JSON.stringify({
  type: 'showMessage',
  data: { message: 'Hello from external app!', duration: 5 }
}));
```

## 📝 Next Steps

1. **Test with real media files** - Add your own videos, images, and sounds
2. **Integrate with Twitch events** - Connect to your existing Twitch integration
3. **Create custom animations** - Add more CSS animations and effects
4. **Build a UI** - Create a control panel in your main app
5. **Add more overlay types** - Chat, donations, alerts, etc.

Your overlay system is now ready to use just like MixItUp! 🎉
