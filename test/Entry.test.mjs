import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entry } from '../js/storage/Entry.js';

test('Entry constructor', async (t) => {
  await t.test('preserves all fields from the input payload', () => {
    const e = new Entry({
      id: 'x-1',
      description: 'Sprint planning',
      project: 'Acme Corp',
      startTime: '09:00',
      endTime: '10:30',
      date: '2026-05-22',
      duration: 90,
    });
    assert.equal(e.id, 'x-1');
    assert.equal(e.description, 'Sprint planning');
    assert.equal(e.project, 'Acme Corp');
    assert.equal(e.startTime, '09:00');
    assert.equal(e.endTime, '10:30');
    assert.equal(e.date, '2026-05-22');
    assert.equal(e.duration, 90);
  });

  await t.test('generates a non-empty id when none is provided', () => {
    const a = new Entry({});
    const b = new Entry({});
    assert.equal(typeof a.id, 'string');
    assert.ok(a.id.length > 0);
    assert.notEqual(a.id, b.id);
  });

  await t.test('falls back to safe defaults', () => {
    const e = new Entry({});
    assert.equal(e.description, '');
    assert.equal(e.project, null);
    assert.equal(e.startTime, '00:00');
    assert.equal(e.endTime, '00:00');
    assert.equal(e.date, '');
    assert.equal(e.duration, 0);
  });

  await t.test('accepts no argument at all', () => {
    const e = new Entry();
    assert.equal(typeof e.id, 'string');
    assert.equal(e.duration, 0);
  });

  await t.test('preserves duration of 0 explicitly (??, not ||)', () => {
    const e = new Entry({ duration: 0 });
    assert.equal(e.duration, 0);
  });
});

test('Entry constructor — input validation at the boundary', async (t) => {
  await t.test('falls back to 00:00 when startTime / endTime are not HH:MM', () => {
    const e = new Entry({ startTime: 'garbage', endTime: '25:99' });
    assert.equal(e.startTime, '00:00');
    assert.equal(e.endTime, '00:00');
  });

  await t.test('normalizes loose HH:MM-ish input (e.g. "9:5")', () => {
    const e = new Entry({ startTime: '9:5', endTime: '10.30' });
    assert.equal(e.startTime, '09:05');
    assert.equal(e.endTime, '10:30');
  });

  await t.test('falls back to empty date when not ISO YYYY-MM-DD', () => {
    assert.equal(new Entry({ date: '22/05/2026' }).date, '');
    assert.equal(new Entry({ date: 'not-a-date' }).date, '');
    assert.equal(new Entry({ date: '2026-13-01' }).date, '');
    assert.equal(new Entry({ date: '2026-02-30' }).date, '');
  });

  await t.test('preserves a valid ISO date', () => {
    assert.equal(new Entry({ date: '2026-05-22' }).date, '2026-05-22');
  });

  await t.test('clamps duration to a non-negative integer', () => {
    assert.equal(new Entry({ duration: -5 }).duration, 0);
    assert.equal(new Entry({ duration: 'abc' }).duration, 0);
    assert.equal(new Entry({ duration: 75.9 }).duration, 75);
    assert.equal(new Entry({ duration: null }).duration, 0);
  });

  await t.test('coerces non-string description to a string', () => {
    assert.equal(new Entry({ description: 42 }).description, '42');
    assert.equal(new Entry({ description: null }).description, '');
    assert.equal(new Entry({ description: undefined }).description, '');
  });
});

test('Entry.toJSON', async (t) => {
  await t.test('returns a plain object with exactly the persisted fields', () => {
    const e = new Entry({
      id: 'x-1', description: 'd', project: 'p',
      startTime: '09:00', endTime: '10:00', date: '2026-05-22', duration: 60,
    });
    const j = e.toJSON();
    assert.deepEqual(j, {
      id: 'x-1', description: 'd', project: 'p',
      startTime: '09:00', endTime: '10:00', date: '2026-05-22', duration: 60,
    });
  });

  await t.test('JSON.stringify round-trip matches toJSON', () => {
    const e = new Entry({ id: 'r', description: 'x', project: 'p', startTime: '09:00', endTime: '10:00', date: '2026-05-22', duration: 60 });
    const parsed = JSON.parse(JSON.stringify(e));
    assert.deepEqual(parsed, e.toJSON());
  });
});

test('Entry.isZero', async (t) => {
  await t.test('true when duration is 0', () => {
    const e = new Entry({ startTime: '09:00', endTime: '09:00', duration: 0 });
    assert.equal(e.isZero, true);
  });

  await t.test('false for a normal entry', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    assert.equal(e.isZero, false);
  });

  await t.test('false for an overnight shift (endTime < startTime but duration > 0)', () => {
    const e = new Entry({ startTime: '23:00', endTime: '01:00', duration: 120 });
    assert.equal(e.isZero, false);
  });

  await t.test('reflects the duration field even if times look stale', () => {
    const e = new Entry({ startTime: '09:00', endTime: '09:00', duration: 30 });
    assert.equal(e.isZero, false);
  });
});

