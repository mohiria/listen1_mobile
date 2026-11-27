import type { PlaylistInfo, Track } from '../api/client';

export function changePlayMode(): { type: string };
export function changeTheme(theme: 'white' | 'black'): { type: string };
export function playTrack(track: Track): { type: string };
export function playTracks(tracks: Track[]): { type: string };
export function playTrackInPlaylist(payload: {
  track: Track;
  playlist: { info: PlaylistInfo; tracks: Track[] };
}): { type: string };
