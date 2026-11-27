import { legacy_createStore as createStore } from 'redux';
import { persistStore, persistReducer } from 'redux-persist';
import storage from '@react-native-async-storage/async-storage';

import reducer from './reducer';
import type { RootState } from './types';

export type {
  MyPlaylist,
  MyPlaylistState,
  PlayerState,
  RootState,
} from './types';

const persistConfig = {
  key: 'root',
  storage,
  blacklist: ['searchState', 'modalState', 'playerState'],
  // null, which the library's types leave out, turns its time limit off
  timeout: null as unknown as number,
};

export const store: {
  getState(): RootState;
  dispatch(action: { type: string }): unknown;
  subscribe(listener: () => void): () => void;
} = createStore(persistReducer(persistConfig, reducer));

export const persistor: {
  flush(): Promise<unknown>;
  getState(): { bootstrapped: boolean };
  subscribe(listener: () => void): () => void;
} = persistStore(store as Parameters<typeof persistStore>[0]);
