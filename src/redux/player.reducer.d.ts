import type { Track } from '../api/client';
import type { PlayerState } from './store';

export function peekNextTrack(state: PlayerState): Track | null;
export function getPlayingSource(state: PlayerState): string;
