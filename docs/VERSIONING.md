# Versioning

VirtualDeck uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

## Rules

| Bump | When |
|------|------|
| **MAJOR** | Breaking changes for users (rare; coordinate with comms) |
| **MINOR** | New features, licensing tiers, large subsystems (e.g. v1.2.0 monetization) |
| **PATCH** | Bug fixes and small improvements only |

## Single source of truth

- **`package.json` → `version`** must match the Git tag and GitHub Release (without the `v` prefix).
- Tag format: **`v1.2.0`** for version `1.2.0`.
- Windows installer file name: **`VirtualDeck-Setup-1.2.0.exe`** (see `build.win.artifactName`).

## Release checklist

1. Bump `package.json` version.
2. Add **`docs/releases/X.Y.Z.md`** release notes (user-facing bullets).
3. Merge to `main`.
4. Push tag `vX.Y.Z` (CI builds and publishes — see `docs/UPDATES.md`).
5. Confirm the GitHub Release contains **`latest.yml`**, **`VirtualDeck-Setup-X.Y.Z.exe`**, and **`.exe.blockmap`**.

## History note

GitHub Releases already ship **v1.1.4–v1.1.8** while `package.json` on some branches still said `1.1.1`. **v1.2.0** realigns the repo with the release line for the public launch milestone.
