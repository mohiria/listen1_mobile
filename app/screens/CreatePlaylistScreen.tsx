import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { createMyPlaylist } from '../../src/redux/actions';
import { store } from '../../src/redux/store';
import type { MineStackParamList } from '../Navigation';
import { usePalette } from '../theme';
import Screen from './Screen';

const DEFAULT_TITLE = '新建歌单';

// Names a new, empty playlist of mine. It also leads to opening a playlist
// of a provider by its link.
export default function CreatePlaylistScreen({
  navigation,
}: NativeStackScreenProps<MineStackParamList, 'CreatePlaylist'>) {
  const palette = usePalette();
  const [title, setTitle] = useState(DEFAULT_TITLE);

  const create = () => {
    store.dispatch(
      createMyPlaylist({
        tracks: [],
        info: {
          id: '',
          title: title.trim() || DEFAULT_TITLE,
          // what the exported data of the app has always held here
          cover_img_url: './assets/images/logo.png',
        },
      })
    );
    navigation.goBack();
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
        value={title}
        onChangeText={setTitle}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={create}
      />
      <Pressable
        style={[styles.button, { borderColor: palette.primaryColor }]}
        onPress={create}
      >
        <Text style={[styles.text, { color: palette.primaryColor }]}>完成</Text>
      </Pressable>
      <Pressable
        style={styles.link}
        onPress={() => navigation.replace('ImportPlaylist')}
      >
        <Text style={[styles.text, { color: palette.secondaryColor }]}>
          {'导入外部歌单 >'}
        </Text>
      </Pressable>
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
  link: { marginTop: 30, padding: 10 },
});
