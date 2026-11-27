import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PlayerSheets from './components/PlayerSheets';
import ToastHost from './components/Toast';
import Navigation from './Navigation';
import PlayerPage from './player/PlayerPage';

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

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorScreen>
        <Navigation />
        <PlayerPage />
        <PlayerSheets />
        <ToastHost />
      </ErrorScreen>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContent: { padding: 20, paddingTop: 80 },
  errorText: { color: '#c00', fontSize: 12 },
});
