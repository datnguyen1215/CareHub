package us.dnguyen.carehub.kiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Launches the kiosk app on device boot.
 * Requires RECEIVE_BOOT_COMPLETED permission and device owner setup.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launchIntent);
        }
    }
}
