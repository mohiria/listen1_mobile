import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import Client, { type Track } from '../../src/api/client';
import { openModalLite, playTrack } from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import ListStatus from '../components/ListStatus';
import ProviderTabs, {
  firstProviderId,
  ProviderPages,
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

export default function SearchScreen() {
  const palette = usePalette();
  const [selected, setSelected] = useState(firstProviderId);
  const [keyword, setKeyword] = useState('');

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
      <ProviderTabs selected={selected} onSelect={setSelected} />
      <ProviderPages
        selected={selected}
        render={(platformId, active) => (
          <SearchResults
            platformId={platformId}
            keyword={keyword}
            active={active}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingTop: 8 },
  input: { borderRadius: 8, fontSize: 14, height: 36, paddingHorizontal: 10 },
});
