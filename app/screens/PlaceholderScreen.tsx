import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme';
import Screen from './Screen';

// Stands in for a screen that has not been moved over yet.
export default function PlaceholderScreen() {
  const palette = usePalette();

  return (
    <Screen style={styles.screen}>
      <Text style={{ color: palette.secondaryColor }}>尚未搬入</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center' },
});
