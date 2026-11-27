import type { Track } from '../api/client';

export type PlayerState = {
  // 0 loop, 1 shuffle, 2 repeat one
  playMode: number;
  nowplayingTrack: Track | null;
  isPlaying: boolean;
  tracks: Track[];
  playingSource: { id: string; source: string } | null;
};

export type RootState = {
  playerState: PlayerState;
  settingState: { language: string; theme: string };
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
