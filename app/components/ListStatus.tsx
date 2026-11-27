import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme';

// What a list shows in place of its rows: a failure the user can retry (pass
// onRetry), or a plain note that there is nothing to show.
export default function ListStatus({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const palette = usePalette();

  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: palette.secondaryColor }]}>
        {message}
      </Text>
      {onRetry !== undefined ? (
        <Pressable
          style={[styles.retry, { borderColor: palette.primaryColor }]}
          onPress={onRetry}
        >
          <Text style={[styles.text, { color: palette.primaryColor }]}>
            重试
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 30 },
  text: { fontSize: 14 },
  retry: {
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 15,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});
