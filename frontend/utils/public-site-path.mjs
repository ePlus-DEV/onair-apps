/** Prefix root-relative STATIC asset URLs for GitHub project Pages. */
export function prefixPublicAsset(path, baseURL = '/') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  const segments = String(baseURL).split('/').filter(Boolean);
  if (!segments.length) return path;
  const prefix = '/' + segments.join('/') + '/';
  if (path.startsWith(prefix) || path === prefix.slice(0, -1)) return path;
  return prefix + path.slice(1);
}

// The station artwork lives on OnAir's public asset host. Catalog JSON and
// application assets stay bundled locally so navigation works independently.
export function resolveAppAsset(path, baseURL = '/', nativeApp = false) {
  if (nativeApp && typeof path === 'string' && path.startsWith('/img/')) {
    return `https://radio.eplus.dev${path}`;
  }
  return prefixPublicAsset(path, baseURL);
}
