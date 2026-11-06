package dev.eplus.onair;

import android.content.ComponentName;
import android.net.Uri;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.concurrent.ExecutionException;

@CapacitorPlugin(name = "RadioAudio")
public final class RadioAudioPlugin extends Plugin {
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private final Player.Listener listener = new Player.Listener() {
        @Override public void onEvents(Player player, Player.Events events) { emitState(player, null); }
        @Override public void onPlayerError(PlaybackException error) {
            if (controller != null) emitState(controller, error.getErrorCodeName());
        }
    };

    @Override public void load() {
        SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), RadioPlaybackService.class));
        controllerFuture = new MediaController.Builder(getContext(), token).buildAsync();
        controllerFuture.addListener(() -> {
            try { controller = controllerFuture.get(); controller.addListener(listener); }
            catch (ExecutionException | InterruptedException error) { if (error instanceof InterruptedException) Thread.currentThread().interrupt(); }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    private void withController(PluginCall call, java.util.function.Consumer<MediaController> action) {
        controllerFuture.addListener(() -> {
            try { action.accept(controllerFuture.get()); call.resolve(); }
            catch (Exception error) { call.reject("Native radio playback is unavailable", error); }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    private void emitState(Player player, String error) {
        MediaItem item = player.getCurrentMediaItem();
        JSObject result = new JSObject();
        result.put("id", item == null ? "" : item.mediaId);
        result.put("playing", player.isPlaying());
        result.put("playWhenReady", player.getPlayWhenReady());
        result.put("state", player.getPlaybackState());
        result.put("suppression", player.getPlaybackSuppressionReason());
        if (error != null) result.put("error", error);
        notifyListeners("state", result);
    }

    @PluginMethod public void playSource(PluginCall call) {
        String url = call.getString("url", "");
        String id = call.getString("id", "");
        Uri uri = Uri.parse(url);
        if (id.isEmpty() || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
            call.reject("Invalid radio source"); return;
        }
        String title = call.getString("title", "ePlus OnAir");
        String artist = call.getString("artist", "");
        withController(call, player -> {
            MediaMetadata metadata = new MediaMetadata.Builder().setTitle(title).setArtist(artist).build();
            player.setMediaItem(new MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(metadata).build());
            player.prepare();
            player.play();
        });
    }

    @PluginMethod public void pause(PluginCall call) { withController(call, Player::pause); }
    @PluginMethod public void play(PluginCall call) { withController(call, Player::play); }
    @PluginMethod public void stop(PluginCall call) { withController(call, player -> { player.stop(); player.clearMediaItems(); }); }
    @PluginMethod public void setVolume(PluginCall call) {
        float value = Math.max(0f, Math.min(1f, call.getFloat("volume", 1f)));
        withController(call, player -> player.setVolume(value));
    }
    @PluginMethod public void setSleep(PluginCall call) {
        int minutes = Math.max(0, Math.min(120, call.getInt("minutes", 0)));
        withController(call, player -> RadioPlaybackService.setSleepMinutes(minutes));
    }
    @Override protected void handleOnDestroy() {
        if (controller != null) controller.removeListener(listener);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        super.handleOnDestroy();
    }
}
