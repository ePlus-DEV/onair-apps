export const LISTENING_STATION_PAGE_SIZE = 10;

const comparableName = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLocaleLowerCase();

export function paginateListeningStations(stations, options = {}) {
  const {
    query = '',
    sort = 'duration-desc',
    page = 1,
    pageSize = LISTENING_STATION_PAGE_SIZE,
    locale = 'en',
  } = options;
  const filtered = [...(Array.isArray(stations) ? stations : [])]
    .filter(station => comparableName(station.title).includes(comparableName(query).trim()));
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const byTitle = (a, b) => collator.compare(a.title, b.title) || collator.compare(a.url, b.url);
  const byDuration = (a, b) => (Number(b.ms) || 0) - (Number(a.ms) || 0) || byTitle(a, b);
  filtered.sort(sort === 'name-asc' ? byTitle : sort === 'duration-asc'
    ? (a, b) => (Number(a.ms) || 0) - (Number(b.ms) || 0) || byTitle(a, b)
    : byDuration);

  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : LISTENING_STATION_PAGE_SIZE;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const requested = Number.isInteger(page) ? page : 1;
  const currentPage = Math.min(totalPages, Math.max(1, requested));
  const start = (currentPage - 1) * safeSize;

  return {
    items: filtered.slice(start, start + safeSize),
    total,
    currentPage,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(total, start + safeSize),
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}
