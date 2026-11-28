import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import Client, { type PlaylistInfo } from '../../src/api/client';
import Cover from '../components/Cover';
import type { MineStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const NO_SUBSCRIPTIONS: PlaylistInfo[] = [];
// the name of a provider by the two letters its ids begin with
const providerNames: Record<string, string> = {};

Client.getPlatformArray().forEach(provider => {
  providerNames[provider.platformId] = provider.name;
});

// My playlists, 我喜欢的音乐 first, and below them the playlists of providers
// I subscribed to.
export default function MineScreen({
  navigation,
}: NativeStackScreenProps<MineStackParamList, 'Mine'>) {
  const palette = usePalette();
  const playlists = useStore(state => state.myPlaylistState.playlists);
  const subscriptions = useStore(
    state => state.myPlaylistState.subscriptions ?? NO_SUBSCRIPTIONS
  );
  const row = (item: PlaylistInfo, tag?: string) => (
    <Pressable
      key={item.id}
      style={styles.row}
      onPress={() => navigation.navigate('Playlist', { info: item })}
    >
      <Cover url={item.cover_img_url} size={50} />
      <Text
        numberOfLines={1}
        style={[styles.title, { color: palette.primaryColor }]}
      >
        {item.title}
      </Text>
      {tag ? (
        <Text style={[styles.tag, { color: palette.thirdColor }]}>{tag}</Text>
      ) : null}
    </Pressable>
  );

  return (
    <Screen>
      <FlatList
        data={playlists}
        keyExtractor={info => info.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.heading, { color: palette.primaryColor }]}>
              我的歌单
            </Text>
            <Pressable
              hitSlop={6}
              style={styles.button}
              onPress={() => navigation.navigate('CreatePlaylist')}
            >
              <MaterialIcons name="add" size={26} color={palette.primaryColor} />
            </Pressable>
            <Pressable
              hitSlop={6}
              style={styles.button}
              accessibilityLabel="导入歌单"
              onPress={() => navigation.navigate('ImportPlaylist')}
            >
              <MaterialIcons name="link" size={26} color={palette.primaryColor} />
            </Pressable>
            <Pressable
              hitSlop={6}
              style={styles.button}
              onPress={() => navigation.navigate('Reorder', {})}
            >
              <MaterialIcons
                name="reorder"
                size={26}
                color={palette.primaryColor}
              />
            </Pressable>
          </View>
        }
        renderItem={({ item }) => row(item)}
        ListFooterComponent={
          <View>
            <View style={styles.header}>
              <Text style={[styles.heading, { color: palette.primaryColor }]}>
                订阅的歌单
              </Text>
            </View>
            {subscriptions.length === 0 ? (
              <Text style={[styles.empty, { color: palette.thirdColor }]}>
                在音源的歌单里点「订阅」，它会出现在这里
              </Text>
            ) : (
              subscriptions.map(item =>
                row(item, providerNames[item.id.slice(0, 2)])
              )
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 50,
    paddingLeft: 15,
    paddingRight: 5,
  },
  heading: { flex: 1, fontSize: 20 },
  button: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 66,
    paddingHorizontal: 15,
  },
  title: { flex: 1, fontSize: 15, marginLeft: 12 },
  tag: { fontSize: 12, marginLeft: 10 },
  empty: { fontSize: 13, paddingHorizontal: 15, paddingVertical: 10 },
});
