import React from 'react';
import {
  BottomTabBar,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { PlaylistInfo } from '../src/api/client';
import MiniPlayer from './components/MiniPlayer';
import AboutScreen from './screens/AboutScreen';
import CreatePlaylistScreen from './screens/CreatePlaylistScreen';
import ImportPlaylistScreen from './screens/ImportPlaylistScreen';
import MineScreen from './screens/MineScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import PlaylistsScreen from './screens/PlaylistsScreen';
import ReorderScreen from './screens/ReorderScreen';
import SearchScreen from './screens/SearchScreen';
import SettingsScreen from './screens/SettingsScreen';
import { navigationTheme, usePalette } from './theme';

export type PlaylistsStackParamList = {
  Playlists: undefined;
  Playlist: { info: PlaylistInfo };
};
export type SearchStackParamList = { Search: undefined };
export type MineStackParamList = {
  Mine: undefined;
  Playlist: { info: PlaylistInfo };
  CreatePlaylist: undefined;
  ImportPlaylist: undefined;
  // the playlist of mine whose songs are edited; without it, my playlists
  Reorder: { playlistId?: string };
};
export type SettingsStackParamList = { Settings: undefined; About: undefined };

const Tab = createBottomTabNavigator();
const PlaylistsStack = createNativeStackNavigator<PlaylistsStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const MineStack = createNativeStackNavigator<MineStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

// Each tab keeps its own stack, so the tab bar stays in place while screens
// are pushed inside a tab.
function useStackOptions(): NativeStackNavigationOptions {
  const palette = usePalette();

  return {
    headerTintColor: palette.accentColor,
    headerTitleStyle: { color: palette.primaryColor },
    statusBarStyle: palette.dark ? 'light' : 'dark',
  };
}

function PlaylistsTab() {
  return (
    <PlaylistsStack.Navigator screenOptions={useStackOptions()}>
      <PlaylistsStack.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{ title: '歌单' }}
      />
      <PlaylistsStack.Screen
        name="Playlist"
        component={PlaylistScreen}
        options={{ title: '' }}
      />
    </PlaylistsStack.Navigator>
  );
}

function SearchTab() {
  return (
    <SearchStack.Navigator screenOptions={useStackOptions()}>
      <SearchStack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: '搜索' }}
      />
    </SearchStack.Navigator>
  );
}

function MineTab() {
  return (
    <MineStack.Navigator screenOptions={useStackOptions()}>
      <MineStack.Screen
        name="Mine"
        component={MineScreen}
        options={{ title: '我的' }}
      />
      <MineStack.Screen
        name="Playlist"
        component={PlaylistScreen}
        options={{ title: '' }}
      />
      <MineStack.Screen
        name="CreatePlaylist"
        component={CreatePlaylistScreen}
        options={{ title: '新建歌单' }}
      />
      <MineStack.Screen
        name="ImportPlaylist"
        component={ImportPlaylistScreen}
        options={{ title: '导入歌单' }}
      />
      <MineStack.Screen
        name="Reorder"
        component={ReorderScreen}
        options={{ title: '编辑歌单' }}
      />
    </MineStack.Navigator>
  );
}

function SettingsTab() {
  return (
    <SettingsStack.Navigator screenOptions={useStackOptions()}>
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '设置' }}
      />
      <SettingsStack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: '关于' }}
      />
    </SettingsStack.Navigator>
  );
}

export default function Navigation() {
  const palette = usePalette();

  return (
    <NavigationContainer theme={navigationTheme(palette)}>
      <Tab.Navigator
        tabBar={props => (
          <>
            <MiniPlayer />
            <BottomTabBar {...props} />
          </>
        )}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.accentColor,
          tabBarInactiveTintColor: palette.secondaryColor,
          // text-only tabs until the app has an icon set
          tabBarIconStyle: { display: 'none' },
          tabBarLabelPosition: 'beside-icon',
          tabBarLabelStyle: { fontSize: 15, marginStart: 0 },
        }}
      >
        <Tab.Screen
          name="PlaylistsTab"
          component={PlaylistsTab}
          options={{ title: '歌单' }}
        />
        <Tab.Screen
          name="SearchTab"
          component={SearchTab}
          options={{ title: '搜索' }}
        />
        <Tab.Screen
          name="MineTab"
          component={MineTab}
          options={{ title: '我的' }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsTab}
          options={{ title: '设置' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
