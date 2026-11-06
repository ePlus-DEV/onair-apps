package dev.eplus.onair;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Saves a user-requested favorites export using Android's document picker. */
@CapacitorPlugin(name = "RadioFiles")
public final class RadioFilesPlugin extends Plugin {
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    @PluginMethod public void saveFavorites(PluginCall call) {
        String content = call.getString("content", "");
        if (content.isEmpty() || content.getBytes(StandardCharsets.UTF_8).length > 256 * 1024) {
            call.reject("Invalid favorites export");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "eplus-onair-favorites-v1.json");
        getActivity().runOnUiThread(() -> {
            try { startActivityForResult(call, intent, "favoritesDocumentSelected"); }
            catch (Exception ignored) { call.reject("Could not open the document picker"); }
        });
    }

    @ActivityCallback private void favoritesDocumentSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        writer.execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IllegalStateException("Unable to open document");
                output.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
                output.flush();
                response.put("saved", true);
                call.resolve(response);
            } catch (Exception ignored) { call.reject("Could not save favorites"); }
        });
    }

    @Override protected void handleOnDestroy() { writer.shutdownNow(); super.handleOnDestroy(); }
}
