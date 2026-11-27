/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './app/App';
import { registerPlayback } from './app/player';
import { name as appName } from './app.json';

registerPlayback();
AppRegistry.registerComponent(appName, () => App);
