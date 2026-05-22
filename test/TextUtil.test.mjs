import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TextUtil } from '../js/util/TextUtil.js';

test('TextUtil.escapeHtml', async (t) => {
  await t.test('escapes the five HTML-special characters', () => {
    assert.equal(TextUtil.escapeHtml('& < > "'), '&amp; &lt; &gt; &quot;');
  });

  await t.test('& is escaped first (no double-escape)', () => {
    assert.equal(TextUtil.escapeHtml('&lt;'), '&amp;lt;');
  });

  await t.test('passes through ordinary text untouched', () => {
    assert.equal(TextUtil.escapeHtml('Sprint planning'), 'Sprint planning');
    assert.equal(TextUtil.escapeHtml(''), '');
  });

  await t.test('coerces non-strings to strings', () => {
    assert.equal(TextUtil.escapeHtml(42), '42');
    assert.equal(TextUtil.escapeHtml(null), 'null');
    assert.equal(TextUtil.escapeHtml(undefined), 'undefined');
  });

  await t.test('does not touch single quotes (intentional — we always use "")', () => {
    assert.equal(TextUtil.escapeHtml("it's"), "it's");
  });
});

test('TextUtil.escapeReg', async (t) => {
  await t.test('escapes all regex metacharacters', () => {
    const meta = '.*+?^${}()|[]\\';
    const escaped = TextUtil.escapeReg(meta);
    for (const ch of meta) {
      assert.ok(escaped.includes('\\' + ch), `expected \\${ch} in escaped output`);
    }
  });

  await t.test('escaped value matches literally when used in RegExp', () => {
    const input = 'a.b+c?';
    const re = new RegExp(TextUtil.escapeReg(input));
    assert.ok(re.test('a.b+c?'));
    assert.ok(!re.test('aXb+c?'));
  });

  await t.test('passes through ordinary text untouched', () => {
    assert.equal(TextUtil.escapeReg('hello'), 'hello');
    assert.equal(TextUtil.escapeReg(''), '');
  });
});
