package us.dnguyen.carehub.kiosk;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SilentUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
