import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import Client, { type PlaylistInfo } from '../../src/api/client';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Cover from './Cover';

const NO_SUBSCRIPTIONS: PlaylistInfo[] = [];
// the name of a provider by the two letters its ids begin with
const providerNames: Record<string, string> = {};

Client.getPlatformArray().forEach(provider => {
  providerNames[provider.platformId] = provider.name;
});

// The playlists of providers I subscribed to, the newest first unless I put
// them in another order.
export function useSubscriptions(): PlaylistInfo[] {
  return useStore(
    state => state.myPlaylistState.subscriptions ?? NO_SUBSCRIPTIONS
  );
}

// All the subscriptions as rows, each with the name of its provider.
export default function SubscriptionList({
  onOpen,
  header,
}: {
  onOpen: (info: PlaylistInfo) => void;
  header?: React.ReactElement;
}) {
  const palette = usePalette();
  const subscriptions = useSubscriptions();

  return (
    <FlatList
      data={subscriptions}
      keyExtractor={info => info.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: palette.thirdColor }]}>
          在音源的歌单里点「订阅」，它会出现在这里
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => onOpen(item)}>
          <Cover url={item.cover_img_url} size={50} />
          <Text
            numberOfLines={1}
            style={[styles.title, { color: palette.primaryColor }]}
          >
            {item.title}
          </Text>
          <Text style={[styles.tag, { color: palette.thirdColor }]}>
            {providerNames[item.id.slice(0, 2)]}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
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
