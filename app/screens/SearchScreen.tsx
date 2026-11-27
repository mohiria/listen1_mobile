import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Client, {
  type AggregateSearch,
  type FoundPlaylist,
  type PlaylistInfo,
  type PlaylistSearch,
  type Track,
} from '../../src/api/client';
import { openModalLite, playTrack } from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import Cover from '../components/Cover';
import ListStatus from '../components/ListStatus';
import type { SearchStackParamList } from '../Navigation';
import ProviderTabs, {
  ProviderPager,
  type TabPage,
} from '../components/ProviderTabs';
import TrackRow from '../components/TrackRow';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const play = (track: Track) => store.dispatch(playTrack(track));
const openMenu = (track: Track) =>
  store.dispatch(openModalLite({ type: 'track', item: track }));

const providerCount = Client.getPlatformArray().length;
// the name of a provider by the two letters its ids begin with
const providerNames: Record<string, string> = {};

Client.getPlatformArray().forEach(provider => {
  providerNames[provider.platformId] = provider.name;
});

// What all the providers find for the keyword, as one list: each row names
// its provider, and a song that several of them have is shown once.
function AllResults({ keyword, active }: { keyword: string; active: boolean }) {
  const nowPlaying = useStore(state => state.playerState.nowplayingTrack);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  // the providers that did not answer the last time, by enName
  const [failed, setFailed] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [searched, setSearched] = useState('');
  const session = useRef<AggregateSearch | null>(null);
  const list = useRef<FlatList<Track>>(null);

  // the next page of every provider; after a failure this is the retry too
  const more = useCallback(() => {
    const mine = session.current;

    if (mine === null) {
      return;
    }
    setLoading(true);
    setFailed([]);
    mine.more().then(found => {
      if (mine !== session.current) {
        return;
      }
      setTracks(found.tracks);
      setFailed(found.failed);
      setDone(found.done);
      setLoading(false);
    });
  }, []);

  const search = useCallback(
    (text: string) => {
      session.current = Client.searchAll(text);
      setSearched(text);
      setTracks([]);
      setDone(false);
      list.current?.scrollToOffset({ animated: false, offset: 0 });
      more();
    },
    [more]
  );

  useEffect(() => {
    if (active && keyword !== '' && keyword !== searched) {
      search(keyword);
    }
  }, [active, keyword, searched, search]);

  const footer = () => {
    if (loading) {
      return null;
    }
    if (failed.length > 0) {
      return (
        <ListStatus
          message={
            failed.length === providerCount
              ? '搜索失败'
              : `${failed.map(Client.getProviderName).join('、')}搜索失败`
          }
          onRetry={more}
        />
      );
    }

    return searched !== '' && tracks.length === 0 ? (
      <ListStatus message="没有结果" />
    ) : null;
  };

  return (
    <FlatList
      ref={list}
      data={tracks}
      keyExtractor={track => track.id}
      extraData={nowPlaying}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={loading}
      onRefresh={() => {
        if (searched !== '') {
          search(searched);
        }
      }}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        // after a failure the list waits for the retry button
        if (loading || failed.length > 0 || tracks.length === 0 || done) {
          return;
        }
        more();
      }}
      ListFooterComponent={footer}
      renderItem={({ item }) => (
        <TrackRow
          track={item}
          playing={nowPlaying !== null && nowPlaying.id === item.id}
          onPress={play}
          tag={Client.getProviderName(item.source)}
          icon="more-vert"
          onPressIcon={openMenu}
        />
      )}
    />
  );
}

