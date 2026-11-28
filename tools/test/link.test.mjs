import test from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const { parsePlaylistLink } = await loadSource('src/api/link.ts');
const idOf = text => {
  const parsed = parsePlaylistLink(text);

  return parsed === null ? null : parsed.id;
};

test('Netease links, from the site, the phone pages and the app', () => {
  assert.equal(idOf('https://music.163.com/#/playlist?id=18480969427'), 'neplaylist_18480969427');
  assert.equal(idOf('http://music.163.com/playlist?id=123&userid=1'), 'neplaylist_123');
  assert.equal(idOf('https://music.163.com/playlist/123/?userid=1'), 'neplaylist_123');
  assert.equal(idOf('https://y.music.163.com/m/playlist?id=123&creatorId=9'), 'neplaylist_123');
  assert.equal(idOf('https://music.163.com/m/playlist?app_version=9&id=123'), 'neplaylist_123');
  assert.equal(idOf('https://music.163.com/#/my/m/music/playlist?id=123'), 'neplaylist_123');
});

test('QQ links', () => {
  assert.equal(idOf('https://y.qq.com/n/yqq/playlist/7707261125.html'), 'qqplaylist_7707261125');
  assert.equal(idOf('https://y.qq.com/n/ryqq/playlist/7707261125'), 'qqplaylist_7707261125');
  assert.equal(idOf('https://y.qq.com/n/yqq/playsquare/123.html'), 'qqplaylist_123');
  assert.equal(idOf('https://y.qq.com/n/m/detail/taoge/index.html?id=123'), 'qqplaylist_123');
  assert.equal(
    idOf('https://i.y.qq.com/n2/m/share/details/taoge.html?hosteuin=x&id=123&appversion=1'),
    'qqplaylist_123'
  );
  assert.equal(idOf('http://y.qq.com/#type=taoge&id=123'), 'qqplaylist_123');
});

test('Kugou links', () => {
  assert.equal(idOf('https://www.kugou.com/yy/special/single/3671576.html'), 'kgplaylist_3671576');
  assert.equal(idOf('https://m.kugou.com/plist/list/3671576'), 'kgplaylist_3671576');
});

test('Kuwo links', () => {
  assert.equal(idOf('https://www.kuwo.cn/playlist_detail/3704399205'), 'kwplaylist_3704399205');
  assert.equal(idOf('http://www.kuwo.cn/playlist/index?pid=3704399205'), 'kwplaylist_3704399205');
  assert.equal(idOf('https://m.kuwo.cn/h5app/playlist/3704399205'), 'kwplaylist_3704399205');
  assert.equal(idOf('https://m.kuwo.cn/newh5app/playlist_detail/3704399205'), 'kwplaylist_3704399205');
});

test('Migu links', () => {
  assert.equal(idOf('https://music.migu.cn/v3/music/playlist/148328706'), 'mgplaylist_148328706');
  assert.equal(
    idOf('https://h5.nf.migu.cn/app/v4/p/share/playlist/index.html?id=148328706&channel=x'),
    'mgplaylist_148328706'
  );
});

test('the link is found among the other words an app shares', () => {
  assert.equal(
    idOf('分享歌单: 通勤 https://music.163.com/m/playlist?id=123 (来自@网易云音乐)'),
    'neplaylist_123'
  );
});

test('what is not a link to a playlist gives null', () => {
  assert.equal(idOf(''), null);
  assert.equal(idOf('随便一段文字'), null);
  assert.equal(idOf('https://music.163.com/#/song?id=123'), null);
  assert.equal(idOf('https://music.163.com/#/playlist?id='), null);
  assert.equal(idOf('https://y.qq.com/n/ryqq/songDetail/003abc'), null);
  // a short link only redirects; following it would take a request
  assert.equal(idOf('https://c6.y.qq.com/base/fcgi-bin/u?__=abcd'), null);
});
