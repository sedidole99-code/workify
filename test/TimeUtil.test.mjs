import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimeUtil } from '../js/util/TimeUtil.js';

test('TimeUtil.normalize', async (t) => {
  await t.test('compact 1-2 digit hour pads to :00', () => {
    assert.equal(TimeUtil.normalize('9'), '09:00');
    assert.equal(TimeUtil.normalize('12'), '12:00');
    assert.equal(TimeUtil.normalize('0'), '00:00');
  });

  await t.test('compact 3-digit form (H + MM)', () => {
    assert.equal(TimeUtil.normalize('915'), '09:15');
    assert.equal(TimeUtil.normalize('700'), '07:00');
  });

  await t.test('compact 4-digit form (HH + MM)', () => {
    assert.equal(TimeUtil.normalize('1515'), '15:15');
    assert.equal(TimeUtil.normalize('0000'), '00:00');
    assert.equal(TimeUtil.normalize('2359'), '23:59');
  });

  await t.test('accepts : . - and whitespace separators', () => {
    assert.equal(TimeUtil.normalize('9:15'), '09:15');
    assert.equal(TimeUtil.normalize('9.15'), '09:15');
    assert.equal(TimeUtil.normalize('9-15'), '09:15');
    assert.equal(TimeUtil.normalize('9 15'), '09:15');
  });

  await t.test('trims surrounding whitespace', () => {
    assert.equal(TimeUtil.normalize('  9:15  '), '09:15');
  });

  await t.test('rejects out-of-range hours and minutes', () => {
    assert.equal(TimeUtil.normalize('24:00'), null);
    assert.equal(TimeUtil.normalize('2400'), null);
    assert.equal(TimeUtil.normalize('12:60'), null);
    assert.equal(TimeUtil.normalize('99:99'), null);
  });

  await t.test('rejects empty / nullish input', () => {
    assert.equal(TimeUtil.normalize(''), null);
    assert.equal(TimeUtil.normalize(null), null);
    assert.equal(TimeUtil.normalize(undefined), null);
  });

  await t.test('rejects garbage', () => {
    assert.equal(TimeUtil.normalize('abc'), null);
    assert.equal(TimeUtil.normalize('9:'), null);
    assert.equal(TimeUtil.normalize(':15'), null);
  });
});

test('TimeUtil.toMinutes', async (t) => {
  await t.test('converts HH:MM to minute count', () => {
    assert.equal(TimeUtil.toMinutes('00:00'), 0);
    assert.equal(TimeUtil.toMinutes('09:15'), 9 * 60 + 15);
    assert.equal(TimeUtil.toMinutes('23:59'), 23 * 60 + 59);
  });

  await t.test('treats empty / nullish as 0', () => {
    assert.equal(TimeUtil.toMinutes(''), 0);
    assert.equal(TimeUtil.toMinutes(null), 0);
    assert.equal(TimeUtil.toMinutes(undefined), 0);
  });
});

test('TimeUtil.fromMinutes', async (t) => {
  await t.test('formats minute count as HH:MM', () => {
    assert.equal(TimeUtil.fromMinutes(0), '00:00');
    assert.equal(TimeUtil.fromMinutes(9 * 60 + 15), '09:15');
    assert.equal(TimeUtil.fromMinutes(23 * 60 + 59), '23:59');
  });

  await t.test('wraps across midnight (modulo 24h)', () => {
    assert.equal(TimeUtil.fromMinutes(1440), '00:00');
    assert.equal(TimeUtil.fromMinutes(1500), '01:00');
  });

  await t.test('wraps negative minutes into the previous day', () => {
    assert.equal(TimeUtil.fromMinutes(-30), '23:30');
    assert.equal(TimeUtil.fromMinutes(-1), '23:59');
  });
});

test('TimeUtil.calcDuration', async (t) => {
  await t.test('returns end - start when both same day', () => {
    assert.equal(TimeUtil.calcDuration('09:00', '10:30'), 90);
    assert.equal(TimeUtil.calcDuration('07:15', '07:25'), 10);
  });

  await t.test('zero when start == end', () => {
    assert.equal(TimeUtil.calcDuration('10:00', '10:00'), 0);
  });

  await t.test('wraps when end < start (over midnight)', () => {
    assert.equal(TimeUtil.calcDuration('23:30', '00:30'), 60);
    assert.equal(TimeUtil.calcDuration('22:00', '02:00'), 240);
  });
});

test('TimeUtil.formatDuration', async (t) => {
  await t.test('formats minutes as HH:MM', () => {
    assert.equal(TimeUtil.formatDuration(0), '00:00');
    assert.equal(TimeUtil.formatDuration(75), '01:15');
    assert.equal(TimeUtil.formatDuration(60), '01:00');
    assert.equal(TimeUtil.formatDuration(8 * 60), '08:00');
  });

  await t.test('clamps negatives to 00:00', () => {
    assert.equal(TimeUtil.formatDuration(-5), '00:00');
    assert.equal(TimeUtil.formatDuration(-1000), '00:00');
  });

  await t.test('truncates fractional minutes', () => {
    assert.equal(TimeUtil.formatDuration(75.9), '01:15');
  });
});

test('TimeUtil.parseDuration', async (t) => {
  await t.test('1-2 digit value is treated as raw minutes', () => {
    assert.equal(TimeUtil.parseDuration('30'), 30);
    assert.equal(TimeUtil.parseDuration('90'), 90);
    assert.equal(TimeUtil.parseDuration('5'), 5);
  });

  await t.test('3-digit compact is H + MM', () => {
    assert.equal(TimeUtil.parseDuration('130'), 90);
    assert.equal(TimeUtil.parseDuration('700'), 7 * 60);
  });

  await t.test('4-digit compact is HH + MM', () => {
    assert.equal(TimeUtil.parseDuration('0130'), 90);
    assert.equal(TimeUtil.parseDuration('1015'), 10 * 60 + 15);
  });

  await t.test('accepts HH:MM with various separators', () => {
    assert.equal(TimeUtil.parseDuration('1:30'), 90);
    assert.equal(TimeUtil.parseDuration('1.30'), 90);
    assert.equal(TimeUtil.parseDuration('1-30'), 90);
    assert.equal(TimeUtil.parseDuration('01:30'), 90);
  });

  await t.test('trims whitespace', () => {
    assert.equal(TimeUtil.parseDuration('  90  '), 90);
  });

  await t.test('returns null for empty / nullish / invalid', () => {
    assert.equal(TimeUtil.parseDuration(''), null);
    assert.equal(TimeUtil.parseDuration(null), null);
    assert.equal(TimeUtil.parseDuration(undefined), null);
    assert.equal(TimeUtil.parseDuration('abc'), null);
    assert.equal(TimeUtil.parseDuration('1:60'), null);
  });
});

test('TimeUtil round-trips', async (t) => {
  await t.test('toMinutes ∘ fromMinutes identity within a day', () => {
    for (const m of [0, 1, 60, 75, 555, 1439]) {
      assert.equal(TimeUtil.toMinutes(TimeUtil.fromMinutes(m)), m);
    }
  });

  await t.test('formatDuration ∘ parseDuration HH:MM identity', () => {
    for (const v of ['00:00', '00:30', '01:00', '08:30', '23:59']) {
      assert.equal(TimeUtil.formatDuration(TimeUtil.parseDuration(v)), v);
    }
  });
});
