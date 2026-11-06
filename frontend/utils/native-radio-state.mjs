// Media3 playback states: idle=1, buffering=2, ready=3, ended=4.
export function nativeRadioAction(event, activeId, userPaused, playObserved = true) {
  if (!event?.id || event.id !== String(activeId) || userPaused) return 'ignore';
  if (event.error) return 'error';
  if (event.playing) return 'playing';
  if (event.suppression) return 'suppressed';
  if (event.state === 2 && event.playWhenReady) return 'waiting';
  if (event.state === 3 && !event.playWhenReady && playObserved) return 'pause';
  if (event.state === 4) return 'ended';
  return 'ignore';
}

export function nativeStationMatches(event, stationUrl) {
  if (!stationUrl || typeof event?.id !== 'string') return false;
  const separator = event.id.indexOf('|');
  return separator > 0 && event.id.slice(separator + 1) === stationUrl;
}
