# VirtualDeck Test Skins

This folder contains test skin files that you can use to test the skin import functionality in VirtualDeck.

## Available Test Skins

### 1. Cyberpunk Neon (`test-cyberpunk.json`)
- **Theme**: Futuristic cyberpunk with neon green and pink accents
- **Colors**: Dark backgrounds with bright neon highlights
- **Effects**: Glow effects, neon text shadows, and futuristic styling

### 2. Ocean Depths (`test-ocean.json`)
- **Theme**: Calming ocean with blues and teals
- **Colors**: Deep ocean blues with light blue highlights
- **Effects**: Floating animations, water ripple effects, and gradient backgrounds

### 3. Sunset Glow (`test-sunset.json`)
- **Theme**: Warm sunset with oranges, pinks, and purples
- **Colors**: Warm sunset colors with glowing effects
- **Effects**: Shimmer animations, sunset gradients, and warm glow effects

## How to Test

1. **Start VirtualDeck** - Make sure the application is running
2. **Open the menu** - Go to `Tools > Themes > Import Theme...`
3. **Select a skin file** - Choose any of the `.json` files from this folder
4. **Apply the theme** - The skin should be imported and applied automatically

## Skin File Structure

Each skin file contains:
- **Metadata**: Name, description, version, and author
- **Variables**: CSS custom properties that override the default theme colors
- **CSS**: Additional custom CSS rules for special effects
- **Components**: Component-specific styling for chat messages and containers

## Creating Your Own Skins

You can create your own skin files by:
1. Copying one of the existing test skins as a template
2. Modifying the colors, effects, and styling to your preference
3. Saving it as a `.json` file
4. Importing it through the VirtualDeck interface

## Troubleshooting

- Make sure the JSON file is valid (use a JSON validator if needed)
- Check that all required fields are present (name, version, etc.)
- If a skin doesn't import, check the console for error messages
- Try refreshing the themes menu after importing

## Notes

- Skins are now integrated into the theme system
- You can switch between built-in themes and imported skins seamlessly
- All skins are stored in the user data directory after import
- The theme cycling hotkey (Ctrl+Shift+T) works with both themes and skins
