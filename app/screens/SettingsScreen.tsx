import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { changeTheme } from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import type { SettingsStackParamList } from '../Navigation';
import { usePalette, type Palette } from '../theme';
import Screen from './Screen';

function Row({
  title,
  value,
  palette,
  onPress,
}: {
  title: string;
  value: string;
  palette: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.row, { borderBottomColor: palette.borderColor }]}
      onPress={onPress}
    >
      <Text style={[styles.title, { color: palette.primaryColor }]}>
        {title}
      </Text>
      <Text style={{ color: palette.secondaryColor }}>{value}</Text>
    </Pressable>
  );
}

export default function SettingsScreen({
  navigation,
}: NativeStackScreenProps<SettingsStackParamList, 'Settings'>) {
  const palette = usePalette();

  return (
    <Screen>
      <ScrollView>
        <Row
          title="主题"
          value={palette.dark ? '黑色' : '白色'}
          palette={palette}
          onPress={() =>
            store.dispatch(changeTheme(palette.dark ? 'white' : 'black'))
          }
        />
        <Row
          title="关于"
          value="›"
          palette={palette}
          onPress={() => navigation.navigate('About')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  title: { fontSize: 16 },
});
