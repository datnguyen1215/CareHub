#!/usr/bin/env bash
# release.sh — Build, sign, and upload a release APK for @carehub/portal
#
# Usage:
#   bash scripts/release.sh --version X.Y.Z
#   npm run release -- --version X.Y.Z
#
# Prerequisites (one-time setup):
#   1. Generate a keystore:
#      keytool -genkey -v -keystore carehub-portal.keystore -alias portal -keyalg RSA -keysize 2048 -validity 10000
#   2. Create packages/portal/.env.release with:
#      KEYSTORE_PATH=./carehub-portal.keystore
#      KEYSTORE_PASSWORD=...
#      KEY_ALIAS=portal
#      KEY_PASSWORD=...
#      BACKEND_URL=https://your-server.com
#   3. ANDROID_HOME must be set in your environment.
#
# See RELEASING.md in the project root for full documentation.

set -euo pipefail

# ── Resolve script and package directories ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$PACKAGE_DIR/android"
BUILD_GRADLE="$ANDROID_DIR/app/build.gradle"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
APP_NAME="portal"

# ── Parse arguments ────────────────────────────────────────────────────────────
VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      if [[ $# -lt 2 ]]; then
        echo "Error: --version requires a value." >&2
        echo "Usage: $0 --version X.Y.Z" >&2
        exit 1
      fi
      VERSION="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --version X.Y.Z" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  echo "Error: --version is required." >&2
  echo "Usage: $0 --version X.Y.Z" >&2
  exit 1
fi

# ── Validate semver format ─────────────────────────────────────────────────────
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be in semver format (X.Y.Z), got: $VERSION" >&2
  exit 1
fi

# ── Load .env.release ──────────────────────────────────────────────────────────
ENV_FILE="$PACKAGE_DIR/.env.release"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found." >&2
  echo "Create it with KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD, BACKEND_URL." >&2
  echo "See RELEASING.md for setup instructions." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

# ── Prerequisites check ────────────────────────────────────────────────────────
PREREQ_OK=true

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "Error: ANDROID_HOME is not set. Install Android SDK and set ANDROID_HOME." >&2
  PREREQ_OK=false
fi

for VAR in KEYSTORE_PATH KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD BACKEND_URL; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "Error: $VAR is not set in $ENV_FILE." >&2
    PREREQ_OK=false
  fi
done

# Resolve KEYSTORE_PATH relative to package dir if not absolute
if [[ -n "${KEYSTORE_PATH:-}" && ! "$KEYSTORE_PATH" = /* ]]; then
  KEYSTORE_PATH="$PACKAGE_DIR/$KEYSTORE_PATH"
fi

if [[ -n "${KEYSTORE_PATH:-}" && ! -f "$KEYSTORE_PATH" ]]; then
  echo "Error: Keystore not found at $KEYSTORE_PATH." >&2
  echo "Generate it with: keytool -genkey -v -keystore carehub-portal.keystore -alias portal -keyalg RSA -keysize 2048 -validity 10000" >&2
  PREREQ_OK=false
fi

if [[ -n "${BACKEND_URL:-}" ]]; then
  if ! curl -sf --max-time 5 "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    echo "Warning: Backend at $BACKEND_URL does not appear reachable (continuing anyway)." >&2
  fi
fi

if [[ "$PREREQ_OK" != true ]]; then
  echo "" >&2
  echo "Prerequisites not met. See RELEASING.md for setup instructions." >&2
  exit 1
fi

echo "==> Releasing $APP_NAME v$VERSION"

# ── Auto-increment versionCode and set versionName ────────────────────────────
echo "==> Updating build.gradle version..."

CURRENT_VERSION_CODE=$(grep -oP 'versionCode \K[0-9]+' "$BUILD_GRADLE" | head -1)
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

TMP_GRADLE=$(mktemp)
sed "s/\(versionCode \)$CURRENT_VERSION_CODE$/\1$NEW_VERSION_CODE/" "$BUILD_GRADLE" > "$TMP_GRADLE"
sed -i "s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$TMP_GRADLE"
cp "$TMP_GRADLE" "$BUILD_GRADLE"
rm -f "$TMP_GRADLE"

echo "    versionCode: $CURRENT_VERSION_CODE → $NEW_VERSION_CODE"
echo "    versionName: $VERSION"

# ── Vite build ─────────────────────────────────────────────────────────────────
echo "==> Running npm run build..."
cd "$PACKAGE_DIR"
npm run build

# ── Capacitor sync ────────────────────────────────────────────────────────────
echo "==> Running npx cap sync android..."
npx cap sync android

# ── Gradle assembleRelease ────────────────────────────────────────────────────
echo "==> Building release APK..."
cd "$ANDROID_DIR"
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
  -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD" \
  -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
  -Pandroid.injected.signing.key.password="$KEY_PASSWORD"

cd "$PACKAGE_DIR"

# ── Verify APK exists ──────────────────────────────────────────────────────────
if [[ ! -f "$APK_PATH" ]]; then
  echo "Error: Expected APK not found at $APK_PATH" >&2
  exit 1
fi

echo "==> APK built: $APK_PATH"

# ── Upload to backend ──────────────────────────────────────────────────────────
echo "==> Uploading to $BACKEND_URL/api/releases/upload..."
RESPONSE=$(curl -sSf \
  -F "apk=@$APK_PATH" \
  -F "version=$VERSION" \
  -F "app=$APP_NAME" \
  "$BACKEND_URL/api/releases/upload") || { echo "Error: Upload failed. Check the backend URL and server logs." >&2; exit 1; }

RELEASE_ID=$(echo "$RESPONSE" | grep -oP '"id"\s*:\s*"\K[^"]+' || echo "$RESPONSE" | grep -oP '"id"\s*:\s*\K[0-9]+' || true)

echo ""
echo "✓ Release uploaded successfully!"
echo "  App:         $APP_NAME"
echo "  Version:     $VERSION"
echo "  VersionCode: $NEW_VERSION_CODE"
if [[ -n "$RELEASE_ID" ]]; then
  echo "  Release ID:  $RELEASE_ID"
fi
