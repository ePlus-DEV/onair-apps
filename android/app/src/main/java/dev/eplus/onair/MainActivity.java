package dev.eplus.onair;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RadioAudioPlugin.class);
        super.onCreate(savedInstanceState);
        if (getBridge() == null || getBridge().getWebView() == null || !(getBridge().getWebView().getParent() instanceof View)) return;
        View root = (View) getBridge().getWebView().getParent();
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            int system = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets bars = insets.getInsets(system);
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            // Keep keyboard insets available while avoiding double system-bar padding.
            return new WindowInsetsCompat.Builder(insets).setInsets(system, Insets.NONE).build();
        });
        ViewCompat.requestApplyInsets(root);
    }
}
