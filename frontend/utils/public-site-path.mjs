/** Prefix root-relative STATIC asset URLs for GitHub project Pages. */
export function prefixPublicAsset(path, baseURL = '/') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  const segments = String(baseURL).split('/').filter(Boolean);
  if (!segments.length) return path;
  const prefix = '/' + segments.join('/') + '/';
  if (path.startsWith(prefix) || path === prefix.slice(0, -1)) return path;
  return prefix + path.slice(1);
}
