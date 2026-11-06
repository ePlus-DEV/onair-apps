import type { GlobalRadioProvider, GlobalRadioProviderIndex } from '~/types/global-radio';

/**
 * The country catalog intentionally contains only streams supported by our
 * HTML5 audio engine. External-only provider data is fetched independently.
 * SSR reads the very same public JSON used by the static client.
 */
async function loadGlobalCatalog<T>(path: string, assetUrl: (path: string) => string): Promise<T> {
  if (import.meta.server) {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    return JSON.parse(await readFile(join(process.cwd(), 'public', path.startsWith('/') ? path.slice(1) : path), 'utf8')) as T;
  }
  return await $fetch<T>(assetUrl(path));
}

export const useGlobalProviders = () => {
  const assetUrl = useSiteAssetUrl();
  return useAsyncData<GlobalRadioProviderIndex>('global-radio-provider-index',
    () => loadGlobalCatalog('/catalog/providers/index.json', assetUrl));
};

export const useAppleMusicProvider = () => {
  const assetUrl = useSiteAssetUrl();
  return useAsyncData<GlobalRadioProvider>('global-radio-apple-music',
    () => loadGlobalCatalog('/catalog/providers/apple-music.json', assetUrl));
};
