// The two sheets that come up from the bottom: the play queue, and the menu
// of one song. The state layer says which one is open.
import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Track } from '../../src/api/client';
import {
  addNextTrack,
  closeModalLite,
  playTrack,
  removeTrack,
} from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import ListStatus from './ListStatus';
import Sheet from './Sheet';
import { showToast } from './Toast';
import TrackRow, { TRACK_ROW_HEIGHT } from './TrackRow';

const close = () => store.dispatch(closeModalLite());
const playFromQueue = (track: Track) => store.dispatch(playTrack(track));
const removeFromQueue = (track: Track) => store.dispatch(removeTrack(track));

function CloseButton() {
  const palette = usePalette();

  return (
    <Pressable
      style={[styles.close, { borderTopColor: palette.borderColor }]}
      onPress={close}
    >
      <Text style={{ color: palette.primaryColor }}>关闭</Text>
    </Pressable>
  );
}

function Queue() {
  const tracks = useStore(state => state.playerState.tracks);
  const nowPlaying = useStore(state => state.playerState.nowplayingTrack);
  const playingId =
    nowPlaying !== null && nowPlaying !== undefined ? nowPlaying.id : '';
  // opens with the current song a few rows from the top
  const first = Math.max(
    0,
    tracks.findIndex(track => track.id === playingId) - 4
  );

  return (
    <>
      <FlatList
        style={styles.fill}
        data={tracks}
        keyExtractor={(track, index) => `${track.id}:${index}`}
        extraData={playingId}
        initialScrollIndex={tracks.length > 0 ? first : undefined}
        getItemLayout={(_data, index) => ({
          length: TRACK_ROW_HEIGHT,
          offset: TRACK_ROW_HEIGHT * index,
          index,
        })}
        ListEmptyComponent={<ListStatus message="播放队列里没有歌曲" />}
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            playing={item.id === playingId}
            onPress={playFromQueue}
            icon="close"
            onPressIcon={removeFromQueue}
          />
        )}
      />
      <CloseButton />
    </>
  );
}

function TrackMenu() {
  const palette = usePalette();
  const track = useStore(state => state.modalState.item);

  return (
    <>
      <Text
        numberOfLines={1}
        style={[styles.menuTitle, { color: palette.primaryColor }]}
      >
        {track.title}
      </Text>
      <Pressable
        style={styles.option}
        onPress={() => {
          store.dispatch(addNextTrack(track));
          close();
          showToast('已加入下一首播放');
        }}
      >
        <MaterialIcons
          name="play-circle-outline"
          size={24}
          color={palette.primaryColor}
        />
        <Text style={[styles.optionText, { color: palette.primaryColor }]}>
          下一首播放
        </Text>
      </Pressable>
      <View style={styles.fill} />
      <CloseButton />
    </>
  );
}

// Mount once, above the full-screen player.
export default function PlayerSheets() {
  const visible = useStore(state => state.modalState.isLiteOpen);
  const type = useStore(state => state.modalState.liteType);
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const wanted = type === 'track' ? 160 : 500;

  return (
    <Sheet
      visible={visible}
      height={Math.min(wanted, screen.height - insets.top - insets.bottom - 40)}
      onClose={close}
    >
      {type === 'nowplaying' ? <Queue /> : null}
      {type === 'track' ? <TrackMenu /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  close: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 50,
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 14, padding: 15 },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 50,
    paddingHorizontal: 15,
  },
  optionText: { fontSize: 14, marginLeft: 15 },
});
