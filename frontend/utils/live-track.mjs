// Share one definition of a real "now playing" track between the player
// and the browser tab. Never mistake a station name for a song title.
const nonempty = value => typeof value === 'string' ? value.trim() : '';

export function resolveLiveTrack(song, playlist) {
  const media = song?.currentMedia;
  const mediaTitle = nonempty(media?.title);
  if (mediaTitle) return { title: mediaTitle, artist: nonempty(media?.artists) };

  const item = Array.isArray(playlist) ? playlist[0] : null;
  const playlistTitle = nonempty(item?.track_title);
  if (playlistTitle) return { title: playlistTitle, artist: nonempty(item?.track_artist) };

  return null;
}
