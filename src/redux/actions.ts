import type { PlaylistInfo, Track } from '../api/types';
import type { MyPlaylist, Theme } from './types';

export const TYPE = {
  PLAY_TRACK: 'PLAY_TRACK',
  TOGGLE_PLAY: 'TOGGLE_PLAY',
  UPDATE_PLAYER: 'UPDATE_PLAYER',
  TOGGLE_MODAL: 'TOGGLE_MODAL',
  OPEN_MODEL_LITE: 'OPEN_MODEL_LITE',
  CLOSE_MODEL_LITE: 'CLOSE_MODEL_LITE',
  PREV_TRACK: 'PREV_TRACK',
  NEXT_TRACK: 'NEXT_TRACK',
  PLAY_TRACKS: 'PLAY_TRACKS',
  PLAY_TRACK_IN_PLAYLIST: 'PLAY_TRACK_IN_PLAYLIST',
  ADD_NEXT_TRACK: 'ADD_NEXT_TRACK',
  LOAD_FAIL: 'LOAD_FAIL',
  REMOVE_TRACK: 'REMOVE_TRACK',
  SEARCH: 'SEARCH',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  CHANGE_THEME: 'CHANGE_THEME',
  CHANGE_PLAY_MODE: 'CHANGE_PLAY_MODE',
  CREATE_MY_PLAYLIST: 'CREATE_MY_PLAYLIST',
  SAVE_MY_PLAYLISTS: 'SAVE_MY_PLAYLISTS',
  EDIT_MY_PLAYLIST: 'EDIT_MY_PLAYLIST',
  ADD_TO_MY_PLAYLIST: 'ADD_TO_MY_PLAYLIST',
  ADD_TO_MY_FAVORITE: 'ADD_TO_MY_FAVORITE',
  REMOVE_FROM_MY_FAVORITE: 'REMOVE_FROM_MY_FAVORITE',
  RECOVER_DATA: 'RECOVER_DATA',
};

export const playTrack = (track: Track) => ({
  type: TYPE.PLAY_TRACK,
  track,
});

export const togglePlay = () => ({
  type: TYPE.TOGGLE_PLAY,
});

export const play = () => ({
  type: TYPE.PLAY,
});

export const pause = () => ({
  type: TYPE.PAUSE,
});

export const updatePlayer = (next: {
  playingSource: { id: string; source: string } | null;
}) => ({
  type: TYPE.UPDATE_PLAYER,
  next,
});

// Opens or closes the full-screen player.
export const toggleModal = () => ({
  type: TYPE.TOGGLE_MODAL,
});

// Opens the sheet with the play queue, the one with the menu of a song, or
// the one that asks which playlist of mine the song goes into.
export const openModalLite = (
  payload:
    | { type: 'nowplaying' }
    | { type: 'track' | 'add_to_playlist'; item: Track }
) => ({
  type: TYPE.OPEN_MODEL_LITE,
  payload,
});

export const closeModalLite = () => ({
  type: TYPE.CLOSE_MODEL_LITE,
});

export const prevTrack = () => ({
  type: TYPE.PREV_TRACK,
});

export const nextTrack = () => ({
  type: TYPE.NEXT_TRACK,
});

// Puts the song right after the current one in the play queue.
export const addNextTrack = (payload: Track) => ({
  type: TYPE.ADD_NEXT_TRACK,
  payload,
});
// Takes the song out of the play queue.
export const removeTrack = (payload: Track) => ({
  type: TYPE.REMOVE_TRACK,
  payload,
});
export const playTracks = (tracks: Track[]) => ({
  type: TYPE.PLAY_TRACKS,
  tracks,
});
export const playTrackInPlaylist = (payload: {
  track: Track;
  playlist: MyPlaylist;
}) => ({
  type: TYPE.PLAY_TRACK_IN_PLAYLIST,
  payload,
});
export const loadFail = () => ({
  type: TYPE.LOAD_FAIL,
});
export const search = (text: string) => ({
  type: TYPE.SEARCH,
  text,
});
export const changeTheme = (theme: Theme) => ({
  type: TYPE.CHANGE_THEME,
  theme,
});
export const changePlayMode = () => ({
  type: TYPE.CHANGE_PLAY_MODE,
});
// Saves the playlist as a new playlist of mine; the id it has is replaced.
export const createMyPlaylist = (playlist: MyPlaylist) => ({
  type: TYPE.CREATE_MY_PLAYLIST,
  playlist,
});
// The playlists of mine to keep, in their new order, without 我喜欢的音乐.
export const saveMyPlaylists = (playlists: PlaylistInfo[]) => ({
  type: TYPE.SAVE_MY_PLAYLISTS,
  playlists,
});
// Replaces the songs of a playlist of mine.
export const editMyPlaylist = (playlist: MyPlaylist) => ({
  type: TYPE.EDIT_MY_PLAYLIST,
  playlist,
});
// Adds the song to a playlist of mine unless it is there already.
export const addToMyPlaylist = (payload: {
  track: Track;
  playlist: PlaylistInfo;
}) => ({
  type: TYPE.ADD_TO_MY_PLAYLIST,
  payload,
});
export const addToMyFavorite = (payload: Track) => ({
  type: TYPE.ADD_TO_MY_FAVORITE,
  payload,
});
export const removeFromMyFavorite = (payload: Track) => ({
  type: TYPE.REMOVE_FROM_MY_FAVORITE,
  payload,
});
// Replaces the play queue and my playlists with those of exported data, as
// StateJsonConvert.getState gives them.
export const recoverData = (payload: {
  playerState: object;
  myPlaylistState: object;
}) => ({
  type: TYPE.RECOVER_DATA,
  payload,
});
