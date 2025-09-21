# VirtualDeck Skin System

This directory contains custom skins for VirtualDeck. Skins allow you to completely customize the appearance of the application beyond the built-in themes.

## Skin File Format

Skins are JSON files with the following structure:

```json
{
  "name": "Skin Name",
  "description": "Description of the skin",
  "version": "1.0.0",
  "author": "Author Name",
  "variables": {
    "--bg-primary": "#ffffff",
    "--text-primary": "#000000",
    "--accent-primary": "#007bff"
  },
  "css": "/* Custom CSS rules */",
  "components": {
    ".sound-card": {
      "border-radius": "15px",
      "box-shadow": "0 4px 8px rgba(0,0,0,0.1)"
    }
  }
}
```

## Fields

- **name** (required): Display name of the skin
- **description** (optional): Description of the skin
- **version** (required): Version of the skin
- **author** (optional): Author of the skin
- **variables** (optional): CSS custom properties to override theme variables
- **css** (optional): Raw CSS to inject into the page
- **components** (optional): Object with CSS selectors as keys and style objects as values

## CSS Variables

Skins can override any of the built-in CSS variables:

- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-quaternary`, `--bg-quinary`
- `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-quaternary`
- `--border-primary`, `--border-secondary`, `--border-tertiary`, `--border-quaternary`
- `--accent-primary`, `--accent-secondary`, `--accent-tertiary`, `--accent-quaternary`
- `--hover-bg`, `--active-bg`, `--focus-bg`
- `--shadow-color`, `--shadow-hover`
- `--success-color`, `--warning-color`, `--error-color`, `--info-color`

## How to Use

1. Create a JSON file with the skin structure above
2. Save it in this directory with a `.json` extension
3. Use the "Import Skin..." option in the Tools > Skins menu to import external skins
4. Select skins from the Tools > Skins menu to apply them
5. Use "Refresh Skins" to reload the skins list

## Examples

See the included example skins:
- `neon-cyber.json` - Cyberpunk-inspired neon theme
- `nature-forest.json` - Earthy forest theme
- `minimal-white.json` - Clean minimal white theme
