export class DateUtil {
  static todayISO() {
    return DateUtil.dateToIso(new Date());
  }

  static dateToIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  static isoToDisplay(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  static displayToIso(input) {
    if (!input) return null;
    const m = String(input).trim().match(/^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2,4})$/);
    if (!m) return null;
    let [, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y, 10) >= 70 ? '19' : '20') + y;
    d = d.padStart(2, '0');
    mo = mo.padStart(2, '0');
    const dt = new Date(`${y}-${mo}-${d}T00:00:00`);
    if (isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== parseInt(y, 10) || dt.getMonth() + 1 !== parseInt(mo, 10) || dt.getDate() !== parseInt(d, 10)) return null;
    return `${y}-${mo}-${d}`;
  }

  static mondayOffset(d) {
    return (d.getDay() + 6) % 7;
  }

  static weekRange() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const dow = DateUtil.mondayOffset(d);
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return [monday, sunday];
  }

  static isThisWeek(dateStr) {
    const [mon, sun] = DateUtil.weekRange();
    const d = new Date(dateStr + 'T00:00:00');
    return d >= mon && d <= sun;
  }

  static formatFriendly(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === yesterday.getTime()) return 'Yesterday';
    const opts = { weekday: 'short', month: 'short', day: 'numeric' };
    if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-GB', opts);
  }

  static weekStartIso(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - DateUtil.mondayOffset(d));
    return DateUtil.dateToIso(d);
  }

  static formatWeekLabel(weekStart) {
    const monday = new Date(weekStart + 'T00:00:00');
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - DateUtil.mondayOffset(today));
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
    if (monday.getTime() === thisMonday.getTime()) return 'This week';
    if (monday.getTime() === lastMonday.getTime()) return 'Last week';
    const fmtFull = (d) => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    const yearSuffix = monday.getFullYear() !== today.getFullYear() ? `, ${monday.getFullYear()}` : '';
    return `${fmtFull(monday)} - ${fmtFull(sunday)}${yearSuffix}`;
  }

  static formatShortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  static formatFullDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
}
