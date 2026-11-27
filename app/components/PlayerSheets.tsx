// The sheets that come up from the bottom: the play queue, the menu of one
// song, and my playlists to put that song into. The state layer says which
// one is open.
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

import type { PlaylistInfo, Track } from '../../src/api/client';
import {
  addNextTrack,
  addToMyPlaylist,
  closeModalLite,
  openModalLite,
  playTrack,
  removeTrack,
} from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Cover from './Cover';
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
  const nowPlaying = useStore(state => state.playerState.nowplayingTrack);
  // the song that is playing cannot be put after itself
  const current =
    nowPlaying !== null &&
    nowPlaying !== undefined &&
    nowPlaying.id === track.id;

  return (
    <>
      <Text
        numberOfLines={1}
        style={[styles.menuTitle, { color: palette.primaryColor }]}
      >
        {track.title}
      </Text>
      {current ? null : (
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
      )}
      <Pressable
        style={styles.option}
        onPress={() =>
          store.dispatch(
            openModalLite({ type: 'add_to_playlist', item: track })
          )
        }
      >
        <MaterialIcons name="add-box" size={24} color={palette.primaryColor} />
        <Text style={[styles.optionText, { color: palette.primaryColor }]}>
          收藏到歌单
        </Text>
      </Pressable>
      <View style={styles.fill} />
      <CloseButton />
    </>
  );
}

// My playlists; the one tapped gets the song.
function AddToPlaylist() {
  const palette = usePalette();
  const track = useStore(state => state.modalState.item);
  const playlists = useStore(state => state.myPlaylistState.playlists);

  const add = (playlist: PlaylistInfo) => {
    store.dispatch(addToMyPlaylist({ track, playlist }));
    close();
    showToast('添加歌单完成');
  };

  return (
    <>
      <FlatList
        style={styles.fill}
        data={playlists}
        keyExtractor={info => info.id}
        renderItem={({ item }) => (
          <Pressable style={styles.playlist} onPress={() => add(item)}>
            <Cover url={item.cover_img_url} size={40} />
            <Text
              numberOfLines={1}
              style={[styles.playlistTitle, { color: palette.primaryColor }]}
            >
              {item.title}
            </Text>
          </Pressable>
        )}
      />
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
  const wanted = type === 'track' ? 210 : 500;

  return (
    <Sheet
      visible={visible}
      height={Math.min(wanted, screen.height - insets.top - insets.bottom - 40)}
      onClose={close}
    >
      {type === 'nowplaying' ? <Queue /> : null}
      {type === 'track' ? <TrackMenu /> : null}
      {type === 'add_to_playlist' ? <AddToPlaylist /> : null}
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
  playlist: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: 15,
  },
  playlistTitle: { flex: 1, fontSize: 14, marginLeft: 12 },
});
