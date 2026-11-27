import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { store } from '../src/redux/store';

export type Palette = {
  dark: boolean;
  // behind the content of a screen
  backgroundColor: string;
  // headers, the tab bar and other chrome
  windowColor: string;
  primaryColor: string;
  secondaryColor: string;
  thirdColor: string;
  // the provider names that are not selected
  inactiveColor: string;
  disableColor: string;
  borderColor: string;
  playingColor: string;
  accentColor: string;
};

const accentColor = '#D43C33';
const playingColor = '#ff4444';

const white: Palette = {
  dark: false,
  backgroundColor: '#ffffff',
  windowColor: '#f2f2f2',
  primaryColor: '#000000',
  secondaryColor: '#666666',
  thirdColor: '#afafaf',
  inactiveColor: '#393939',
  disableColor: '#cfcfcf',
  borderColor: '#eaeaea',
  playingColor,
  accentColor,
};

const black: Palette = {
  dark: true,
  backgroundColor: '#111111',
  windowColor: '#171717',
  primaryColor: '#7E7E7E',
  secondaryColor: '#5a5a5a',
  thirdColor: '#555555',
  inactiveColor: '#393939',
  disableColor: '#202020',
  borderColor: '#2b2b2b',
  playingColor,
  accentColor,
};

const themeName = () => store.getState().settingState.theme;

// The theme is the one chosen in the settings; 'system' there means the
// appearance of the device.
export function usePalette(): Palette {
  const chosen = useSyncExternalStore(store.subscribe, themeName);
  const system = useColorScheme();
  const dark = chosen === 'system' ? system === 'dark' : chosen === 'black';

  return dark ? black : white;
}

export function navigationTheme(palette: Palette): Theme {
  return {
    ...(palette.dark ? DarkTheme : DefaultTheme),
    colors: {
      primary: palette.accentColor,
      background: palette.backgroundColor,
      card: palette.windowColor,
      text: palette.primaryColor,
      border: palette.borderColor,
      notification: palette.accentColor,
    },
  };
}
