import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { changeTheme } from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import Sheet from '../components/Sheet';
import type { MineStackParamList } from '../Navigation';
import { usePalette, type Palette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

const THEMES = [
  { theme: 'system', name: '跟随系统' },
  { theme: 'white', name: '白色' },
  { theme: 'black', name: '黑色' },
] as const;

const CHOICE_HEIGHT = 50;

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
}: NativeStackScreenProps<MineStackParamList, 'Settings'>) {
  const palette = usePalette();
  const theme = useStore(state => state.settingState.theme);
  // the sheet with the three themes; touching outside it closes it
  const [choosing, setChoosing] = useState(false);

  return (
    <Screen>
      <ScrollView>
        <Row
          title="主题"
          value={THEMES.find(one => one.theme === theme)?.name ?? ''}
          palette={palette}
          onPress={() => setChoosing(true)}
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
      <Modal
        transparent
        visible={choosing}
        animationType="fade"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setChoosing(false)}
      >
        <Sheet
          visible
          height={THEMES.length * CHOICE_HEIGHT}
          onClose={() => setChoosing(false)}
        >
          {THEMES.map(one => (
            <Pressable
              key={one.theme}
              style={styles.choice}
              onPress={() => {
                store.dispatch(changeTheme(one.theme));
                setChoosing(false);
              }}
            >
              <Text
                style={[
                  styles.title,
                  {
                    color:
                      one.theme === theme
                        ? palette.accentColor
                        : palette.primaryColor,
                  },
                ]}
              >
                {one.name}
              </Text>
            </Pressable>
          ))}
        </Sheet>
      </Modal>
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
  choice: {
    alignItems: 'center',
    height: CHOICE_HEIGHT,
    justifyContent: 'center',
  },
});
