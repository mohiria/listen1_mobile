import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import Cover from '../components/Cover';
import ProviderTabs, { type TabPage } from '../components/ProviderTabs';
import SubscriptionList from '../components/SubscriptionList';
import type { MineStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const MINE = 'mine';
const SUBSCRIBED = 'subscribed';
const PAGES: TabPage[] = [
  { name: '我的歌单', platformId: MINE },
  { name: '订阅', platformId: SUBSCRIBED },
];

// My playlists, 我喜欢的音乐 first, and on a page of their own the playlists
// of providers I subscribed to.
export default function MineScreen({
  navigation,
}: NativeStackScreenProps<MineStackParamList, 'Mine'>) {
  const palette = usePalette();
  const [page, setPage] = useState(MINE);
  const playlists = useStore(state => state.myPlaylistState.playlists);
  const button = (
    icon: 'add' | 'link' | 'reorder',
    label: string,
    onPress: () => void
  ) => (
    <Pressable
      hitSlop={6}
      style={styles.button}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <MaterialIcons name={icon} size={26} color={palette.primaryColor} />
    </Pressable>
  );
  const openByLink = button('link', '导入歌单', () =>
    navigation.navigate('ImportPlaylist')
  );

  return (
    <Screen>
      <ProviderTabs pages={PAGES} selected={page} onSelect={setPage} />
      {page === MINE ? (
        <FlatList
          data={playlists}
          keyExtractor={info => info.id}
          ListHeaderComponent={
            <View style={styles.header}>
              {button('add', '新建歌单', () =>
                navigation.navigate('CreatePlaylist')
              )}
              {openByLink}
              {button('reorder', '编辑歌单', () =>
                navigation.navigate('Reorder', {})
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
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
            </Pressable>
          )}
        />
      ) : (
        <SubscriptionList
          onOpen={info => navigation.navigate('Playlist', { info })}
          header={
            <View style={styles.header}>
              {openByLink}
              {button('reorder', '编辑订阅', () =>
                navigation.navigate('Reorder', { subscriptions: true })
              )}
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 46,
    justifyContent: 'flex-end',
    paddingRight: 5,
  },
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
});