// The playlists all the providers find for the keyword, as one list where
// each row names its provider.
function PlaylistResults({
  keyword,
  active,
  onOpen,
}: {
  keyword: string;
  active: boolean;
  onOpen: (info: PlaylistInfo) => void;
}) {
  const palette = usePalette();
  const [playlists, setPlaylists] = useState<FoundPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  // the providers that did not answer the last time, by enName
  const [failed, setFailed] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [searched, setSearched] = useState('');
  const session = useRef<PlaylistSearch | null>(null);
  const list = useRef<FlatList<FoundPlaylist>>(null);

  // the next page; after a failure this is the retry too
  const more = useCallback(() => {
    const mine = session.current;

    if (mine === null) {
      return;
    }
    setLoading(true);
    setFailed([]);
    mine.more().then(found => {
      if (mine !== session.current) {
        return;
      }
      setPlaylists(found.playlists);
      setFailed(found.failed);
      setDone(found.done);
      setLoading(false);
    });
  }, []);

  const search = useCallback(
    (text: string) => {
      session.current = Client.searchPlaylists(text);
      setSearched(text);
      setPlaylists([]);
      setDone(false);
      list.current?.scrollToOffset({ animated: false, offset: 0 });
      more();
    },
    [more]
  );

  useEffect(() => {
    if (active && keyword !== '' && keyword !== searched) {
      search(keyword);
    }
  }, [active, keyword, searched, search]);

  const footer = () => {
    if (loading) {
      return null;
    }
    if (failed.length > 0) {
      return (
        <ListStatus
          message={
            failed.length === providerCount
              ? '搜索失败'
              : `${failed.map(Client.getProviderName).join('、')}搜索失败`
          }
          onRetry={more}
        />
      );
    }

    return searched !== '' && playlists.length === 0 ? (
      <ListStatus message="没有结果" />
    ) : null;
  };

  return (
    <FlatList
      ref={list}
      data={playlists}
      keyExtractor={info => info.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={loading}
      onRefresh={() => {
        if (searched !== '') {
          search(searched);
        }
      }}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        // after a failure the list waits for the retry button
        if (loading || failed.length > 0 || playlists.length === 0 || done) {
          return;
        }
        more();
      }}
      ListFooterComponent={footer}
      renderItem={({ item }) => (
        <Pressable
          style={styles.playlist}
          onPress={() =>
            onOpen({
              id: item.id,
              title: item.title,
              cover_img_url: item.cover_img_url,
            })
          }
        >
          <Cover url={item.cover_img_url} size={50} />
          <View style={styles.playlistText}>
            <Text
              numberOfLines={1}
              style={[styles.playlistTitle, { color: palette.primaryColor }]}
            >
              {item.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.playlistDetail, { color: palette.secondaryColor }]}
            >
              {item.author !== ''
                ? `${item.count} 首 · ${item.author}`
                : `${item.count} 首`}
            </Text>
          </View>
          <Text style={[styles.playlistTag, { color: palette.thirdColor }]}>
            {providerNames[item.id.slice(0, 2)]}
          </Text>
        </Pressable>
      )}
    />
  );
}

// The two pages of results. A page is searched the first time it is shown.
const SONGS = 'song';
const PLAYLISTS = 'playlist';
const KINDS: TabPage[] = [
  { name: '单曲', platformId: SONGS },
  { name: '歌单', platformId: PLAYLISTS },
];

export default function SearchScreen({
  navigation,
}: NativeStackScreenProps<SearchStackParamList, 'Search'>) {
  const palette = usePalette();
  const [kind, setKind] = useState(SONGS);
  const [keyword, setKeyword] = useState('');
  const open = useCallback(
    (info: PlaylistInfo) => navigation.navigate('Playlist', { info }),
    [navigation]
  );

  return (
    <Screen>
      <View style={[styles.bar, { backgroundColor: palette.windowColor }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: palette.backgroundColor,
              color: palette.primaryColor,
            },
          ]}
          placeholder="输入歌曲名，歌手或专辑"
          placeholderTextColor={palette.thirdColor}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={event => setKeyword(event.nativeEvent.text.trim())}
        />
      </View>
      <ProviderTabs pages={KINDS} selected={kind} onSelect={setKind} />
      <ProviderPager
        pages={KINDS}
        selected={kind}
        onSelect={setKind}
        render={page =>
          page === SONGS ? (
            <AllResults keyword={keyword} active={kind === SONGS} />
          ) : (
            <PlaylistResults
              keyword={keyword}
              active={kind === PLAYLISTS}
              onOpen={open}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  input: {
    borderRadius: 8,
    flex: 1,
    fontSize: 14,
    height: 36,
    paddingHorizontal: 10,
  },
  playlist: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 66,
    paddingHorizontal: 15,
  },
  playlistText: { flex: 1, justifyContent: 'center', marginLeft: 12 },
  playlistTitle: { fontSize: 15 },
  playlistDetail: { fontSize: 12, marginTop: 4 },
  playlistTag: { fontSize: 12, marginLeft: 10 },
});
