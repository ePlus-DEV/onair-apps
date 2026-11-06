export const normalizeScheduleUrl = (value) => {
  if (typeof value !== "string") return "";

  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) return "";

  return url;
};

export const isZingScheduleUrl = (value) => {
  const url = normalizeScheduleUrl(value);
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "zing.eplus.dev" &&
      parsed.pathname.startsWith("/api/live-stream-program-list")
    );
  } catch {
    return false;
  }
};


// A reference guide contains actual time windows, while legacy provider EPG
// reports the currently playing item first. When there is a gap, scroll to
// the next listed programme (or the last if today's listings have ended).
// Never *highlight* a nearest entry as live unless its interval contains now.
export const schedulePosition = (programs, nowSeconds, isReference = false) => {
  if (!Array.isArray(programs) || programs.length === 0) {
    return { currentIndex: -1, scrollIndex: -1 };
  }
  if (!isReference) return { currentIndex: 0, scrollIndex: 0 };

  const currentIndex = programs.findIndex(item =>
    Number.isFinite(item?.startTime) && Number.isFinite(item?.endTime)
    && item.startTime <= nowSeconds && nowSeconds < item.endTime
  );
  if (currentIndex !== -1) return { currentIndex, scrollIndex: currentIndex };

  const upcomingIndex = programs.findIndex(item =>
    Number.isFinite(item?.startTime) && item.startTime > nowSeconds
  );
  return {
    currentIndex: -1,
    scrollIndex: upcomingIndex !== -1 ? upcomingIndex : programs.length - 1,
  };
};

// A missing block of *reference metadata* is not evidence that the radio has
// stopped broadcasting. Show a neutral "programme not listed" time marker,
// rather than attributing the next programme to the current moment.
// Index is where the marker belongs among chronologically ordered programmes.
export const referenceScheduleGap = (programs, nowSeconds) => {
  if (!Array.isArray(programs) || !programs.length || !Number.isFinite(nowSeconds)) return null;
  for (let index = 0; index < programs.length; index++) {
    const next = programs[index];
    if (!Number.isFinite(next?.startTime) || !Number.isFinite(next?.endTime)) return null;
    if (next.startTime <= nowSeconds && nowSeconds < next.endTime) return null;
    if (nowSeconds < next.startTime) {
      const previous = programs[index - 1];
      // Explicit inter-programme gaps and time before the first listed slot.
      if (!previous || (Number.isFinite(previous.endTime) && nowSeconds >= previous.endTime)) {
        return {
          insertIndex: index,
          nextTitle: next.title || '',
          nextStartTime: next.startTime,
        };
      }
      return null;
    }
  }
  // Today's published guide has finished. Don't label this as off-air.
  const last = programs[programs.length - 1];
  return Number.isFinite(last?.endTime) && nowSeconds >= last.endTime
    ? { insertIndex: programs.length, nextTitle: '', nextStartTime: null }
    : null;
};

// Percentage of actual elapsed wall-clock time in a scheduled interval.
// Used only as a reference-guide timeline, not an audio playback progress bar.
// Invalid or unknown bounds intentionally have no calculable position.
export const scheduleTimelineProgress = (startSeconds, endSeconds, nowSeconds) => {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)
      || !Number.isFinite(nowSeconds) || endSeconds <= startSeconds) return null;
  return Math.min(100, Math.max(0, (nowSeconds - startSeconds) * 100 / (endSeconds - startSeconds)));
};

// Fixed-scale broadcast timeline. Unix timestamps stay in Vietnam's ICT zone:
// no browser-local timezone or daylight-saving conversion can move a programme.
export const SCHEDULE_TIMELINE_HOUR_PX = 76;
export const referenceTimelineLayout = (programs, nowSeconds, hourPixels = SCHEDULE_TIMELINE_HOUR_PX) => {
  if (!Array.isArray(programs) || !programs.length || !Number.isFinite(nowSeconds)
    || !Number.isFinite(hourPixels) || hourPixels <= 0) return null;
  const sorted = programs.filter(item =>
    Number.isFinite(item?.startTime) && Number.isFinite(item?.endTime)
    && item.endTime > item.startTime
  ).slice().sort((a, b) => a.startTime - b.startTime);
  if (!sorted.length) return null;
  const vietnamOffset = 7 * 3600;
  const dayStart = Math.floor((sorted[0].startTime + vietnamOffset) / 86400) * 86400 - vietnamOffset;
  // Display a continuous hourly ruler through 03:00 of the following day.
  // Keep longer source events visible without clipping them at midnight.
  const lastEnd = Math.max(...sorted.map(item => item.endTime));
  const hourCount = Math.max(27, Math.ceil((lastEnd - dayStart) / 3600) + 2);
  const timeTop = seconds => (seconds - dayStart) / 3600 * hourPixels;
  const programsLayout = sorted.map((item, index) => ({
    index,
    item,
    top: timeTop(item.startTime),
    height: Math.max(1, timeTop(item.endTime) - timeTop(item.startTime)),
    active: item.startTime <= nowSeconds && nowSeconds < item.endTime,
  }));
  const gap = referenceScheduleGap(sorted, nowSeconds);
  const previous = gap?.insertIndex > 0 ? sorted[gap.insertIndex - 1] : null;
  const next = gap && gap.insertIndex < sorted.length ? sorted[gap.insertIndex] : null;
  return {
    dayStart,
    height: hourCount * hourPixels,
    hours: Array.from({ length: hourCount + 1 }, (_, index) => ({
      time: dayStart + index * 3600,
      top: index * hourPixels,
      nextDay: index > 0 && index % 24 === 0,
    })),
    programmes: programsLayout,
    nowTop: nowSeconds >= dayStart && nowSeconds <= dayStart + hourCount * 3600
      ? timeTop(nowSeconds) : null,
    // An unknown interval is neutral metadata, never a live station status.
    gap: gap ? {
      ...gap,
      startTime: previous?.endTime ?? dayStart,
      endTime: next?.startTime ?? dayStart + hourCount * 3600,
    } : null,
  };
};
