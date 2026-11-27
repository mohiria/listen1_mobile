import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Client from '../../src/api/client';
import { usePalette } from '../theme';

const providers = Client.getPlatformArray();

export const firstProviderId = providers[0].platformId;

// The row of provider names above a list; one of them is selected.
export default function ProviderTabs({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (platformId: string) => void;
}) {
  const palette = usePalette();

  return (
    <View style={[styles.row, { backgroundColor: palette.windowColor }]}>
      {providers.map(({ name, platformId }) => {
        const active = platformId === selected;

        return (
          <Pressable
            key={platformId}
            style={styles.tab}
            onPress={() => onSelect(platformId)}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? palette.primaryColor : palette.inactiveColor,
                  fontWeight: active ? '600' : '400',
                },
              ]}
            >
              {name}
            </Text>
            <View
              style={[
                styles.underline,
                active && { backgroundColor: palette.primaryColor },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// Keeps one child per provider alive once it has been shown, so that going
// back to a provider does not load its list again.
export function ProviderPages({
  selected,
  render,
}: {
  selected: string;
  render: (platformId: string, active: boolean) => React.ReactNode;
}) {
  const [visited, setVisited] = useState([selected]);

  if (!visited.includes(selected)) {
    setVisited([...visited, selected]);
  }

  return (
    <>
      {visited.map(platformId => (
        <View
          key={platformId}
          style={platformId === selected ? styles.page : styles.hidden}
        >
          {render(platformId, platformId === selected)}
        </View>
      ))}
    </>
  );
}

// One page per provider, side by side: swiping left or right changes the
// provider, and so does selecting it by name. A page is filled in the first
// time it is shown and kept afterwards.
export function ProviderPager({
  selected,
  onSelect,
  render,
}: {
  selected: string;
  onSelect: (platformId: string) => void;
  render: (platformId: string) => React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const pageWidth = useWindowDimensions().width - insets.left - insets.right;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [visited, setVisited] = useState([selected]);
  const index = providers.findIndex(
    provider => provider.platformId === selected
  );

  if (!visited.includes(selected)) {
    setVisited([...visited, selected]);
  }

  useEffect(() => {
    scroll.current?.scrollTo({ x: index * pageWidth, animated: true });
  }, [index, pageWidth]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={event => {
        const shown =
          providers[Math.round(event.nativeEvent.contentOffset.x / pageWidth)];

        if (shown !== undefined && shown.platformId !== selected) {
          onSelect(shown.platformId);
        }
      }}
    >
      {providers.map(({ platformId }) => (
        <View key={platformId} style={{ width: pageWidth }}>
          {visited.includes(platformId) ? render(platformId) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tab: { alignItems: 'center', flex: 1, paddingTop: 12 },
  label: { fontSize: 15 },
  underline: { alignSelf: 'stretch', height: 3, marginTop: 9 },
  page: { flex: 1 },
  hidden: { display: 'none' },
});
