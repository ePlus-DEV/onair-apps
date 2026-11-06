// Personal-library entries intentionally persist metadata only, never stream URLs.
// Resolve the selected station from its current country catalog when the user clicks Play.
export function parseLibraryStationPath(url) {
  if (typeof url !== 'string') return null;
  const match = /^\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(url);
  if (!match) return null;
  const [, area, country, id] = match;
  return { area, country, id };
}

export function buildLibraryPlaybackQueue(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.flatMap(item => {
    const route = parseLibraryStationPath(item?.url);
    if (!route || seen.has(item.url)) return [];
    seen.add(item.url);
    return [{
      id: route.id,
      url: item.url,
      title: item.title,
      image: item.image,
    }];
  });
}
