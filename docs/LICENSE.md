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
| `LEMONSQUEEZY_STORE_ID` | Lemon Squeezy store ID (recommended for production builds) |
| `LEMONSQUEEZY_PRODUCT_ID` | Product ID for VirtualDeck Pro / AI license |
| `LEMONSQUEEZY_VARIANT_ID` | Optional variant ID if you sell multiple variants |
| `VD_LICENSE_PURCHASE_URL` | Checkout link shown in Preferences (optional) |
| `VD_LICENSE_MOCK_PREFIXES` | Comma-separated prefixes accepted in mock mode (default `VD-MOCK-,VDTEST-`) |

### Mock / dev mode (default)

No network calls. Activate any key that:

- Starts with `VD-MOCK-` or `VDTEST-`, or
- Is at least 12 characters long

Example: `VD-MOCK-DEV-LOCAL-001`

### Lemon Squeezy (production)

The app uses Lemon Squeezy’s **public** [License API](https://docs.lemonsqueezy.com/api/license-api) (`activate`, `validate`, `deactivate` at `https://api.lemonsqueezy.com/v1/licenses/...`). **No store API key is required** for these endpoints.

1. Create a product in Lemon Squeezy with license keys enabled (activation limit **3** for VirtualDeck Pro).
2. Set `VD_LICENSE_PROVIDER=lemonsqueezy`.
3. Set `LEMONSQUEEZY_STORE_ID` and `LEMONSQUEEZY_PRODUCT_ID` to your store and product so keys from other Lemon Squeezy stores are rejected. Example for the live VirtualDeck store:

   | Setting | VirtualDeck value |
   |---------|-------------------|
   | Store | `501850` (`virtualdeckapp.lemonsqueezy.com`) |
   | Product (VirtualDeck AI License) | `1487094` |
   | Variant (optional) | *(omit or leave empty until a live variant ID is set)* |

4. Set `VD_LICENSE_PURCHASE_URL` to your checkout URL for the in-app “Get VirtualDeck Pro” link (live checkout: `https://virtualdeckapp.lemonsqueezy.com/checkout/buy/0e1d263f-6ff4-4864-bf6b-b253adccb043`).

**Flow**

- **Activate:** user enters a key → `POST /licenses/activate` with `license_key` + `instance_name` → app stores the returned `instance.id` encrypted in `%APPDATA%/VirtualDeck/license.dat` (OS keychain via Electron `safeStorage` when available).
- **Validate:** on launch and every ~24 hours → `POST /licenses/validate` with `license_key` + `instance_id`.
- **Deactivate:** user removes the key → `POST /licenses/deactivate` with `license_key` + `instance_id`, then local state is cleared.

**Test mode vs live:** Lemon Squeezy test-mode and live-mode keys use the same License API, but **product IDs differ** between test and live products. Release builds and `.env` must use the **live** store/product IDs (and checkout URL) when the store is live—see the table above.

**Offline grace:** Revalidation runs about every 24 hours. If validation fails because the key is invalid or revoked, entitlements end after **7 days** from the last successful check. If validation fails due to **network or server errors**, the app keeps the previous validation state and the same 7-day grace window applies from the last successful check—brief offline use does not immediately lock you out.

## Personal / secret-key builds

**Never ship public installers with bundled API keys.**

| Script | Safe for public release? |
|--------|-------------------------|
| `npm run build:win` | Yes (no Raven staging) |
| `npm run build:win:with-raven` | Yes (keyless `env.defaults`) |
| `npm run build:win:personal` | **No** — bundles secrets via `RAVEN_BUNDLE_KEYS=1` |

`prepare-build.js` fails the build if credential files would be packaged. Personal builds print explicit warnings and are blocked in CI unless `VD_ALLOW_PERSONAL_BUILD=1`.
