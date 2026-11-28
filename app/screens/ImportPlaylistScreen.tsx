import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import Client from '../../src/api/client';
import type { MineStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import Screen from './Screen';

// Opens the playlist of a provider that a pasted link points to. From there
// it can be saved as a playlist of mine.
export default function ImportPlaylistScreen({
  navigation,
}: NativeStackScreenProps<MineStackParamList, 'ImportPlaylist'>) {
  const palette = usePalette();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');

  const open = () => {
    const found = Client.parseUrl(text);

    if (found === null) {
      setNotice('无法解析信息');

      return;
    }
    setNotice('');
    // the title and the cover come with the songs
    navigation.replace('Playlist', {
      info: { id: found.id, title: '', cover_img_url: '' },
    });
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
        placeholder="请粘贴歌单分享中复制链接的内容"
        placeholderTextColor={palette.thirdColor}
        value={text}
        onChangeText={setText}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={open}
      />
      <Pressable
        style={[styles.button, { borderColor: palette.primaryColor }]}
        onPress={open}
      >
        <Text style={[styles.text, { color: palette.primaryColor }]}>打开</Text>
      </Pressable>
      <Text style={[styles.notice, { color: palette.secondaryColor }]}>
        {notice}
      </Text>
      <Text style={[styles.hint, { color: palette.thirdColor }]}>
        打开歌单后，可以「收藏」一份到我的歌单，也可以「订阅」它，跟随音源更新。
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', padding: 15 },
  input: {
    alignSelf: 'stretch',
    borderRadius: 8,
    fontSize: 14,
    height: 40,
    paddingHorizontal: 10,
  },
  button: {
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 8,
  },
  text: { fontSize: 14 },
  notice: { fontSize: 14, marginTop: 20 },
  hint: { fontSize: 12, marginTop: 10, textAlign: 'center' },
});
