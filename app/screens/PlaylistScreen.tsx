import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import Client, { type Track } from '../../src/api/client';
import {
  openModalLite,
  playTrackInPlaylist,
  playTracks,
} from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import ListStatus from '../components/ListStatus';
import TrackRow from '../components/TrackRow';
import type { PlaylistsStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const openMenu = (track: Track) =>
  store.dispatch(openModalLite({ type: 'track', item: track }));

// The songs of one playlist of a provider.
export default function PlaylistScreen({
  route,
}: NativeStackScreenProps<PlaylistsStackParamList, 'Playlist'>) {
  const { info } = route.params;
  const palette = usePalette();
  const nowPlaying = useStore(state => state.playerState.nowplayingTrack);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const load = useCallback(() => {
    const mine = ++request.current;

    setLoading(true);
    setFailed(false);
    // Promise.resolve: getPlaylist can throw for an id it does not recognise
    Promise.resolve()
      .then(() => Client.getPlaylist(info.id))
      .then(playlist => {
        if (mine === request.current) {
          setTracks(playlist.tracks);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mine === request.current) {
          setLoading(false);
          setFailed(true);
        }
      });
  }, [info.id]);

  useEffect(() => {
    load();

    return () => {
      request.current += 1;
    };
  }, [load]);

  const play = useCallback(
    (track: Track) =>
      store.dispatch(
        playTrackInPlaylist({ track, playlist: { info, tracks } })
      ),
    [info, tracks]
  );

  const header = (
    <View>
      <View style={styles.header}>
        <Image
          source={{ uri: info.cover_img_url }}
          style={[styles.cover, { backgroundColor: palette.windowColor }]}
        />
        <Text style={[styles.title, { color: palette.primaryColor }]}>
          {info.title}
        </Text>
      </View>
      {loading ? <ActivityIndicator color="#777777" /> : null}
      {!loading && failed ? (
        <ListStatus message="加载失败" onRetry={load} />
      ) : null}
      {!loading && !failed && tracks.length > 0 ? (
        <Pressable
          style={styles.playAll}
          onPress={() => store.dispatch(playTracks(tracks))}
        >
          <MaterialIcons
            name="play-circle-outline"
            size={26}
            color={palette.primaryColor}
          />
          <Text style={[styles.playAllText, { color: palette.primaryColor }]}>
            {`播放全部(共${tracks.length}首)`}
          </Text>
        </Pressable>
      ) : null}
      {!loading && !failed && tracks.length === 0 ? (
        <ListStatus message="歌单里没有歌曲" />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={tracks}
        keyExtractor={(track, index) => `${track.id}:${index}`}
        ListHeaderComponent={header}
        extraData={nowPlaying}
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            playing={nowPlaying !== null && nowPlaying.id === item.id}
            onPress={play}
            icon="more-vert"
            onPressIcon={openMenu}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', padding: 20 },
  cover: { height: 120, width: 120 },
  title: { flex: 1, fontSize: 16, marginLeft: 10 },
  playAll: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 40,
    paddingHorizontal: 20,
  },
  playAllText: { marginLeft: 10 },
});
