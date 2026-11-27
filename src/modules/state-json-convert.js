import { defaultPlayerState } from '../redux/player.reducer';
import { defaultmyPlaylistState } from '../redux/myplaylist.reducer';

function deepCopy(oldObject) {
  return JSON.parse(JSON.stringify(oldObject));
}

export default class StateJsonConvert {
  static getJson(state) {
    const { playerState, myPlaylistState } = state;

    const nowPlayingTrackId =
      playerState.nowPlayingTrack === undefined
        ? '-1'
        : playerState.nowPlayingTrack.id;
    const result = {
      // TODO: support language setting
      language: 'zh_CN',
      'player-settings': {
        playmode: playerState.playMode,
        nowplaying_track_id: nowPlayingTrackId,
        volume: 100,
      },
      'current-playing': playerState.tracks,
      playerlists: myPlaylistState.playlists.map(i => i.id),
    };

    myPlaylistState.playlists.forEach(i => {
      const playlist = myPlaylistState.myPlaylistDict[i.id];
      // fix local image url, in a copy: the state is not to change
      const info = playlist.info.cover_img_url.startsWith('http')
        ? playlist.info
        : { ...playlist.info, cover_img_url: 'images/mycover.jpg' };

      result[i.id] = { ...playlist, info, is_mine: 1 };
    });

    return result;
  }
  // Throws when the data is not what getJson gives.
  static getState(jsonData) {
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

    jsonData.playerlists.forEach(playlistId => {
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
        jsonData[playlistId].tracks.forEach(track => {
          myPlaylistState.myFavoriteIds[track.id] = 1;
        });
      }
      myPlaylistState.myPlaylistDict[playlistId] = playlist;
    });

    return { playerState, myPlaylistState };
  }
}
