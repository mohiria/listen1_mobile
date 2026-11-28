import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import Client, { type PlaylistInfo, type Track } from '../../src/api/client';
import {
  createMyPlaylist,
  openModalLite,
  playTrackInPlaylist,
  playTracks,
  subscribePlaylist,
  unsubscribePlaylist,
} from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import Cover from '../components/Cover';
import ListStatus from '../components/ListStatus';
import { showToast } from '../components/Toast';
import TrackRow from '../components/TrackRow';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const openMenu = (track: Track) =>
  store.dispatch(openModalLite({ type: 'track', item: track }));

const NO_TRACKS: Track[] = [];

// The songs of one playlist: of a provider, loaded from it, or of mine, kept
// in the app. The screen is in the stacks of two tabs; only the one of my
// playlists has the screen that edits.
export default function PlaylistScreen({
  route,
  navigation,
}: {
  route: { params: { info: PlaylistInfo } };
  navigation: {
    navigate(name: 'Reorder', params: { playlistId: string }): void;
  };
}) {
  const given = route.params.info;
  const mine = given.id.startsWith('my');
  const palette = usePalette();
  const nowPlaying = useStore(state => state.playerState.nowplayingTrack);
  const saved = useStore(state =>
    mine ? state.myPlaylistState.myPlaylistDict[given.id] : undefined
  );
  const subscribed = useStore(state =>
    (state.myPlaylistState.subscriptions ?? []).some(i => i.id === given.id)
  );
  const [loaded, setLoaded] = useState<{
    info: PlaylistInfo;
    tracks: Track[];
  } | null>(null);
  const [loading, setLoading] = useState(!mine);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const load = useCallback(() => {
    const current = ++request.current;

    setLoading(true);
    setFailed(false);
    // Promise.resolve: getPlaylist can throw for an id it does not recognise
    Promise.resolve()
      .then(() => Client.getPlaylist(given.id))
      .then(playlist => {
        if (current === request.current) {
          setLoaded(playlist);
          setLoading(false);
        }
      })
      .catch(() => {
        if (current === request.current) {
          setLoading(false);
          setFailed(true);
        }
      });
  }, [given.id]);

  useEffect(() => {
    if (!mine) {
      load();
    }

    return () => {
      request.current += 1;
    };
  }, [mine, load]);

  const tracks = (mine ? saved?.tracks : loaded?.tracks) ?? NO_TRACKS;
  // a playlist opened by its link is given without a title, and a chart
  // without a cover
  const partial = given.title === '' || given.cover_img_url === '';
  const info = (mine ? saved?.info : partial ? loaded?.info : given) ?? given;

  const play = useCallback(
    (track: Track) =>
      store.dispatch(
        playTrackInPlaylist({ track, playlist: { info, tracks } })
      ),
    [info, tracks]
  );

  const color = palette.primaryColor;
  const toggleSubscription = () => {
    if (subscribed) {
      store.dispatch(unsubscribePlaylist(given.id));
      showToast('已取消订阅');
    } else {
      store.dispatch(subscribePlaylist(info));
      showToast('已订阅');
    }
  };
  const header = (
    <View>
      <View style={styles.header}>
        <Cover url={info.cover_img_url} size={120} />
        <Text style={[styles.title, { color }]}>{info.title}</Text>
      </View>
      {loading ? <ActivityIndicator color="#777777" /> : null}
      {!loading && failed ? (
        <ListStatus message="加载失败" onRetry={load} />
      ) : null}
      {/* a subscribed playlist that no longer loads can still be let go */}
      {!loading && failed && subscribed ? (
        <Pressable style={styles.unsubscribe} onPress={toggleSubscription}>
          <Text style={{ color: palette.secondaryColor }}>取消订阅</Text>
        </Pressable>
      ) : null}
      {!loading && !failed && tracks.length > 0 ? (
        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, styles.playAll]}
            onPress={() => store.dispatch(playTracks(tracks))}
          >
            <MaterialIcons name="play-circle-outline" size={26} color={color} />
            <Text style={[styles.buttonText, { color }]}>
              {`播放全部(共${tracks.length}首)`}
            </Text>
          </Pressable>
          {mine ? (
            <Pressable
              style={styles.button}
              onPress={() =>
                navigation.navigate('Reorder', { playlistId: given.id })
              }
            >
              <MaterialIcons name="reorder" size={26} color={color} />
              <Text style={[styles.buttonText, { color }]}>编辑歌单</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.button}
                onPress={() => {
                  store.dispatch(createMyPlaylist({ info, tracks }));
                  showToast('收藏成功');
                }}
              >
                <MaterialIcons name="add-box" size={26} color={color} />
                <Text style={[styles.buttonText, { color }]}>收藏</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.subscribe]}
                onPress={toggleSubscription}
              >
                <MaterialIcons
                  name={subscribed ? 'bookmark' : 'bookmark-border'}
                  size={26}
                  color={subscribed ? palette.accentColor : color}
                />
                <Text
                  style={[
                    styles.buttonText,
                    { color: subscribed ? palette.accentColor : color },
                  ]}
                >
                  {subscribed ? '已订阅' : '订阅'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
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
  title: { flex: 1, fontSize: 16, marginLeft: 10 },
  buttons: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 40,
    paddingHorizontal: 20,
  },
  button: { alignItems: 'center', flexDirection: 'row', height: 40 },
  playAll: { flex: 1 },
  subscribe: { marginLeft: 14 },
  unsubscribe: { alignItems: 'center', paddingVertical: 10 },
  buttonText: { marginLeft: 6 },
});