test('Entry.setStartTime', async (t) => {
  await t.test('updates startTime and recomputes duration when end stays after start', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    e.setStartTime('09:30');
    assert.equal(e.startTime, '09:30');
    assert.equal(e.endTime, '10:00');
    assert.equal(e.duration, 30);
  });

  await t.test('preserves duration by pushing endTime when new start >= old end', () => {
    const e = new Entry({ startTime: '09:00', endTime: '09:30', duration: 30 });
    e.setStartTime('10:00');
    assert.equal(e.startTime, '10:00');
    assert.equal(e.endTime, '10:30');
    assert.equal(e.duration, 30);
  });

  await t.test('defaults to 10-min duration if previous endTime was already <= old start', () => {
    const e = new Entry({ startTime: '09:00', endTime: '09:00', duration: 0 });
    e.setStartTime('10:00');
    assert.equal(e.endTime, '10:10');
    assert.equal(e.duration, 10);
  });

  await t.test('caps endTime at 23:59 when start nears end of day', () => {
    const e = new Entry({ startTime: '08:00', endTime: '08:30', duration: 30 });
    e.setStartTime('23:50');
    assert.equal(e.endTime, '23:59');
  });
});

test('Entry.setEndTime', async (t) => {
  await t.test('accepts when newEnd >= start and updates duration', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    const ok = e.setEndTime('11:30');
    assert.equal(ok, true);
    assert.equal(e.endTime, '11:30');
    assert.equal(e.duration, 150);
  });

  await t.test('rejects (returns false, no mutation) when newEnd < start', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    const ok = e.setEndTime('08:00');
    assert.equal(ok, false);
    assert.equal(e.endTime, '10:00');
    assert.equal(e.duration, 60);
  });

  await t.test('accepts newEnd == start (zero-duration entry)', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    const ok = e.setEndTime('09:00');
    assert.equal(ok, true);
    assert.equal(e.duration, 0);
  });
});

test('Entry.setDuration', async (t) => {
  await t.test('updates duration and recomputes endTime', () => {
    const e = new Entry({ startTime: '09:00', endTime: '09:30', duration: 30 });
    e.setDuration(120);
    assert.equal(e.duration, 120);
    assert.equal(e.endTime, '11:00');
  });

  await t.test('clamps negative duration to 0', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    e.setDuration(-10);
    assert.equal(e.duration, 0);
    assert.equal(e.endTime, '09:00');
  });

  await t.test('clamps to 23:59 (does not allow end to roll over midnight)', () => {
    const e = new Entry({ startTime: '23:00', endTime: '23:10', duration: 10 });
    e.setDuration(999);
    assert.equal(e.endTime, '23:59');
    assert.equal(e.duration, 59);
  });
});

test('Entry.setProject', async (t) => {
  await t.test('updates the project field', () => {
    const e = new Entry({ project: 'Acme' });
    e.setProject('Internal');
    assert.equal(e.project, 'Internal');
  });

  await t.test('accepts null (entry with no project)', () => {
    const e = new Entry({ project: 'Acme' });
    e.setProject(null);
    assert.equal(e.project, null);
  });
});

test('Entry.setDate', async (t) => {
  await t.test('updates the date field with an ISO string', () => {
    const e = new Entry({ date: '2026-05-22' });
    e.setDate('2026-05-23');
    assert.equal(e.date, '2026-05-23');
  });
});

test('Entry.setDescription', async (t) => {
  await t.test('updates the description field', () => {
    const e = new Entry({ description: 'old' });
    e.setDescription('new');
    assert.equal(e.description, 'new');
  });

  await t.test('accepts empty string', () => {
    const e = new Entry({ description: 'old' });
    e.setDescription('');
    assert.equal(e.description, '');
  });
});

test('Entry.adjustTime', async (t) => {
  await t.test('+ delta on end extends the entry', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    e.adjustTime('end', 30);
    assert.equal(e.endTime, '10:30');
    assert.equal(e.duration, 90);
  });

  await t.test('- delta on end shrinks the entry, clamped at start', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    e.adjustTime('end', -90);
    assert.equal(e.endTime, '09:00');
    assert.equal(e.duration, 0);
  });

  await t.test('- delta on start extends backwards', () => {
    const e = new Entry({ startTime: '09:30', endTime: '10:00', duration: 30 });
    e.adjustTime('start', -30);
    assert.equal(e.startTime, '09:00');
    assert.equal(e.duration, 60);
  });

  await t.test('+ delta on start shrinks from the front, clamped at end', () => {
    const e = new Entry({ startTime: '09:00', endTime: '10:00', duration: 60 });
    e.adjustTime('start', 90);
    assert.equal(e.startTime, '10:00');
    assert.equal(e.duration, 0);
  });

  await t.test('clamps start at 00:00 when going further back', () => {
    const e = new Entry({ startTime: '00:30', endTime: '01:00', duration: 30 });
    e.adjustTime('start', -120);
    assert.equal(e.startTime, '00:00');
    assert.equal(e.duration, 60);
  });
});
