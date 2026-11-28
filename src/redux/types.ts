import type { PlaylistInfo, Track } from '../api/types';

export type PlayerState = {
  // 0 loop, 1 shuffle, 2 repeat one
  playMode: number;
  nowplayingTrack: Track | null;
  isPlaying: boolean;
  // the play queue
  tracks: Track[];
  // the ids of the play queue in the order shuffle plays them
  shuffleIds: string[];
  // the songs that failed to load since the play queue was last replaced
  skipIds: { [trackId: string]: 1 };
  // { id, source } once a song is being played from another provider
  playingSource: { id: string; source: string } | null;
  // kept from the old app; nothing reads them
  volume: number;
  duration: number;
  current: number;
  seek: number;
  isSeeking: boolean;
};

// A playlist of mine with its songs.
export type MyPlaylist = { info: PlaylistInfo; tracks: Track[] };

export type MyPlaylistState = {
  // the ids of the songs in 我喜欢的音乐
  myFavoriteIds: { [trackId: string]: 1 | undefined };
  // my playlists in the order they are shown; 我喜欢的音乐 is the first
  playlists: PlaylistInfo[];
  myPlaylistDict: { [playlistId: string]: MyPlaylist | undefined };
  // the playlists of providers I subscribed to, the newest first unless
  // put in another order; only what names them is kept, the songs are
  // asked for each time. Missing in a state saved before subscriptions
  // existed.
  subscriptions?: PlaylistInfo[];
};

export type Theme = 'system' | 'white' | 'black';

export type SettingState = { language: string; theme: Theme };

export type ModalState = {
  // the full-screen player
  isOpen: boolean;
  // the sheet; liteType and item keep their last values while it is closed
  isLiteOpen: boolean;
  liteHeight: number;
  liteType: '' | 'nowplaying' | 'track' | 'add_to_playlist';
  // the song the sheet is about; not meaningful when liteType is 'nowplaying'
  item: Track;
};

export type RootState = {
  playerState: PlayerState;
  myPlaylistState: MyPlaylistState;
  settingState: SettingState;
  searchState: { text: string };
  modalState: ModalState;
};
