export interface RadioSource {
  src: string;
  type?: string;
  source?: string;
  label?: string;
  proxied?: boolean;
}

export interface RadioStationOption {
  id: string;
  title: string;
  image: string;
  url?: string;
}

export interface RadioCatalogEntry {
  title: string;
  description?: string;
  type?: string;
  cros?: boolean;
  stream: string;
  streams?: { url: string; type?: string; cros?: boolean; source?: string; label?: string }[];
  stream_alternative?: string;
  features?: string;
  schedule?: string | boolean;
  favorite?: boolean;
}

export interface PlaybackStation extends RadioStationOption {
  url: string;
  area: string;
  country: string;
  countryKey: string;
  schedule: string;
  sources: RadioSource[];
}

export interface RadioTrack {
  track_title: string;
  track_artist: string;
  track_image: string;
  track_played: number;
}

export interface RadioProgram {
  encodeId?: string;
  startTime?: number;
  endTime?: number;
  title?: string;
  description?: string;
}

export interface RadioMedia {
  title: string;
  artists: string;
  hasLyric?: boolean;
  encodeId: string;
  thumbnail?: string;
}

export interface RadioSong {
  encodeId: string;
  currentMedia?: RadioMedia;
  nextMedia?: RadioMedia;
  thumbnail?: string;
}

