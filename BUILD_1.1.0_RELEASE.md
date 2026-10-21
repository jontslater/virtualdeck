# VirtualDeck v1.1.0 Release Notes

**Release Date:** October 10, 2025  
**Build Version:** 1.1.0  
**Platform:** Windows x64

---

## 🐛 Bug Fixes

### Audio Button Save Error
**Issue:** When attempting to save an audio button, users encountered the following error:
```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'value')
at document.getElementById.onsubmit (script.js:2754:26)
```

**Fix:** 
- Added missing `type` hidden input field to the settings form
- Updated `openAudioForm()` function to properly set the type value to 'audio'
- The form submission now correctly identifies the button type and processes audio files

**Impact:** Audio buttons can now be saved without errors

---

### Audio File Picker Filter
**Issue:** When selecting audio files through the "Add Audio" form, the file picker showed all file types, making it difficult to find audio files.

**Fix:**
- Added `accept="audio/*"` attribute to the audio file input
- File picker now defaults to showing only audio files (MP3, WAV, OGG, M4A, etc.)

**Impact:** Improved user experience when selecting audio files

---

## 📦 Installation

**Installer Location:**
```
dist\VirtualDeck Setup 1.1.0.exe
```

**Installation Options:**
- Custom installation directory
- Desktop shortcut creation
- Start menu shortcut creation

---

## 🔧 Technical Details

### Modified Files
- `public/index.html` - Form structure updates
- `public/script.js` - Audio form initialization logic

### Commits
- `a3f2d15` - Fix audio button save error and add audio file filter

---

## 📋 System Requirements

- **OS:** Windows 10 or later
- **Architecture:** x64
- **Disk Space:** ~200 MB

---

## 🚀 Features (Existing)

This build maintains all existing VirtualDeck features:
- Audio button management with hotkey support
- Multi-media button creation (images, videos, audio, text)
- Twitch integration and chat display
- Customizable overlay system
- Alert widget for Twitch events
- Theme support
- Drag-and-drop functionality
- Button pagination
- Custom hotkey recording

---

## 🔄 Upgrade Notes

Users upgrading from v1.0.1 to v1.1.0:
- All existing buttons and settings will be preserved
- No configuration changes required
- Simply install over the previous version

---

## 🐞 Known Issues

None reported for this build.

---

## 📞 Support

For issues or questions, please create an issue on the GitHub repository.

**Repository:** https://github.com/jontslater/virtualdeck
