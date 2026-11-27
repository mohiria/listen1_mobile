import type { MyPlaylistState, PlayerState } from '../redux/store';

// The play queue and my playlists as one object, in the layout the other
// Listen 1 clients export and import.
export default class StateJsonConvert {
  static getJson(state: {
    playerState: PlayerState;
    myPlaylistState: MyPlaylistState;
  }): object;
  // Throws when the data is not what getJson gives.
  static getState(jsonData: unknown): {
    playerState: object;
    myPlaylistState: object;
  };
}
