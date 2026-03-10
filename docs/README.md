# VirtualDeck 🎵

A customizable audio trigger deck with global hotkey support and a modern UI. VirtualDeck allows you to create instant sound triggers that can be activated with a click or keyboard shortcut, perfect for streamers, content creators, and anyone who needs quick audio access.

## ✨ Features

### 🎯 Core Functionality
- **Customizable Audio Deck**: Add, edit, and delete sound triggers on a responsive grid-based dashboard
- **Instant Playback**: Click any card or press its assigned hotkey to play audio immediately
- **Modern UI**: Clean, card-based interface with hover effects and smooth animations

### ⌨️ Global Hotkey Support
- **F1-F12 Keys**: Assign function keys as global hotkeys
- **Number Row (1-0)**: Use number keys for additional triggers
- **Always Active**: Hotkeys work even when the app is not focused
- **Real-time Updates**: Hotkey assignments refresh automatically after changes

### 🎛️ Trigger Management
- **Add New Sounds**: Drag-and-drop file upload or browse to add audio files
- **Edit Existing**: Modify labels, hotkeys, or replace audio files
- **Smart File Management**: Audio files are automatically renamed when labels change
- **Delete Triggers**: Remove triggers and their associated files with one click

### 🖥️ Window Controls
- **Frameless Design**: Custom draggable title bar with "⇱ Move" indicator
- **Always-On-Top**: Window stays on top for quick access
- **Close Button**: Easy app closure from the UI
- **DevTools Access**: Right-click menu and F12 for debugging

### 🔒 Security & Reliability
- **Electron Security**: Node integration disabled, context isolation enabled
- **Safe APIs**: Only secure APIs exposed via preload.js
- **User Data Protection**: All config and audio files stored in user-specific directories
- **Automatic Setup**: Default config and sounds copied on first run

## 🚀 Installation

### Windows
1. Download the latest installer from the Releases page
2. Run the `.exe` installer
3. Follow the installation wizard
4. Launch VirtualDeck from your Start Menu or desktop shortcut

### Development Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/VirtualDeck.git
cd VirtualDeck

# Install dependencies
npm install
```

## 🏃 How to Run

To run the VirtualDeck application in development mode:

```bash
npm start
```

## 🧪 How to Test

1. **Manual Testing**: Launch app, test adding sounds, hotkeys and playback
2. **Build Testing**: `npm run prepare-build` && `npm run build:win`
3. **Integration Testing**: hotkeys while unfocused, file ops, window controls

## 📖 Usage

### Adding Your First Sound
1. Click the "Add Sound" card to open the settings modal
2. Drag and drop an audio file or click "Browse" to select one
3. Enter a label for your sound
4. Click "Record Hotkey" and press your desired key
5. Click "Save"

### Playing Sounds
- Click any sound card to play it
- Press the assigned hotkey from anywhere

### Managing Your Deck
- Edit: Click "Edit" on any card to modify
- Delete: Click "Delete" to remove

## 🎨 Supported Audio Formats
- MP3, WAV, OGG, M4A

## 🔧 Configuration
VirtualDeck stores user data in the Electron userData path (platform-specific).

## 🛠️ Development
Project structure, key technologies, security notes, and build commands.

---

**VirtualDeck** - Your customizable audio trigger deck for instant sound access! 🎵

