package dev.eplus.onair;

import java.io.BufferedReader;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.concurrent.TimeUnit;

/** Parses only HTTP(S) candidates from a bounded PLS or M3U response. */
final class RadioPlaylistParser {
    private RadioPlaylistParser() {}

    static String firstStream(BufferedReader input, URL base) throws IOException {
        StringBuilder line = new StringBuilder();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        for (int remaining = 65536; remaining > 0 && System.nanoTime() < deadline; remaining--) {
            int next = input.read();
            if (next == -1 || next == '\n') {
                String stream = parseLine(line.toString(), base);
                if (stream != null) return stream;
                line.setLength(0);
                if (next == -1) return null;
            } else if (next != '\r') {
                line.append((char) next);
            }
        }
        return null;
    }

    private static String parseLine(String raw, URL base) {
        String line = raw.trim();
        // This is an HLS manifest, not a simple list of radio URLs. Give the
        // manifest to Media3 so it handles variants and successive segments.
        if (line.startsWith("#EXT-X-")) return base.toExternalForm();
        if (line.isEmpty() || line.startsWith("#") || (line.startsWith("[") && line.endsWith("]"))) return null;
        if (line.matches("(?i)^file[0-9]+\\s*=.*")) line = line.substring(line.indexOf('=') + 1).trim();
        else if (line.matches("^[A-Za-z][A-Za-z0-9_]*\\s*=.*")) return null;
        try {
            URL candidate = new URL(base, line);
            if ("http".equals(candidate.getProtocol()) || "https".equals(candidate.getProtocol())) return candidate.toExternalForm();
        } catch (MalformedURLException ignored) { /* Try the next entry. */ }
        return null;
    }
}
