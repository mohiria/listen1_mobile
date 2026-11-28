import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  editMyPlaylist,
  saveMyPlaylists,
  saveSubscriptions,
} from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import ListEditor from '../components/ListEditor';
import type { MineStackParamList } from '../Navigation';
import Screen from './Screen';

// Puts in order and deletes: the songs of the playlist of mine named by the
// route, the subscriptions when the route asks for them, or else my playlists
// themselves, all but 我喜欢的音乐.
export default function ReorderScreen({
  route,
}: NativeStackScreenProps<MineStackParamList, 'Reorder'>) {
  const { playlistId, subscriptions } = route.params;
  // as they were when the screen opened; the editor holds them from then on
  const [state] = useState(() => store.getState().myPlaylistState);
  const playlist =
    playlistId !== undefined ? state.myPlaylistDict[playlistId] : undefined;

  if (subscriptions) {
    return (
      <Screen>
        <ListEditor
          items={state.subscriptions ?? []}
          onChange={kept => store.dispatch(saveSubscriptions(kept))}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {playlist !== undefined ? (
        <ListEditor
          items={playlist.tracks}
          onChange={tracks =>
            store.dispatch(editMyPlaylist({ info: playlist.info, tracks }))
          }
        />
      ) : (
        <ListEditor
          items={state.playlists.slice(1)}
          onChange={playlists => store.dispatch(saveMyPlaylists(playlists))}
        />
      )}
    </Screen>
  );
}
