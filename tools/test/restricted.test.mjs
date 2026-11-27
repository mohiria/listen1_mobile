// Run with: node --test "tools/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const {
  neteaseIsRestricted,
  neteaseIsTrialClip,
  kugouIsRestricted,
  kuwoIsRestricted,
  kuwoIsPromptAudio,
  miguIsRestricted,
} = await loadSource('src/api/restricted.ts');

// The samples below are trimmed from real responses seen on 2026-11-26.

test('netease: a song the visitor may play in full is not restricted', () => {
  assert.equal(neteaseIsRestricted({ fee: 8, st: 0, pl: 320000, dl: 0 }), false);
  assert.equal(
    neteaseIsRestricted({ fee: 0, st: 0, pl: 128000, dl: 128000 }),
    false
  );
});

test('netease: a member-only song is restricted', () => {
  assert.equal(neteaseIsRestricted({ fee: 1, st: 0, pl: 0, dl: 0 }), true);
});

test('netease: a song taken off the shelf is restricted', () => {
  assert.equal(neteaseIsRestricted({ fee: 0, st: -200, pl: 0, dl: 0 }), true);
  assert.equal(neteaseIsRestricted({ fee: 0, st: -1, pl: 320000 }), true);
});

test('netease: a song without privilege data is not judged', () => {
  assert.equal(neteaseIsRestricted(undefined), false);
  assert.equal(neteaseIsRestricted(null), false);
});

test('netease: an address that only covers a trial clip is recognised', () => {
  assert.equal(
    neteaseIsTrialClip({
      url: 'http://m701.music.126.net/x.m4a',
      size: 481115,
      time: 30040,
      freeTrialInfo: { fragmentType: -1, start: 0, end: 30 },
    }),
    true
  );
  assert.equal(
    neteaseIsTrialClip({
      url: 'http://m701.music.126.net/y.m4a',
      size: 3885194,
      time: 319039,
      freeTrialInfo: null,
    }),
    false
  );
  assert.equal(neteaseIsTrialClip({ url: 'http://m701.music.126.net/z.m4a' }), false);
});

test('kugou: privilege 10 means the song needs payment', () => {
  assert.equal(kugouIsRestricted(10), true);
  assert.equal(kugouIsRestricted(0), false);
  assert.equal(kugouIsRestricted(8), false);
  assert.equal(kugouIsRestricted(undefined), false);
});

test('kuwo: a song that only offers a fragment is restricted', () => {
  assert.equal(
    kuwoIsRestricted({ tpay: '1', payInfo: { listen_fragment: '1', play: '1111' } }),
    true
  );
  assert.equal(
    kuwoIsRestricted({ tpay: '0', payInfo: { listen_fragment: '0', play: '1100' } }),
    false
  );
  assert.equal(kuwoIsRestricted({}), false);
});

test('kuwo: the fixed prompt clip is recognised whatever host and key it has', () => {
  assert.equal(
    kuwoIsPromptAudio(
      'https://kw-bj.kuwo.cn/f1d26ee9408826579e65ec7805649e5e/6b07e214/nf/resource/n1/69/32/588957081.mp3'
    ),
    true
  );
  assert.equal(
    kuwoIsPromptAudio(
      'https://other.kuwo.cn/92cb40bde21d8fb39c6da93a94bedbc3/6b07e831/nf/resource/n1/69/32/588957081.mp3'
    ),
    true
  );
});

test('kuwo: the address of a real song is not taken for the prompt clip', () => {
  assert.equal(
    kuwoIsPromptAudio(
      'https://kw-lw.kuwo.cn/e8d24a851a8404690e379d1e20e34181/6b07e214/resource/30106/trackmedia/M500001DgqrQ0gVkBQ.mp3'
    ),
    false
  );
});

test('migu: a song whose copyright is gone is restricted', () => {
  assert.equal(miguIsRestricted({ copyright: 0, chargeAuditions: '-1' }), true);
  assert.equal(miguIsRestricted({ copyright: '0' }), true);
});

test('migu: a member song the visitor still gets in 128k is not restricted', () => {
  assert.equal(miguIsRestricted({ copyright: 1, vipType: '1' }), false);
  assert.equal(miguIsRestricted({ copyright: 1, vipType: '' }), false);
});
