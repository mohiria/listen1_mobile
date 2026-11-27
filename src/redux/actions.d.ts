import type { PlaylistInfo, Track } from '../api/client';

export function changePlayMode(): { type: string };
export function changeTheme(theme: 'white' | 'black'): { type: string };
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
// Opens the sheet with the play queue, or the one with the menu of a song.
export function openModalLite(
  payload: { type: 'nowplaying' } | { type: 'track'; item: Track }
): { type: string };
export function closeModalLite(): { type: string };
