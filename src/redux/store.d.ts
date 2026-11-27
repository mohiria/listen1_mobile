import type { PlaylistInfo, Track } from '../api/client';

export type PlayerState = {
  // 0 loop, 1 shuffle, 2 repeat one
  playMode: number;
  nowplayingTrack: Track | null;
  isPlaying: boolean;
  tracks: Track[];
  playingSource: { id: string; source: string } | null;
};

// A playlist of mine with its songs.
export type MyPlaylist = { info: PlaylistInfo; tracks: Track[] };

export type MyPlaylistState = {
  // the ids of the songs in 我喜欢的音乐
  myFavoriteIds: { [trackId: string]: 1 | undefined };
  // my playlists in the order they are shown; 我喜欢的音乐 is the first
  playlists: PlaylistInfo[];
  myPlaylistDict: { [playlistId: string]: MyPlaylist | undefined };
};

export type RootState = {
  playerState: PlayerState;
  myPlaylistState: MyPlaylistState;
  settingState: { language: string; theme: 'system' | 'white' | 'black' };
  modalState: {
    // the full-screen player
    isOpen: boolean;
    // the sheet; liteType and item keep their last values while it is closed
    isLiteOpen: boolean;
    liteType: '' | 'nowplaying' | 'track' | 'add_to_playlist';
    // the song the sheet is about; not meaningful when liteType is 'nowplaying'
    item: Track;
  };
};

export const store: {
  getState(): RootState;
  dispatch(action: { type: string }): unknown;
  subscribe(listener: () => void): () => void;
};

export const persistor: {
  flush(): Promise<unknown>;
  getState(): { bootstrapped: boolean };
  subscribe(listener: () => void): () => void;
};
