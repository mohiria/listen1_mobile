import { defaultPlayerState } from '../redux/player.reducer';
import { defaultmyPlaylistState } from '../redux/myplaylist.reducer';
import type { MyPlaylistState, PlayerState } from '../redux/types';

function deepCopy<T>(oldObject: T): T {
  return JSON.parse(JSON.stringify(oldObject));
}

// The play queue and my playlists as one object, in the layout the other
// Listen 1 clients export and import. The subscriptions are an addition of
// this app, under a key the others do not read.
export default class StateJsonConvert {
  static getJson(state: {
    playerState: PlayerState;
    myPlaylistState: MyPlaylistState;
  }): object {
    const { playerState, myPlaylistState } = state;

    const nowPlayingTrackId =
      playerState.nowplayingTrack === null
        ? '-1'
        : playerState.nowplayingTrack.id;
    const result: { [key: string]: unknown } = {
      // TODO: support language setting
      language: 'zh_CN',
      'player-settings': {
        playmode: playerState.playMode,
        nowplaying_track_id: nowPlayingTrackId,
        volume: 100,
      },
      'current-playing': playerState.tracks,
      playerlists: myPlaylistState.playlists.map(i => i.id),
      subscriptions: myPlaylistState.subscriptions ?? [],
    };

    myPlaylistState.playlists.forEach(i => {
      const playlist = myPlaylistState.myPlaylistDict[i.id]!;
      // fix local image url, in a copy: the state is not to change
      const info = playlist.info.cover_img_url.startsWith('http')
        ? playlist.info
        : { ...playlist.info, cover_img_url: 'images/mycover.jpg' };

      result[i.id] = { ...playlist, info, is_mine: 1 };
    });

    return result;
  }
  // Throws when the data is not what getJson gives.
  static getState(data: unknown): {
    playerState: object;
    myPlaylistState: object;
  } {
    const jsonData = data as any;

    if (
      jsonData === null ||
      typeof jsonData !== 'object' ||
      !Array.isArray(jsonData.playerlists)
    ) {
      throw new Error('not exported data');
    }

    const playerState = deepCopy(defaultPlayerState);
    const myPlaylistState = deepCopy(defaultmyPlaylistState);

    playerState.tracks = Array.isArray(jsonData['current-playing'])
      ? jsonData['current-playing']
      : [];

    // the current song, when the data names one of the play queue; data
    // exported before 2.1 always says '-1'
    const nowPlayingTrackId =
      jsonData['player-settings'] &&
      jsonData['player-settings'].nowplaying_track_id;

    playerState.nowplayingTrack =
      playerState.tracks.find(track => track.id === nowPlayingTrackId) ?? null;

    jsonData.playerlists.forEach((playlistId: string) => {
      const playlist = jsonData[playlistId];

      if (
        !playlist ||
        !playlist.info ||
        typeof playlist.info.cover_img_url !== 'string' ||
        !Array.isArray(playlist.tracks)
      ) {
        throw new Error(`no playlist ${playlistId} in the exported data`);
      }

      // fix local image url
      if (!playlist.info.cover_img_url.startsWith('http')) {
        playlist.info.cover_img_url = './assets/images/logo.png';
      }
      if (playlistId !== 'myplaylist_favorite') {
        myPlaylistState.playlists.push(playlist.info);
      } else {
        // load favorite ids
        jsonData[playlistId].tracks.forEach((track: any) => {
          myPlaylistState.myFavoriteIds[track.id] = 1;
        });
      }
      myPlaylistState.myPlaylistDict[playlistId] = playlist;
    });

    // absent in data exported before subscriptions existed, and by the other
    // clients
    if (Array.isArray(jsonData.subscriptions)) {
      myPlaylistState.subscriptions = jsonData.subscriptions
        .filter(
          (info: any) =>
            info &&
            typeof info.id === 'string' &&
            typeof info.title === 'string'
        )
        .map((info: any) => ({
          id: info.id,
          title: info.title,
          cover_img_url:
            typeof info.cover_img_url === 'string' ? info.cover_img_url : '',
          source_url: info.source_url,
        }));
    }

    return { playerState, myPlaylistState };
  }
}
