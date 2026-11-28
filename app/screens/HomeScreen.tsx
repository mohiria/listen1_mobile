import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Client, { type Chart, type PlaylistInfo } from '../../src/api/client';
import Cover from '../components/Cover';
import ListStatus from '../components/ListStatus';
import SearchBox from '../components/SearchBox';
import { useSubscriptions } from '../components/SubscriptionList';
import { createHomeData, type Lead } from '../homeData';
import { usePalette } from '../theme';
import Screen from './Screen';

const TILE = 104;

const KINDS: { kind: Chart['kind']; title: string; color: string }[] = [
  { kind: 'hot', title: '热歌榜', color: '#c0453c' },
  { kind: 'rising', title: '飙升榜', color: '#3c7ac0' },
  { kind: 'new', title: '新歌榜', color: '#3c9c6a' },
];

// how many subscriptions the home screen shows; the rest are behind 全部
const MOST_SUBSCRIPTIONS = 10;
const charts = Client.getCharts();
const NO_LEAD: Lead = { song: '', cover: '' };

// Lives as long as the app runs, so what was loaded is there again when the
// screen comes back.
const home = createHomeData({
  charts,
  platformIds: Client.getPlatformArray().map(provider => provider.platformId),
  getPlaylist: id => Client.getPlaylist(id),
  showPlaylist: (offset, platformId) => Client.showPlaylist(offset, platformId),
});
const loadMissing = () => {
  home.load();
};
const loadAll = () => {
  home.load(true);
};

function ChartTile({
  chart,
  lead,
  color,
  onOpen,
}: {
  chart: Chart;
  lead: Lead;
  color: string;
  onOpen: (info: PlaylistInfo) => void;
}) {
  const palette = usePalette();
  const { song, cover } = lead;
  const pictured = /^https?:/.test(cover);

  return (
    <Pressable style={styles.tile} onPress={() => onOpen(chart)}>
      <View style={[styles.picture, { backgroundColor: color }]}>
        {pictured ? (
          <Image
            source={{ uri: cover }}
            resizeMode="cover"
            style={styles.image}
          />
        ) : null}
        {/* over a picture, darkens it so that the names stay readable */}
        <View style={[styles.block, pictured ? styles.shade : null]}>
          <Text numberOfLines={2} style={styles.blockTitle}>
            {chart.title}
          </Text>
          <Text style={styles.blockProvider}>
            {Client.getProviderName(chart.source)}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.caption, { color: palette.secondaryColor }]}
      >
        {song === '' ? ' ' : `1. ${song}`}
      </Text>
    </Pressable>
  );
}

function PlaylistTile({
  info,
  onOpen,
}: {
  info: PlaylistInfo;
  onOpen: (info: PlaylistInfo) => void;
}) {
  const palette = usePalette();

  return (
    <Pressable style={styles.tile} onPress={() => onOpen(info)}>
      <Cover url={info.cover_img_url} size={TILE} />
      <Text
        numberOfLines={1}
        style={[styles.caption, { color: palette.secondaryColor }]}
      >
        {info.title}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  onMore,
  children,
}: {
  title: string;
  // opens all of what the section shows a part of
  onMore?: () => void;
  children: React.ReactNode;
}) {
  const palette = usePalette();

  return (
    <View>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: palette.primaryColor }]}>
          {title}
        </Text>
        {onMore ? (
          <Pressable hitSlop={8} onPress={onMore}>
            <Text style={[styles.more, { color: palette.secondaryColor }]}>
              {'全部 >'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {children}
      </ScrollView>
    </View>
  );
}

// The first screen of the app: the playlists I subscribed to, the charts of
// every provider side by side, group by group, and a playlist of each
// provider. Pulling down loads it all again.
export default function HomeScreen({
  navigation,
}: {
  navigation: {
    navigate(
      name: 'Playlist' | 'Search' | 'Subscriptions',
      params?: { info: PlaylistInfo }
    ): void;
  };
}) {
  const { leads, recommended, loading, failed } = useSyncExternalStore(
    home.subscribe,
    home.getState
  );
  const subscriptions = useSubscriptions();
  const open = useCallback(
    (info: PlaylistInfo) => navigation.navigate('Playlist', { info }),
    [navigation]
  );

  useEffect(loadMissing, []);

  return (
    <Screen>
      <SearchBox onPress={() => navigation.navigate('Search')} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadAll}
            tintColor="#777777"
          />
        }
      >
        {subscriptions.length > 0 ? (
          <Section
            title="订阅的歌单"
            onMore={
              subscriptions.length > MOST_SUBSCRIPTIONS
                ? () => navigation.navigate('Subscriptions')
                : undefined
            }
          >
            {subscriptions.slice(0, MOST_SUBSCRIPTIONS).map(info => (
              <PlaylistTile key={info.id} info={info} onOpen={open} />
            ))}
          </Section>
        ) : null}
        {KINDS.map(({ kind, title, color }) => (
          <Section key={kind} title={title}>
            {charts
              .filter(chart => chart.kind === kind)
              .map(chart => (
                <ChartTile
                  key={chart.id}
                  chart={chart}
                  lead={leads[chart.id] ?? NO_LEAD}
                  color={color}
                  onOpen={open}
                />
              ))}
          </Section>
        ))}
        {recommended.length > 0 ? (
          <Section title="推荐歌单">
            {recommended.map(info => (
              <PlaylistTile key={info.id} info={info} onOpen={open} />
            ))}
          </Section>
        ) : null}
        {!loading && failed.length > 0 ? (
          <ListStatus
            message={`有 ${failed.length} 项没有加载出来`}
            onRetry={loadMissing}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 16 },
  headingRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 12,
    marginTop: 14,
  },
  heading: { fontSize: 16, fontWeight: '600' },
  more: { fontSize: 13 },
  strip: { gap: 10, paddingHorizontal: 12 },
  tile: { width: TILE },
  picture: { borderRadius: 8, height: TILE, overflow: 'hidden', width: TILE },
  image: { height: TILE, left: 0, position: 'absolute', top: 0, width: TILE },
  block: {
    alignItems: 'center',
    height: TILE,
    justifyContent: 'center',
    padding: 6,
    width: TILE,
  },
  shade: { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  blockTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  blockProvider: { color: '#ffffffcc', fontSize: 12, marginTop: 4 },
  caption: { fontSize: 12, marginTop: 5 },
});
