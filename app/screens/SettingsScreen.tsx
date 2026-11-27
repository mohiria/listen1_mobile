import React from 'react';
import {
  ActionSheetIOS,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { changeTheme } from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import type { SettingsStackParamList } from '../Navigation';
import { usePalette, type Palette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const THEMES = [
  { theme: 'system', name: '跟随系统' },
  { theme: 'white', name: '白色' },
  { theme: 'black', name: '黑色' },
] as const;

function chooseTheme() {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: [...THEMES.map(one => one.name), '取消'],
      cancelButtonIndex: THEMES.length,
    },
    index => {
      const chosen = THEMES[index];

      if (chosen !== undefined) {
        store.dispatch(changeTheme(chosen.theme));
      }
    }
  );
}

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
  const theme = useStore(state => state.settingState.theme);

  return (
    <Screen>
      <ScrollView>
        <Row
          title="主题"
          value={THEMES.find(one => one.theme === theme)?.name ?? ''}
          palette={palette}
          onPress={chooseTheme}
        />
        <Row
          title="备份"
          value="›"
          palette={palette}
          onPress={() => navigation.navigate('Backup')}
        />
        <Row
          title="恢复"
          value="›"
          palette={palette}
          onPress={() => navigation.navigate('Restore')}
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
