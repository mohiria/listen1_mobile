import { useSyncExternalStore } from 'react';

import { store, type RootState } from '../src/redux/store';

// Reads one value from the state layer and re-renders when it changes. The
// selector has to return the same reference while the value is unchanged.
export function useStore<T>(selector: (state: RootState) => T): T {
  return useSyncExternalStore(store.subscribe, () =>
    selector(store.getState())
  );
}
