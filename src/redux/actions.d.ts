import type { PlaylistInfo, Track } from '../api/client';

export function changePlayMode(): { type: string };
export function changeTheme(theme: 'system' | 'white' | 'black'): {
  type: string;
};
export function playTrack(track: Track): { type: string };
export function playTracks(tracks: Track[]): { type: string };
export function playTrackInPlaylist(payload: {
  track: Track;
  playlist: { info: PlaylistInfo; tracks: Track[] };
}): { type: string };
export function play(): { type: string };
export function pause(): { type: string };
export function togglePlay(): { type: string };
export function nextTrack(): { type: string };
export function prevTrack(): { type: string };
export function loadFail(): { type: string };
export function updatePlayer(next: {
  playingSource: { id: string; source: string } | null;
}): { type: string };
// Puts the song right after the current one in the play queue.
export function addNextTrack(track: Track): { type: string };
// Takes the song out of the play queue.
export function removeTrack(track: Track): { type: string };
// Opens or closes the full-screen player.
export function toggleModal(): { type: string };
// Opens the sheet with the play queue, the one with the menu of a song, or
// the one that asks which playlist of mine the song goes into.
export function openModalLite(
  payload:
    | { type: 'nowplaying' }
    | { type: 'track' | 'add_to_playlist'; item: Track }
): { type: string };
export function closeModalLite(): { type: string };

// Saves the playlist as a new playlist of mine; the id it has is replaced.
export function createMyPlaylist(playlist: {
  info: PlaylistInfo;
  tracks: Track[];
}): { type: string };
// The playlists of mine to keep, in their new order, without 我喜欢的音乐.
export function saveMyPlaylists(playlists: PlaylistInfo[]): { type: string };
// Replaces the songs of a playlist of mine.
export function editMyPlaylist(playlist: {
  info: PlaylistInfo;
  tracks: Track[];
}): { type: string };
// Adds the song to a playlist of mine unless it is there already.
export function addToMyPlaylist(payload: {
  track: Track;
  playlist: PlaylistInfo;
}): { type: string };
export function addToMyFavorite(track: Track): { type: string };
export function removeFromMyFavorite(track: Track): { type: string };
// Replaces the play queue and my playlists with those of exported data, as
// StateJsonConvert.getState gives them.
export function recoverData(payload: {
  playerState: object;
  myPlaylistState: object;
}): { type: string };
