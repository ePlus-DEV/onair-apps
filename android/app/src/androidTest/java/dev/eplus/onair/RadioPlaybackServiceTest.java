package dev.eplus.onair;

import static org.junit.Assert.assertTrue;

import android.content.ComponentName;
import android.content.Context;
import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class RadioPlaybackServiceTest {
    private static byte[] wav() {
        int rate = 8000;
        int samples = rate * 12;
        ByteBuffer data = ByteBuffer.allocate(44 + samples * 2).order(ByteOrder.LITTLE_ENDIAN);
        data.put(new byte[] {'R','I','F','F'}).putInt(36 + samples * 2).put(new byte[] {'W','A','V','E'});
        data.put(new byte[] {'f','m','t',' '}).putInt(16).putShort((short) 1).putShort((short) 1);
        data.putInt(rate).putInt(rate * 2).putShort((short) 2).putShort((short) 16);
        data.put(new byte[] {'d','a','t','a'}).putInt(samples * 2);
        while (data.hasRemaining()) data.putShort((short) 0);
        return data.array();
    }

    @Test public void mediaSessionPlaysAndPauses() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        AtomicReference<ListenableFuture<MediaController>> future = new AtomicReference<>();
        Instrumentation instrument = InstrumentationRegistry.getInstrumentation();
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        instrument.waitForIdleSync();
        instrument.runOnMainSync(() -> {
            SessionToken token = new SessionToken(context, new ComponentName(context, RadioPlaybackService.class));
            future.set(new MediaController.Builder(context, token).buildAsync());
        });
        MediaController controller = future.get().get(30, TimeUnit.SECONDS);
        CountDownLatch playing = new CountDownLatch(1);
        CountDownLatch paused = new CountDownLatch(1);
        Player.Listener listener = new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) playing.countDown();
                else if (playing.getCount() == 0) paused.countDown();
            }
        };
        try {
            String uri = "data:audio/wav;base64," + Base64.encodeToString(wav(), Base64.NO_WRAP);
            instrument.runOnMainSync(() -> {
                controller.addListener(listener);
                controller.setMediaItem(MediaItem.fromUri(Uri.parse(uri)));
                controller.prepare();
                controller.play();
            });
            assertTrue("Media3 never started playing", playing.await(30, TimeUnit.SECONDS));
            instrument.runOnMainSync(controller::pause);
            assertTrue("Media3 never paused", paused.await(10, TimeUnit.SECONDS));
        } finally {
            instrument.runOnMainSync(() -> {
                controller.removeListener(listener);
                controller.stop();
                MediaController.releaseFuture(future.get());
            });
        }
    }
}
