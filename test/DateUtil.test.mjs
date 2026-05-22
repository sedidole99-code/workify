import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DateUtil } from '../js/util/DateUtil.js';

const FROZEN_NOW = new Date('2026-05-22T12:00:00').getTime(); // Friday

function freezeToday(t) {
  mock.timers.enable({ apis: ['Date'], now: FROZEN_NOW });
  t.after(() => mock.timers.reset());
}

test('DateUtil.mondayOffset', async (t) => {
  await t.test('returns 0 for Monday, 6 for Sunday', () => {
    // 2026-05-18 is Monday, 2026-05-24 is Sunday
    assert.equal(DateUtil.mondayOffset(new Date(2026, 4, 18)), 0);
    assert.equal(DateUtil.mondayOffset(new Date(2026, 4, 19)), 1);
    assert.equal(DateUtil.mondayOffset(new Date(2026, 4, 22)), 4); // Friday
    assert.equal(DateUtil.mondayOffset(new Date(2026, 4, 24)), 6);
  });
});

test('DateUtil.dateToIso', async (t) => {
  await t.test('formats a Date as YYYY-MM-DD', () => {
    assert.equal(DateUtil.dateToIso(new Date(2026, 0, 1)), '2026-01-01');
    assert.equal(DateUtil.dateToIso(new Date(2026, 11, 31)), '2026-12-31');
    assert.equal(DateUtil.dateToIso(new Date(2026, 4, 22)), '2026-05-22');
  });

  await t.test('pads single-digit month and day with zero', () => {
    assert.equal(DateUtil.dateToIso(new Date(2026, 2, 5)), '2026-03-05');
  });
});

test('DateUtil.todayISO', async (t) => {
  freezeToday(t);
  await t.test('returns today in YYYY-MM-DD against frozen clock', () => {
    assert.equal(DateUtil.todayISO(), '2026-05-22');
  });
});

test('DateUtil.isoToDisplay', async (t) => {
  await t.test('formats ISO as DD/MM/YYYY', () => {
    assert.equal(DateUtil.isoToDisplay('2026-05-22'), '22/05/2026');
    assert.equal(DateUtil.isoToDisplay('2026-01-01'), '01/01/2026');
  });

  await t.test('returns empty string for empty / nullish input', () => {
    assert.equal(DateUtil.isoToDisplay(''), '');
    assert.equal(DateUtil.isoToDisplay(null), '');
    assert.equal(DateUtil.isoToDisplay(undefined), '');
  });

  await t.test('returns input unchanged when not in ISO shape', () => {
    assert.equal(DateUtil.isoToDisplay('not-a-date'), 'not-a-date');
    assert.equal(DateUtil.isoToDisplay('22/05/2026'), '22/05/2026');
  });
});

test('DateUtil.displayToIso', async (t) => {
  await t.test('parses DD/MM/YYYY', () => {
    assert.equal(DateUtil.displayToIso('22/05/2026'), '2026-05-22');
    assert.equal(DateUtil.displayToIso('1/1/2026'), '2026-01-01');
  });

  await t.test('accepts . - and whitespace as separators', () => {
    assert.equal(DateUtil.displayToIso('22.05.2026'), '2026-05-22');
    assert.equal(DateUtil.displayToIso('22-05-2026'), '2026-05-22');
    assert.equal(DateUtil.displayToIso('22 05 2026'), '2026-05-22');
  });

  await t.test('expands 2-digit years: >=70 → 19xx, <70 → 20xx', () => {
    assert.equal(DateUtil.displayToIso('01/01/70'), '1970-01-01');
    assert.equal(DateUtil.displayToIso('01/01/99'), '1999-01-01');
    assert.equal(DateUtil.displayToIso('01/01/69'), '2069-01-01');
    assert.equal(DateUtil.displayToIso('01/01/00'), '2000-01-01');
  });

  await t.test('rejects invalid calendar dates (Feb 30, Apr 31, etc.)', () => {
    assert.equal(DateUtil.displayToIso('30/02/2026'), null);
    assert.equal(DateUtil.displayToIso('31/04/2026'), null);
    assert.equal(DateUtil.displayToIso('32/01/2026'), null);
    assert.equal(DateUtil.displayToIso('00/01/2026'), null);
  });

  await t.test('rejects malformed input', () => {
    assert.equal(DateUtil.displayToIso(''), null);
    assert.equal(DateUtil.displayToIso(null), null);
    assert.equal(DateUtil.displayToIso('abc'), null);
    assert.equal(DateUtil.displayToIso('22/05'), null);
    assert.equal(DateUtil.displayToIso('22/05/2026/extra'), null);
  });

  await t.test('trims whitespace', () => {
    assert.equal(DateUtil.displayToIso('  22/05/2026  '), '2026-05-22');
  });
});

