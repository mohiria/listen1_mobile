import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const SHOWN_MS = 3000;

let show: ((message: string) => void) | null = null;

// Shows a short message over the app. Does nothing while no ToastHost is
// mounted, which is the case when the app runs without its window.
export function showToast(message: string) {
  show?.(message);
}

// Mount once, above everything else.
export default function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    show = text => {
      clearTimeout(timer);
      setMessage(text);
      timer = setTimeout(() => setMessage(null), SHOWN_MS);
    };

    return () => {
      show = null;
      clearTimeout(timer);
    };
  }, []);

  if (message === null) {
    return null;
  }

  return (
    <View style={styles.layer}>
      <View style={styles.box}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    alignItems: 'center',
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
    justifyContent: 'center',
    padding: 40,
  },
  box: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: { color: '#ffffff', fontSize: 14, textAlign: 'center' },
});
