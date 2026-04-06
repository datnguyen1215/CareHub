# CareHub Kiosk — Android Device Setup

## Device Owner Provisioning

The kiosk app uses Android **Device Owner** mode to silently install APK updates
without user interaction. This is a one-time, per-device setup that requires
the device to be in a clean state.

### Prerequisites

- ADB installed and available in `PATH`
- Device connected via USB with USB Debugging enabled
- Device has **no Google accounts** (or is freshly factory-reset)
- Kiosk APK installed on the device

### Steps

1. **Factory reset the device**
   Settings → General Management → Reset → Factory Data Reset

2. **Complete minimal Android setup**
   - Skip or dismiss the Google account sign-in step entirely
   - Do not add any accounts

3. **Enable Developer Options**
   Settings → About Phone → tap "Build Number" 7 times
   Then: Settings → Developer Options → enable "USB Debugging"

4. **Install the kiosk APK**
   ```bash
   adb install path/to/carehub-kiosk.apk
   ```

5. **Run the provisioning script**
   ```bash
   bash packages/kiosk/scripts/provision-device-owner.sh
   ```

6. **Verify**
   ```bash
   adb shell dpm list-owners
   # Expected output contains: us.dnguyen.carehub.kiosk
   ```

### Notes

- Device owner can only be set once. To change it, the device must be factory-reset.
- Lock Task Mode (kiosk pinning) works in conjunction with Device Owner and is
  already configured in `MainActivity` via `startLockTask()`.
- To remove device owner (disables silent install): 
  `adb shell dpm remove-active-admin us.dnguyen.carehub.kiosk/.DeviceAdminReceiver`

### Relevant Files

| File | Purpose |
|------|---------|
| `android/app/src/main/java/us/dnguyen/carehub/kiosk/DeviceAdminReceiver.java` | Device admin entry point |
| `android/app/src/main/java/us/dnguyen/carehub/kiosk/SilentUpdatePlugin.java` | Capacitor plugin — downloads, verifies, and silently installs APK updates |
| `android/app/src/main/java/us/dnguyen/carehub/kiosk/InstallStatusReceiver.java` | BroadcastReceiver for PackageInstaller session results |
| `android/app/src/main/java/us/dnguyen/carehub/kiosk/MainActivity.java` | Registers SilentUpdatePlugin on startup |
| `android/app/src/main/res/xml/device_admin.xml` | Declares required admin policies |
| `android/app/src/main/AndroidManifest.xml` | Registers receivers (DeviceAdmin, InstallStatus) |
| `src/lib/plugins/silent-update.ts` | TypeScript/JS bridge for the SilentUpdate plugin |
| `scripts/provision-device-owner.sh` | One-time ADB provisioning script |
