import { prefixPublicAsset } from '~/utils/public-site-path.mjs';

export function useSiteAssetUrl() {
  const baseURL = useRuntimeConfig().app.baseURL || '/';
  return (path: string | null | undefined): string =>
    prefixPublicAsset(path || '', baseURL);
}
