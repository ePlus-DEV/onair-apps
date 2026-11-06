package dev.eplus.onair;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RadioAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
