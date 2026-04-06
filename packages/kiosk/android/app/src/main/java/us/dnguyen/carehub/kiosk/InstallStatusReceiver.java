package us.dnguyen.carehub.kiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.util.Log;

import com.getcapacitor.PluginCall;

import java.io.File;
import java.util.concurrent.ConcurrentHashMap;

/**
 * BroadcastReceiver that handles {@link PackageInstaller} session commit results.
 *
 * <p>When {@link SilentUpdatePlugin} commits an install session it provides a
 * {@link android.app.PendingIntent} pointing at this receiver. The Android OS sends
 * a broadcast to this receiver once installation completes (successfully or not),
 * carrying the final status code and any error message.
 *
 * <p>This receiver resolves or rejects the pending Capacitor {@link PluginCall} that
 * initiated the download-and-install flow. Calls are stored in a static map keyed by
 * the Capacitor callback ID so they survive across the broadcast boundary.
 */
public class InstallStatusReceiver extends BroadcastReceiver {

    private static final String TAG = "InstallStatusReceiver";

    /**
     * Intent extra key used to pass the Capacitor callback ID through the PendingIntent.
     * Must match the key used when building the intent in {@link SilentUpdatePlugin}.
     */
    public static final String EXTRA_CALL_CALLBACK_ID = "callbackId";

    /**
     * Intent extra key used to pass the downloaded APK file path through the PendingIntent
     * so this receiver can delete the file after a successful installation.
     */
    public static final String EXTRA_APK_PATH = "apkPath";

    /**
     * Pending plugin calls awaiting an install result, keyed by Capacitor callback ID.
     * ConcurrentHashMap is used because the BroadcastReceiver runs on the main thread
     * while calls are registered from a background thread.
     */
    private static final ConcurrentHashMap<String, PluginCall> pendingCalls =
            new ConcurrentHashMap<>();

    /**
     * Registers a {@link PluginCall} so it can be resolved or rejected when the
     * install result arrives.
     *
     * @param callbackId the Capacitor callback ID for this call
     * @param call       the plugin call to resolve/reject
     */
    public static void registerCall(String callbackId, PluginCall call) {
        pendingCalls.put(callbackId, call);
    }

    /**
     * Removes a previously registered {@link PluginCall} from the pending map without
     * resolving or rejecting it. Called by {@link SilentUpdatePlugin} when
     * {@link android.content.pm.PackageInstaller.Session#commit} fails after registration,
     * to prevent the entry from leaking (the receiver will never fire in that case).
     *
     * @param callbackId the Capacitor callback ID to remove
     */
    public static void unregisterCall(String callbackId) {
        pendingCalls.remove(callbackId);
    }

    /**
     * Handles the install result broadcast from {@link PackageInstaller}.
     *
     * <p>Reads the {@link PackageInstaller#EXTRA_STATUS} and
     * {@link PackageInstaller#EXTRA_STATUS_MESSAGE} extras, then resolves or rejects
     * the pending {@link PluginCall} accordingly.
     *
     * @param context the running context
     * @param intent  the intent sent by PackageInstaller containing install status
     */
    @Override
    public void onReceive(Context context, Intent intent) {
        String callbackId = intent.getStringExtra(EXTRA_CALL_CALLBACK_ID);
        PluginCall call = callbackId != null ? pendingCalls.remove(callbackId) : null;

        if (call == null) {
            Log.w(TAG, "Received install status but no matching call found for id=" + callbackId);
            return;
        }

        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS,
                PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        if (status == PackageInstaller.STATUS_SUCCESS) {
            Log.i(TAG, "Silent install succeeded");

            // Clean up the downloaded APK — the OS has finished reading it.
            String apkPath = intent.getStringExtra(EXTRA_APK_PATH);
            if (apkPath != null) {
                File apkFile = new File(apkPath);
                if (apkFile.exists() && !apkFile.delete()) {
                    Log.w(TAG, "Failed to delete APK after install: " + apkPath);
                }
            }

            com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
            result.put("success", true);
            call.resolve(result);
        } else {
            String errorMsg = "Install failed (status=" + status + ")"
                    + (message != null ? ": " + message : "");
            Log.e(TAG, errorMsg);
            call.reject(errorMsg);
        }
    }
}
