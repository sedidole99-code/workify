import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FsaAdapter } from '../js/storage/FsaAdapter.js';

function fakeHandle({ name = 'workify-data.json', text = '{}' } = {}) {
  const writes = [];
  return {
    handle: {
      name,
      async getFile() { return { async text() { return text; } }; },
      async createWritable() {
        return {
          async write(data) { writes.push(data); },
          async close() {},
        };
      },
    },
    writes,
  };
}

test('FsaAdapter', async (t) => {
  await t.test('name comes from the underlying handle, canChange is true', () => {
    const { handle } = fakeHandle({ name: 'my-data.json' });
    const a = new FsaAdapter(handle);
    assert.equal(a.name, 'my-data.json');
    assert.equal(a.canChange, true);
  });

  await t.test('load() reads the file and parses JSON', async () => {
    const { handle } = fakeHandle({ text: '{"entries":[],"projects":["X"]}' });
    const data = await new FsaAdapter(handle).load();
    assert.deepEqual(data, { entries: [], projects: ['X'] });
  });

  await t.test('load() returns null when file is empty / whitespace-only', async () => {
    const { handle: emptyHandle } = fakeHandle({ text: '' });
    assert.equal(await new FsaAdapter(emptyHandle).load(), null);

    const { handle: wsHandle } = fakeHandle({ text: '   \n  ' });
    assert.equal(await new FsaAdapter(wsHandle).load(), null);
  });

  await t.test('load() throws a helpful error when the file is corrupt JSON', async () => {
    const { handle } = fakeHandle({ text: '{ this is not json' });
    await assert.rejects(
      () => new FsaAdapter(handle).load(),
      /workify-data\.json/,
      'expected error to mention the file name',
    );
  });

  await t.test('save() writes pretty-printed JSON via the writable', async () => {
    const { handle, writes } = fakeHandle();
    await new FsaAdapter(handle).save({ projects: ['p'], entries: [] });
    assert.equal(writes.length, 1);
    const parsed = JSON.parse(writes[0]);
    assert.deepEqual(parsed, { projects: ['p'], entries: [] });
    assert.ok(writes[0].includes('\n'), 'expected pretty-printed (multi-line) JSON');
  });
});
