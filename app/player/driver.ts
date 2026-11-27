// Keeps the native player in step with the state layer. The play queue and
// the play mode live in the state layer; the native player only ever holds the
// song being played and, near its end, the song that follows.
import type { ResolveResult, Track } from '../../src/api/client';
import {
  loadFail,
  nextTrack,
  pause,
  play,
  updatePlayer,
} from '../../src/redux/actions';
import { peekNextTrack } from '../../src/redux/player.reducer';
import type { PlayerState, RootState } from '../../src/redux/store';

export type PlayerItem = {
  // unique per load, so that the same song loaded twice can be told apart
  mediaId: string;
  url: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
};

// What the driver needs from the native player.
export type PlayerPort = {
  // Plays this item in place of whatever is loaded.
  load(item: PlayerItem): void;
  // Puts the item right after the current one, or takes it away with null.
  setNext(item: PlayerItem | null): void;
  play(): void;
  pause(): void;
  // Whether the current item starts over when it ends.
  setRepeatOne(on: boolean): void;
  // Seconds left of the current item, or null while that is unknown.
  remaining(): number | null;
};

export type DriverOptions = {
  store: {
    getState(): RootState;
    dispatch(action: { type: string }): unknown;
    subscribe(listener: () => void): () => void;
  };
  player: PlayerPort;
  resolve(track: Track): Promise<ResolveResult>;
  // Tells the user that a song could not be played.
  notify(message: string): void;
  // How many seconds before the end of a song the next one is resolved.
  prepareAhead?: number;
};

export type PlaybackDriver = {
  // Call every couple of seconds while the app runs.
  tick(): void;
  // The player moved on by itself to the item given to setNext.
  onAdvanced(mediaId: string): void;
  // The player ran out of items.
  onEnded(): void;
  // The current item failed while playing.
  onError(): void;
  // The player stopped or went on by itself: headphones were taken off,
  // another app took the sound, a phone call came in or ended.
  onPlayingChanged(playing: boolean): void;
  stop(): void;
};

// The song that follows the current one when it ends by itself: a track,
// 'repeat' when the current one starts over, or null when there is none.
function upcoming(state: PlayerState): Track | 'repeat' | null {
  const current = state.nowplayingTrack;

  if (current === null || current === undefined) {
    return null;
  }
  if (state.playMode === 2) {
    return 'repeat';
  }

  const following = peekNextTrack(state);

  if (following === null || following === undefined) {
    return null;
  }

  return following.id === current.id ? 'repeat' : following;
}

function failureMessage(track: Track, result: ResolveResult) {
  return 'reason' in result && result.reason === 'network'
    ? `网络错误，无法播放「${track.title}」`
    : `「${track.title}」在所有音源都没有可播放的版本`;
}

