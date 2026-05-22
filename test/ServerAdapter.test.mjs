import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServerAdapter } from '../js/storage/ServerAdapter.js';

function withFetchMock(t, impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  t.after(() => { globalThis.fetch = original; });
}

test('ServerAdapter', async (t) => {
  await t.test('name is data.json, canChange is false', () => {
    const a = new ServerAdapter();
    assert.equal(a.name, 'data.json');
    assert.equal(a.canChange, false);
  });

  await t.test('load() returns parsed JSON on 200', async (t) => {
    withFetchMock(t, async (url, opts) => {
      assert.equal(url, '/api/data');
      assert.equal(opts.method, 'GET');
      return { ok: true, status: 200, json: async () => ({ entries: [], projects: ['X'] }) };
    });
    const data = await new ServerAdapter().load();
    assert.deepEqual(data, { entries: [], projects: ['X'] });
  });

  await t.test('load() throws on non-OK response', async (t) => {
    withFetchMock(t, async () => ({ ok: false, status: 500 }));
    await assert.rejects(() => new ServerAdapter().load(), /Failed to load: 500/);
  });

  await t.test('save() PUTs JSON body with content-type', async (t) => {
    let captured = null;
    withFetchMock(t, async (url, opts) => {
      captured = { url, opts };
      return { ok: true, status: 204 };
    });
    await new ServerAdapter().save({ projects: ['p'] });
    assert.equal(captured.url, '/api/data');
    assert.equal(captured.opts.method, 'PUT');
    assert.equal(captured.opts.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(captured.opts.body), { projects: ['p'] });
  });

  await t.test('save() throws on non-OK response', async (t) => {
    withFetchMock(t, async () => ({ ok: false, status: 500 }));
    await assert.rejects(() => new ServerAdapter().save({}), /Failed to save: 500/);
  });

  await t.test('load() propagates network errors', async (t) => {
    withFetchMock(t, async () => { throw new Error('connection refused'); });
    await assert.rejects(() => new ServerAdapter().load(), /connection refused/);
  });
});
