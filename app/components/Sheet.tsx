import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../theme';

const SLIDE_MS = 200;

// For something that slides in and out: `shown` runs from 0 to 1 as it comes
// in, and `mounted` stays true until it has gone all the way out.
export function useSlide(visible: boolean) {
  const shown = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) {
      return undefined;
    }

    const animation = Animated.timing(shown, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => animation.stop();
  }, [visible, mounted, shown]);

  return { mounted, shown };
}

// A panel that slides up from the bottom over a dimmed screen. Its children
// are mounted only while it is on screen. Mount it above what it covers.
export default function Sheet({
  visible,
  height,
  onClose,
  children,
}: {
  visible: boolean;
  // of the children; the bottom safe area is added to it
  height: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { mounted, shown } = useSlide(visible);

  if (!mounted) {
    return null;
  }

  const total = height + insets.bottom;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.dim,
          {
            opacity: shown.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.6],
            }),
          },
        ]}
      >
        <Pressable style={styles.fill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: palette.windowColor,
            height: total,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            transform: [
              {
                translateY: shown.interpolate({
                  inputRange: [0, 1],
                  outputRange: [total, 0],
                }),
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: '#000000' },
  fill: { flex: 1 },
  panel: { bottom: 0, left: 0, position: 'absolute', right: 0 },
});
