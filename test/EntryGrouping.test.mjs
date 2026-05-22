import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EntryGrouping } from '../js/util/EntryGrouping.js';

const makeEntry = (overrides = {}) => ({
  id: 'e-' + Math.random().toString(36).slice(2, 8),
  description: '',
  project: 'p',
  startTime: '09:00',
  endTime: '10:00',
  date: '2026-05-22',
  duration: 60,
  ...overrides,
});

test('EntryGrouping.sortKey', async (t) => {
  await t.test('orders by date, then startTime, then id', () => {
    const a = makeEntry({ date: '2026-05-22', startTime: '09:00', id: 'a' });
    const b = makeEntry({ date: '2026-05-22', startTime: '10:00', id: 'b' });
    const c = makeEntry({ date: '2026-05-23', startTime: '09:00', id: 'c' });
    const items = [c, b, a].sort((x, y) => EntryGrouping.sortKey(x).localeCompare(EntryGrouping.sortKey(y)));
    assert.deepEqual(items.map(e => e.id), ['a', 'b', 'c']);
  });

  await t.test('uses 00:00 placeholder when startTime is missing', () => {
    const e = makeEntry({ startTime: '' });
    assert.ok(EntryGrouping.sortKey(e).includes('00:00'));
  });
});

test('EntryGrouping.findOverlapIds', async (t) => {
  await t.test('returns empty Set for non-overlapping entries', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00', duration: 60 }),
      makeEntry({ id: 'b', startTime: '10:00', endTime: '11:00', duration: 60 }),
      makeEntry({ id: 'c', startTime: '12:00', endTime: '13:00', duration: 60 }),
    ];
    const overlaps = EntryGrouping.findOverlapIds(items);
    assert.equal(overlaps.size, 0);
  });

  await t.test('detects partial overlap and flags both involved entries', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00', duration: 60 }),
      makeEntry({ id: 'b', startTime: '09:30', endTime: '10:30', duration: 60 }),
    ];
    const overlaps = EntryGrouping.findOverlapIds(items);
    assert.equal(overlaps.size, 2);
    assert.ok(overlaps.has('a') && overlaps.has('b'));
  });

  await t.test('detects an entry fully contained inside another', () => {
    const items = [
      makeEntry({ id: 'outer', startTime: '09:00', endTime: '12:00', duration: 180 }),
      makeEntry({ id: 'inner', startTime: '10:00', endTime: '11:00', duration: 60 }),
    ];
    const overlaps = EntryGrouping.findOverlapIds(items);
    assert.ok(overlaps.has('outer') && overlaps.has('inner'));
  });

  await t.test('touching boundaries (a.end == b.start) is NOT an overlap', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00', duration: 60 }),
      makeEntry({ id: 'b', startTime: '10:00', endTime: '11:00', duration: 60 }),
    ];
    assert.equal(EntryGrouping.findOverlapIds(items).size, 0);
  });

  await t.test('falls back to calcDuration when duration field is 0', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00', duration: 0 }),
      makeEntry({ id: 'b', startTime: '09:30', endTime: '10:30', duration: 0 }),
    ];
    assert.equal(EntryGrouping.findOverlapIds(items).size, 2);
  });

  await t.test('empty input returns empty Set', () => {
    assert.equal(EntryGrouping.findOverlapIds([]).size, 0);
  });

  await t.test('single entry never overlaps', () => {
    assert.equal(EntryGrouping.findOverlapIds([makeEntry()]).size, 0);
  });
});

test('EntryGrouping.findGapIds', async (t) => {
  await t.test('no gaps when entries are contiguous', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00' }),
      makeEntry({ id: 'b', startTime: '10:00', endTime: '11:00' }),
    ];
    assert.equal(EntryGrouping.findGapIds(items).size, 0);
  });

  await t.test('flags the LATER entry with the gap size in minutes', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00' }),
      makeEntry({ id: 'b', startTime: '10:30', endTime: '11:00' }),
    ];
    const gaps = EntryGrouping.findGapIds(items);
    assert.equal(gaps.size, 1);
    assert.equal(gaps.get('b'), 30);
  });

  await t.test('1-minute gap is NOT flagged (threshold is > 1)', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00' }),
      makeEntry({ id: 'b', startTime: '10:01', endTime: '11:00' }),
    ];
    assert.equal(EntryGrouping.findGapIds(items).size, 0);
  });

  await t.test('2-minute gap IS flagged', () => {
    const items = [
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00' }),
      makeEntry({ id: 'b', startTime: '10:02', endTime: '11:00' }),
    ];
    const gaps = EntryGrouping.findGapIds(items);
    assert.equal(gaps.get('b'), 2);
  });

  await t.test('sorts internally — order of input array does not matter', () => {
    const items = [
      makeEntry({ id: 'b', startTime: '10:30', endTime: '11:00' }),
      makeEntry({ id: 'a', startTime: '09:00', endTime: '10:00' }),
    ];
    const gaps = EntryGrouping.findGapIds(items);
    assert.equal(gaps.get('b'), 30);
    assert.ok(!gaps.has('a'));
  });

  await t.test('returns empty Map for 0 or 1 entries', () => {
    assert.equal(EntryGrouping.findGapIds([]).size, 0);
    assert.equal(EntryGrouping.findGapIds([makeEntry()]).size, 0);
  });
});

test('EntryGrouping.paginateByDay', async (t) => {
  await t.test('groups all entries of the same day together', () => {
    const items = [
      makeEntry({ id: 'a', date: '2026-05-22' }),
      makeEntry({ id: 'b', date: '2026-05-22' }),
      makeEntry({ id: 'c', date: '2026-05-21' }),
    ];
    const pages = EntryGrouping.paginateByDay(items, 50);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].map(e => e.id), ['a', 'b', 'c']);
  });

  await t.test('starts a new page rather than splitting a day across pages', () => {
    const items = [
      makeEntry({ id: 'a', date: '2026-05-22' }),
      makeEntry({ id: 'b', date: '2026-05-22' }),
      makeEntry({ id: 'c', date: '2026-05-21' }),
      makeEntry({ id: 'd', date: '2026-05-21' }),
    ];
    const pages = EntryGrouping.paginateByDay(items, 2);
    assert.equal(pages.length, 2);
    assert.deepEqual(pages[0].map(e => e.id), ['a', 'b']);
    assert.deepEqual(pages[1].map(e => e.id), ['c', 'd']);
  });

  await t.test('a day larger than pageSize still renders as one page (intact)', () => {
    const items = [
      makeEntry({ id: '1', date: '2026-05-22' }),
      makeEntry({ id: '2', date: '2026-05-22' }),
      makeEntry({ id: '3', date: '2026-05-22' }),
      makeEntry({ id: '4', date: '2026-05-22' }),
    ];
    const pages = EntryGrouping.paginateByDay(items, 2);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].length, 4);
  });

  await t.test('returns a single empty page when input is empty', () => {
    const pages = EntryGrouping.paginateByDay([], 50);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0], []);
  });

  await t.test('honours pageSize boundary exactly', () => {
    const items = [
      makeEntry({ id: 'a', date: '2026-05-22' }),
      makeEntry({ id: 'b', date: '2026-05-21' }),
    ];
    const pages = EntryGrouping.paginateByDay(items, 2);
    assert.equal(pages.length, 1);
  });
});
