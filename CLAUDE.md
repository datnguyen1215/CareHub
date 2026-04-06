# CareHub — Claude Context

## Releasing Android APKs

To build, sign, and upload a release APK, use the release scripts. See **[RELEASING.md](./RELEASING.md)** for full setup and usage.

Quick reference:
```bash
npm run release:kiosk -- --version X.Y.Z
npm run release:portal -- --version X.Y.Z
```

Requires one-time setup: keystore generation and a `.env.release` file in each package directory.
