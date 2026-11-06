import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPinia, setActivePinia } from 'pinia';
import { usePlaybackStore } from '../stores/playback.ts';
import { parseHlsId3Tag, extractHlsId3Tracks, createTimedHlsTrackBuffer, extractNativeHlsId3Track } from '../utils/hls-song-metadata.mjs';

const ascii = text => [...text].map(c => c.charCodeAt(0));
const safeSize = n => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const bigSize = n => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const frame = (id, value, version = 3, encoding = 3) => {
  const bytes = [...new TextEncoder().encode(value)];
  const payload = [encoding, ...bytes];
  return [...ascii(id), ...(version === 4 ? safeSize(payload.length) : bigSize(payload.length)),
    0, 0, ...payload];
};
const makeTag = (frames, version = 3) => {
  const bytes = frames.flat();
  return new Uint8Array([...ascii('ID3'), version, 0, 0, ...safeSize(bytes.length), ...bytes]);
};
const title = (value, v = 3) => frame('TIT2', value, v);
const artist = (value, v = 3) => frame('TPE1', value, v);

test('extracts real ID3v2.3 and ID3v2.4 title and artist, including UTF-8', () => {
  const v3 = makeTag([title('Một bài hát'), artist('Ca sĩ A')]);
  const v4 = makeTag([title('Chanson été', 4), artist('Artiste B', 4)], 4);
  assert.deepEqual(parseHlsId3Tag(v3), { title: 'Một bài hát', artist: 'Ca sĩ A' });
  assert.deepEqual(parseHlsId3Tag(v4), { title: 'Chanson été', artist: 'Artiste B' });
});

test('missing or malformed metadata cannot impersonate a current song', () => {
  const invalid = [
    new Uint8Array(),
    new TextEncoder().encode('Apple Music 1'),
    makeTag([title('Only title')]),
    makeTag([artist('Only performer')]),
    makeTag([frame('TXXX', 'Artist - Song')]),
    makeTag([title('Same'), artist('Same')]),
    makeTag([title('Some title'), frame('PRIV', 'opaque stream marker')]),
  ];
  for (const tag of invalid) assert.equal(parseHlsId3Tag(tag), null);
  const badHeader = makeTag([title('Song'), artist('Singer')]);
  badHeader[6] = 0xff;
  assert.equal(parseHlsId3Tag(badHeader), null);
  const badFrame = makeTag([title('Song'), artist('Singer')]);
  badFrame[14] = 0x7f;
  assert.equal(parseHlsId3Tag(badFrame), null);
  assert.equal(parseHlsId3Tag(new Uint8Array(70_000)), null);
});

test('accepts only ID3 bytes and preserves timestamp for accurate live playback', () => {
  const data = makeTag([title('Song 1'), artist('Artist 1')]);
  assert.deepEqual(extractHlsId3Tracks([
    null,
    { data: 'Artist 2 - Song 2', pts: 2 },
    { data, pts: 42.25 },
    { data: makeTag([title('Missing artist')]), pts: 43 },
  ]), [{ title: 'Song 1', artist: 'Artist 1', pts: 42.25 }]);
  assert.deepEqual(extractHlsId3Tracks(null), []);
});

test('waits until media time reaches ID3 PTS and suppresses duplicate tracks', () => {
  const buffer = createTimedHlsTrackBuffer();
  const a = makeTag([title('First'), artist('Artist A')]);
  const b = makeTag([title('Second'), artist('Artist B')]);
  buffer.add([{ data: a, pts: 50 }, { data: b, pts: 70 }]);
  assert.equal(buffer.consume(20), null);
  assert.deepEqual(buffer.consume(49.6), { title: 'First', artist: 'Artist A' });
  assert.equal(buffer.consume(52), null);
  assert.deepEqual(buffer.consume(70), { title: 'Second', artist: 'Artist B' });
  buffer.add([{ data: b, pts: 71 }]);
  assert.equal(buffer.consume(72), null);
  buffer.clear();
  buffer.add([{ data: a, pts: 100 }]);
  assert.equal(buffer.consume(10), null);
  buffer.clear();
  assert.equal(buffer.consume(101), null);
});

