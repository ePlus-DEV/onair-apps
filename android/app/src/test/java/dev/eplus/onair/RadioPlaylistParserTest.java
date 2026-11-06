package dev.eplus.onair;

import static org.junit.Assert.*;
import java.io.BufferedReader;
import java.io.StringReader;
import java.net.URL;
import org.junit.Test;

public class RadioPlaylistParserTest {
    private String parse(String body) throws Exception {
        return RadioPlaylistParser.firstStream(new BufferedReader(new StringReader(body)), new URL("https://example.com/radio/list.m3u"));
    }
    @Test public void plsSkipsSectionsAndMetadata() throws Exception {
        assertEquals("https://stream.example/live", parse("[playlist]\nNumberOfEntries=1\nFile1=https://stream.example/live\nTitle1=Station\n"));
    }
    @Test public void m3uAcceptsRelativeStreamsAndComments() throws Exception {
        assertEquals("https://example.com/radio/live.mp3", parse("#EXTM3U\n#EXTINF:-1,Radio\nlive.mp3\n"));
    }
    @Test public void rejectsOtherProtocols() throws Exception {
        assertNull(parse("file:///private/data\n"));
    }
    @Test public void preservesQueryParameters() throws Exception {
        assertEquals("https://stream.example/live?token=a=b", parse("#EXTM3U\nhttps://stream.example/live?token=a=b\n"));
    }
    @Test public void limitsUntrustedPlaylistSize() throws Exception {
        assertNull(parse("x".repeat(65536) + "\nhttps://stream.example/live\n"));
    }
    @Test public void hlsManifestsAreNotReducedToTheirFirstSegment() throws Exception {
        assertEquals("https://example.com/radio/list.m3u", parse("#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:5,\nsegment.ts\n"));
    }
}
