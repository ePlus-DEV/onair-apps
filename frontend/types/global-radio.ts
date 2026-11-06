export interface GlobalRadioStation {
  id: string;
  title: string;
  description: string;
  genre: string;
  language: string;
  listen_url: string;
  tunein_url?: string;
  seasonal?: boolean;
}

export interface GlobalRadioProvider {
  schema_version: number;
  id: string;
  name: string;
  description: string;
  origin_country: string;
  coverage: 'global' | 'regional';
  playback: 'external';
  homepage: string;
  requires_account: boolean;
  requires_subscription: boolean;
  metadata_checked_on?: string;
  discovery_sources?: string[];
  stations: GlobalRadioStation[];
}

export interface GlobalRadioProviderSummary {
  id: string;
  name: string;
  description: string;
  coverage: 'global' | 'regional';
  origin_country: string;
  playback: 'external';
  catalog: string;
  href: string;
}

export interface GlobalRadioProviderIndex {
  schema_version: number;
  providers: GlobalRadioProviderSummary[];
}
