// TEMP(B-03): runs the provider layer and the state layer on the device, to
// show that they work in this app before any screen uses them. Goes away when
// the playlist and search screens arrive.
import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import Client from '../src/api/client';
import { changePlayMode } from '../src/redux/actions';
import { persistor, store } from '../src/redux/store';

const KEYWORD = '周杰伦';
const PLAY_MODES = ['顺序循环', '随机', '单曲循环'];

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// One line per step, so that a failure names the step it happened in.
async function checkProvider(
  provider: { name: string; platformId: string },
  report: (line: string) => void
) {
  const { name, platformId } = provider;

  try {
    const lists = await Client.showPlaylist(0, platformId);

    report(`${name} 歌单列表：${lists.result.length} 个`);
  } catch (error) {
    report(`${name} 歌单列表失败：${describe(error)}`);
  }

  try {
    const found = await Client.search(KEYWORD, 1, platformId);
    const restricted = found.result.filter(track => track.disabled);

    report(
      `${name} 搜索：${found.result.length} 首，受限 ${restricted.length} 首`
    );

    const track = restricted[0] || found.result[0];

    if (track !== undefined) {
      const result = await Client.resolveTrack(track);

      report(
        result.url !== '' && 'source' in result
          ? `${name} 取址「${track.title}」：${Client.getProviderName(
              result.source
            )}${result.switched ? '（换源）' : ''}`
          : `${name} 取址「${track.title}」：${
              'reason' in result && result.reason === 'network'
                ? '网络错误'
                : '所有音源都没有可播放的版本'
            }`
      );
    }
  } catch (error) {
    report(`${name} 搜索失败：${describe(error)}`);
  }
}

export default function SelfCheck({ color }: { color: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const playMode = useSyncExternalStore(
    store.subscribe,
    () => store.getState().playerState.playMode
  );

  const run = async () => {
    setRunning(true);
    setLines([]);
    const report = (line: string) => setLines(previous => [...previous, line]);

    await Promise.all(
      Client.getPlatformArray().map(provider =>
        checkProvider(provider, report)
      )
    );
    report('自检结束');
    setRunning(false);
  };

  const nextPlayMode = () => {
    store.dispatch(changePlayMode());
    persistor.flush();
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Pressable style={styles.button} onPress={nextPlayMode}>
        <Text style={styles.buttonText}>
          {`播放模式：${PLAY_MODES[playMode]}（点按切换）`}
        </Text>
      </Pressable>
      <Pressable style={styles.button} disabled={running} onPress={run}>
        <Text style={styles.buttonText}>
          {running ? '音源自检中…' : '音源自检'}
        </Text>
      </Pressable>
      {lines.map(line => (
        <Text key={line} selectable style={[styles.line, { color }]}>
          {line}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { alignSelf: 'stretch', flexGrow: 0, maxHeight: '60%' },
  content: { alignItems: 'center', padding: 16 },
  button: {
    backgroundColor: '#D43C33',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { color: '#fff', fontSize: 15 },
  line: { alignSelf: 'flex-start', fontSize: 13, marginTop: 6 },
});
