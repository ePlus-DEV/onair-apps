package dev.eplus.onair;

import java.io.BufferedReader;
import java.io.IOException;
import java.net.URL;
import java.net.MalformedURLException;

/** Parses only HTTP(S) candidates from a bounded PLS or M3U response. */
final class RadioPlaylistParser {
    private RadioPlaylistParser() {}

    static String firstStream(BufferedReader input, URL base) throws IOException {
        String line;
        int remaining = 65536;
        while ((line = input.readLine()) != null && (remaining -= line.length()) >= 0) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#") || (line.startsWith("[") && line.endsWith("]"))) continue;
            if (line.matches("(?i)^file[0-9]+\\s*=.*")) line = line.substring(line.indexOf('=') + 1).trim();
            else if (line.matches("^[A-Za-z][A-Za-z0-9_]*\\s*=.*")) continue;
            try {
                URL candidate = new URL(base, line);
                if ("http".equals(candidate.getProtocol()) || "https".equals(candidate.getProtocol())) return candidate.toExternalForm();
            } catch (MalformedURLException ignored) { /* Try the next entry. */ }
        }
        return null;
    }
}
