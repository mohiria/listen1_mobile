// Run with: node --test "tools/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const { isExcerpt } = await loadSource('src/api/excerpt.ts');

test('a song shorter than half a minute is an excerpt', () => {
  assert.equal(isExcerpt(13), true);
  assert.equal(isExcerpt(29.9), true);
  assert.equal(isExcerpt('13'), true);
});

test('a song of half a minute or more is not', () => {
  assert.equal(isExcerpt(30), false);
  assert.equal(isExcerpt(31), false);
  assert.equal(isExcerpt(269), false);
});

test('a song whose length is not known is kept', () => {
  assert.equal(isExcerpt(0), false);
  assert.equal(isExcerpt(undefined), false);
  assert.equal(isExcerpt(null), false);
  assert.equal(isExcerpt(''), false);
  assert.equal(isExcerpt(NaN), false);
});
