// Build an ephemeral player entry. Signed stream URLs must never enter JSON catalogs.
export function createAuthorizedApplePlaybackStation(station, source, placeholder = '/brand/onair-mark.svg') {
  const url = '/global-radio/apple-music/' + station.id;
  return {
    id: station.id,
    title: station.title,
    url,
    image: placeholder,
    area: 'global-radio',
    country: 'apple-music',
    countryKey: 'global_radio.title',
    schedule: '',
    sources: [{
      src: source,
      type: 'application/vnd.apple.mpegurl',
      source: 'primary',
      label: 'Apple Music HLS',
    }],
  };
}


// Keep Global Radio's player queue identical in structure to Country Radio.
// These are catalog-only entries: no stream URL, accessKey, or stale HLS state.
export function createAppleRadioQueue(stations, placeholder = '/brand/onair-mark.svg') {
  const seen = new Set();
  return (Array.isArray(stations) ? stations : []).flatMap(station => {
    if (!station || typeof station.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(station.id)
      || seen.has(station.id)) return [];
    seen.add(station.id);
    return [{
      id: station.id,
      title: String(station.title || station.id),
      image: placeholder,
      url: '/global-radio/apple-music/' + station.id,
    }];
  });
}
