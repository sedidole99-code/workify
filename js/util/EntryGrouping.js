import { TimeUtil } from './TimeUtil.js';

export class EntryGrouping {
  static sortKey(e) {
    return e.date + ' ' + (e.startTime || '00:00') + ' ' + e.id;
  }

  static findOverlapIds(items) {
    const overlapping = new Set();
    const ranges = items.map(e => {
      const s = TimeUtil.toMinutes(e.startTime);
      const d = e.duration || TimeUtil.calcDuration(e.startTime, e.endTime);
      return { id: e.id, start: s, end: s + d };
    });
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const a = ranges[i], b = ranges[j];
        if (a.start < b.end && b.start < a.end) {
          overlapping.add(a.id);
          overlapping.add(b.id);
        }
      }
    }
    return overlapping;
  }

  static findGapIds(items) {
    const gaps = new Map();
    if (items.length < 2) return gaps;
    const sorted = items.slice().sort((a, b) =>
      TimeUtil.toMinutes(a.startTime) - TimeUtil.toMinutes(b.startTime) || a.id.localeCompare(b.id)
    );
    for (let i = 1; i < sorted.length; i++) {
      const gap = TimeUtil.toMinutes(sorted[i].startTime) - TimeUtil.toMinutes(sorted[i - 1].endTime);
      if (gap > 1) gaps.set(sorted[i].id, gap);
    }
    return gaps;
  }

  static paginateByDay(sortedEntries, pageSize) {
    const dayGroups = [];
    let currentDay = null;
    let currentList = null;
    for (const e of sortedEntries) {
      if (e.date !== currentDay) {
        currentDay = e.date;
        currentList = [];
        dayGroups.push(currentList);
      }
      currentList.push(e);
    }
    const pages = [];
    let page = [];
    let count = 0;
    for (const group of dayGroups) {
      if (count > 0 && count + group.length > pageSize) {
        pages.push(page);
        page = [];
        count = 0;
      }
      page.push(...group);
      count += group.length;
    }
    if (page.length > 0) pages.push(page);
    if (pages.length === 0) pages.push([]);
    return pages;
  }
}
