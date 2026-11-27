// Run with: node --test "tools/test/*.test.mjs"
// Needs the packages of tools/probe (npm install in tools/probe).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadState } from './load-state.mjs';

const { reducer, actions, StateJsonConvert } = await loadState();

const song = (id) => ({ id, title: `title ${id}`, artist: `artist ${id}` });
const a = song('netrack_a');
const b = song('qqtrack_b');
const c = song('kgtrack_c');
const playlist = { info: { id: 'neplaylist_1' }, tracks: [a, b, c] };

// Applies the actions in order to a fresh state.
function after(...list) {
  return list.reduce(
    (state, action) => reducer(state, action),
    reducer(undefined, { type: '@@test/init' })
  );
}

const nowPlaying = (state) =>
  state.playerState.nowplayingTrack && state.playerState.nowplayingTrack.id;
const queue = (state) => state.playerState.tracks.map((track) => track.id);

test('playing a song from a playlist makes the playlist the play queue', () => {
  const state = after(actions.playTrackInPlaylist({ track: b, playlist }));

  assert.deepEqual(queue(state), [a.id, b.id, c.id]);
  assert.equal(nowPlaying(state), b.id);
});

test('playing a single song adds it to the end of the play queue once', () => {
  const d = song('kwtrack_d');
  const state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.playTrack(d),
    actions.playTrack(d)
  );

  assert.deepEqual(queue(state), [a.id, b.id, c.id, d.id]);
  assert.equal(nowPlaying(state), d.id);
});

test('next and previous walk the play queue in order and wrap around', () => {
  const start = actions.playTrackInPlaylist({ track: b, playlist });

  assert.equal(nowPlaying(after(start, actions.nextTrack())), c.id);
  assert.equal(
    nowPlaying(after(start, actions.nextTrack(), actions.nextTrack())),
    a.id
  );
  assert.equal(nowPlaying(after(start, actions.prevTrack())), a.id);
  assert.equal(
    nowPlaying(after(start, actions.prevTrack(), actions.prevTrack())),
    c.id
  );
});

test('the play mode cycles through loop, shuffle and repeat one', () => {
  const mode = (state) => state.playerState.playMode;

  assert.equal(mode(after()), 0);
  assert.equal(mode(after(actions.changePlayMode())), 1);
  assert.equal(
    mode(after(actions.changePlayMode(), actions.changePlayMode())),
    2
  );
  assert.equal(
    mode(
      after(
        actions.changePlayMode(),
        actions.changePlayMode(),
        actions.changePlayMode()
      )
    ),
    0
  );
});

test('shuffle plays every song of the play queue once before repeating', () => {
  let state = after(
    actions.changePlayMode(),
    actions.playTrackInPlaylist({ track: a, playlist })
  );
  const heard = [nowPlaying(state)];

  state = reducer(state, actions.nextTrack());
  heard.push(nowPlaying(state));
  state = reducer(state, actions.nextTrack());
  heard.push(nowPlaying(state));

  assert.deepEqual([...heard].sort(), [a.id, b.id, c.id].sort());
  assert.deepEqual(queue(state), [a.id, b.id, c.id]);
});

test('a song put next is played right after the current one', () => {
  const d = song('kwtrack_d');
  const state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.addNextTrack(d),
    actions.nextTrack()
  );

  assert.deepEqual(queue(state), [a.id, d.id, b.id, c.id]);
  assert.equal(nowPlaying(state), d.id);
});

test('a song of the play queue put next moves there instead of appearing twice', () => {
  const state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.addNextTrack(c)
  );

  assert.deepEqual(queue(state), [a.id, c.id, b.id]);
  assert.equal(nowPlaying(state), a.id);
});

test('putting the current song next changes nothing', () => {
  const state = after(
    actions.playTrackInPlaylist({ track: b, playlist }),
    actions.addNextTrack(b)
  );

  assert.deepEqual(queue(state), [a.id, b.id, c.id]);
  assert.equal(nowPlaying(state), b.id);
});

