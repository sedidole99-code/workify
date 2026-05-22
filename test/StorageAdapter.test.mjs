import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StorageAdapter } from '../js/storage/StorageAdapter.js';

test('StorageAdapter (base class)', async (t) => {
  await t.test('load() throws "not implemented"', async () => {
    const a = new StorageAdapter();
    await assert.rejects(() => a.load(), /not implemented/);
  });

  await t.test('save() throws "not implemented"', async () => {
    const a = new StorageAdapter();
    await assert.rejects(() => a.save({}), /not implemented/);
  });

  await t.test('default name is empty string, canChange is true', () => {
    const a = new StorageAdapter();
    assert.equal(a.name, '');
    assert.equal(a.canChange, true);
  });
});
