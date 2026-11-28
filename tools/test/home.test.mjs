import test from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const { createHomeData } = await loadSource('app/homeData.ts');

const charts = [
  { id: 'nechart_1', kind: 'hot' },
  { id: 'nechart_2', kind: 'new' },
  { id: 'qqchart_1', kind: 'hot' },
];
const playlistOf = id => ({
  info: { id, title: id, cover_img_url: `http://cover/${id}` },
  tracks: [{ id: `${id}-a`, title: `first of ${id}`, img_url: `http://song/${id}` }],
});

// A source whose requests are counted and can be made to fail by id.
function source(failing = new Set()) {
  const asked = [];

  return {
    asked,
    failing,
    charts,
    platformIds: ['ne', 'qq'],
    getPlaylist(id) {
      asked.push(id);

      return failing.has(id)
        ? Promise.reject(new Error(`no ${id}`))
        : Promise.resolve(playlistOf(id));
    },
    showPlaylist(offset, platformId) {
      asked.push(platformId);

      return failing.has(platformId)
        ? Promise.reject(new Error(`no ${platformId}`))
        : Promise.resolve({
            result: [{ id: `${platformId}playlist_1`, title: platformId }],
          });
    },
  };
}

test('a load gets what leads every chart and a playlist of each provider', async () => {
  const home = createHomeData(source());

  await home.load();
  const state = home.getState();

  assert.deepEqual(state.leads.nechart_1, {
    song: 'first of nechart_1',
    cover: 'http://song/nechart_1',
  });
  assert.deepEqual(Object.keys(state.leads).sort(), ['nechart_1', 'nechart_2', 'qqchart_1']);
  assert.deepEqual(state.recommended.map(info => info.id), ['neplaylist_1', 'qqplaylist_1']);
  assert.equal(state.loading, false);
  assert.deepEqual(state.failed, []);
});

test('the chart gives its own cover where the leading song has no picture', async () => {
  const from = source();

  from.getPlaylist = id =>
    Promise.resolve({ ...playlistOf(id), tracks: [{ id: 'a', title: 't', img_url: '' }] });
  const home = createHomeData(from);

  await home.load();
  assert.equal(home.getState().leads.qqchart_1.cover, 'http://cover/qqchart_1');
});

test('what fails is named with its reason, and the rest is still shown', async () => {
  const home = createHomeData(source(new Set(['nechart_2', 'qq'])));

  await home.load();
  const state = home.getState();

  assert.deepEqual(state.failed.sort(), ['nechart_2', 'qq']);
  assert.match(state.error, /no (nechart_2|qq)/);
  assert.deepEqual(Object.keys(state.leads).sort(), ['nechart_1', 'qqchart_1']);
  assert.deepEqual(state.recommended.map(info => info.id), ['neplaylist_1']);
});

test('the next load asks only for what is missing', async () => {
  const from = source(new Set(['nechart_2', 'qq']));
  const home = createHomeData(from);

  await home.load();
  from.failing.clear();
  from.asked.length = 0;
  await home.load();

  assert.deepEqual(from.asked.sort(), ['nechart_2', 'qq']);
  assert.deepEqual(home.getState().failed, []);
  assert.equal(home.getState().recommended.length, 2);
});

test('a load of everything asks again and keeps what is shown meanwhile', async () => {
  const from = source();
  const home = createHomeData(from);

  await home.load();
  from.asked.length = 0;
  const loading = home.load(true);

  assert.equal(home.getState().loading, true);
  assert.equal(Object.keys(home.getState().leads).length, 3);
  await loading;
  assert.equal(from.asked.length, 5);
});

test('listeners hear of every change, and a second load while loading does nothing', async () => {
  const from = source();
  const home = createHomeData(from);
  let heard = 0;
  const stop = home.subscribe(() => {
    heard += 1;
  });

  await Promise.all([home.load(), home.load()]);
  assert.equal(from.asked.length, 5);
  assert.ok(heard >= 5);
  stop();
  heard = 0;
  await home.load(true);
  assert.equal(heard, 0);
});

test('a provider gets one request at a time', async () => {
  const from = source();
  let open = 0;
  let most = 0;

  from.getPlaylist = id => {
    if (id.startsWith('ne')) {
      open += 1;
      most = Math.max(most, open);
    }

    return new Promise(resolve =>
      setTimeout(() => {
        if (id.startsWith('ne')) {
          open -= 1;
        }
        resolve(playlistOf(id));
      }, 5)
    );
  };
  await createHomeData(from).load();

  assert.equal(most, 1);
});
