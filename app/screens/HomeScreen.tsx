import React, { useCallback, useEffect, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Client, { type Chart, type PlaylistInfo } from '../../src/api/client';
import Cover from '../components/Cover';
import SearchBox from '../components/SearchBox';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const TILE = 104;

const KINDS: { kind: Chart['kind']; title: string; color: string }[] = [
  { kind: 'hot', title: '热歌榜', color: '#c0453c' },
  { kind: 'rising', title: '飙升榜', color: '#3c7ac0' },
  { kind: 'new', title: '新歌榜', color: '#3c9c6a' },
];

const NO_SUBSCRIPTIONS: PlaylistInfo[] = [];
const charts = Client.getCharts();
const providers = Client.getPlatformArray();

// The song that leads a chart: its name, and its picture as the cover of the
// chart. Where the song has no picture the chart's own takes its place.
type Lead = { song: string; cover: string };

// By the id of the chart, as far as it has been asked for since the app
// started. A chart changes once a day at most.
const leads: { [chartId: string]: Lead } = {};
const NO_LEAD: Lead = { song: '', cover: '' };

// What leads the chart; empty until it is known.
function useLead(chart: Chart): Lead {
  const [lead, setLead] = useState(leads[chart.id] ?? NO_LEAD);

  useEffect(() => {
    let mounted = true;

    if (leads[chart.id] === undefined) {
      // Promise.resolve: getPlaylist can throw for an id it does not recognise
      Promise.resolve()
        .then(() => Client.getPlaylist(chart.id))
        .then(playlist => {
          if (playlist.tracks.length > 0) {
            leads[chart.id] = {
              song: playlist.tracks[0].title,
              cover:
                playlist.tracks[0].img_url || playlist.info.cover_img_url || '',
            };
            if (mounted) {
              setLead(leads[chart.id]);
            }
          }
        })
        // the tile stays without the name; the chart can still be opened
        .catch(() => {});
    }

    return () => {
      mounted = false;
    };
  }, [chart.id]);

  return lead;
}

function ChartTile({
  chart,
  color,
  onOpen,
}: {
  chart: Chart;
  color: string;
  onOpen: (info: PlaylistInfo) => void;
}) {
  const palette = usePalette();
  const { song, cover } = useLead(chart);
  const names = (
    <>
      <Text numberOfLines={2} style={styles.blockTitle}>
        {chart.title}
      </Text>
      <Text style={styles.blockProvider}>
        {Client.getProviderName(chart.source)}
      </Text>
    </>
  );

  return (
    <Pressable style={styles.tile} onPress={() => onOpen(chart)}>
      {/^https?:/.test(cover) ? (
        <ImageBackground
          source={{ uri: cover }}
          style={[styles.picture, { backgroundColor: color }]}
        >
          {/* darkens the picture so that the names stay readable */}
          <View style={[styles.block, styles.shade]}>{names}</View>
        </ImageBackground>
      ) : (
        <View style={[styles.block, { backgroundColor: color }]}>{names}</View>
      )}
      <Text
        numberOfLines={1}
        style={[styles.caption, { color: palette.secondaryColor }]}
      >
        {song === '' ? ' ' : `1. ${song}`}
      </Text>
    </Pressable>
  );
}

// One playlist of each provider, the first it recommends. A provider that
// does not answer is left out.
function useRecommended(): PlaylistInfo[] {
  const [lists, setLists] = useState<PlaylistInfo[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.all(
      providers.map(provider =>
        Client.showPlaylist(0, provider.platformId)
          .then(({ result }) => result.slice(0, 1))
          .catch(() => [] as PlaylistInfo[])
      )
    ).then(found => {
      if (mounted) {
        setLists(([] as PlaylistInfo[]).concat(...found));
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return lists;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const palette = usePalette();

  return (
    <View>
      <Text style={[styles.heading, { color: palette.primaryColor }]}>
        {title}
      </Text>
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

// The first screen of the app: the playlists I subscribed to, the charts of
// every provider side by side, group by group, and a playlist of each
// provider.
export default function HomeScreen({
  navigation,
}: {
  navigation: {
    navigate(
      name: 'Playlist' | 'Search',
      params?: { info: PlaylistInfo }
    ): void;
  };
}) {
  const recommended = useRecommended();
  const subscriptions = useStore(
    state => state.myPlaylistState.subscriptions ?? NO_SUBSCRIPTIONS
  );
  const open = useCallback(
    (info: PlaylistInfo) => navigation.navigate('Playlist', { info }),
    [navigation]
  );

  return (
    <Screen>
      <SearchBox onPress={() => navigation.navigate('Search')} />
      <ScrollView contentContainerStyle={styles.content}>
        {subscriptions.length > 0 ? (
          <Section title="订阅的歌单">
            {subscriptions.map(info => (
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 16 },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginHorizontal: 12,
    marginTop: 14,
  },
  strip: { gap: 10, paddingHorizontal: 12 },
  tile: { width: TILE },
  block: {
    alignItems: 'center',
    borderRadius: 8,
    height: TILE,
    justifyContent: 'center',
    padding: 6,
    width: TILE,
  },
  picture: { borderRadius: 8, height: TILE, overflow: 'hidden', width: TILE },
  shade: { backgroundColor: '#00000066', borderRadius: 0 },
  blockTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  blockProvider: { color: '#ffffffcc', fontSize: 12, marginTop: 4 },
  caption: { fontSize: 12, marginTop: 5 },
});
