// Run with: node --test "tools/test/*.test.mjs"
// Needs the packages of tools/probe (npm install in tools/probe).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadState } from './load-state.mjs';

const { reducer, actions, createPlaybackDriver } = await loadState();

const song = (id) => ({ id, title: `title ${id}`, artist: `artist ${id}` });
const a = song('netrack_a');
const b = song('qqtrack_b');
const c = song('kgtrack_c');
const playlist = { info: { id: 'neplaylist_1' }, tracks: [a, b, c] };

const settle = () => new Promise((resolve) => setImmediate(resolve));

// A state layer, a recording player and a resolver the test controls.
function setup({ before = [], answers = {} } = {}) {
  let state = before.reduce(
    (current, action) => reducer(current, action),
    reducer(undefined, { type: '@@test/init' })
  );
  const listeners = new Set();
  const store = {
    getState: () => state,
    dispatch(action) {
      state = reducer(state, action);
      [...listeners].forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };

  const calls = [];
  const resolved = [];
  const notes = [];
  const world = { remaining: null, pending: new Map() };
  const player = {
    load: (item) => calls.push(['load', item.url]),
    setNext: (item) => calls.push(['next', item && item.url]),
    play: () => calls.push(['play']),
    pause: () => calls.push(['pause']),
    setRepeatOne: (on) => calls.push(['repeat', on]),
    remaining: () => world.remaining,
  };
  const items = [];
  const recording = {
    ...player,
    load(item) {
      items.push(item);
      player.load(item);
    },
    setNext(item) {
      if (item) {
        items.push(item);
      }
      player.setNext(item);
    },
  };

  // answers: id -> result, or 'wait' to answer later through world.answer
  const resolve = (track) => {
    resolved.push(track.id);

    const answer = answers[track.id];

    if (answer === 'wait') {
      return new Promise((done) => world.pending.set(track.id, done));
    }

    return Promise.resolve(
      answer || { url: `url:${track.id}`, source: 'own', switched: false }
    );
  };

  world.answer = (id, result) => world.pending.get(id)(result);

  const driver = createPlaybackDriver({
    store,
    player: recording,
    resolve,
    notify: (message) => notes.push(message),
  });

  return {
    store,
    driver,
    calls,
    resolved,
    notes,
    world,
    items,
    nowPlaying: () => state.playerState.nowplayingTrack.id,
    playerState: () => state.playerState,
    did: (name) => calls.filter(([call]) => call === name).map(([, x]) => x),
  };
}

const none = { url: '', reason: 'unavailable' };

test('a chosen song is resolved, loaded and played', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: b, playlist }));
  await settle();

  assert.deepEqual(t.did('load'), ['url:qqtrack_b']);
  assert.equal(t.did('play').length, 1);
  assert.equal(t.playerState().isPlaying, true);
});

test('the song left from the last run waits for the play button', async () => {
  const t = setup({
    before: [actions.playTrackInPlaylist({ track: b, playlist })],
  });

  await settle();
  assert.deepEqual(t.resolved, []);

  t.store.dispatch(actions.play());
  await settle();
  assert.deepEqual(t.did('load'), ['url:qqtrack_b']);
});

test('a song chosen while another is being resolved wins', async () => {
  const t = setup({ answers: { netrack_a: 'wait' } });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  t.store.dispatch(actions.playTrackInPlaylist({ track: b, playlist }));
  await settle();
  t.world.answer('netrack_a', {
    url: 'url:late',
    source: 'own',
    switched: false,
  });
  await settle();

  assert.deepEqual(t.did('load'), ['url:qqtrack_b']);
});

test('pause and play reach the player', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.store.dispatch(actions.pause());
  t.store.dispatch(actions.play());

  assert.deepEqual(
    t.calls.filter(([call]) => call === 'play' || call === 'pause'),
    [['play'], ['pause'], ['play']]
  );
});

test('the following song is resolved only near the end of the current one', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();

  t.world.remaining = 120;
  t.driver.tick();
  await settle();
  assert.deepEqual(t.did('next'), []);

  t.world.remaining = 40;
  t.driver.tick();
  t.driver.tick();
  await settle();
  assert.deepEqual(t.did('next'), ['url:qqtrack_b']);
  assert.deepEqual(t.resolved, ['netrack_a', 'qqtrack_b']);
});

test('when the player moves on by itself the state layer follows without loading again', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.world.remaining = 10;
  t.driver.tick();
  await settle();

  t.driver.onAdvanced(t.items.at(-1).mediaId);
  await settle();

  assert.equal(t.nowPlaying(), b.id);
  assert.deepEqual(t.did('load'), ['url:netrack_a']);

  // and the song after that is prepared in its turn
  t.driver.tick();
  await settle();
  assert.deepEqual(t.did('next'), ['url:qqtrack_b', 'url:kgtrack_c']);
});

test('in shuffle the prepared song is the one the state layer moves to', async () => {
  for (let round = 0; round < 5; round++) {
    const t = setup({ before: [actions.changePlayMode()] });

    t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
    await settle();
    t.world.remaining = 10;
    t.driver.tick();
    await settle();

    const prepared = t.items.at(-1);

    t.driver.onAdvanced(prepared.mediaId);
    await settle();

    assert.equal(prepared.url, `url:${t.nowPlaying()}`);
    assert.deepEqual(t.did('load'), ['url:netrack_a']);
  }
});