test('in shuffle a song put next is the one shuffle moves to', () => {
  const d = song('kwtrack_d');
  const state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.changePlayMode(),
    actions.addNextTrack(d),
    actions.addNextTrack(c),
    actions.nextTrack()
  );

  assert.equal(nowPlaying(state), c.id);
  assert.deepEqual(queue(state).sort(), [a.id, b.id, c.id, d.id].sort());
});

test('with no current song, a song put next becomes the current one', () => {
  const state = after(actions.addNextTrack(a));

  assert.deepEqual(queue(state), [a.id]);
  assert.equal(nowPlaying(state), a.id);
});

test('a removed song leaves the play queue', () => {
  const state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.removeTrack(b)
  );

  assert.deepEqual(queue(state), [a.id, c.id]);
});

test('next and previous keep the current song once the play queue is empty', () => {
  const start = [
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.removeTrack(a),
    actions.removeTrack(b),
    actions.removeTrack(c),
  ];

  assert.equal(nowPlaying(after(...start, actions.nextTrack())), a.id);
  assert.equal(nowPlaying(after(...start, actions.prevTrack())), a.id);
});

test('a song that fails to load is skipped', () => {
  const state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.loadFail()
  );

  assert.equal(nowPlaying(state), b.id);
  assert.equal(state.playerState.isPlaying, true);
});

test('the player stops once every song of the play queue has failed', () => {
  const state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.play(),
    actions.loadFail(),
    actions.loadFail(),
    actions.loadFail(),
    actions.loadFail()
  );

  assert.equal(state.playerState.isPlaying, false);
});

test('a favourite is added once and can be taken back', () => {
  const favourites = (state) =>
    state.myPlaylistState.myPlaylistDict.myplaylist_favorite.tracks.map(
      (track) => track.id
    );
  const added = after(
    actions.addToMyFavorite(a),
    actions.addToMyFavorite(b),
    actions.addToMyFavorite(a)
  );

  assert.deepEqual(favourites(added), [a.id, b.id]);
  assert.deepEqual(
    favourites(reducer(added, actions.removeFromMyFavorite(a))),
    [b.id]
  );
});

test('a new playlist of mine holds songs from several providers, each once', () => {
  let state = after(
    actions.createMyPlaylist({
      info: { title: '通勤', cover_img_url: 'http://example.invalid/c.jpg' },
      tracks: [],
    })
  );
  const mine = state.myPlaylistState.playlists.find(
    (info) => info.title === '通勤'
  );

  for (const track of [a, b, a]) {
    state = reducer(
      state,
      actions.addToMyPlaylist({ track, playlist: mine })
    );
  }

  assert.match(mine.id, /^myplaylist_/);
  assert.deepEqual(
    state.myPlaylistState.myPlaylistDict[mine.id].tracks.map((t) => t.id),
    [a.id, b.id]
  );
});

test('exported data restores the play queue, favourites and my playlists', () => {
  let state = after(
    actions.playTrackInPlaylist({ track: a, playlist }),
    actions.addToMyFavorite(c),
    actions.createMyPlaylist({
      info: { title: '通勤', cover_img_url: 'http://example.invalid/c.jpg' },
      tracks: [b],
    })
  );
  const exported = JSON.parse(JSON.stringify(StateJsonConvert.getJson(state)));

  // the file layout other Listen 1 clients read
  assert.deepEqual(
    exported['current-playing'].map((track) => track.id),
    [a.id, b.id, c.id]
  );
  assert.equal(exported.playerlists[0], 'myplaylist_favorite');
  assert.equal(exported.myplaylist_favorite.is_mine, 1);

  state = reducer(
    after(),
    actions.recoverData(StateJsonConvert.getState(exported))
  );

  assert.deepEqual(queue(state), [a.id, b.id, c.id]);
  assert.deepEqual(Object.keys(state.myPlaylistState.myFavoriteIds), [c.id]);
  assert.deepEqual(
    state.myPlaylistState.playlists.map((info) => info.title),
    ['我喜欢的音乐', '通勤']
  );

  const restored = state.myPlaylistState.playlists.find(
    (info) => info.title === '通勤'
  );

  assert.deepEqual(
    state.myPlaylistState.myPlaylistDict[restored.id].tracks.map((t) => t.id),
    [b.id]
  );
});
