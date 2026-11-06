import { createCachedLoader } from '~/utils/cached-loader.mjs';

export interface StationSearchItem {
  objectID: string;
  station_name: string;
  station_country: string;
  station_category?: string;
  station_language?: string;
  country_label?: string;
  station_image: string;
  url: string;
  featured?: boolean;
}

// Cache each public project path separately; this executes only on the client.
const loaders = new Map<string, ReturnType<typeof createCachedLoader>>();
function loaderFor(url: string) {
  let loader = loaders.get(url);
  if (!loader) {
    loader = createCachedLoader(async () => {
      const items = await $fetch<StationSearchItem[]>(url, { timeout: 10_000 });
      if (!Array.isArray(items)) throw new Error('Invalid station search index');
      return markRaw(items);
    });
    loaders.set(url, loader);
  }
  return loader;
}

export function useStationSearchIndex() {
  const searchUrl = useSiteAssetUrl()('/search/stations.json');
  const index = shallowRef<StationSearchItem[]>([]);
  const loading = ref(false);
  const error = ref(false);
  let disposed = false;
  let requested: Promise<void> | undefined;

  // Never fetch a multi-station catalog simply because the global header mounts.
  // Load on search focus/open; the cached loader deduplicates across mobile
  // modal and desktop header, and failed requests remain retryable.
  const load = (): Promise<void> => {
    if (index.value.length) return Promise.resolve();
    if (requested) return requested;
    loading.value = true;
    error.value = false;
    requested = loaderFor(searchUrl)()
      .then(items => { if (!disposed) index.value = items; })
      .catch(() => { if (!disposed) error.value = true; })
      .finally(() => {
        requested = undefined;
        if (!disposed) loading.value = false;
      });
    return requested;
  };
  onBeforeUnmount(() => { disposed = true; });
  return { index, loading, error, load };
}
