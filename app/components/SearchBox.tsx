import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';

import { usePalette } from '../theme';

// The bar at the top of a screen that opens the search screen. It only looks
// like an input; the typing happens there.
export default function SearchBox({ onPress }: { onPress: () => void }) {
  const palette = usePalette();

  return (
    <View style={[styles.bar, { backgroundColor: palette.windowColor }]}>
      <Pressable
        accessibilityRole="search"
        style={[styles.box, { backgroundColor: palette.backgroundColor }]}
        onPress={onPress}
      >
        <MaterialIcons name="search" size={18} color={palette.thirdColor} />
        <Text style={[styles.hint, { color: palette.thirdColor }]}>
          搜索歌曲、歌单
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingBottom: 8, paddingHorizontal: 12, paddingTop: 8 },
  box: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    height: 36,
    paddingHorizontal: 10,
  },
  hint: { fontSize: 14, marginLeft: 6 },
});