test('Safari native timed ID3 cue extraction requires a concurrent title/artist pair', () => {
  const cue = (key, value) => ({ value: { key, data: new Uint8Array([3, ...new TextEncoder().encode(value)]) } });
  assert.deepEqual(extractNativeHlsId3Track([
    cue('TIT2', 'Song on Air'), cue('TPE1', 'Actual Artist'),
  ]), { title: 'Song on Air', artist: 'Actual Artist' });
  assert.equal(extractNativeHlsId3Track([cue('TIT2', 'Song Only')]), null);
  assert.equal(extractNativeHlsId3Track([cue('PRIV', 'Not a song'), cue('TPE1', 'Singer')]), null);
  assert.equal(extractNativeHlsId3Track([{ value: { key: 'TIT2', data: 'Title' } }]), null);
  assert.equal(extractNativeHlsId3Track(null), null);
});


test('real HLS song takes priority over stale TuneIn Describe without leaking across stations', () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  const stationUrl = '/global-radio/apple-music/apple-music-1';
  playback.activateGlobalRadio({
    id: 'apple-music-1', url: stationUrl, title: 'Apple Music 1',
    image: '', sources: [],
  }, 'https://music.apple.com/', Date.now() + 120_000, [], { autoplay: false });
  playback.setLiveTrack(stationUrl, { title: 'Provider Song', artist: 'Provider Artist' });
  assert.equal(playback.liveTrack.source, 'provider');
  assert.equal(playback.setHlsLiveTrack(stationUrl, { title: 'HLS Song', artist: 'HLS Artist' }), true);
  assert.deepEqual({
    title: playback.liveTrack.title, artist: playback.liveTrack.artist,
    source: playback.liveTrack.source,
  }, { title: 'HLS Song', artist: 'HLS Artist', source: 'hls' });
  playback.setLiveTrack(stationUrl, null);
  playback.setLiveTrack(stationUrl, { title: 'Outdated Song', artist: 'Old Artist' });
  assert.equal(playback.liveTrack.title, 'HLS Song');
  assert.equal(playback.setHlsLiveTrack('/global-radio/apple-music/wrong', { title: 'X', artist: 'Y' }), false);
  assert.equal(playback.setHlsLiveTrack(stationUrl, { title: 'Incomplete', artist: '' }), false);
  playback.clearHlsLiveTrack(stationUrl);
  assert.equal(playback.liveTrack, null);
  playback.setLiveTrack(stationUrl, { title: 'Provider Returns', artist: 'Artist' });
  assert.equal(playback.liveTrack.source, 'provider');
  playback.activateGlobalRadio({
    id: 'apple-music-hits', url: '/global-radio/apple-music/apple-music-hits',
    title: 'Apple Music Hits', image: '', sources: [],
  }, 'https://music.apple.com/', Date.now() + 120_000, [], { autoplay: false });
  assert.equal(playback.liveTrack, null);
});

test('wire actual hls.js metadata to existing player and queue, not another stream', async () => {
  const player = await readFile(new URL('../components/player/Player.vue', import.meta.url), 'utf8');
  const realtime = await readFile(new URL('../composables/useStationRealtime.ts', import.meta.url), 'utf8');
  const store = await readFile(new URL('../stores/playback.ts', import.meta.url), 'utf8');
  assert.match(player, /Hls\.Events\.FRAG_PARSING_METADATA/);
  assert.match(player, /attachNativeHlsSongMetadata\(media, version\)/);
  assert.match(player, /extractNativeHlsId3Track\(track\.activeCues, \{ appleMusic: true \}\)/);
  assert.match(player, /detachNativeHlsMetadata\?\.\(\)/);
  assert.match(player, /hlsSongBuffer\.add\(data\?\.samples\)/);
  assert.match(player, /media\.addEventListener\("timeupdate", flushHlsSongMetadata\)/);
  assert.match(player, /media\.removeEventListener\("timeupdate", flushHlsSongMetadata\)/);
  assert.match(player, /playback\.setHlsLiveTrack\(stationUrl, track\)/);
  assert.match(player, /version !== sourceVersion \|\| userPaused\.value/);
  assert.match(store, /this\.liveTrack\.source === 'hls'/);
  assert.match(realtime, /track\.source !== 'hls'/);
  assert.match(realtime, /addTuneInSessionTrack\(playlist\.value, track\)/);
  assert.doesNotMatch(player, /fetch\([^)]*accessKey/);
});

