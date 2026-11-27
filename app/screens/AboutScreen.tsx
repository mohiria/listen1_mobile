import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commit } from '../buildInfo';
import { usePalette } from '../theme';
import Screen from './Screen';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const color = palette.primaryColor;

  return (
    <Screen style={styles.screen}>
      <Text style={[styles.name, { color }]}>Listen 1</Text>
      <Text selectable style={[styles.detail, { color }]}>
        {`构建 ${commit}`}
      </Text>
      <Text selectable style={[styles.detail, { color }]}>
        {`安全区 上 ${insets.top} 下 ${insets.bottom} 左 ${insets.left} 右 ${insets.right}`}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 28, fontWeight: '600', marginBottom: 12 },
  detail: { fontSize: 14, marginTop: 4 },
});
