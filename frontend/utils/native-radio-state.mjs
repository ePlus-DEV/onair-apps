// Media3 playback states: idle=1, buffering=2, ready=3, ended=4.
export function nativeRadioAction(event, sourceVersion, userPaused) {
  if (!event?.id || event.id !== String(sourceVersion) || userPaused) return 'ignore';
  if (event.error) return 'error';
  if (event.playing) return 'playing';
  if (event.suppression) return 'suppressed';
  if (event.state === 2 && event.playWhenReady) return 'waiting';
  if (event.state === 3 && !event.playWhenReady) return 'pause';
  if (event.state === 4) return 'ended';
  return 'ignore';
}
