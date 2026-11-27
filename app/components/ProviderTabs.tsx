import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const [visited, setVisited] = React.useState([selected]);

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

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tab: { alignItems: 'center', flex: 1, paddingTop: 12 },
  label: { fontSize: 15 },
  underline: { alignSelf: 'stretch', height: 3, marginTop: 9 },
  page: { flex: 1 },
  hidden: { display: 'none' },
});
