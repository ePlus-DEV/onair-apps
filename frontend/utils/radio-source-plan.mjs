export const MAX_STREAM_ATTEMPTS = 6;

const normalizeProxyBase = (value) => {
  const base = String(value || "").trim();
  if (!base) return "";
  return base.endsWith("/") ? base : `${base}/`;
};

export const buildPlaybackSources = (sources, corsServer) => {
  const proxyBase = normalizeProxyBase(corsServer);
  const result = [];
  const seen = new Set();

  const push = (source) => {
    const src = String(source?.src || "").trim();
    if (!src || seen.has(src)) return;
    seen.add(src);
    result.push({ ...source, src });
  };

  for (const source of Array.isArray(sources) ? sources : []) {
    const src = String(source?.src || "").trim();
    if (!src) continue;

    push(source);

    const type = String(source?.type || "").toLowerCase();
    const isHls =
      /\.m3u8(?:$|[?#])/i.test(src) ||
      type.includes("mpegurl") ||
      type.includes("m3u8");

    const canProxy =
      proxyBase &&
      !isHls &&
      !source.proxied &&
      /^https?:\/\//i.test(src) &&
      !src.startsWith(proxyBase);

    if (canProxy) {
      push({
        ...source,
        src: `${proxyBase}${src}`,
        proxied: true,
      });
    }
  }

  return result;
};

export const nextPlaybackIndex = (currentIndex, count) => {
  if (!Number.isInteger(count) || count <= 0) return -1;
  return (Number(currentIndex) + 1 + count) % count;
};
