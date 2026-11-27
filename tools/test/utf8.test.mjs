// Run with: node --test "tools/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decodeUtf8 } from '../../src/api/utf8.js';

const bytes = (text) => new TextEncoder().encode(text);

test('well-formed text is read as it is', () => {
  const text = '{"name":"周杰伦 & Jay ①"}\n';

  assert.equal(decodeUtf8(bytes(text)), text);
});

test('a character cut short does not take the bytes after it', () => {
  // 得 is e5 be 97; the answer was cut after its second byte
  const cut = Uint8Array.from([
    ...bytes('{"intro":"值'),
    0xe5,
    0xbe,
    ...bytes('...","n":1}'),
  ]);

  assert.deepEqual(JSON.parse(decodeUtf8(cut)), { intro: '值�...', n: 1 });
});

test('bytes that begin no character are replaced one by one', () => {
  assert.equal(decodeUtf8(Uint8Array.from([0x61, 0xff, 0x80, 0x62])), 'a��b');
});

test('a character cut short at the very end is replaced', () => {
  assert.equal(decodeUtf8(Uint8Array.from([0x61, 0xe5, 0xbe])), 'a�');
});
