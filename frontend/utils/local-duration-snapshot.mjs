/**
 * Avoid parsing/validating the same duration JSON at every active checkpoint.
 * The caller still reads localStorage before writing, so changes from another
 * tab are observed even if the storage event has not been processed yet.
 */
export function createRawStorageSnapshot() {
  let lastRaw;
  const parseRaw = (raw, parse, empty) => raw === null ? empty() : parse(raw);
  return {
    read(raw, previous, parse, empty) {
      if (lastRaw === raw) return previous;
      lastRaw = raw;
      return parseRaw(raw, parse, empty);
    },
    external(raw, parse, empty) {
      // Explicit storage events, including clear(), always update the store.
      lastRaw = raw;
      return parseRaw(raw, parse, empty);
    },
    saved(raw) { lastRaw = raw; },
  };
}