test('DateUtil.weekRange', async (t) => {
  freezeToday(t);
  await t.test('returns [Monday 00:00, Sunday 23:59:59] for the current week', () => {
    const [mon, sun] = DateUtil.weekRange();
    assert.equal(DateUtil.dateToIso(mon), '2026-05-18'); // Mon
    assert.equal(DateUtil.dateToIso(sun), '2026-05-24'); // Sun
    assert.equal(mon.getHours(), 0);
    assert.equal(mon.getMinutes(), 0);
    assert.equal(sun.getHours(), 23);
    assert.equal(sun.getMinutes(), 59);
  });
});

test('DateUtil.isThisWeek', async (t) => {
  freezeToday(t);
  await t.test('Mon–Sun of the current week are this-week', () => {
    for (const iso of ['2026-05-18', '2026-05-22', '2026-05-24']) {
      assert.ok(DateUtil.isThisWeek(iso), `${iso} should be this week`);
    }
  });

  await t.test('previous Sunday and next Monday are NOT this-week', () => {
    assert.ok(!DateUtil.isThisWeek('2026-05-17'));
    assert.ok(!DateUtil.isThisWeek('2026-05-25'));
  });
});

test('DateUtil.weekStartIso', async (t) => {
  await t.test('snaps to the Monday of the same week', () => {
    assert.equal(DateUtil.weekStartIso('2026-05-22'), '2026-05-18'); // Fri → Mon
    assert.equal(DateUtil.weekStartIso('2026-05-18'), '2026-05-18'); // Mon → Mon
    assert.equal(DateUtil.weekStartIso('2026-05-24'), '2026-05-18'); // Sun → Mon
  });

  await t.test('handles week crossing month boundary', () => {
    assert.equal(DateUtil.weekStartIso('2026-06-01'), '2026-06-01'); // Monday
    assert.equal(DateUtil.weekStartIso('2026-05-31'), '2026-05-25'); // Sun → prev Mon
  });
});

test('DateUtil.formatFriendly', async (t) => {
  freezeToday(t);
  await t.test('"Today" / "Yesterday" for the obvious cases', () => {
    assert.equal(DateUtil.formatFriendly('2026-05-22'), 'Today');
    assert.equal(DateUtil.formatFriendly('2026-05-21'), 'Yesterday');
  });

  await t.test('non-special dates return a non-empty locale string (en-GB)', () => {
    const out = DateUtil.formatFriendly('2026-05-19');
    assert.ok(out.length > 0);
    assert.notEqual(out, 'Today');
    assert.notEqual(out, 'Yesterday');
  });

  await t.test('includes year suffix for dates in a different year', () => {
    const out = DateUtil.formatFriendly('2025-12-01');
    assert.ok(/2025/.test(out), `expected 2025 in "${out}"`);
  });
});

test('DateUtil.formatWeekLabel', async (t) => {
  freezeToday(t);
  await t.test('"This week" for the current Monday', () => {
    assert.equal(DateUtil.formatWeekLabel('2026-05-18'), 'This week');
  });

  await t.test('"Last week" for the previous Monday', () => {
    assert.equal(DateUtil.formatWeekLabel('2026-05-11'), 'Last week');
  });

  await t.test('older weeks render a Mon–Sun range', () => {
    const out = DateUtil.formatWeekLabel('2026-05-04');
    assert.ok(out.includes('-'), `expected range separator in "${out}"`);
    assert.notEqual(out, 'This week');
    assert.notEqual(out, 'Last week');
  });

  await t.test('different year gets a year suffix', () => {
    const out = DateUtil.formatWeekLabel('2024-12-30');
    assert.ok(/2024/.test(out), `expected 2024 in "${out}"`);
  });
});

test('DateUtil.formatShortDate', async (t) => {
  await t.test('returns a non-empty locale string', () => {
    assert.ok(DateUtil.formatShortDate('2026-05-22').length > 0);
  });
});
