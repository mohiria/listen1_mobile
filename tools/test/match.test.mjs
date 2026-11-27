// Run with: node --test "tools/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const { isSameSong } = await loadSource('src/api/match.ts');

const song = (title, artist) => ({ title, artist });

test('songs with the same title and artist are the same song', () => {
  assert.equal(isSameSong(song('晴天', '周杰伦'), song('晴天', '周杰伦')), true);
});

test('a different title or a different artist is a different song', () => {
  assert.equal(isSameSong(song('晴天', '周杰伦'), song('阴天', '周杰伦')), false);
  assert.equal(isSameSong(song('晴天', '周杰伦'), song('晴天', '刘瑞琦')), false);
});

test('letter case and whitespace do not matter', () => {
  assert.equal(
    isSameSong(song('Shape of You', 'Ed Sheeran'), song('shape of  you', 'ED SHEERAN ')),
    true
  );
  assert.equal(isSameSong(song('Mojito', '周杰伦'), song('MOJITO', '周 杰伦')), true);
});

test('full-width and half-width forms of a character are the same', () => {
  assert.equal(isSameSong(song('ＡＢＣ', 'Ｓ．Ｈ．Ｅ'), song('abc', 's.h.e')), true);
});

test('a version note in brackets does not matter', () => {
  const plain = song('晴天', '周杰伦');

  assert.equal(isSameSong(plain, song('晴天 (Live)', '周杰伦')), true);
  assert.equal(isSameSong(plain, song('晴天（2003 叶惠美版）', '周杰伦')), true);
  assert.equal(isSameSong(plain, song('晴天[Remastered]', '周杰伦')), true);
  assert.equal(isSameSong(plain, song('晴天【电影《不能说的秘密》插曲】', '周杰伦')), true);
  assert.equal(isSameSong(plain, song('晴天', '周杰伦 (Jay Chou)')), true);
});

test('text outside the brackets still has to match', () => {
  assert.equal(isSameSong(song('晴天 (Live)', '周杰伦'), song('阴天 (Live)', '周杰伦')), false);
});

test('a title that is nothing but a bracket is compared as written', () => {
  assert.equal(isSameSong(song('（无题）', '陈奕迅'), song('(无题)', '陈奕迅')), true);
  assert.equal(isSameSong(song('（无题）', '陈奕迅'), song('（序曲）', '陈奕迅')), false);
});

test('nested brackets are dropped together', () => {
  assert.equal(
    isSameSong(song('晴天 (Live (2019 嘉年华))', '周杰伦'), song('晴天', '周杰伦')),
    true
  );
});

test('a song missing its title or artist matches nothing', () => {
  assert.equal(isSameSong(song('', ''), song('', '')), false);
  assert.equal(isSameSong(song('晴天', ''), song('晴天', '')), false);
  assert.equal(isSameSong(song(undefined, '周杰伦'), song(undefined, '周杰伦')), false);
  assert.equal(isSameSong(song('晴天', null), song('晴天', null)), false);
});

// Providers disagree on how they report a song with several artists: 网易 gives
// only the first one, QQ joins them with ";", 酷我 with "&", 酷狗 with "、".
test('songs by several artists are compared by the first artist', () => {
  const first = song('千里之外', '周杰伦');

  assert.equal(isSameSong(first, song('千里之外', '周杰伦;费玉清')), true);
  assert.equal(isSameSong(first, song('千里之外', '周杰伦&费玉清')), true);
  assert.equal(isSameSong(first, song('千里之外', '周杰伦、费玉清')), true);
  assert.equal(isSameSong(first, song('千里之外', '周杰伦；费玉清')), true);
  assert.equal(isSameSong(first, song('千里之外', '费玉清&周杰伦')), false);
  assert.equal(
    isSameSong(song('不老梦', '银临&Aki阿杰'), song('不老梦', '银临;Aki阿杰')),
    true
  );
});
