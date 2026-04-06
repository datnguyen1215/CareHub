# Releasing CareHub Android Apps

This document covers the full process for building, signing, and uploading signed APKs for the **kiosk** and **portal** Android apps.

## Overview

The release pipeline is a single command that:
1. Validates all prerequisites
2. Bumps `versionCode` (auto-increment) and sets `versionName` in `build.gradle`
3. Runs `npm run build` (Vite)
4. Runs `npx cap sync android` (Capacitor sync)
5. Builds a signed APK via Gradle
6. Uploads the APK to the backend release endpoint

---

## One-Time Setup

### 1. Install Android SDK

Set `ANDROID_HOME` in your environment (e.g. in `~/.bashrc` or `~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
```

### 2. Generate Keystores

Each app requires its own keystore. **Store these files securely and back them up** — losing the keystore means you cannot publish updates to existing installs.

**Kiosk:**
```bash
cd packages/kiosk
keytool -genkey -v \
  -keystore carehub-kiosk.keystore \
  -alias kiosk \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Portal:**
```bash
cd packages/portal
keytool -genkey -v \
  -keystore carehub-portal.keystore \
  -alias portal \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be prompted for a keystore password, distinguished name details, and a key password. Remember these — they go in `.env.release`.

### 3. Create `.env.release` Files

Create `packages/kiosk/.env.release`:
```
KEYSTORE_PATH=./carehub-kiosk.keystore
KEYSTORE_PASSWORD=your-keystore-password
KEY_ALIAS=kiosk
KEY_PASSWORD=your-key-password
BACKEND_URL=https://your-server.com
```

Create `packages/portal/.env.release`:
```
KEYSTORE_PATH=./carehub-portal.keystore
KEYSTORE_PASSWORD=your-keystore-password
KEY_ALIAS=portal
KEY_PASSWORD=your-key-password
BACKEND_URL=https://your-server.com
```

These files are gitignored and must never be committed.

---

## Running a Release

From the project root:

```bash
npm run release:kiosk -- --version 1.1.0
npm run release:portal -- --version 1.1.0
```

Or from within a package directory:

```bash
cd packages/kiosk
npm run release -- --version 1.1.0
```

The version argument is required and must be in `X.Y.Z` (semver) format.

---

## What Happens at Each Step

| Step | What it does |
|------|-------------|
| Prerequisite check | Verifies `ANDROID_HOME`, `.env.release`, keystore file, and required env vars |
| Version bump | Reads current `versionCode` from `build.gradle`, increments by 1; sets `versionName` to the provided version |
| `npm run build` | Runs Vite to produce the web bundle |
| `npx cap sync android` | Copies the web bundle into the Android project and updates Capacitor plugins |
| `./gradlew assembleRelease` | Compiles and signs the APK using the provided keystore credentials |
| Upload | POSTs the APK to `$BACKEND_URL/api/releases/upload` with `app`, `version` fields |
| Output | Prints the release ID and version on success |

---

## Keystore Backup

**Critical:** The keystore file is the only way to sign future updates. If lost, existing installs cannot receive updates.

Recommended backup strategy:
- Store an encrypted copy in a password manager (e.g. 1Password, Bitwarden)
- Keep an offline backup on encrypted storage
- Document the keystore password separately from the file itself

---

## Troubleshooting

### `ANDROID_HOME is not set`
Install Android Studio or the Android command-line tools, then add `ANDROID_HOME` to your shell profile.

### `Keystore not found at ...`
Run the `keytool` command in the One-Time Setup section above, then update `KEYSTORE_PATH` in `.env.release`.

### `./gradlew: Permission denied`
```bash
chmod +x packages/kiosk/android/gradlew
chmod +x packages/portal/android/gradlew
```

### Signing errors (`keystore was tampered` or wrong password)
Double-check `KEYSTORE_PASSWORD` and `KEY_PASSWORD` in `.env.release`. These are set during keystore generation.

### Build fails after Capacitor sync
Run `npm run build` manually in the package directory and check for Vite/SvelteKit errors first.

### Upload fails (curl error)
Verify `BACKEND_URL` is correct and the server is running. The script will warn if the backend is unreachable before starting.

### APK not found after build
Check the Gradle output for build errors. The APK should appear at:
- `packages/kiosk/android/app/build/outputs/apk/release/app-release.apk`
- `packages/portal/android/app/build/outputs/apk/release/app-release.apk`
