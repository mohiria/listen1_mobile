// TEMP(B-06): the least that lets playback be checked on the device. The mini
// player replaces it.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Client from '../../src/api/client';
import { nextTrack, prevTrack, togglePlay } from '../../src/redux/actions';
import { getPlayingSource } from '../../src/redux/player.reducer';
import { store } from '../../src/redux/store';
import { usePalette } from '../theme';
import { useStore } from '../useStore';

export default function TempPlayerBar() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const track = useStore(state => state.playerState.nowplayingTrack);
  const playing = useStore(state => state.playerState.isPlaying);
  const source = useStore(state => getPlayingSource(state.playerState));

  if (track === null || track === undefined) {
    return null;
  }

  const button = (
    name: 'skip-previous' | 'play-arrow' | 'pause' | 'skip-next',
    action: () => { type: string }
  ) => (
    <Pressable
      hitSlop={6}
      style={styles.button}
      onPress={() => store.dispatch(action())}
    >
      <MaterialIcons name={name} size={28} color={palette.primaryColor} />
    </Pressable>
  );

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: palette.windowColor,
          borderTopColor: palette.borderColor,
          paddingLeft: insets.left + 12,
          paddingRight: insets.right + 4,
        },
      ]}
    >
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: palette.primaryColor }]}
        >
          {track.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.detail, { color: palette.secondaryColor }]}
        >
          {source !== ''
            ? `${track.artist} · 来自${Client.getProviderName(source)}`
            : track.artist}
        </Text>
      </View>
      {button('skip-previous', prevTrack)}
      {button(playing ? 'pause' : 'play-arrow', togglePlay)}
      {button('skip-next', nextTrack)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 50,
  },
  text: { flex: 1 },
  title: { fontSize: 14 },
  detail: { fontSize: 12, marginTop: 2 },
  button: { alignItems: 'center', justifyContent: 'center', width: 44 },
});