export function createPlaybackDriver({
  store,
  player,
  resolve,
  notify,
  prepareAhead = 45,
}: DriverOptions): PlaybackDriver {
  const playerState = () => store.getState().playerState;

  let sequence = 0;
  // the song the player holds or is about to hold
  let activeId: string | null = null;
  // whether that song has reached the player
  let loaded = false;
  let loadToken = 0;
  // the song handed to the player to follow the current one
  let next: {
    id: string;
    mediaId: string;
    source: { id: string; source: string } | null;
  } | null = null;
  let preparingId: string | null = null;
  let prepareToken = 0;
  // a following song that could not be resolved is not tried again and again
  let unpreparableId: string | null = null;
  let retriedId: string | null = null;
  let repeatOne = false;
  let lastTrack = playerState().nowplayingTrack;
  let lastPlaying = playerState().isPlaying;

  const toItem = (track: Track, url: string): PlayerItem => ({
    mediaId: `${track.id}#${++sequence}`,
    url,
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.img_url,
  });

  const sourceOf = (track: Track, result: ResolveResult) =>
    'switched' in result && result.switched
      ? { id: track.id, source: result.source }
      : null;

  function dropNext() {
    prepareToken += 1;
    preparingId = null;
    if (next !== null) {
      next = null;
      player.setNext(null);
    }
  }

  function load(track: Track) {
    const token = ++loadToken;

    activeId = track.id;
    loaded = false;
    unpreparableId = null;
    if (retriedId !== track.id) {
      retriedId = null;
    }
    dropNext();
    resolve(track).then(result => {
      // the user moved on to another song while this one was being resolved
      if (token !== loadToken) {
        return;
      }
      if (result.url === '') {
        activeId = null;
        notify(failureMessage(track, result));
        store.dispatch(loadFail());

        return;
      }
      loaded = true;
      player.load(toItem(track, result.url));
      if (playerState().isPlaying) {
        player.play();
      } else {
        player.pause();
      }
      store.dispatch(updatePlayer({ playingSource: sourceOf(track, result) }));
    });
  }

  function prepare(track: Track) {
    const token = ++prepareToken;

    preparingId = track.id;
    resolve(track).then(result => {
      if (token !== prepareToken) {
        return;
      }
      preparingId = null;
      if (result.url === '') {
        unpreparableId = track.id;

        return;
      }

      const item = toItem(track, result.url);

      next = {
        id: track.id,
        mediaId: item.mediaId,
        source: sourceOf(track, result),
      };
      player.setNext(item);
    });
  }

  function sync() {
    const state = playerState();
    const want = state.nowplayingTrack;
    const changed = want !== lastTrack;
    const playingChanged = state.isPlaying !== lastPlaying;

    lastTrack = want;
    lastPlaying = state.isPlaying;

    if (want === null || want === undefined) {
      if (activeId !== null) {
        loadToken += 1;
        activeId = null;
        loaded = false;
        dropNext();
        player.pause();
      }

      return;
    }

    if (want.id !== activeId) {
      // a newly chosen song plays at once; the song left from the last run
      // waits for the play button
      if (changed || state.isPlaying) {
        load(want);
        if (!state.isPlaying) {
          store.dispatch(play());
        }
      }

      return;
    }

    if (changed && !state.isPlaying) {
      // the song that is loaded was chosen again while paused
      store.dispatch(play());

      return;
    }

    if (loaded && playingChanged) {
      if (state.isPlaying) {
        player.play();
      } else {
        player.pause();
      }
    }

    const following = upcoming(state);
    const wantRepeat = following === 'repeat';

    if (wantRepeat !== repeatOne) {
      repeatOne = wantRepeat;
      player.setRepeatOne(wantRepeat);
    }

    // the play queue or the play mode changed under a prepared song
    const followingId =
      following !== null && following !== 'repeat' ? following.id : null;

    if (
      (next !== null && next.id !== followingId) ||
      (preparingId !== null && preparingId !== followingId)
    ) {
      dropNext();
    }
  }

  const unsubscribe = store.subscribe(sync);

  return {
    tick() {
      const state = playerState();

      if (!loaded || !state.isPlaying || next !== null || preparingId !== null) {
        return;
      }

      const following = upcoming(state);

      if (
        following === null ||
        following === 'repeat' ||
        following.id === unpreparableId
      ) {
        return;
      }

      const left = player.remaining();

      if (left !== null && left <= prepareAhead) {
        prepare(following);
      }
    },

    onAdvanced(mediaId) {
      if (next === null || next.mediaId !== mediaId) {
        return;
      }

      const { source } = next;

      activeId = next.id;
      loaded = true;
      next = null;
      unpreparableId = null;
      retriedId = null;
      // the state layer follows the player; had the two disagreed, sync would
      // load the song the state layer names
      store.dispatch(nextTrack());
      store.dispatch(updatePlayer({ playingSource: source }));
    },

    onEnded() {
      const state = playerState();

      if (!loaded || !state.isPlaying) {
        return;
      }

      const following = upcoming(state);

      if (following === null || following === 'repeat') {
        return;
      }
      // nothing was prepared in time: move on the slow way
      loaded = false;
      activeId = null;
      store.dispatch(nextTrack());
    },

    onError() {
      const track = playerState().nowplayingTrack;

      if (!loaded || track === null || track === undefined) {
        return;
      }
      if (track.id !== activeId) {
        return;
      }
      // the address may have expired: resolve the song once more before
      // giving up on it
      if (retriedId !== track.id) {
        retriedId = track.id;
        load(track);

        return;
      }
      loadToken += 1;
      activeId = null;
      loaded = false;
      dropNext();
      notify(`「${track.title}」播放失败`);
      store.dispatch(loadFail());
    },

    onPlayingChanged(playing) {
      // while a song is being resolved the player still holds the last one
      if (!loaded || playerState().isPlaying === playing) {
        return;
      }
      // the player has done it already and is not told again
      lastPlaying = playing;
      store.dispatch(playing ? play() : pause());
    },

    stop() {
      unsubscribe();
      loadToken += 1;
      dropNext();
    },
  };
}
