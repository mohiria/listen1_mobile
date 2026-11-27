import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import { usePalette } from '../theme';

// The cover of a playlist. A playlist made in the app has no picture of its
// own, and shows a note in its place.
export default function Cover({ url, size }: { url: string; size: number }) {
  const palette = usePalette();
  const box = {
    backgroundColor: palette.windowColor,
    height: size,
    width: size,
  };

  return /^https?:/.test(url) ? (
    <Image source={{ uri: url }} style={box} />
  ) : (
    <View style={[styles.center, box]}>
      <MaterialIcons
        name="music-note"
        size={size / 2}
        color={palette.thirdColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
