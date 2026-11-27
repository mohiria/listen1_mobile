// Connects the playback driver to the audio library, the provider layer and
// the state layer. Everything here needs a device to be checked.
import TrackPlayer, {
  Event,
  PlaybackState,
  PlayerCommand,
  RepeatMode,
  useProgress,
  type MediaItem,
} from '@rntp/player';

import Client from '../../src/api/client';
import { nextTrack, pause, play, prevTrack } from '../../src/redux/actions';
import { persistor, store } from '../../src/redux/store';
import { showToast } from '../components/Toast';
import {
  createPlaybackDriver,
  type PlayerItem,
  type PlayerPort,
} from './driver';

const TICK_MS = 2000;
// How long the player must have been silent before the state layer is told
// that it paused; between two songs it is silent for a moment.
const SETTLE_MS = 1000;

const toMediaItem = (item: PlayerItem): MediaItem => ({
  mediaId: item.mediaId,
  url: item.url,
  title: item.title,
  artist: item.artist,
  albumTitle: item.album,
  artworkUrl: item.artwork,
});

// True from the loading of a song until it is heard: the player is silent
// then without having paused.
let starting = false;

// The native queue holds the current item and at most the one after it.
const port: PlayerPort = {
  load(item) {
    starting = true;
    const length = TrackPlayer.getQueue().length;

    if (length === 0) {
      TrackPlayer.setMediaItem(toMediaItem(item));

      return;
    }
    // setMediaItem would close the audio session, and in the background the
    // app would be suspended: add, move over, then drop the old items
    TrackPlayer.addMediaItem(toMediaItem(item));
    TrackPlayer.skipToIndex(length);
    TrackPlayer.removeMediaItems(0, length);
  },
  setNext(item) {
    const index = TrackPlayer.getActiveMediaItemIndex() ?? 0;
    const length = TrackPlayer.getQueue().length;

    if (length > index + 1) {
      TrackPlayer.removeMediaItems(index + 1, length);
    }
    if (item !== null) {
      TrackPlayer.addMediaItem(toMediaItem(item));
    }
  },
  play: () => TrackPlayer.play(),
  pause: () => TrackPlayer.pause(),
  setRepeatOne: on =>
    TrackPlayer.setRepeatMode(on ? RepeatMode.One : RepeatMode.Off),
  remaining() {
    const { duration, position } = TrackPlayer.getProgress();

    return duration > 0 ? duration - position : null;
  },
};

function start() {
  const driver = createPlaybackDriver({
    store,
    player: port,
    resolve: track => Client.resolveTrack(track),
    notify: showToast,
  });

  TrackPlayer.addEventListener(Event.MediaItemTransition, event => {
    if (event.reason !== 'auto' || event.item?.mediaId === undefined) {
      return;
    }
    driver.onAdvanced(event.item.mediaId);
    // the item that just finished is no longer needed
    if (event.index > 0) {
      TrackPlayer.removeMediaItems(0, event.index);
    }
  });
  TrackPlayer.addEventListener(Event.PlaybackStateChanged, event => {
    if (event.state === PlaybackState.Ended) {
      driver.onEnded();
    }
  });
  let settling: ReturnType<typeof setTimeout> | null = null;

  // The player pauses by itself when headphones are taken off, when another
  // app takes the sound or when a phone call comes in, and goes on by itself
  // when the call ends. The buttons of the app follow the state layer.
  TrackPlayer.addEventListener(Event.IsPlayingChanged, event => {
    if (settling !== null) {
      clearTimeout(settling);
      settling = null;
    }
    if (event.playing) {
      starting = false;
      if (TrackPlayer.isPlaying()) {
        driver.onPlayingChanged(true);
      }

      return;
    }
    if (starting) {
      return;
    }
    settling = setTimeout(() => {
      settling = null;
      // a paused player reports ready; buffering, ended and error are not
      // pauses
      if (
        !TrackPlayer.isPlaying() &&
        TrackPlayer.getPlaybackState() === PlaybackState.Ready
      ) {
        driver.onPlayingChanged(false);
      }
    }, SETTLE_MS);
  });
  TrackPlayer.addEventListener(Event.PlaybackError, () => {
    // an item waiting in the queue can fail too; only the current one counts
    if (TrackPlayer.getPlaybackState() === PlaybackState.Error) {
      driver.onError();
    }
  });
  setInterval(driver.tick, TICK_MS);
}

// Where the current song is and how long it is, in seconds, read a couple of
// times a second. The length is 0 while no song is loaded.
export function usePlaybackProgress(): { position: number; duration: number } {
  return useProgress(0.5);
}

export function seekTo(seconds: number) {
  TrackPlayer.seekTo(seconds);
}

// Call once from index.js, before the app component is registered.
export function registerPlayback() {
  TrackPlayer.registerPlaybackSession(() => {
    // The lock screen buttons act on the state layer, which then drives the
    // player like any button of the app does.
    const hasSong = () => store.getState().playerState.nowplayingTrack !== null;

    TrackPlayer.registerRemoteHandlers({
      play: () => {
        // the player pauses by itself when headphones are taken off, and the
        // state layer is not told; putting them back on asks to play
        if (store.getState().playerState.isPlaying) {
          TrackPlayer.play();

          return;
        }
        store.dispatch(play());
      },
      pause: () => {
        store.dispatch(pause());
      },
      next: () => {
        if (hasSong()) {
          store.dispatch(nextTrack());
        }
      },
      previous: () => {
        if (hasSong()) {
          store.dispatch(prevTrack());
        }
      },
    });
    // no cache: it cuts streams short (issue 2690 of the library)
    TrackPlayer.setupPlayer({ contentType: 'music' });
    TrackPlayer.setCommands({
      capabilities: [
        PlayerCommand.PlayPause,
        PlayerCommand.Next,
        PlayerCommand.Previous,
        PlayerCommand.Seek,
      ],
    });

    // The driver starts from the saved state, so it waits for that state to
    // be read back; otherwise the saved song would look newly chosen.
    if (persistor.getState().bootstrapped) {
      start();

      return;
    }

    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        start();
      }
    });
  });
}
