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
1. Download the latest installer from [Releases](https://github.com/jontslater/VirtualDeck/releases)
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

This will start the Electron application with hot reload enabled for development.

## 🧪 How to Test

To test the application functionality:

1. **Manual Testing**: 
   - Launch the app with `npm start`
   - Test adding new sound triggers
   - Test hotkey assignments (F1-F12, 1-0)
   - Test audio playback
   - Test editing and deleting triggers

2. **Build Testing**:
   ```bash
   # Test the build process
   npm run prepare-build
   npm run build:win
   ```

3. **Integration Testing**:
   - Test global hotkeys work when app is not focused
   - Test file operations (add/edit/delete sounds)
   - Test window controls (move, close, always-on-top)

## 📖 Usage

### Adding Your First Sound
1. Click the "Add Sound" card to open the settings modal
2. Drag and drop an audio file or click "Browse" to select one
3. Enter a label for your sound (e.g., "Applause", "Drum Roll")
4. Click "Record Hotkey" and press your desired key (F1-F12 or 1-0)
5. Click "Save" to add the trigger to your deck

### Playing Sounds
- **Click**: Simply click any sound card to play it
- **Hotkey**: Press the assigned hotkey from anywhere on your system
- **Global Access**: Hotkeys work even when VirtualDeck is minimized

### Managing Your Deck
- **Edit**: Click "Edit" on any card to modify its settings
- **Delete**: Click "Delete" to remove a trigger and its audio file
- **Move Window**: Drag the title bar to reposition the app

## 🎨 Supported Audio Formats
- MP3
- WAV
- OGG
- M4A

## 🔧 Configuration

VirtualDeck stores all user data in the following locations:
- **Windows**: `%APPDATA%/VirtualDeck/`
- **macOS**: `~/Library/Application Support/VirtualDeck/`
- **Linux**: `~/.config/VirtualDeck/`

This includes:
- `config.json`: Your trigger configurations
- `sounds/`: Your audio files
- `defaults/`: Default sounds (copied on first run)

## 🛠️ Development

### Project Structure
```
VirtualDeck/
├── main.js              # Main Electron process
├── preload.js           # Preload script for secure API access
├── public/              # Renderer process files
│   ├── index.html       # Main UI
│   ├── script.js        # Frontend logic
│   └── styles.css       # Styling
├── config.json          # Default configuration
└── package.json         # Dependencies and scripts
```

### Key Technologies
- **Electron**: Cross-platform desktop app framework
- **Node.js**: Backend runtime
- **HTML/CSS/JavaScript**: Frontend interface
- **electron-builder**: Packaging and distribution

### Security Features
- Context isolation enabled
- Node integration disabled in renderer
- File system operations isolated to main process
- IPC communication for secure API access

## 📦 Building

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Build Commands
```bash
# Install dependencies
npm install

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux

# Build for all platforms
npm run build:all
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/)
- Icons and UI inspiration from modern design systems
- Audio playback powered by Web Audio API

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/VirtualDeck/issues) page
2. Create a new issue with detailed information
3. Include your operating system and VirtualDeck version

---

**VirtualDeck** - Your customizable audio trigger deck for instant sound access! 🎵
