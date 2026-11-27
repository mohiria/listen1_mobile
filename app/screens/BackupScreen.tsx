import React from 'react';
import { Pressable, Share, StyleSheet, Text } from 'react-native';

import StateJsonConvert from '../../src/modules/state-json-convert';
import { store } from '../../src/redux/store';
import { showToast } from '../components/Toast';
import { usePalette } from '../theme';
import { useStore } from '../useStore';
import Screen from './Screen';

// Hands the play queue and my playlists to the share sheet as one text, from
// where it can be copied or saved to a file.
export default function BackupScreen() {
  const palette = usePalette();
  const playlists = useStore(state => state.myPlaylistState.playlists);

  const share = () => {
    const { playerState, myPlaylistState } = store.getState();
    const message = JSON.stringify(
      StateJsonConvert.getJson({ playerState, myPlaylistState })
    );

    Share.share({ message }).catch(() => showToast('备份失败'));
  };

  return (
    <Screen style={styles.screen}>
      <Text style={[styles.text, { color: palette.primaryColor }]}>
        {`将备份 ${playlists.length} 个我的歌单（含我喜欢的音乐）和当前播放队列。`}
      </Text>
      <Pressable
        style={[styles.button, { borderColor: palette.primaryColor }]}
        onPress={share}
      >
        <Text style={[styles.text, { color: palette.primaryColor }]}>
          导出备份
        </Text>
      </Pressable>
      <Text style={[styles.note, { color: palette.secondaryColor }]}>
        备份方法：点击「导出备份」后选择「拷贝」，把内容粘贴到备忘录等处保存；或选择「存储到文件」。恢复时把这段文本粘贴到恢复页面。
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', padding: 20 },
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
