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
