/**
 * Lightweight daily activity trends for listener stats.
 * Independent per-series y scales; never overlay unlike metrics on one scale.
 * Values are daily buckets (not a cumulative time series).
 */
export function buildActivityTrend(series, width = 320, height = 96) {
  const entries = Array.isArray(series) ? series : [];
  const safe = entries.map(item => Number.isFinite(item?.ms) ? Math.max(0, item.ms) : 0);
  const maxMs = Math.max(0, ...safe);
  const left = 5, top = 8, right = width - 5, bottom = height - 8;
  const points = safe.map((ms, index) => ({
    key: entries[index]?.key || '',
    ms,
    x: entries.length < 2 ? (left + right) / 2 : left + index * (right - left) / (entries.length - 1),
    y: maxMs > 0 ? bottom - ms / maxMs * (bottom - top) : bottom,
  }));
  const linePath = points.map((p, index) =>
    `${index === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L${points.at(-1).x.toFixed(2)},${bottom} L${points[0].x.toFixed(2)},${bottom} Z`
    : '';
  return { points, linePath, areaPath, hasData: maxMs > 0, maxMs };
}
