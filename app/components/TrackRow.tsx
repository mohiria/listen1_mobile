import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import type { Track } from '../../src/api/client';
import { usePalette } from '../theme';

function TrackRow({
  track,
  playing,
  onPress,
  icon,
  onPressIcon,
}: {
  track: Track;
  playing: boolean;
  onPress: (track: Track) => void;
  // a button at the end of the row
  icon?: 'more-vert' | 'close';
  onPressIcon?: (track: Track) => void;
}) {
  const palette = usePalette();
  // a restricted song is dimmed but can still be tapped: it may play from
  // another provider
  const tint = playing
    ? palette.playingColor
    : track.disabled
      ? palette.disableColor
      : undefined;

  return (
    <Pressable
      style={[styles.row, icon !== undefined ? styles.rowWithIcon : null]}
      onPress={() => onPress(track)}
    >
      {playing ? (
        <MaterialIcons
          name="volume-up"
          size={20}
          color={palette.playingColor}
          style={styles.playing}
        />
      ) : null}
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: tint ?? palette.primaryColor }]}
        >
          {track.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.detail, { color: tint ?? palette.secondaryColor }]}
        >
          {track.album ? `${track.artist} - ${track.album}` : track.artist}
        </Text>
      </View>
      {icon !== undefined ? (
        <Pressable
          hitSlop={6}
          style={styles.icon}
          onPress={() => onPressIcon?.(track)}
        >
          <MaterialIcons name={icon} size={20} color={palette.thirdColor} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export default React.memo(TrackRow);

export const TRACK_ROW_HEIGHT = 50;

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: TRACK_ROW_HEIGHT,
    paddingHorizontal: 20,
  },
  rowWithIcon: { paddingRight: 10 },
  playing: { marginRight: 10 },
  text: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 14 },
  detail: { fontSize: 12, marginTop: 3 },
  icon: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
