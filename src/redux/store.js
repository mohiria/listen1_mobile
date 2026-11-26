import { legacy_createStore as createStore } from 'redux';
import { persistStore, persistReducer } from 'redux-persist';
import storage from '@react-native-async-storage/async-storage';

import reducer from './reducer';

const persistConfig = {
  key: 'root',
  storage,
  blacklist: ['searchState', 'modalState', 'playerState'],
  timeout: null,
};

export const store = createStore(persistReducer(persistConfig, reducer));
export const persistor = persistStore(store);
