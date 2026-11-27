// Run with: node --test "tools/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const {
  createAggregateSearch,
  mergeSongs,
  takeInTurn,
} = await loadSource('src/api/aggregate.ts');

const song = (id, title, artist, disabled = false) => ({
  id,
  title,
  artist,
  disabled,
});

const ids = (songs) => songs.map((one) => one.id);

test('songs are taken in turn from each provider, in the order given', () => {
  const merged = mergeSongs([
    [song('ne1', '晴天', '周杰伦'), song('ne2', '稻香', '周杰伦')],
    [song('qq1', '七里香', '周杰伦'), song('qq2', '彩虹', '周杰伦')],
    [song('kw1', '夜曲', '周杰伦')],
  ]);

  assert.deepEqual(ids(merged), ['ne1', 'qq1', 'kw1', 'ne2', 'qq2']);
});

test('the same song from two providers is kept once, from the first one', () => {
  const merged = mergeSongs([
    [song('ne1', '晴天', '周杰伦')],
    [song('qq1', ' 晴天', '周杰伦;某人'), song('qq2', '稻香', '周杰伦')],
  ]);

  assert.deepEqual(ids(merged), ['ne1', 'qq2']);
});

test('a copy that is not restricted is kept over one that is', () => {
  const merged = mergeSongs([
    [song('ne1', '晴天', '周杰伦', true), song('ne2', '稻香', '周杰伦')],
    [song('qq1', '晴天', '周杰伦')],
  ]);

  // it takes the place of the copy it replaces
  assert.deepEqual(ids(merged), ['qq1', 'ne2']);
});

test('between two restricted copies the first provider is kept', () => {
  const merged = mergeSongs([
    [song('ne1', '晴天', '周杰伦', true)],
    [song('qq1', '晴天', '周杰伦', true)],
  ]);

  assert.deepEqual(ids(merged), ['ne1']);
});

test('an earlier provider wins even when its copy is further down its list', () => {
  const merged = mergeSongs([
    [song('ne1', '稻香', '周杰伦'), song('ne2', '晴天', '周杰伦')],
    [song('qq1', '晴天', '周杰伦')],
  ]);

  assert.deepEqual(ids(merged), ['ne1', 'ne2']);
});

test('the same song twice in one provider is kept once', () => {
  const merged = mergeSongs([
    [
      song('ne1', '晴天', '周杰伦', true),
      song('ne2', '晴天', '周杰伦'),
      song('ne3', '晴天', '周杰伦'),
    ],
  ]);

  assert.deepEqual(ids(merged), ['ne2']);
});

test('another version of a song is a song of its own', () => {
  const merged = mergeSongs([
    [song('ne1', '晴天', '周杰伦', true), song('ne2', '晴天 (Live)', '周杰伦')],
    [
      song('qq1', '晴天 (13秒片段)', '周杰伦'),
      song('qq2', '晴天（LIVE）', '周杰伦'),
      song('qq3', '晴天 (DJ版)', '周杰伦'),
    ],
  ]);

  // the two live takes are one; the restricted original is not replaced
  assert.deepEqual(ids(merged), ['ne1', 'qq1', 'ne2', 'qq3']);
});

test('songs already on show are left alone and not repeated', () => {
  const shown = [song('ne1', '晴天', '周杰伦', true)];
  const merged = mergeSongs(
    [[song('qq1', '晴天', '周杰伦'), song('qq2', '稻香', '周杰伦')]],
    shown
  );

  assert.deepEqual(ids(merged), ['qq2']);
});

test('songs without a title or an artist are only merged by id', () => {
  const merged = mergeSongs([
    [song('ne1', '', '周杰伦'), song('ne1', '', '周杰伦')],
    [song('qq1', '', '周杰伦')],
  ]);

  assert.deepEqual(ids(merged), ['ne1', 'qq1']);
});

// A provider stand-in. pages are what it answers page by page; an Error in
// their place makes that request fail once, and the page is then served.
function provider(name, pages, total) {
  const calls = [];
  const left = pages.slice();

  return {
    name,
    calls,
    search(keyword, page) {
      calls.push([keyword, page]);

      const answer = left[page - 1];

      if (answer instanceof Error) {
        left[page - 1] = pages.filter((one) => !(one instanceof Error))[0] || [];

        return Promise.reject(answer);
      }

      return Promise.resolve({ result: answer || [], total });
    },
  };
}

test('the first call asks every provider for its first page', async () => {
  const netease = provider('netease', [[song('ne1', '晴天', '周杰伦')]]);
  const qq = provider('qq', [[song('qq1', '稻香', '周杰伦')]]);
  const found = await createAggregateSearch([netease, qq], '周杰伦').more();

  assert.deepEqual(ids(found.tracks), ['ne1', 'qq1']);
  assert.deepEqual(found.failed, []);
  assert.equal(found.done, false);
  assert.deepEqual(netease.calls, [['周杰伦', 1]]);
  assert.deepEqual(qq.calls, [['周杰伦', 1]]);
});

