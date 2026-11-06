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
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "RadioAudio")
public final class RadioAudioPlugin extends Plugin {
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private final ExecutorService playlistExecutor = Executors.newSingleThreadExecutor();
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
        MediaMetadata metadata = player.getMediaMetadata();
        if (metadata.title != null) result.put("title", metadata.title.toString());
        if (metadata.artist != null) result.put("artist", metadata.artist.toString());
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
        String artwork = call.getString("artwork", "");
        withController(call, player -> {
            MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder().setTitle(title).setArtist(artist);
            Uri imageUri = Uri.parse(artwork);
            if ("https".equals(imageUri.getScheme())) metadataBuilder.setArtworkUri(imageUri);
            MediaMetadata metadata = metadataBuilder.build();
            player.setMediaItem(new MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(metadata).build());
            player.prepare();
            player.play();
        });
    }

    @PluginMethod public void pause(PluginCall call) { withController(call, Player::pause); }
    @PluginMethod public void play(PluginCall call) { withController(call, Player::play); }
    @PluginMethod public void stop(PluginCall call) { withController(call, player -> { player.stop(); player.clearMediaItems(); }); }
    @PluginMethod public void resolvePlaylist(PluginCall call) {
        String source = call.getString("url", "");
        playlistExecutor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL original = new URL(source);
                if (!"https".equals(original.getProtocol()) && !"http".equals(original.getProtocol())) throw new IllegalArgumentException();
                connection = (HttpURLConnection) original.openConnection();
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(4000);
                connection.setRequestProperty("Accept", "audio/x-scpls,audio/x-mpegurl,text/plain,*/*");
                try (BufferedReader input = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String candidate = RadioPlaylistParser.firstStream(input, connection.getURL());
                    if (candidate != null) {
                        JSObject result = new JSObject();
                        result.put("url", candidate);
                        call.resolve(result);
                        return;
                    }
                }
                call.reject("Playlist does not contain a supported stream");
            } catch (Exception ignored) { call.reject("Could not load station playlist"); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }
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
        playlistExecutor.shutdownNow();
        super.handleOnDestroy();
    }
}
