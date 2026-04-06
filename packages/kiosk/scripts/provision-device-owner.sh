#!/usr/bin/env bash
# =============================================================================
# provision-device-owner.sh
#
# Sets the CareHub Kiosk app as the Android Device Owner so it can silently
# install APK updates without user interaction.
#
# Prerequisites:
#   - Device must be factory-reset OR have no Google/account manager accounts
#     added. Android rejects device owner provisioning if accounts exist.
#   - The kiosk APK must already be installed on the device.
#   - ADB must be installed and the device connected (USB debugging enabled).
#   - Run only once per device — device owner cannot be changed without a
#     factory reset afterward.
#
# One-time provisioning steps:
#   1. Factory reset the device (Settings → General Management → Reset).
#   2. Complete minimal Android setup — skip adding a Google account.
#   3. Enable Developer Options and USB Debugging.
#   4. Install the kiosk APK: adb install carehub-kiosk.apk
#   5. Run this script: bash provision-device-owner.sh
# =============================================================================

set -euo pipefail

PACKAGE="us.dnguyen.carehub.kiosk"
COMPONENT="${PACKAGE}/.DeviceAdminReceiver"

echo "=== CareHub Kiosk — Device Owner Provisioning ==="
echo ""

# ---------------------------------------------------------------------------
# Step 1: Remove existing accounts (required for device owner setup)
# ---------------------------------------------------------------------------
echo "[1/3] Removing existing accounts from device..."
ACCOUNTS=$(adb shell dumpsys account | grep -oP '(?<=Account \{name=)[^,]+' 2>/dev/null || true)
if [ -n "$ACCOUNTS" ]; then
    echo "  Found accounts — attempting removal via account manager..."
    adb shell pm remove-all-accounts-for-user 0 2>/dev/null || true
    echo "  Done. If accounts remain, factory reset is required."
else
    echo "  No accounts found — proceeding."
fi
echo ""

# ---------------------------------------------------------------------------
# Step 2: Set device owner
# ---------------------------------------------------------------------------
echo "[2/3] Setting device owner to ${COMPONENT}..."
if adb shell dpm set-device-owner "${COMPONENT}"; then
    echo "  Device owner set successfully."
else
    echo ""
    echo "ERROR: Failed to set device owner." >&2
    echo "  Common causes:" >&2
    echo "    - Accounts still exist on the device (factory reset required)." >&2
    echo "    - App is not installed: adb install carehub-kiosk.apk" >&2
    echo "    - Another device owner is already set." >&2
    exit 1
fi
echo ""

# ---------------------------------------------------------------------------
# Step 3: Verify
# ---------------------------------------------------------------------------
echo "[3/3] Verifying device owner..."
OWNERS=$(adb shell dpm list-owners)
echo "  ${OWNERS}"

if echo "${OWNERS}" | grep -q "${PACKAGE}"; then
    echo ""
    echo "SUCCESS: ${PACKAGE} is now the device owner."
    echo "The kiosk app can now silently install APK updates."
else
    echo ""
    echo "WARNING: Device owner verification failed — '${PACKAGE}' not found in owner list." >&2
    exit 1
fi
