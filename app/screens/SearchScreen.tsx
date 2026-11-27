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
  ALL_PROVIDERS,
  ProviderPager,
} from '../components/ProviderTabs';
import TrackRow from '../components/TrackRow';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const PAGE_SIZE = 20;

const play = (track: Track) => store.dispatch(playTrack(track));
const openMenu = (track: Track) =>
  store.dispatch(openModalLite({ type: 'track', item: track }));

// What one provider finds for the keyword. It searches only while it is the
// provider on show, and again when the keyword changes.
function SearchResults({
  platformId,
  keyword,
  active,
}: {
  platformId: string;
  keyword: string;
  active: boolean;
}) {
  const nowPlaying = useStore(state => state.playerState.nowplayingTrack);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [total, setTotal] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const [searched, setSearched] = useState('');
  const request = useRef(0);
  const list = useRef<FlatList<Track>>(null);

  const search = useCallback(
    (text: string, page: number) => {
      const mine = ++request.current;

      setLoading(true);
      setFailedPage(null);
      setSearched(text);
      if (page === 1) {
        setTracks([]);
        setTotal(-1);
      }
      Client.search(text, page, platformId)
        .then(found => {
          if (mine !== request.current) {
            return;
          }
          if (page === 1) {
            list.current?.scrollToOffset({ animated: false, offset: 0 });
            setTracks(found.result);
            setTotal(found.total);
          } else {
            setTracks(previous => {
              const known = new Set(previous.map(track => track.id));

              return previous.concat(
                found.result.filter(track => !known.has(track.id))
              );
            });
            // an empty page ends the list whatever the total says
            if (found.result.length === 0) {
              setTotal(0);
            }
          }
          setLoading(false);
        })
        .catch(() => {
          if (mine !== request.current) {
            return;
          }
          setLoading(false);
          setFailedPage(page);
        });
    },
    [platformId]
  );

  useEffect(() => {
    if (active && keyword !== '' && keyword !== searched) {
      search(keyword, 1);
    }
  }, [active, keyword, searched, search]);

  const footer = () => {
    if (loading) {
      return null;
    }
    if (failedPage !== null) {
      return (
        <ListStatus
          message="搜索失败"
          onRetry={() => search(searched, failedPage)}
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
          search(searched, 1);
        }
      }}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        // after a failure the list waits for the retry button
        if (
          loading ||
          failedPage !== null ||
          tracks.length === 0 ||
          (total !== -1 && tracks.length >= total)
        ) {
          return;
        }
        search(searched, Math.ceil(tracks.length / PAGE_SIZE) + 1);
      }}
      ListFooterComponent={footer}
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
  );
}

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

// The playlists the keyword finds, in one provider or in all of them, where
// each row names its provider.
function PlaylistResults({
  platformId,
  keyword,
  active,
  onOpen,
}: {
  platformId: string;
  keyword: string;
  active: boolean;
  onOpen: (info: PlaylistInfo) => void;
}) {
  const palette = usePalette();
  const all = platformId === ALL_PROVIDERS;
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
      session.current = Client.searchPlaylists(
        text,
        all ? undefined : platformId
      );
      setSearched(text);
      setPlaylists([]);
      setDone(false);
      list.current?.scrollToOffset({ animated: false, offset: 0 });
      more();
    },
    [all, platformId, more]
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
            !all || failed.length === providerCount
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
          {all ? (
            <Text style={[styles.playlistTag, { color: palette.thirdColor }]}>
              {providerNames[item.id.slice(0, 2)]}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const KINDS = [
  { kind: 'song', name: '单曲' },
  { kind: 'playlist', name: '歌单' },
] as const;

export default function SearchScreen({
  navigation,
}: NativeStackScreenProps<SearchStackParamList, 'Search'>) {
  const palette = usePalette();
  const [selected, setSelected] = useState(ALL_PROVIDERS);
  const [keyword, setKeyword] = useState('');
  // what is searched for; each kind keeps its own results
  const [kind, setKind] = useState<'song' | 'playlist'>('song');
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
        {KINDS.map(one => (
          <Pressable
            key={one.kind}
            hitSlop={4}
            style={styles.kind}
            onPress={() => setKind(one.kind)}
          >
            <Text
              style={{
                color:
                  kind === one.kind ? palette.accentColor : palette.inactiveColor,
                fontSize: 14,
                fontWeight: kind === one.kind ? '600' : '400',
              }}
            >
              {one.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <ProviderTabs selected={selected} onSelect={setSelected} all />
      <ProviderPager
        all
        selected={selected}
        onSelect={setSelected}
        render={platformId => {
          const shown = selected === platformId;

          // both lists stay in the page, so changing the kind and back
          // finds the results where they were
          return (
            <>
              <View style={kind === 'song' ? styles.fill : styles.hidden}>
                {platformId === ALL_PROVIDERS ? (
                  <AllResults
                    keyword={keyword}
                    active={shown && kind === 'song'}
                  />
                ) : (
                  <SearchResults
                    platformId={platformId}
                    keyword={keyword}
                    active={shown && kind === 'song'}
                  />
                )}
              </View>
              <View style={kind === 'playlist' ? styles.fill : styles.hidden}>
                <PlaylistResults
                  platformId={platformId}
                  keyword={keyword}
                  active={shown && kind === 'playlist'}
                  onOpen={open}
                />
              </View>
            </>
          );
        }}
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
  kind: { height: 36, justifyContent: 'center', paddingLeft: 12 },
  fill: { flex: 1 },
  hidden: { display: 'none' },
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