const applePriv = (owner, version = 4) => {
  // Reconstruct only the ID3 frame type and owner identifier seen in the
  // user's HAR. Never commit stream bytes, encoded provider data or accessKey.
  const payload = [...new TextEncoder().encode(owner), 0, 1];
  return [...ascii('PRIV'), ...(version === 4 ? safeSize(payload.length) : bigSize(payload.length)),
    0, 0, ...payload];
};

test('HAR regression: Apple CMAF ID3 music vs presenter in sequence 53/54', () => {
  const apple = { appleMusic: true };
  const song = makeTag([
    applePriv('com.apple.radio.ping.jingle'),
    applePriv('com.apple.radio.adamid'),
    frame('TALB', 'Wrapped In Red (Deluxe Version)', 4),
    artist('Kelly Clarkson', 4), title('Underneath the Tree', 4),
  ], 4);
  const presenter = makeTag([
    applePriv('com.apple.radio.ping.jingle'),
    artist('Holiday Hits', 4), title('Eddie Francis', 4),
  ], 4);
  const nextSong = makeTag([
    applePriv('com.apple.radio.ping.jingle'),
    applePriv('com.apple.radio.adamid'),
    frame('TALB', 'Make It to Christmas - Single', 4),
    artist('Alessia Cara', 4), title('Make It to Christmas', 4),
  ], 4);
  assert.deepEqual(parseHlsId3Tag(song, apple),
    { title: 'Underneath the Tree', artist: 'Kelly Clarkson' });
  assert.equal(parseHlsId3Tag(presenter, apple), null);
  // Apple may place its song marker after the two text frames.
  const trailingMarker = makeTag([
    title('Underneath the Tree', 4), artist('Kelly Clarkson', 4),
    applePriv('com.apple.radio.adamid'),
  ], 4);
  assert.deepEqual(parseHlsId3Tag(trailingMarker, apple),
    { title: 'Underneath the Tree', artist: 'Kelly Clarkson' });
  assert.deepEqual(parseHlsId3Tag(nextSong, apple),
    { title: 'Make It to Christmas', artist: 'Alessia Cara' });
  // Ordinary ID3 handling remains backward compatible for non-Apple radio.
  assert.deepEqual(parseHlsId3Tag(presenter),
    { title: 'Eddie Francis', artist: 'Holiday Hits' });
  const buffer = createTimedHlsTrackBuffer(apple);
  assert.equal(buffer.add([{ data: song, pts: 832 }, { data: presenter, pts: 837 },
    { data: nextSong, pts: 854 }, { data: nextSong, pts: 864 }]), 3);
  assert.equal(buffer.consume(831), null);
  assert.deepEqual(buffer.consume(832),
    { title: 'Underneath the Tree', artist: 'Kelly Clarkson' });
  assert.equal(buffer.consume(837), null);
  assert.deepEqual(buffer.consume(854),
    { title: 'Make It to Christmas', artist: 'Alessia Cara' });
  assert.equal(buffer.consume(865), null);
});

test('Apple native Safari cues require a song marker, not only a DJ/show pair', () => {
  const cue = (key, value) => ({ value: { key,
    data: new Uint8Array([3, ...new TextEncoder().encode(value)]) } });
  const presenter = [cue('TIT2', 'Eddie Francis'), cue('TPE1', 'Holiday Hits')];
  assert.equal(extractNativeHlsId3Track(presenter, { appleMusic: true }), null);
  const song = [
    cue('TIT2', 'Make It to Christmas'), cue('TPE1', 'Alessia Cara'),
    cue('TALB', 'Make It to Christmas - Single'),
  ];
  assert.deepEqual(extractNativeHlsId3Track(song, { appleMusic: true }),
    { title: 'Make It to Christmas', artist: 'Alessia Cara' });
});

const appleArtwork = (size, imageUrl, v = 4) => {
  const description = size === 640 ? 'artworkURL_640x' : 'artworkURL_390x';
  const bytes = [0, ...ascii(description), 0, ...new TextEncoder().encode(imageUrl)];
  return [...ascii('WXXX'), ...(v === 4 ? safeSize(bytes.length) : bigSize(bytes.length)), 0, 0, ...bytes];
};
const verifiedArtwork390 = 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/sanitized-fixture/390x390bb.jpg';
const verifiedArtwork640 = 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/sanitized-fixture/1400x1400bb.jpg';

