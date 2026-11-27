import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Client, { type PlaylistInfo } from '../../src/api/client';
import ListStatus from '../components/ListStatus';
import ProviderTabs, {
  firstProviderId,
  ProviderPages,
} from '../components/ProviderTabs';
import type { PlaylistsStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import Screen from './Screen';

const MIN_COVER = 100;
const GAP = 10;
const TITLE_HEIGHT = 40;

// The playlists one provider recommends, as a grid of covers that loads more
// when its end is reached.
function PlaylistGrid({
  platformId,
  onOpen,
}: {
  platformId: string;
  onOpen: (info: PlaylistInfo) => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const width = useWindowDimensions().width - insets.left - insets.right;
  const columns = Math.max(1, Math.floor((width - GAP) / (MIN_COVER + GAP)));
  const cover = Math.floor((width - GAP * (columns + 1)) / columns);

  const [lists, setLists] = useState<PlaylistInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const load = useCallback(
    (offset: number) => {
      const mine = ++request.current;

      setLoading(true);
      setFailed(false);
      Client.showPlaylist(offset, platformId)
        .then(({ result }) => {
          if (mine !== request.current) {
            return;
          }
          setLists(previous => {
            if (offset === 0) {
              return result;
            }
            // a provider can repeat a playlist on the next page
            const known = new Set(previous.map(info => info.id));

            return previous.concat(result.filter(info => !known.has(info.id)));
          });
          setLoading(false);
        })
        .catch(() => {
          if (mine !== request.current) {
            return;
          }
          setLoading(false);
          setFailed(true);
        });
    },
    [platformId]
  );

  useEffect(() => {
    load(0);

    return () => {
      request.current += 1;
    };
  }, [load]);

  const footer = () => {
    if (loading) {
      return null;
    }
    if (failed) {
      return (
        <ListStatus message="加载失败" onRetry={() => load(lists.length)} />
      );
    }

    return lists.length === 0 ? <ListStatus message="没有歌单" /> : null;
  };

  return (
    <FlatList
      // the number of columns cannot change on a mounted list
      key={columns}
      numColumns={columns}
      data={lists}
      keyExtractor={info => info.id}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
      refreshing={loading}
      onRefresh={() => load(0)}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        // after a failure the list waits for the retry button
        if (!loading && !failed && lists.length > 0) {
          load(lists.length);
        }
      }}
      ListFooterComponent={footer}
      renderItem={({ item }) => (
        <Pressable style={{ width: cover }} onPress={() => onOpen(item)}>
          <Image
            source={{ uri: item.cover_img_url }}
            resizeMode="cover"
            style={{
              width: cover,
              height: cover,
              backgroundColor: palette.windowColor,
            }}
          />
          <Text
            numberOfLines={2}
            style={[styles.title, { color: palette.secondaryColor }]}
          >
            {item.title}
          </Text>
        </Pressable>
      )}
    />
  );
}

export default function PlaylistsScreen({
  navigation,
}: NativeStackScreenProps<PlaylistsStackParamList, 'Playlists'>) {
  const [selected, setSelected] = useState(firstProviderId);
  const open = useCallback(
    (info: PlaylistInfo) => navigation.navigate('Playlist', { info }),
    [navigation]
  );

  return (
    <Screen>
      <ProviderTabs selected={selected} onSelect={setSelected} />
      <ProviderPages
        selected={selected}
        render={platformId => (
          <PlaylistGrid platformId={platformId} onOpen={open} />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: GAP, paddingTop: GAP },
  gridRow: { gap: GAP },
  title: { fontSize: 12, height: TITLE_HEIGHT, marginTop: 5 },
});
