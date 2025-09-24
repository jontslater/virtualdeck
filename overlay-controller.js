/**
 * VirtualDeck Overlay Controller
 * 
 * This script demonstrates how to control the OBS overlay via WebSocket
 * Similar to how MixItUp controls browser sources in OBS
 * 
 * Usage:
 * 1. Start your VirtualDeck app (this starts the WebSocket server on port 8080)
 * 2. Add the overlay to OBS as a browser source with URL: file:///path/to/overlay-obs.html
 * 3. Run this script to control the overlay
 */

const WebSocket = require('ws');

class OverlayController {
  constructor() {
    this.ws = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log('Connecting to VirtualDeck overlay WebSocket server...');
      
      this.ws = new WebSocket('ws://localhost:8080');
      
      this.ws.on('open', () => {
        console.log('✅ Connected to overlay WebSocket server');
        this.connected = true;
        resolve();
      });

      this.ws.on('close', () => {
        console.log('❌ Disconnected from overlay WebSocket server');
        this.connected = false;
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });
    });
  }

  sendCommand(type, data = {}) {
    if (!this.connected || !this.ws) {
      console.error('❌ Not connected to overlay server');
      return;
    }

    const message = {
      type: type,
      data: data
    };

    console.log(`📤 Sending ${type}:`, data);
    this.ws.send(JSON.stringify(message));
  }

  // Media Control Methods (MixItUp-style)
  
  showVideo(videoPath, duration = 5, volume = 1.0) {
    this.sendCommand('showMedia', {
      type: 'video',
      src: videoPath,
      duration: duration,
      volume: volume
    });
  }

  showImage(imagePath, duration = 5) {
    this.sendCommand('showMedia', {
      type: 'image',
      src: imagePath,
      duration: duration
    });
  }

  playSound(audioPath, volume = 1.0, duration = 5) {
    this.sendCommand('showMedia', {
      type: 'audio',
      src: audioPath,
      volume: volume,
      duration: duration
    });
  }

  showMessage(message, duration = 5, styling = {}) {
    this.sendCommand('showMessage', {
      message: message,
      duration: duration,
      fontSize: styling.fontSize || 24,
      fontFamily: styling.fontFamily || 'Arial',
      textColor: styling.textColor || '#ffffff',
      backgroundColor: styling.backgroundColor || 'rgba(0,0,0,0.8)'
    });
  }

  hideMedia() {
    this.sendCommand('hideMedia', {});
  }

  // Multi-Action (like MixItUp's complex actions)
  executeMultiAction(actions) {
    this.sendCommand('executeMultiAction', {
      actions: actions
    });
  }

  // Stats and Activity Updates
  updateStats(viewerCount, followerCount, subscriberCount) {
    this.sendCommand('updateStats', {
      viewerCount: viewerCount,
      followerCount: followerCount,
      subscriberCount: subscriberCount
    });
  }

  updateActivity(latestFollower, latestSubscriber) {
    this.sendCommand('updateActivity', {
      latestFollower: latestFollower,
      latestSubscriber: latestSubscriber
    });
  }

  updateSoundStatus(currentSound) {
    this.sendCommand('updateSoundStatus', {
      currentSound: currentSound
    });
  }

  // Overlay Visibility Control
  toggleOverlay(overlayType, visible) {
    this.sendCommand('toggleOverlay', {
      overlayType: overlayType,
      visible: visible
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

// Example usage and test functions
async function runTests() {
  const controller = new OverlayController();
  
  try {
    await controller.connect();
    
    console.log('\n🎬 Starting overlay tests...\n');
    
    // Test 1: Show a message
    console.log('Test 1: Showing welcome message');
    controller.showMessage('Welcome to VirtualDeck!', 3, {
      fontSize: 32,
      textColor: '#00ff00',
      backgroundColor: 'rgba(0,0,0,0.9)'
    });
    
    await sleep(4000);
    
    // Test 2: Show fake stats
    console.log('Test 2: Updating stats');
    controller.updateStats(1234, 5678, 90);
    controller.toggleOverlay('twitch-stats-overlay', true);
    
    await sleep(3000);
    
    // Test 3: Show activity
    console.log('Test 3: Showing recent activity');
    controller.updateActivity('NewFollower123', 'LoyalSubscriber456');
    controller.toggleOverlay('recent-activity-overlay', true);
    
    await sleep(3000);
    
    // Test 4: Multi-action (multiple things at once)
    console.log('Test 4: Executing multi-action');
    controller.executeMultiAction([
      {
        type: 'text',
        text: '🎉 CELEBRATION TIME! 🎉',
        duration: 5,
        fontSize: 28,
        textColor: '#ff6b6b',
        backgroundColor: 'rgba(255,107,107,0.9)'
      },
      {
        type: 'text',
        text: 'Multiple actions happening!',
        duration: 5,
        fontSize: 20,
        textColor: '#4ecdc4',
        backgroundColor: 'rgba(78,205,196,0.9)'
      }
    ]);
    
    await sleep(6000);
    
    // Test 5: Hide everything
    console.log('Test 5: Hiding all media');
    controller.hideMedia();
    controller.toggleOverlay('twitch-stats-overlay', false);
    controller.toggleOverlay('recent-activity-overlay', false);
    
    await sleep(2000);
    
    // Test 6: Final message
    console.log('Test 6: Final message');
    controller.showMessage('Tests completed! ✅', 3, {
      fontSize: 24,
      textColor: '#ffffff',
      backgroundColor: 'rgba(0,100,0,0.9)'
    });
    
    await sleep(4000);
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    controller.disconnect();
  }
}

// Utility function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Interactive mode
function startInteractiveMode() {
  const controller = new OverlayController();
  
  controller.connect().then(() => {
    console.log('\n🎮 Interactive Overlay Controller');
    console.log('Available commands:');
    console.log('  message <text> [duration] - Show a message');
    console.log('  video <path> [duration] [volume] - Show a video');
    console.log('  image <path> [duration] - Show an image');
    console.log('  sound <path> [volume] [duration] - Play audio');
    console.log('  stats <viewers> <followers> <subscribers> - Update stats');
    console.log('  activity <follower> <subscriber> - Update activity');
    console.log('  hide - Hide all media');
    console.log('  toggle <overlayType> <true/false> - Toggle overlay visibility');
    console.log('  multi - Run multi-action demo');
    console.log('  quit - Exit\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const prompt = () => {
      rl.question('overlay> ', (input) => {
        const parts = input.trim().split(' ');
        const command = parts[0].toLowerCase();
        
        switch (command) {
          case 'message':
            const message = parts.slice(1, -1).join(' ') || 'Test message';
            const duration = parseInt(parts[parts.length - 1]) || 5;
            controller.showMessage(message, duration);
            break;
            
          case 'video':
            const videoPath = parts[1] || 'test-video.mp4';
            const videoDuration = parseInt(parts[2]) || 5;
            const videoVolume = parseFloat(parts[3]) || 1.0;
            controller.showVideo(videoPath, videoDuration, videoVolume);
            break;
            
          case 'image':
            const imagePath = parts[1] || 'test-image.jpg';
            const imageDuration = parseInt(parts[2]) || 5;
            controller.showImage(imagePath, imageDuration);
            break;
            
          case 'sound':
            const soundPath = parts[1] || 'test-sound.mp3';
            const soundVolume = parseFloat(parts[2]) || 1.0;
            const soundDuration = parseInt(parts[3]) || 5;
            controller.playSound(soundPath, soundVolume, soundDuration);
            break;
            
          case 'stats':
            const viewers = parseInt(parts[1]) || 1234;
            const followers = parseInt(parts[2]) || 5678;
            const subscribers = parseInt(parts[3]) || 90;
            controller.updateStats(viewers, followers, subscribers);
            controller.toggleOverlay('twitch-stats-overlay', true);
            break;
            
          case 'activity':
            const follower = parts[1] || 'NewFollower123';
            const subscriber = parts[2] || 'LoyalSubscriber456';
            controller.updateActivity(follower, subscriber);
            controller.toggleOverlay('recent-activity-overlay', true);
            break;
            
          case 'hide':
            controller.hideMedia();
            controller.toggleOverlay('twitch-stats-overlay', false);
            controller.toggleOverlay('recent-activity-overlay', false);
            break;
            
          case 'toggle':
            const overlayType = parts[1] || 'twitch-stats-overlay';
            const visible = parts[2] === 'true';
            controller.toggleOverlay(overlayType, visible);
            break;
            
          case 'multi':
            controller.executeMultiAction([
              {
                type: 'text',
                text: '🎉 MULTI-ACTION DEMO 🎉',
                duration: 5,
                fontSize: 28,
                textColor: '#ff6b6b'
              }
            ]);
            break;
            
          case 'quit':
          case 'exit':
            console.log('Goodbye!');
            controller.disconnect();
            rl.close();
            return;
            
          default:
            console.log('Unknown command. Type a command or "quit" to exit.');
        }
        
        prompt();
      });
    };
    
    prompt();
    
  }).catch(error => {
    console.error('Failed to connect:', error.message);
    console.log('Make sure VirtualDeck is running and the overlay server is active.');
  });
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test') || args.includes('-t')) {
    runTests();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
VirtualDeck Overlay Controller

Usage:
  node overlay-controller.js [options]

Options:
  --test, -t     Run automated tests
  --interactive, -i  Start interactive mode (default)
  --help, -h     Show this help

Examples:
  node overlay-controller.js --test
  node overlay-controller.js --interactive
    `);
  } else {
    startInteractiveMode();
  }
}

module.exports = OverlayController;