test('a change of the play queue replaces the prepared song', async () => {
  const d = song('kwtrack_d');
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.world.remaining = 10;
  t.driver.tick();
  await settle();

  t.store.dispatch(actions.addNextTrack(d));
  t.driver.tick();
  await settle();

  assert.deepEqual(t.did('next'), ['url:qqtrack_b', null, 'url:kwtrack_d']);
});

test('repeat one lets the player start the song over and prepares nothing', async () => {
  const t = setup({
    before: [actions.changePlayMode(), actions.changePlayMode()],
  });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.world.remaining = 10;
  t.driver.tick();
  await settle();

  assert.deepEqual(t.did('repeat'), [true]);
  assert.deepEqual(t.did('next'), []);

  // the next button still moves on
  t.store.dispatch(actions.nextTrack());
  await settle();
  assert.deepEqual(t.did('load'), ['url:netrack_a', 'url:qqtrack_b']);
});

test('a song that cannot be resolved is reported and skipped', async () => {
  const t = setup({ answers: { netrack_a: none } });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();

  assert.equal(t.notes.length, 1);
  assert.match(t.notes[0], /title netrack_a/);
  assert.equal(t.nowPlaying(), b.id);
  assert.deepEqual(t.did('load'), ['url:qqtrack_b']);
});

test('a network failure is reported as such', async () => {
  const t = setup({
    answers: { netrack_a: { url: '', reason: 'network' } },
  });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();

  assert.match(t.notes[0], /网络错误/);
});

test('playback stops once no song of the play queue can be resolved', async () => {
  const t = setup({
    answers: { netrack_a: none, qqtrack_b: none, kgtrack_c: none },
  });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  await settle();

  assert.equal(t.playerState().isPlaying, false);
  assert.deepEqual(t.did('load'), []);
  assert.ok(t.resolved.length <= 5, `resolved ${t.resolved.length} times`);
});

test('a following song that cannot be resolved is left for when its turn comes', async () => {
  const t = setup({ answers: { qqtrack_b: none } });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.world.remaining = 10;
  t.driver.tick();
  await settle();
  t.driver.tick();
  await settle();

  // asked once, not on every tick
  assert.deepEqual(t.resolved, ['netrack_a', 'qqtrack_b']);

  t.driver.onEnded();
  await settle();

  // its turn: reported, skipped, and the one after it plays
  assert.equal(t.notes.length, 1);
  assert.equal(t.nowPlaying(), c.id);
  assert.deepEqual(t.did('load'), ['url:netrack_a', 'url:kgtrack_c']);
});

test('a song that fails while playing is resolved once more, then skipped', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();

  t.driver.onError();
  await settle();
  assert.deepEqual(t.did('load'), ['url:netrack_a', 'url:netrack_a']);
  assert.equal(t.notes.length, 0);

  t.driver.onError();
  await settle();
  assert.equal(t.notes.length, 1);
  assert.equal(t.nowPlaying(), b.id);
});

test('the provider a song is played from is recorded when it is not its own', async () => {
  const t = setup({
    answers: { netrack_a: { url: 'url:other', source: 'qq', switched: true } },
  });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  assert.deepEqual(t.playerState().playingSource, {
    id: a.id,
    source: 'qq',
  });

  t.store.dispatch(actions.nextTrack());
  await settle();
  assert.equal(t.playerState().playingSource, null);
});

test('a pause made by the player itself reaches the state layer', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();

  // headphones were taken off: the player stopped without being told
  t.driver.onPlayingChanged(false);
  assert.equal(t.playerState().isPlaying, false);
  // it is paused already and is not told again
  assert.equal(t.did('pause').length, 0);

  t.store.dispatch(actions.play());
  assert.equal(t.did('play').length, 2);
});

test('a resume made by the player itself reaches the state layer', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.driver.onPlayingChanged(false);

  // a phone call ended and the player went on
  t.driver.onPlayingChanged(true);
  assert.equal(t.playerState().isPlaying, true);
  assert.equal(t.did('play').length, 1);

  t.store.dispatch(actions.pause());
  assert.equal(t.did('pause').length, 1);
});

test('the player doing as it was told changes nothing', async () => {
  const t = setup();

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.driver.onPlayingChanged(true);
  assert.equal(t.playerState().isPlaying, true);

  t.store.dispatch(actions.pause());
  t.driver.onPlayingChanged(false);
  assert.equal(t.playerState().isPlaying, false);
  assert.equal(t.did('pause').length, 1);
});

test('what the player reports while a song is being resolved is ignored', async () => {
  const t = setup({ answers: { qqtrack_b: 'wait' } });

  t.store.dispatch(actions.playTrackInPlaylist({ track: a, playlist }));
  await settle();
  t.store.dispatch(actions.playTrackInPlaylist({ track: b, playlist }));
  await settle();

  t.driver.onPlayingChanged(false);
  assert.equal(t.playerState().isPlaying, true);
});
