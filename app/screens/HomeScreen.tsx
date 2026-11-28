import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Client, { type Chart, type PlaylistInfo } from '../../src/api/client';
import Cover from '../components/Cover';
import SearchBox from '../components/SearchBox';
import { usePalette } from '../theme';
import Screen from './Screen';

const TILE = 104;

const KINDS: { kind: Chart['kind']; title: string; color: string }[] = [
  { kind: 'hot', title: '热歌榜', color: '#c0453c' },
  { kind: 'rising', title: '飙升榜', color: '#3c7ac0' },
  { kind: 'new', title: '新歌榜', color: '#3c9c6a' },
];

const charts = Client.getCharts();
const providers = Client.getPlatformArray();

// The first song of each chart, by the id of the chart, as far as it has been
// asked for since the app started. A chart changes once a day at most.
const firstSongs: { [chartId: string]: string } = {};

// The name of the song that leads the chart, '' until it is known.
function useFirstSong(chart: Chart): string {
  const [song, setSong] = useState(firstSongs[chart.id] ?? '');

  useEffect(() => {
    let mounted = true;

    if (firstSongs[chart.id] === undefined) {
      // Promise.resolve: getPlaylist can throw for an id it does not recognise
      Promise.resolve()
        .then(() => Client.getPlaylist(chart.id))
        .then(playlist => {
          if (playlist.tracks.length > 0) {
            firstSongs[chart.id] = playlist.tracks[0].title;
            if (mounted) {
              setSong(firstSongs[chart.id]);
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

  return song;
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
  const song = useFirstSong(chart);

  return (
    <Pressable style={styles.tile} onPress={() => onOpen(chart)}>
      <View style={[styles.block, { backgroundColor: color }]}>
        <Text numberOfLines={2} style={styles.blockTitle}>
          {chart.title}
        </Text>
        <Text style={styles.blockProvider}>
          {Client.getProviderName(chart.source)}
        </Text>
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

// The first screen of the app: the charts of every provider side by side,
// group by group, and a playlist of each provider.
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
  const palette = usePalette();
  const recommended = useRecommended();
  const open = useCallback(
    (info: PlaylistInfo) => navigation.navigate('Playlist', { info }),
    [navigation]
  );

  return (
    <Screen>
      <SearchBox onPress={() => navigation.navigate('Search')} />
      <ScrollView contentContainerStyle={styles.content}>
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
              <Pressable
                key={info.id}
                style={styles.tile}
                onPress={() => open(info)}
              >
                <Cover url={info.cover_img_url} size={TILE} />
                <Text
                  numberOfLines={1}
                  style={[styles.caption, { color: palette.secondaryColor }]}
                >
                  {info.title}
                </Text>
              </Pressable>
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
  blockTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  blockProvider: { color: '#ffffffcc', fontSize: 12, marginTop: 4 },
  caption: { fontSize: 12, marginTop: 5 },
});
