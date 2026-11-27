import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Client from '../../src/api/client';
import { toggleModal, togglePlay } from '../../src/redux/actions';
import { getPlayingSource } from '../../src/redux/player.reducer';
import { store } from '../../src/redux/store';
import { usePalette } from '../theme';
import { useStore } from '../useStore';

const HEIGHT = 50;

// The bar above the tabs: the current song and a play button. A tap anywhere
// else on it opens the full-screen player.
export default function MiniPlayer() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const track = useStore(state => state.playerState.nowplayingTrack);
  const playing = useStore(state => state.playerState.isPlaying);
  const source = useStore(state => getPlayingSource(state.playerState));
  const hasTrack = track !== null && track !== undefined;

  return (
    <Pressable
      style={[
        styles.bar,
        {
          backgroundColor: palette.windowColor,
          borderTopColor: palette.borderColor,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
      onPress={() => store.dispatch(toggleModal())}
    >
      {hasTrack && track.img_url ? (
        <Image source={{ uri: track.img_url }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.center]}>
          <MaterialIcons
            name="music-note"
            size={26}
            color={palette.thirdColor}
          />
        </View>
      )}
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: palette.primaryColor }]}
        >
          {hasTrack ? track.title : 'Listen 1'}
        </Text>
        {hasTrack ? (
          <Text
            numberOfLines={1}
            style={[styles.detail, { color: palette.secondaryColor }]}
          >
            {source !== ''
              ? `${track.artist} · 来自${Client.getProviderName(source)}`
              : track.artist}
          </Text>
        ) : null}
      </View>
      <Pressable
        hitSlop={6}
        style={[styles.cover, styles.center]}
        onPress={() => {
          if (hasTrack) {
            store.dispatch(togglePlay());
          }
        }}
      >
        <MaterialIcons
          name={playing ? 'pause-circle-outline' : 'play-circle-outline'}
          size={30}
          color={palette.primaryColor}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: HEIGHT,
  },
  cover: { height: HEIGHT, width: HEIGHT },
  center: { alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  title: { fontSize: 14 },
  detail: { fontSize: 12, marginTop: 3 },
});