test('Apple Music 1 CMAF emsg carries a verified ID3 song and artwork, not merely show text', () => {
  // Metadata-only synthetic fixture based on the 2026-11-06 Apple Music 1 HAR.
  // Neither signed stream URLs nor audio/complete HAR payloads are committed.
  const song = makeTag([
    applePriv('com.apple.radio.adamid'),
    frame('TALB', 'The Black Album', 4),
    title('99 Problems', 4), artist('JAŸ-Z', 4),
    appleArtwork(640, verifiedArtwork640),
  ], 4);
  const parsed = parseHlsId3Tag(song, { appleMusic: true });
  assert.deepEqual(parsed, { title: '99 Problems', artist: 'JAŸ-Z', artwork: verifiedArtwork640 });
  const buffer = createTimedHlsTrackBuffer({ appleMusic: true });
  assert.equal(buffer.add([{ data: song, pts: 90 }]), 1);
  assert.equal(buffer.consume(89), null);
  assert.deepEqual(buffer.consume(90), parsed);
  assert.equal(buffer.consume(92), null);
});

test('HAR regression: Apple Music 1 AAC contains adjacent transport and song ID3 tags', () => {
  // The 2026-11-06 preview HAR has two adjacent ID3v2.4 headers per .aac
  // segment. hls.js emits both as ONE metadata sample; previously our parser
  // stopped after the first transportStreamTimestamp-only tag.
  const timestamp = makeTag([applePriv('com.apple.streaming.transportStreamTimestamp')], 4);
  const song = makeTag([
    applePriv('com.apple.radio.ping.jingle'),
    appleArtwork(640, verifiedArtwork640),
    applePriv('com.apple.radio.adamid'),
    frame('TALB', 'Westside Whimsy', 4),
    artist('Jhené Aiko', 4),
    title('So Good (feat. Kendrick Lamar)', 4),
  ], 4);
  const packed = new Uint8Array([...timestamp, ...song]);
  const expected = {
    title: 'So Good (feat. Kendrick Lamar)',
    artist: 'Jhené Aiko',
    artwork: verifiedArtwork640,
  };
  assert.equal(parseHlsId3Tag(timestamp, { appleMusic: true }), null);
  assert.deepEqual(parseHlsId3Tag(song, { appleMusic: true }), expected);
  assert.deepEqual(parseHlsId3Tag(packed, { appleMusic: true }), expected);
  assert.deepEqual(extractHlsId3Tracks([{ data: packed, pts: 312.75 }], { appleMusic: true }),
    [{ ...expected, pts: 312.75 }]);
  const buffer = createTimedHlsTrackBuffer({ appleMusic: true });
  assert.equal(buffer.add([{ data: packed, pts: 312.75 }]), 1);
  assert.equal(buffer.consume(310), null);
  assert.deepEqual(buffer.consume(312.75), expected);
  assert.equal(buffer.consume(314), null);

  const presenter = makeTag([
    title('Radio host / show', 4),
    artist('Apple Music 1', 4),
  ], 4);
  assert.equal(parseHlsId3Tag(new Uint8Array([...timestamp, ...presenter]),
    { appleMusic: true }), null);
  // No cross-tag mixing: TIT2 in one tag and TPE1 in the next is not a song.
  assert.equal(parseHlsId3Tag(new Uint8Array([
    ...makeTag([title('Title only', 4)], 4),
    ...makeTag([artist('Artist only', 4), applePriv('com.apple.radio.adamid')], 4),
  ]), { appleMusic: true }), null);
  assert.equal(parseHlsId3Tag(new Uint8Array([...timestamp, ...song.subarray(0, 12)]),
    { appleMusic: true }), null);
});

test('Apple Holiday Hits HLS WXXX artwork follows the SONG, not DJ interstitial', () => {
  const song = makeTag([
    appleArtwork(390, verifiedArtwork390),
    applePriv('com.apple.radio.adamid'),
    frame('TALB', 'Wrapped in Red', 4),
    artist('Kelly Clarkson', 4),
    appleArtwork(640, verifiedArtwork640),
    title('Underneath the Tree', 4),
  ], 4);
  assert.deepEqual(parseHlsId3Tag(song, { appleMusic: true }), {
    title: 'Underneath the Tree', artist: 'Kelly Clarkson', artwork: verifiedArtwork640,
  });
  const dj = makeTag([
    appleArtwork(640, verifiedArtwork640),
    artist('Holiday Hits', 4), title('Eddie Francis', 4),
  ], 4);
  assert.equal(parseHlsId3Tag(dj, { appleMusic: true }), null);
});

