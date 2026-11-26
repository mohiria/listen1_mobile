import React from 'react';
import { connect } from 'react-redux';
import { createStackNavigator, createAppContainer } from 'react-navigation';
import { StatusBar } from 'react-native';
import { fromRight } from 'react-navigation-transitions';
import styled, { withTheme, ThemeProvider } from 'styled-components';
import { animationSetting } from './src/config/settings';

import { blackTheme, whiteTheme } from './src/config/theme';

import { ThemeFlex } from './src/components';

/* screens */
import PlaylistTabs from './src/views/playlist/playlist-tabs.screen';
import Playlist from './src/views/playlist/playlist.screen';
import BackgroundPlayer from './src/views/player/background-player.screen';
import ModalPlayerContainer from './src/views/player/modal-player-container.screen';
import MiniPlayer from './src/views/player/mini-player.screen';

import Setting from './src/views/setting/setting.screen';
import CreatePlaylist from './src/views/myplaylist/create-playlist.screen';
import ReOrder from './src/views/myplaylist/reorder.screen';
import ModalLiteContainer from './src/views/player/modal-lite-container.screen';
import ImportPlaylist from './src/views/myplaylist/import-playlist.screen';
import About from './src/views/setting/about.screen';
import ImportLocal from './src/views/setting/import-local.screen';
import ExportLocal from './src/views/setting/export-local.screen';

const MainStack = createStackNavigator(
  {
    Home: {
      screen: PlaylistTabs,
    },
    Details: {
      screen: Playlist,
    },
    Setting: {
      screen: Setting,
    },
    CreatePlaylist: {
      screen: CreatePlaylist,
    },
    ImportPlaylist: {
      screen: ImportPlaylist,
    },
    ReOrder: {
      screen: ReOrder,
    },
    About: {
      screen: About,
    },
    ImportLocal: {
      screen: ImportLocal,
    },
    ExportLocal: {
      screen: ExportLocal,
    },
  },
  {
    initialRouteName: 'Home',
    // force navigation animation window from right to left, set animation time in milliseconds
    transitionConfig: () => fromRight(animationSetting.transitionTime),
    defaultNavigationOptions: {
      headerBackTitle: null,
      // safe area is applied once by the native SafeAreaView at app root
      headerForceInset: { top: 'never', bottom: 'never' },
    },
  }
);

const AppContainer = createAppContainer(MainStack);
const ThemeAppContainer = withTheme(({ theme }) => {
  return <AppContainer screenProps={{ theme }} />;
});

const ThemeStatusBar = withTheme(({ theme }) => {
  return (
    <StatusBar backgroundColor={theme.windowColor} barStyle={theme.barStyle} />
  );
});

const ThemeSafeArea = styled.SafeAreaView`
  flex: 1;
  background-color: ${(props) => props.theme.windowColor};
`;

class App extends React.Component {
  props: {
    settingState: Object,
  };
  render() {
    return (
      <ThemeProvider
        theme={
          this.props.settingState.theme === 'black' ? blackTheme : whiteTheme
        }
      >
        <ThemeSafeArea>
          <ThemeFlex>
            <ThemeAppContainer />
            <ThemeStatusBar />
            <BackgroundPlayer />
            <MiniPlayer />
            <ModalPlayerContainer />
            <ModalLiteContainer />
          </ThemeFlex>
        </ThemeSafeArea>
      </ThemeProvider>
    );
  }
}
const mapStateToProps = ({ settingState }) => ({
  settingState,
});

export default connect(mapStateToProps)(App);
