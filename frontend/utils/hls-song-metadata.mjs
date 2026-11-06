// Decode a genuine song + artist pair from timed HLS ID3 metadata.
// This module only parses bytes already received by the media player;
// it never fetches audio, downloads playlists or accesses HLS credentials.
// Missing/incomplete tags return no track (never infer from station/show names).
const MAX_TAG_BYTES = 65_536;
const MAX_TEXT_BYTES = 4_096;
const MAX_SCHEDULED = 32;
const CHECK_AHEAD_SECONDS = 0.5;

const synchsafe = (bytes, index) => {
  if (index + 4 > bytes.length) return -1;
  for (let i = 0; i < 4; i++) if (bytes[index + i] & 0x80) return -1;
  return ((bytes[index] << 21) | (bytes[index + 1] << 14)
    | (bytes[index + 2] << 7) | bytes[index + 3]) >>> 0;
};

function frameText(payload) {
  if (!(payload instanceof Uint8Array) || payload.length < 2
    || payload.length > MAX_TEXT_BYTES) return '';
  const encoding = payload[0];
  let bytes = payload.subarray(1);
  let decoder = 'windows-1252';
  if (encoding === 3) decoder = 'utf-8';
  else if (encoding === 2) decoder = 'utf-16be';
  else if (encoding === 1) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      decoder = 'utf-16be';
      bytes = bytes.subarray(2);
    } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      decoder = 'utf-16le';
      bytes = bytes.subarray(2);
    } else return '';
  } else if (encoding !== 0) return '';
  try {
    // ID3 text may be multi-value; the first non-empty value identifies the
    // main title/performer. Reject control chars, never parse arbitrary PRIV.
    const raw = new TextDecoder(decoder, { fatal: true }).decode(bytes);
    const text = raw.split('\u0000').find(s => s.trim()) || '';
    if (/[\u0001-\u001f\u007f]/.test(text)) return '';
    return text.trim().slice(0, 180);
  } catch { return ''; }
}

// Apple embeds song cover links in ID3 WXXX artworkURL_390x/640x frames.
// Reject arbitrary URLs; only render public assets on Apple's image CDN.
function appleArtworkFrame(payload) {
  if (!(payload instanceof Uint8Array) || payload.length < 20 ||
    payload.length > MAX_TEXT_BYTES || (payload[0] !== 0 && payload[0] !== 3)) return null;
  const separator = payload.indexOf(0, 1);
  if (separator < 2 || separator > 48) return null;
  try {
    const decoder = new TextDecoder(payload[0] === 3 ? 'utf-8' : 'windows-1252', { fatal: true });
    const label = decoder.decode(payload.subarray(1, separator));
    const priority = label === 'artworkURL_640x' ? 2 : label === 'artworkURL_390x' ? 1 : 0;
    if (!priority) return null;
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(payload.subarray(separator + 1));
    if (raw.length > 2048 || !raw || /[\u0000-\u001f\u007f]/.test(raw)) return null;
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !/^is[0-9]+-ssl\.mzstatic\.com$/i.test(url.hostname) ||
      url.username || url.password || url.port || url.hash || url.search ||
      !url.pathname.startsWith('/image/thumb/') ||
      !/\/[0-9]{2,4}x[0-9]{2,4}(?:bb|cc)\.jpe?g$/i.test(url.pathname)) return null;
    return { artwork: url.href, priority };
  } catch { return null; }
}

