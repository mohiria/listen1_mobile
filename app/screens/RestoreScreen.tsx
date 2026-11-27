import React, { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import StateJsonConvert from '../../src/modules/state-json-convert';
import { recoverData } from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import { showToast } from '../components/Toast';
import type { MineStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import Screen from './Screen';

// Takes the text of a backup, pasted in, and puts its play queue and
// playlists in the place of the ones the app has.
export default function RestoreScreen({
  navigation,
}: NativeStackScreenProps<MineStackParamList, 'Restore'>) {
  const palette = usePalette();
  // the text is long, so it is not kept in the state of the screen
  const text = useRef('');

  const restore = () => {
    let restored: ReturnType<typeof StateJsonConvert.getState>;

    try {
      restored = StateJsonConvert.getState(JSON.parse(text.current));
    } catch {
      showToast('粘贴的内容不是可用的备份文本');

      return;
    }
    Alert.alert('恢复备份', '将覆盖当前的播放队列和全部我的歌单。', [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复',
        style: 'destructive',
        onPress: () => {
          store.dispatch(recoverData(restored));
          showToast('恢复成功');
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <Screen style={styles.screen}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: palette.windowColor,
            color: palette.primaryColor,
          },
        ]}
        multiline
        placeholder="在此粘贴备份文本"
        placeholderTextColor={palette.thirdColor}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        onChangeText={value => {
          text.current = value;
        }}
      />
      <Pressable
        style={[styles.button, { borderColor: palette.primaryColor }]}
        onPress={restore}
      >
        <Text style={[styles.text, { color: palette.primaryColor }]}>恢复</Text>
      </Pressable>
      <Text style={[styles.note, { color: palette.secondaryColor }]}>
        恢复方法：拷贝之前备份的文本，长按上方输入框粘贴，再点击「恢复」。恢复将覆盖当前的播放队列和全部我的歌单，请谨慎操作。
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', padding: 20 },
  input: {
    alignSelf: 'stretch',
    borderRadius: 8,
    fontSize: 12,
    height: 160,
    padding: 10,
  },
  text: { fontSize: 14 },
  button: {
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 8,
  },
  note: { alignSelf: 'stretch', fontSize: 13, lineHeight: 20, marginTop: 24 },
});
