export function playbackHealth({ online, error, unsupported, waiting, hasPlayed = false }) {
  if (!online) return 'offline';
  if (error) return unsupported ? 'unsupported' : 'exhausted';
  // Initial connection and post-playback stalls are different experiences.
  // A stalled stream is not evidence that the station is permanently offline.
  return waiting ? (hasPlayed ? 'buffering' : 'connecting') : '';
}

export function playbackFailureReason({ mediaCode, hlsType, exceptionName, timeout = false } = {}) {
  if (timeout) return 'timeout';
  if (hlsType === 'networkError' || mediaCode === 2 || exceptionName === 'NetworkError') return 'network';
  if (hlsType === 'mediaError' || mediaCode === 3 || mediaCode === 4 || exceptionName === 'NotSupportedError') return 'decode';
  // Browser error types cannot reliably tell CORS from an offline broadcaster.
  return 'unknown';
}
