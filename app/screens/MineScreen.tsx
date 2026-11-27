import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import Cover from '../components/Cover';
import type { MineStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

// My playlists, 我喜欢的音乐 first.
export default function MineScreen({
  navigation,
}: NativeStackScreenProps<MineStackParamList, 'Mine'>) {
  const palette = usePalette();
  const playlists = useStore(state => state.myPlaylistState.playlists);

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
});
