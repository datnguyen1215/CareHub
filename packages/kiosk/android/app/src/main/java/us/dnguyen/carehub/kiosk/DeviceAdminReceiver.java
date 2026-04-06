package us.dnguyen.carehub.kiosk;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * DeviceAdminReceiver is the entry point Android uses to grant Device Owner privileges
 * to this application.
 *
 * <p>Device Owner mode enables the kiosk app to silently install APK updates without
 * user interaction, using {@link android.app.admin.DevicePolicyManager}. This receiver
 * must be registered in AndroidManifest.xml with the BIND_DEVICE_ADMIN permission and
 * declared as the device admin component.</p>
 *
 * <p>Provisioning is a one-time operation performed via ADB after factory reset.
 * See {@code packages/kiosk/scripts/provision-device-owner.sh} for the provisioning script,
 * and {@code SETUP.md} for step-by-step instructions.</p>
 */
public class DeviceAdminReceiver extends android.app.admin.DeviceAdminReceiver {

    private static final String TAG = "DeviceAdminReceiver";

    /**
     * Called when this application is made a device administrator.
     *
     * <p>This is triggered after successful provisioning via ADB or the device
     * administration UI. At this point the app has device owner privileges and
     * can perform privileged operations such as silent APK installation.</p>
     *
     * @param context the running context
     * @param intent  the received intent
     */
    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Log.i(TAG, "Device admin enabled — device owner privileges granted");
    }

    /**
     * Called when this application is removed as a device administrator.
     *
     * <p>After this callback the app no longer has device owner privileges.
     * Silent APK installation will no longer be available.</p>
     *
     * @param context the running context
     * @param intent  the received intent
     */
    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Log.w(TAG, "Device admin disabled — device owner privileges revoked");
    }
}
