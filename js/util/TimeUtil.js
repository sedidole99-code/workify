export class TimeUtil {
  // Parses compact (1-4 digit) or separated (HH:MM / HH.MM / HH-MM / HH MM) input.
  // `compactAsMinutes`: when input is 1-2 digits, treat it as total minutes (parseDuration)
  // instead of a bare hour (normalize). Returns { h, mm } or null.
  static #parseHM(raw, compactAsMinutes) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^\d{1,4}$/.test(s)) {
      if (s.length <= 2) {
        if (compactAsMinutes) {
          const mins = parseInt(s, 10);
          return { h: Math.floor(mins / 60), mm: mins % 60 };
        }
        return { h: parseInt(s, 10), mm: 0 };
      }
      if (s.length === 3) {
        return { h: parseInt(s.slice(0, 1), 10), mm: parseInt(s.slice(1), 10) };
      }
      return { h: parseInt(s.slice(0, 2), 10), mm: parseInt(s.slice(2), 10) };
    }
    const m = s.replace(/[.\s-]/g, ':').match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    return { h: parseInt(m[1], 10), mm: parseInt(m[2], 10) };
  }

  static normalize(raw) {
    const r = TimeUtil.#parseHM(raw, false);
    if (!r || r.h > 23 || r.mm > 59) return null;
    return String(r.h).padStart(2, '0') + ':' + String(r.mm).padStart(2, '0');
  }

  static toMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  static fromMinutes(m) {
    m = ((m % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60), mm = m % 60;
    return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  static calcDuration(startTime, endTime) {
    let diff = TimeUtil.toMinutes(endTime) - TimeUtil.toMinutes(startTime);
    if (diff < 0) diff += 1440;
    return diff;
  }

  static formatDuration(mins) {
    mins = Math.max(0, mins | 0);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  static parseDuration(str) {
    const r = TimeUtil.#parseHM(str, true);
    if (!r || r.mm > 59) return null;
    return r.h * 60 + r.mm;
  }
}
