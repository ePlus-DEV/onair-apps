package dev.eplus.onair;

import static org.junit.Assert.assertTrue;

import android.content.ComponentName;
import android.content.Context;
import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.WebView;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class RadioPlaybackServiceTest {
    @Test public void webViewRendersHome() throws Exception {
        AtomicReference<String> result = new AtomicReference<>("false");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            for (int attempt = 0; attempt < 20; attempt++) {
                CountDownLatch evaluated = new CountDownLatch(1);
                scenario.onActivity(activity -> {
                    WebView webView = activity.getBridge().getWebView();
                    webView.evaluateJavascript("Boolean(document.querySelector('main h1') && document.querySelector('nav a'))", value -> {
                        result.set(value);
                        evaluated.countDown();
                    });
                });
                assertTrue("WebView JavaScript did not respond", evaluated.await(5, TimeUnit.SECONDS));
                if ("true".equals(result.get())) {
                    scenario.onActivity(activity -> {
                        View root = (View) activity.getBridge().getWebView().getParent();
                        WindowInsetsCompat all = ViewCompat.getRootWindowInsets(root);
                        if (all != null) {
                            Insets bars = all.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                            assertTrue("Content overlaps the status bar", root.getPaddingTop() >= bars.top);
                            assertTrue("Content overlaps the navigation bar", root.getPaddingBottom() >= bars.bottom);
                        }
                    });
                    return;
                }
                Thread.sleep(1000);
            }
            assertTrue("Home screen did not render", "true".equals(result.get()));
        }
    }
    private static byte[] wav() {
        int rate = 8000;
        int samples = rate * 3;
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

    @Test public void playsHlsFromHttpStream() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        byte[] segment;
        try (java.io.InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("test-radio.ts")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int n;
            while ((n = input.read(buffer)) != -1) bytes.write(buffer, 0, n);
            segment = bytes.toByteArray();
        }
        byte[] manifest = ("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:3\n#EXT-X-MEDIA-SEQUENCE:0\n"
            + "#EXTINF:3.0,\ntest-radio.ts\n#EXTINF:3.0,\ntest-radio.ts\n#EXT-X-ENDLIST\n").getBytes(StandardCharsets.UTF_8);
        ServerSocket server = new ServerSocket(0);
        Thread http = new Thread(() -> {
            while (!server.isClosed()) {
                try (Socket client = server.accept()) {
                    client.setSoTimeout(5000);
                    BufferedReader request = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.US_ASCII));
                    String first = request.readLine();
                    String header;
                    while ((header = request.readLine()) != null && !header.isEmpty()) { /* Drain request. */ }
                    byte[] body = first != null && first.contains(".m3u8") ? manifest : segment;
                    String type = body == manifest ? "application/vnd.apple.mpegurl" : "video/mp2t";
                    OutputStream out = client.getOutputStream();
                    out.write(("HTTP/1.1 200 OK\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                    out.write(body);
                    out.flush();
                } catch (Exception ignored) { if (server.isClosed()) break; }
            }
        });
        http.setDaemon(true);
        http.start();
        AtomicReference<ListenableFuture<MediaController>> future = new AtomicReference<>();
        Instrumentation instrument = InstrumentationRegistry.getInstrumentation();
        context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        instrument.waitForIdleSync();
        instrument.runOnMainSync(() -> future.set(new MediaController.Builder(context,
            new SessionToken(context, new ComponentName(context, RadioPlaybackService.class))).buildAsync()));
        MediaController controller = future.get().get(30, TimeUnit.SECONDS);
        CountDownLatch playing = new CountDownLatch(1);
        Player.Listener listener = new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean isPlaying) { if (isPlaying) playing.countDown(); }
        };
        try {
            String url = "http://127.0.0.1:" + server.getLocalPort() + "/radio.m3u8";
            instrument.runOnMainSync(() -> {
                controller.addListener(listener);
                controller.setMediaItem(MediaItem.fromUri(url));
                controller.prepare();
                controller.play();
            });
            assertTrue("HLS did not start", playing.await(30, TimeUnit.SECONDS));
        } finally {
            instrument.runOnMainSync(() -> { controller.removeListener(listener); controller.stop(); MediaController.releaseFuture(future.get()); });
            server.close();
            http.join(5000);
        }
    }
}
