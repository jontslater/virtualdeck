# VirtualDeck licensing (v1.2+)

## Plans

| Feature | Free | VirtualDeck Pro (one-time license) |
|--------|------|-------------------------------------|
| Soundboard, alerts, macros, Twitch tools | Yes | Yes |
| Active buttons / hotkeys | 15 | Unlimited |
| Raven AI assistant | No | Yes (BYOK) |

Existing decks with more than 15 buttons **keep all data**. On the free plan, only the first 15 slots in deck order stay active; additional buttons are saved but locked (no hotkey, no trigger, no edits) until a license is activated.

## Configuration

Set in `.env` (loaded by `main.js` on startup) or the process environment:

| Variable | Description |
|----------|-------------|
| `VD_LICENSE_PROVIDER` | `mock` (default) or `lemonsqueezy` |
| `LEMONSQUEEZY_API_KEY` | API key from Lemon Squeezy → Settings → API |
| `VD_LICENSE_PURCHASE_URL` | Checkout link shown in Preferences (optional) |
| `VD_LICENSE_MOCK_PREFIXES` | Comma-separated prefixes accepted in mock mode (default `VD-MOCK-,VDTEST-`) |

### Mock / dev mode (default)

No network calls. Activate any key that:

- Starts with `VD-MOCK-` or `VDTEST-`, or
- Is at least 12 characters long

Example: `VD-MOCK-DEV-LOCAL-001`

### Lemon Squeezy (production)

1. Create a product in Lemon Squeezy with license keys enabled.
2. Copy the **API key** into `LEMONSQUEEZY_API_KEY`.
3. Set `VD_LICENSE_PROVIDER=lemonsqueezy`.
4. Set `VD_LICENSE_PURCHASE_URL` to your checkout URL for the in-app “Get VirtualDeck Pro” link.

The app uses the [License API](https://docs.lemonsqueezy.com/api/license-api) (`activate`, `validate`, `deactivate`). Activation is stored encrypted in `%APPDATA%/VirtualDeck/license.dat` (OS keychain via Electron `safeStorage` when available).

Revalidation runs about every 24 hours. If validation fails (offline), entitlements remain for **7 days** after the last successful check, then revert to free.

## Personal / secret-key builds

**Never ship public installers with bundled API keys.**

| Script | Safe for public release? |
|--------|-------------------------|
| `npm run build:win` | Yes (no Raven staging) |
| `npm run build:win:with-raven` | Yes (keyless `env.defaults`) |
| `npm run build:win:personal` | **No** — bundles secrets via `RAVEN_BUNDLE_KEYS=1` |

`prepare-build.js` fails the build if credential files would be packaged. Personal builds print explicit warnings and are blocked in CI unless `VD_ALLOW_PERSONAL_BUILD=1`.