test('each further call adds the next page of every provider', async () => {
  const netease = provider('netease', [
    [song('ne1', '晴天', '周杰伦')],
    [song('ne2', '稻香', '周杰伦')],
  ]);
  const qq = provider('qq', [
    [song('qq1', '七里香', '周杰伦')],
    [song('qq2', '晴天', '周杰伦')],
  ]);
  const search = createAggregateSearch([netease, qq], '周杰伦');

  await search.more();
  const found = await search.more();

  // qq2 is the song already shown as ne1
  assert.deepEqual(ids(found.tracks), ['ne1', 'qq1', 'ne2']);
});

test('a provider that has given all its songs is not asked again', async () => {
  const netease = provider('netease', [[song('ne1', '晴天', '周杰伦')]], 1);
  const qq = provider(
    'qq',
    [[song('qq1', '稻香', '周杰伦')], [song('qq2', '彩虹', '周杰伦')]],
    2
  );
  const search = createAggregateSearch([netease, qq], '周杰伦');

  assert.equal((await search.more()).done, false);

  const found = await search.more();

  assert.equal(found.done, true);
  assert.deepEqual(ids(found.tracks), ['ne1', 'qq1', 'qq2']);
  assert.equal(netease.calls.length, 1);

  await search.more();
  assert.equal(qq.calls.length, 2);
});

test('an empty page ends a provider whatever its total says', async () => {
  const netease = provider('netease', [[song('ne1', '晴天', '周杰伦')]], 99);
  const search = createAggregateSearch([netease], '周杰伦');

  await search.more();

  assert.equal((await search.more()).done, true);
});

test('a provider that repeats a page is taken as ended', async () => {
  const page = [song('ne1', '晴天', '周杰伦')];
  const netease = provider('netease', [page, page, page]);
  const search = createAggregateSearch([netease], '周杰伦');

  await search.more();

  const found = await search.more();

  assert.equal(found.done, true);
  assert.deepEqual(ids(found.tracks), ['ne1']);
});

test('a provider that fails is named and the others are still shown', async () => {
  const netease = provider('netease', [new Error('timeout')]);
  const qq = provider('qq', [[song('qq1', '稻香', '周杰伦')]]);
  const found = await createAggregateSearch([netease, qq], '周杰伦').more();

  assert.deepEqual(ids(found.tracks), ['qq1']);
  assert.deepEqual(found.failed, ['netease']);
  assert.equal(found.done, false);
});

test('the next call asks a failed provider for the same page again', async () => {
  const netease = provider('netease', [
    new Error('timeout'),
    [song('ne1', '晴天', '周杰伦')],
  ]);
  const qq = provider('qq', [[song('qq1', '稻香', '周杰伦')]], 1);
  const search = createAggregateSearch([netease, qq], '周杰伦');

  await search.more();

  const found = await search.more();

  assert.deepEqual(netease.calls, [
    ['周杰伦', 1],
    ['周杰伦', 1],
  ]);
  assert.deepEqual(found.failed, []);
  assert.deepEqual(ids(found.tracks), ['qq1', 'ne1']);
});

test('when every provider fails nothing is shown and all are named', async () => {
  const netease = provider('netease', [new Error('timeout')]);
  const qq = provider('qq', [new Error('timeout')]);
  const found = await createAggregateSearch([netease, qq], '周杰伦').more();

  assert.deepEqual(found.tracks, []);
  assert.deepEqual(found.failed, ['netease', 'qq']);
  assert.equal(found.done, false);
});

test('pages that bring nothing new are passed over in the same call', async () => {
  const netease = provider('netease', [
    [song('ne1', '晴天', '周杰伦')],
    [song('ne2', '晴 天', '周杰伦')],
    [song('ne3', '稻香', '周杰伦')],
  ]);
  const search = createAggregateSearch([netease], '周杰伦');

  await search.more();

  const found = await search.more();

  assert.deepEqual(ids(found.tracks), ['ne1', 'ne3']);
  assert.equal(netease.calls.length, 3);
});

test('taking in turn keeps every item, alike or not', () => {
  const taken = takeInTurn([
    [song('ne1', '周杰伦', ''), song('ne2', '周杰伦', '')],
    [],
    [song('kw1', '周杰伦', '')],
  ]);

  assert.deepEqual(ids(taken), ['ne1', 'kw1', 'ne2']);
});

test('a search can merge its pages by taking in turn', async () => {
  const netease = provider('netease', [[song('ne1', '周杰伦精选', '')]], 1);
  const qq = provider('qq', [
    [song('qq1', '周杰伦精选', ''), song('qq2', '周杰伦全集', '')],
    [],
  ]);
  const search = createAggregateSearch([netease, qq], '周杰伦', takeInTurn);
  const first = await search.more();

  assert.deepEqual(ids(first.tracks), ['ne1', 'qq1', 'qq2']);
  assert.equal(first.done, false);

  const second = await search.more();

  assert.deepEqual(ids(second.tracks), ['ne1', 'qq1', 'qq2']);
  assert.equal(second.done, true);
});
