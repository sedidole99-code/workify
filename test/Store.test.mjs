import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../js/storage/Store.js';
import { Entry } from '../js/storage/Entry.js';

class FakeAdapter {
  constructor(canned = null) {
    this.data = canned;
    this.saveCalls = [];
  }
  async load() { return this.data; }
  async save(data) {
    this.saveCalls.push(JSON.parse(JSON.stringify(data)));
    this.data = JSON.parse(JSON.stringify(data));
  }
  get name() { return 'fake'; }
  get canChange() { return true; }
}

test('Store constructor', async (t) => {
  await t.test('starts empty with sensible defaults', () => {
    const s = new Store(new FakeAdapter());
    assert.deepEqual(s.entries, []);
    assert.deepEqual(s.projects, []);
    assert.equal(s.lastProject, null);
    assert.equal(s.pageSize, 50);
  });
});

test('Store.load', async (t) => {
  await t.test('populates fields and wraps entries as Entry instances', async () => {
    const s = new Store(new FakeAdapter({
      entries: [
        { id: 'e1', description: 'd', project: 'Acme', startTime: '09:00', endTime: '10:00', date: '2026-05-22', duration: 60 },
      ],
      projects: ['Acme', 'Internal'],
      lastProject: 'Acme',
      pageSize: 25,
    }));
    await s.load();
    assert.equal(s.entries.length, 1);
    assert.ok(s.entries[0] instanceof Entry, 'expected Entry instance');
    assert.deepEqual(s.projects, ['Acme', 'Internal']);
    assert.equal(s.lastProject, 'Acme');
    assert.equal(s.pageSize, 25);
  });

  await t.test('handles null payload (empty file) by resetting to defaults', async () => {
    const s = new Store(new FakeAdapter(null));
    s.entries = [new Entry()];
    s.projects = ['leftover'];
    await s.load();
    assert.deepEqual(s.entries, []);
    assert.deepEqual(s.projects, []);
    assert.equal(s.lastProject, null);
    assert.equal(s.pageSize, 50);
  });

  await t.test('coerces malformed payload safely', async () => {
    const s = new Store(new FakeAdapter({ entries: 'nope', projects: null, pageSize: 'big' }));
    await s.load();
    assert.deepEqual(s.entries, []);
    assert.deepEqual(s.projects, []);
    assert.equal(s.pageSize, 50);
  });

  await t.test('non-object payload (string/number) does not throw', async () => {
    const s = new Store(new FakeAdapter('hello'));
    await s.load();
    assert.deepEqual(s.entries, []);
  });
});

test('Store.toJSON / persist', async (t) => {
  await t.test('toJSON shape matches the data contract', () => {
    const s = new Store(new FakeAdapter());
    s.entries = [new Entry({ id: 'e1', startTime: '09:00', endTime: '10:00', date: '2026-05-22', duration: 60, project: 'p' })];
    s.projects = ['p'];
    s.lastProject = 'p';
    s.pageSize = 10;
    const j = JSON.parse(JSON.stringify(s.toJSON()));
    assert.deepEqual(Object.keys(j).sort(), ['entries', 'lastProject', 'pageSize', 'projects']);
    assert.equal(j.entries.length, 1);
    assert.equal(j.entries[0].id, 'e1');
  });

  await t.test('persist() forwards to adapter.save', async () => {
    const adapter = new FakeAdapter();
    const s = new Store(adapter);
    s.projects = ['x'];
    await s.persist();
    assert.equal(adapter.saveCalls.length, 1);
    assert.deepEqual(adapter.saveCalls[0].projects, ['x']);
  });
});

test('Store.addEntry', async (t) => {
  await t.test('wraps a plain object as an Entry', () => {
    const s = new Store(new FakeAdapter());
    const e = s.addEntry({ project: 'p', startTime: '09:00', endTime: '10:00', date: '2026-05-22', duration: 60 });
    assert.ok(e instanceof Entry);
    assert.equal(s.entries.length, 1);
    assert.strictEqual(s.entries[0], e);
  });

  await t.test('passes an existing Entry instance through unchanged', () => {
    const s = new Store(new FakeAdapter());
    const e = new Entry({ id: 'fixed', project: 'p', startTime: '09:00', endTime: '10:00', date: '2026-05-22', duration: 60 });
    const returned = s.addEntry(e);
    assert.strictEqual(returned, e);
    assert.equal(s.entries[0].id, 'fixed');
  });
});

