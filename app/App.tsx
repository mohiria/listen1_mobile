import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { commit } from './buildInfo';
import SelfCheck from './SelfCheck';

type ErrorScreenState = { error: Error | null };

// TEMP(phase 1): shows JS errors on screen instead of crashing. Kept until the
// new app replaces the old one.
class ErrorScreen extends React.Component<
  { children: React.ReactNode },
  ErrorScreenState
> {
  state: ErrorScreenState = { error: null };

  componentDidMount() {
    const { ErrorUtils } = globalThis as {
      ErrorUtils?: { setGlobalHandler(handler: (error: Error) => void): void };
    };

    ErrorUtils?.setGlobalHandler((error) => this.setState({ error }));
  }

  componentDidCatch(error: Error) {
    this.setState({ error });
  }

  render() {
    const { error } = this.state;

    if (error !== null) {
      return (
        <ScrollView contentContainerStyle={styles.errorContent}>
          <Text selectable style={styles.errorText}>
            {`JS ERROR\n${String(error.message)}\n\n${String(error.stack)}`}
          </Text>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

function Shell() {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#fff' : '#000';

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: dark ? '#000' : '#fff',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Text style={[styles.title, { color }]}>Listen 1</Text>
      <Text style={[styles.detail, { color }]}>{`构建 ${commit}`}</Text>
      <Text style={[styles.detail, { color }]}>
        {`安全区 上 ${insets.top} 下 ${insets.bottom}`}
      </Text>
      <SelfCheck color={color} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorScreen>
        <Shell />
      </ErrorScreen>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 12 },
  detail: { fontSize: 14, marginTop: 4 },
  errorContent: { padding: 20, paddingTop: 80 },
  errorText: { color: '#c00', fontSize: 12 },
});
