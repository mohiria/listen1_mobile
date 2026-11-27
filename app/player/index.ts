// Connects the playback driver to the audio library, the provider layer and
// the state layer. Everything here needs a device to be checked.
import TrackPlayer, {
  Event,
  PlaybackState,
  PlayerCommand,
  RepeatMode,
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

const toMediaItem = (item: PlayerItem): MediaItem => ({
  mediaId: item.mediaId,
  url: item.url,
  title: item.title,
  artist: item.artist,
  albumTitle: item.album,
  artworkUrl: item.artwork,
});

// The native queue holds the current item and at most the one after it.
const port: PlayerPort = {
  load(item) {
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
  TrackPlayer.addEventListener(Event.PlaybackError, () => {
    // an item waiting in the queue can fail too; only the current one counts
    if (TrackPlayer.getPlaybackState() === PlaybackState.Error) {
      driver.onError();
    }
  });
  setInterval(driver.tick, TICK_MS);
}

// Call once from index.js, before the app component is registered.
export function registerPlayback() {
  TrackPlayer.registerPlaybackSession(() => {
    // The lock screen buttons act on the state layer, which then drives the
    // player like any button of the app does.
    const hasSong = () => store.getState().playerState.nowplayingTrack !== null;

    TrackPlayer.registerRemoteHandlers({
      play: () => {
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
