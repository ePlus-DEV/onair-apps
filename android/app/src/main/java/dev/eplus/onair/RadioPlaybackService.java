package dev.eplus.onair;

import android.os.Handler;
import android.os.Looper;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/** Owns playback independently of the activity and WebView lifecycle. */
public final class RadioPlaybackService extends MediaSessionService {
    private static RadioPlaybackService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ExoPlayer player;
    private final Runnable sleepAction = () -> { if (player != null) player.pause(); };
    private MediaSession session;

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        player = new ExoPlayer.Builder(this).setWakeMode(C.WAKE_MODE_NETWORK).build();
        player.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        MediaSession.Builder builder = new MediaSession.Builder(this, player);
        if (intent != null) {
            PendingIntent pending = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.setSessionActivity(pending);
        }
        session = builder.build();
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo info) { return session; }

    static boolean setSleepMinutes(int minutes) {
        if (instance == null) return false;
        instance.handler.removeCallbacks(instance.sleepAction);
        if (minutes > 0) instance.handler.postDelayed(instance.sleepAction, minutes * 60_000L);
        return true;
    }

    @Override public void onDestroy() {
        handler.removeCallbacks(sleepAction);
        if (session != null) session.release();
        if (player != null) player.release();
        instance = null;
        super.onDestroy();
    }
}