test('WXXX only accepts Apple artwork CDN assets, not arbitrary links', () => {
  for (const candidate of [
    'https://evil.example.com/image/thumb/Music124/v4/xxx/390x390bb.jpg',
    'http://is1-ssl.mzstatic.com/image/thumb/Music124/v4/xxx/390x390bb.jpg',
    'https://is1-ssl.mzstatic.com.evil.example/image/thumb/Music124/v4/xxx/390x390bb.jpg',
    'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/xxx/390x390bb.jpg?token=secret',
    'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/xxx/390x390bb.jpg#tracking',
  ]) {
    const tag = makeTag([
      appleArtwork(640, candidate),
      applePriv('com.apple.radio.adamid'),
      title('Valid track', 4), artist('Real artist', 4),
    ], 4);
    assert.deepEqual(parseHlsId3Tag(tag, { appleMusic: true }),
      { title: 'Valid track', artist: 'Real artist' });
  }
});

test('Album artwork upgrades an existing ID3 song without creating another history row', async () => {
  const { addTuneInSessionTrack } = await import('../utils/global-radio-tunein-metadata.mjs');
  const plain = makeTag([applePriv('com.apple.radio.adamid'), title('Track', 4), artist('Singer', 4)], 4);
  const withArt = makeTag([
    applePriv('com.apple.radio.adamid'), title('Track', 4), artist('Singer', 4),
    appleArtwork(640, verifiedArtwork640),
  ], 4);
  const buffer = createTimedHlsTrackBuffer({ appleMusic: true });
  buffer.add([{ data: plain, pts: 20 }]);
  const first = buffer.consume(20);
  assert.deepEqual(first, { title: 'Track', artist: 'Singer' });
  let history = addTuneInSessionTrack([], first);
  assert.equal(history.length, 1);
  assert.equal(history[0].track_image, '');
  buffer.add([{ data: withArt, pts: 24 }]);
  const update = buffer.consume(24);
  assert.equal(update.artwork, verifiedArtwork640);
  history = addTuneInSessionTrack(history, update);
  assert.equal(history.length, 1);
  assert.equal(history[0].track_image, verifiedArtwork640);
  assert.equal(buffer.consume(26), null);
});

test('Safari timed WXXX native cue is accepted with album marker and matching song', () => {
  const cue = (key, data) => ({ value: { key, data } });
  const txt = value => new Uint8Array([3, ...new TextEncoder().encode(value)]);
  const wxxx = new Uint8Array([0, ...ascii('artworkURL_640x'), 0, ...new TextEncoder().encode(verifiedArtwork640)]);
  const found = extractNativeHlsId3Track([
    cue('TIT2', txt('Underneath the Tree')),
    cue('TPE1', txt('Kelly Clarkson')),
    cue('TALB', txt('Wrapped in Red')),
    cue('WXXX', wxxx),
  ], { appleMusic: true });
  assert.deepEqual(found, { title: 'Underneath the Tree', artist: 'Kelly Clarkson',
    artwork: verifiedArtwork640 });
});

test('Apple artwork is scoped to the current live track, never a stale history row', async () => {
  setActivePinia(createPinia());
  const playback = usePlaybackStore();
  const url = '/global-radio/apple-music/apple-music-1';
  playback.activateGlobalRadio({ id: 'apple-music-1', url, title: 'Apple Music 1', image: '',
    sources: [] }, 'https://music.apple.com/', Date.now() + 120_000, [], { autoplay: false });
  playback.setHlsLiveTrack(url, { title: 'Track', artist: 'Artist', artwork: verifiedArtwork640 });
  assert.equal(playback.liveTrack.artwork, verifiedArtwork640);
  playback.setLiveTrack(url, null);
  assert.equal(playback.liveTrack.artwork, verifiedArtwork640);
  playback.activateGlobalRadio({ id: 'apple-music-hits', url: '/global-radio/apple-music/apple-music-hits',
    title: 'Apple Music Hits', image: '', sources: [] },
  'https://music.apple.com/', Date.now() + 120_000, [], { autoplay: false });
  assert.equal(playback.liveTrack, null);
  const player = await readFile(new URL('../components/player/Player.vue', import.meta.url), 'utf8');
  assert.match(player, /live\?\.stationUrl === props\.stationUrl && live\.artwork/);
});