test('Store.deleteEntry / findEntry', async (t) => {
  const makeStore = () => {
    const s = new Store(new FakeAdapter());
    s.addEntry(new Entry({ id: 'a' }));
    s.addEntry(new Entry({ id: 'b' }));
    s.addEntry(new Entry({ id: 'c' }));
    return s;
  };

  await t.test('findEntry returns the matching entry', () => {
    const s = makeStore();
    assert.equal(s.findEntry('b').id, 'b');
  });

  await t.test('findEntry returns undefined when not found', () => {
    const s = makeStore();
    assert.equal(s.findEntry('zzz'), undefined);
  });

  await t.test('deleteEntry removes only the matching id', () => {
    const s = makeStore();
    s.deleteEntry('b');
    assert.deepEqual(s.entries.map(e => e.id), ['a', 'c']);
  });

  await t.test('deleteEntry on a missing id is a no-op', () => {
    const s = makeStore();
    s.deleteEntry('zzz');
    assert.equal(s.entries.length, 3);
  });
});

test('Store.ensureProject', async (t) => {
  await t.test('adds the project when missing', () => {
    const s = new Store(new FakeAdapter());
    s.ensureProject('Acme');
    assert.deepEqual(s.projects, ['Acme']);
  });

  await t.test('is a no-op when project already exists', () => {
    const s = new Store(new FakeAdapter());
    s.projects = ['Acme'];
    s.ensureProject('Acme');
    assert.deepEqual(s.projects, ['Acme']);
  });
});

test('Store.uniqueDescriptions', async (t) => {
  await t.test('returns unique non-empty descriptions, newest first', () => {
    const s = new Store(new FakeAdapter());
    s.entries = [
      new Entry({ id: '1', description: 'A' }),
      new Entry({ id: '2', description: 'B' }),
      new Entry({ id: '3', description: 'A' }),
      new Entry({ id: '4', description: 'C' }),
    ];
    assert.deepEqual(s.uniqueDescriptions(), ['C', 'A', 'B']);
  });

  await t.test('skips empty descriptions', () => {
    const s = new Store(new FakeAdapter());
    s.entries = [
      new Entry({ id: '1', description: '' }),
      new Entry({ id: '2', description: 'X' }),
      new Entry({ id: '3', description: '' }),
    ];
    assert.deepEqual(s.uniqueDescriptions(), ['X']);
  });

  await t.test('empty store returns empty list', () => {
    const s = new Store(new FakeAdapter());
    assert.deepEqual(s.uniqueDescriptions(), []);
  });
});

test('Store.nextSlotForDate', async (t) => {
  await t.test('returns 07:15–07:25 when no entries exist for that date', () => {
    const s = new Store(new FakeAdapter());
    assert.deepEqual(s.nextSlotForDate('2026-05-22'), { start: '07:15', end: '07:25' });
  });

  await t.test('chains from the latest endTime on the date, +10 minutes', () => {
    const s = new Store(new FakeAdapter());
    s.entries = [
      new Entry({ id: '1', date: '2026-05-22', startTime: '09:00', endTime: '10:00', duration: 60 }),
      new Entry({ id: '2', date: '2026-05-22', startTime: '10:30', endTime: '11:45', duration: 75 }),
      new Entry({ id: '3', date: '2026-05-21', startTime: '20:00', endTime: '22:00', duration: 120 }), // different date
    ];
    assert.deepEqual(s.nextSlotForDate('2026-05-22'), { start: '11:45', end: '11:55' });
  });

  await t.test('ignores other dates entirely', () => {
    const s = new Store(new FakeAdapter());
    s.entries = [
      new Entry({ id: '1', date: '2026-05-21', startTime: '14:00', endTime: '15:00', duration: 60 }),
    ];
    assert.deepEqual(s.nextSlotForDate('2026-05-22'), { start: '07:15', end: '07:25' });
  });
});
