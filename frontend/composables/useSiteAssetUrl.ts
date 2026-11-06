import { resolveAppAsset } from '~/utils/public-site-path.mjs';

export function useSiteAssetUrl() {
  const config = useRuntimeConfig();
  const baseURL = config.app.baseURL || '/';
  return (path: string | null | undefined): string =>
    resolveAppAsset(path || '', baseURL, config.public.nativeApp);
}
