/** Absolute deadlines survive background timer throttling; check again on resume. */
export function createSleepTimer({ onExpire, onChange, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let deadline = 0;
  let timer;
  const cancel = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    deadline = 0;
    onChange(0);
  };
  const check = () => {
    if (!deadline) return;
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    const remaining = deadline - now();
    if (remaining <= 0) {
      cancel();
      onExpire();
      return;
    }
    onChange(Math.ceil(remaining / 60_000));
    timer = setTimer(check, Math.min(remaining, 60_000));
  };
  const start = minutes => {
    cancel();
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120) return;
    deadline = now() + minutes * 60_000;
    check();
  };
  return { start, cancel, check };
}
