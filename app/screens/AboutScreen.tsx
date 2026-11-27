import React from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { version } from '../../package.json';
import { commit } from '../buildInfo';
import { usePalette } from '../theme';
import Screen from './Screen';

// where the builds of this app are published
const RELEASES = 'https://github.com/mohiria/listen1_mobile/releases';

export default function AboutScreen() {
  const palette = usePalette();
  const color = palette.primaryColor;
  const border = { borderBottomColor: palette.borderColor };

  return (
    <Screen>
      <ScrollView>
        <View style={[styles.logoBox, border]}>
          <Image
            source={require('../../src/assets/images/logo.png')}
            style={styles.logo}
          />
        </View>
        <View style={[styles.row, border]}>
          <Text style={[styles.title, { color }]}>Listen 1 版本</Text>
          <Text selectable style={{ color }}>{`v${version} (${commit})`}</Text>
        </View>
        <View style={[styles.row, border]}>
          <Text style={[styles.title, { color }]}>开源协议</Text>
          <Text style={{ color }}>MIT</Text>
        </View>
        <Pressable
          style={[styles.row, border]}
          onPress={() => {
            Linking.openURL(RELEASES);
          }}
        >
          <Text style={[styles.title, { color }]}>检查更新</Text>
          <Text style={{ color: palette.secondaryColor }}>›</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 200,
    justifyContent: 'center',
  },
  logo: { height: 80, width: 80 },
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
