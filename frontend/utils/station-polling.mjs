// A polling lifetime follows the selected station, independent of the route.
// Abort saves work; the generation check also protects against providers that
// complete a request even after it has been aborted.
export function createStationPolling({ load, onData, onError, onLoading, interval = 60_000, shouldPoll = () => true, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let generation = 0;
  let timer;
  let controller;

  const stop = () => {
    generation += 1;
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    controller?.abort();
    controller = undefined;
  };

  const start = (url) => {
    stop();
    if (!url) {
      onLoading(false);
      return;
    }
    const version = generation;
    controller = new AbortController();
    const signal = controller.signal;
    onLoading(true);

    const poll = async () => {
      try {
        if (!shouldPoll()) return;
        const data = await load(url, signal);
        if (version !== generation || signal.aborted) return;
        onData(data);
      } catch (error) {
        if (version !== generation || signal.aborted) return;
        onError?.(error);
      } finally {
        if (version === generation && !signal.aborted) {
          onLoading(false);
          timer = setTimer(poll, interval);
        }
      }
    };
    void poll();
  };

  return { start, stop };
}
