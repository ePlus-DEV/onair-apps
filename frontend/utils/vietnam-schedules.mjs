// Public programme guides checked against the broadcasters' own pages.
// These are REFERENCE time slots, not real-time provider EPG responses.
// Do not present them as guaranteed broadcasts for every calendar day.
export const VIETNAM_SCHEDULE_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_SCHEDULES = Object.freeze({
  'vov-giao-thong': {
    sourceUrl: 'https://vovgiaothong.vn/lich-phat-song-hn/',
    slots: [
      ['04:00','05:30','Nhạc Việt Nam'],
      ['05:30','06:30','Nhạc quốc tế'],
      ['06:30','08:15','Giờ cao điểm sáng'],
      ['08:15','09:15','Giờ cao điểm sáng'],
      ['09:15','10:30','Đời sống thị thành'],
      ['10:30','12:00','Giờ cao điểm trưa'],
      ['12:30','14:30','Đường tình ca – Trên mọi nẻo đường'],
      ['14:30','16:30','FM91 – Buổi chiều'],
      ['16:30','19:40','Giờ cao điểm chiều'],
      ['19:40','20:00','FM Bất động sản'],
      ['20:00','21:30','Kết nối yêu thương'],
      ['21:30','23:00','Đường tin 91 – Đường khuya'],
    ],
  },
  'vov-gt-hcm': {
    sourceUrl: 'https://vovgiaothong.vn/lich-phat-song-hcm/',
    slots: [
      ['04:00','05:00','Nhạc quốc tế'],
      ['05:00','06:30','Nhạc Việt Nam'],
      ['06:30','08:00','Giờ cao điểm sáng'],
      ['09:00','10:30','Đời sống thị thành'],
      ['10:30','11:00','Giờ cao điểm trưa'],
      ['12:30','14:30','Đường tình ca – Trên mọi nẻo đường'],
      ['14:30','16:15','FM91 – Buổi chiều'],
      ['16:30','19:00','Giờ cao điểm chiều'],
    ],
  },
  'vov-mekong': {
    sourceUrl: 'https://vovgiaothong.vn/lich-phat-song-mk/',
    slots: [
      ['06:00','07:00','Bình minh châu thổ – Chào ngày mới'],
      ['07:00','08:00','Bình minh châu thổ – Chuyện đồng bằng'],
      ['08:00','09:00','Bình minh châu thổ – Tin phương Nam'],
      ['10:30','12:00','Đứng bóng mặt trời'],
      ['14:00','16:30','Quà tặng âm nhạc'],
      ['16:30','18:00','Đường về hoàng hôn'],
      ['18:00','19:00','Đường về hoàng hôn – Bản tin miền Tây'],
    ],
  },
  // Daily programmes on these channels vary. Link directly to the official
  // live guide instead of inventing a repeating timetable.
  vov1: { sourceUrl: 'https://vov1.vov.vn/', slots: [] },
  vov3: { sourceUrl: 'https://vov3.vov.vn/lich-phat-song', slots: [] },
  // VOH publishes per-channel daily schedules; do not freeze its rotating
  // shows into a made-up recurring guide.
  'voh-fm-99.9-mhz': { sourceUrl: 'https://voh.com.vn/radios/schedule', slots: [] },
  'voh-fm-95.6-mhz': { sourceUrl: 'https://voh.com.vn/radios/schedule', slots: [] },
  'voh-fm-87.7-mhz': { sourceUrl: 'https://voh.com.vn/radios/schedule', slots: [] },
  'voh-am-610khz': { sourceUrl: 'https://voh.com.vn/radios/schedule', slots: [] },
});

const clockMinutes = clock => {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(clock)) return -1;
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
};

export const getVietnamSchedule = stationPath => {
  const match = /^\/asia\/viet-nam\/([a-z0-9.-]+)$/.exec(stationPath || '');
  return match ? VIETNAM_SCHEDULES[match[1]] || null : null;
};

export const vietnamDateKey = (instant = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VIETNAM_SCHEDULE_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const pieces = Object.fromEntries(formatter.formatToParts(instant)
    .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return [pieces.year, pieces.month, pieces.day].join('-');
};

// Vietnam does not observe DST; convert its local midnight to a UTC instant.
export const vietnamMidnightUtc = (instant = new Date()) => {
  const [year, month, day] = vietnamDateKey(instant).split('-').map(Number);
  return Date.UTC(year, month - 1, day) - 7 * 3_600_000;
};

export const vietnamReferencePrograms = (stationPath, instant = new Date()) => {
  const schedule = getVietnamSchedule(stationPath);
  if (!schedule?.slots?.length) return [];
  const midnight = vietnamMidnightUtc(instant);
  return schedule.slots.flatMap(([start, end, title]) => {
    const from = clockMinutes(start);
    const to = clockMinutes(end);
    if (from < 0 || to < 0 || to <= from || !title) return [];
    return [{
      startTime: Math.floor((midnight + from * 60_000) / 1000),
      endTime: Math.floor((midnight + to * 60_000) / 1000),
      title,
      description: '',
    }];
  });
};
