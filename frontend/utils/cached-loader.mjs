/** Share one successful load and one in-flight request. Failures remain retryable. */
export function createCachedLoader(load) {
  let cached;
  let pending;
  return () => {
    if (cached !== undefined) return Promise.resolve(cached);
    if (!pending) {
      pending = Promise.resolve().then(load).then(value => {
        cached = value;
        return value;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
}