// hls.js / @svta/cml-id3 delivers consecutive packed-AAC ID3 tags as one
// metadata sample. Decode each tag independently: Apple's first tag often
// contains only transportStreamTimestamp and the next contains the song.
function parseSingleHlsId3Tag(data, offset, end, version, appleMusic) {
  let index = offset + 10;
  let title = '';
  let artist = '';
  let album = '';
  let appleTrackId = false;
  let artwork = '';
  let artworkPriority = 0;
  while (index + 10 <= end) {
    const id = String.fromCharCode(...data.subarray(index, index + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4 ? synchsafe(data, index + 4)
      : ((data[index + 4] << 24) >>> 0) + (data[index + 5] << 16)
        + (data[index + 6] << 8) + data[index + 7];
    if (size <= 0 || index + 10 + size > end) break;
    // Do not decode compressed, encrypted or grouped frames as plain text.
    if (!data[index + 8] && !data[index + 9] && size <= MAX_TEXT_BYTES) {
      const frame = data.subarray(index + 10, index + 10 + size);
      if (id === 'TIT2') title = frameText(frame);
      if (id === 'TPE1') artist = frameText(frame);
      if (id === 'TALB') album = frameText(frame);
      if (appleMusic && id === 'WXXX') {
        const candidate = appleArtworkFrame(frame);
        if (candidate && candidate.priority > artworkPriority) {
          artwork = candidate.artwork;
          artworkPriority = candidate.priority;
        }
      }
      // Real Apple song segments carry an album and/or an adamid PRIV frame.
      // Its presenter/program ID3 also has TIT2+TPE1, but neither marker.
      // Inspect only the bounded PRIV owner identifier, never its private data.
      if (id === 'PRIV') {
        const owner = new TextEncoder().encode('com.apple.radio.adamid');
        appleTrackId ||= frame.length > owner.length &&
          owner.every((byte, i) => frame[i] === byte) && frame[owner.length] === 0;
      }
    }
    // Apple identification and album frames can follow TIT2/TPE1.
    // Scan the remaining bounded frames before deciding whether it is a song.
    index += 10 + size;
  }
  // Apple also emits DJ/show cards as TIT2/TPE1. Only publish a music
  // track when its ID3 contains an explicit song marker, not just two texts.
  if (appleMusic && !album && !appleTrackId) return null;
  return title && artist && title.toLocaleLowerCase() !== artist.toLocaleLowerCase()
    ? { title, artist, ...(appleMusic && artwork ? { artwork } : {}) } : null;
}


export function parseHlsId3Tag(data, { appleMusic = false } = {}) {
  if (!(data instanceof Uint8Array) || data.length < 20
    || data.length > MAX_TAG_BYTES) return null;
  let offset = 0;
  let latest = null;
  // Stay inside the contiguous ID3 block. Never scan arbitrary audio bytes,
  // combine title/artist from different tags, or treat DJ cards as songs.
  for (let count = 0; count < MAX_SCHEDULED && offset + 10 <= data.length; count++) {
    if (data[offset] !== 0x49 || data[offset + 1] !== 0x44
      || data[offset + 2] !== 0x33) break;
    const version = data[offset + 3];
    if (version !== 3 && version !== 4) return null;
    const flags = data[offset + 5];
    if (flags & 0x40) return null; // Do not interpret extended ID3 headers.
    const tagSize = synchsafe(data, offset + 6);
    if (tagSize < 10 || offset + 10 + tagSize > data.length) return null;
    const end = offset + 10 + tagSize;
    const song = parseSingleHlsId3Tag(data, offset, end, version, appleMusic);
    if (song) latest = song;
    offset = end;
    if (version === 4 && (flags & 0x10)) {
      // ID3v2.4 footer is 10 bytes with the reversed "3DI" signature.
      if (offset + 10 > data.length || data[offset] !== 0x33
        || data[offset + 1] !== 0x44 || data[offset + 2] !== 0x49) return null;
      offset += 10;
    }
  }
  return latest;
}

export function extractHlsId3Tracks(samples, options = {}) {
  if (!Array.isArray(samples)) return [];
  const tracks = [];
  for (const sample of samples.slice(0, MAX_SCHEDULED)) {
    // Only accept an actual ID3 byte array, never string or untrusted JSON.
    const parsed = parseHlsId3Tag(sample?.data, options);
    if (!parsed) continue;
    tracks.push({ ...parsed,
      pts: typeof sample.pts === 'number' && Number.isFinite(sample.pts)
        ? sample.pts : null });
  }
  return tracks;
}

export function createTimedHlsTrackBuffer(options = {}) {
  let pending = [];
  let lastTrack = null;
  return {
    add(samples) {
      const tracks = extractHlsId3Tracks(samples, options);
      pending.push(...tracks);
      if (pending.length > MAX_SCHEDULED) pending = pending.slice(-MAX_SCHEDULED);
      return tracks.length;
    },
    consume(mediaTime) {
      if (!Number.isFinite(mediaTime)) return null;
      let ready = null;
      const waiting = [];
      for (const entry of pending) {
        if (entry.pts === null || entry.pts <= mediaTime + CHECK_AHEAD_SECONDS) {
          if (!ready || (entry.pts ?? -1) >= (ready.pts ?? -1)) ready = entry;
        } else waiting.push(entry);
      }
      pending = waiting;
      if (!ready) return null;
      // A following fragment can add artwork to an initially text-only song.
      if (lastTrack?.title === ready.title && lastTrack?.artist === ready.artist &&
        (!ready.artwork || lastTrack.artwork === ready.artwork)) return null;
      lastTrack = ready;
      return { title: ready.title, artist: ready.artist, ...(ready.artwork ? { artwork: ready.artwork } : {}) };
    },
    clear() {
      pending = [];
      lastTrack = null;
    },
  };
}


// WebKit/native HLS exposes timed ID3 frames as metadata TextTrack cues.
// Only pair explicit TIT2 + TPE1 frames from concurrently active cues.
export function extractNativeHlsId3Track(cues, { appleMusic = false } = {}) {
  if (!cues || typeof cues.length !== 'number') return null;
  let title = '';
  let artist = '';
  let album = '';
  let appleTrackId = false;
  let artwork = '';
  let artworkPriority = 0;
  for (let i = 0; i < Math.min(cues.length, MAX_SCHEDULED); i++) {
    const cue = cues[i];
    const value = cue?.value;
    if (!value || typeof value !== 'object'
      || !['TIT2', 'TPE1', 'TALB', 'PRIV', 'WXXX'].includes(value.key)) continue;
    if (value.key === 'WXXX' && appleMusic) {
      const bytes = value.data instanceof Uint8Array ? value.data
        : value.data instanceof ArrayBuffer ? new Uint8Array(value.data) : null;
      const candidate = appleArtworkFrame(bytes);
      if (candidate && candidate.priority > artworkPriority) {
        artwork = candidate.artwork;
        artworkPriority = candidate.priority;
      }
      continue;
    }
    if (value.key === 'PRIV') {
      // WebKit can expose the ID3 PRIV owner separately as "owner".
      if (value.owner === 'com.apple.radio.adamid') appleTrackId = true;
      continue;
    }
    let text = '';
    if (typeof value.data === 'string') {
      const trimmed = value.data.trim();
      if (trimmed && trimmed.length <= 180
        && !/[\u0000-\u001f\u007f]/.test(trimmed)) text = trimmed;
    } else {
      const bytes = value.data instanceof Uint8Array ? value.data
        : value.data instanceof ArrayBuffer ? new Uint8Array(value.data) : null;
      if (bytes) text = frameText(bytes);
    }
    if (value.key === 'TIT2') title = text;
    else if (value.key === 'TPE1') artist = text;
    else album = text;
  }
  if (appleMusic && !album && !appleTrackId) return null;
  return title && artist && title.toLocaleLowerCase() !== artist.toLocaleLowerCase()
    ? { title, artist, ...(appleMusic && artwork ? { artwork } : {}) } : null;
}
